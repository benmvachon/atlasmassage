/**
 * Development seed script.
 * Clears all user-related data, then inserts a known set of sample users.
 * Runs automatically as part of `npm run dev`.
 *
 * Refuses to run in production.
 */

import 'dotenv/config';
import bcrypt from 'bcrypt';
import { getPool, closePool } from './pool.js';
import { logger } from '../logging/logger.js';

if (process.env.NODE_ENV === 'production') {
  logger.error('seed_refused', { reason: 'will not run in production' });
  process.exit(1);
}

const BCRYPT_ROUNDS = 10; // lower cost than production for dev speed

const MEMBERSHIP_PLANS = [
  {
    name: 'Essentials',
    description: 'One 60-minute massage per month. Perfect for maintaining wellness.',
    priceMonthlyCents: 12000,
    creditsPerMonth: 1,
    stripePriceId: 'price_1TdbGCQec936INktczEfSHnr', // this will likely require modification when prices are updated
  },
  {
    name: 'Wellness',
    description: 'Two 60-minute massages per month. Our most popular plan.',
    priceMonthlyCents: 20000,
    creditsPerMonth: 2,
    stripePriceId: 'price_1TdbGCQec936INktHP8B88JA', // this will likely require modification when prices are updated
  },
  {
    name: 'Unlimited',
    description: 'Four 60-minute massages per month. Maximum recovery and relaxation.',
    priceMonthlyCents: 36000,
    creditsPerMonth: 4,
    stripePriceId: 'price_1TdbGCQec936INktwkkXuy8M', // this will likely require modification when prices are updated
  },
];

const SERVICES = [
  { name: 'Massage', description: 'A comprehensive massage inclusive of all services offered by the therapist and individualized to your needs.', durationMinutes: 60, priceCents: 15000 },
];

const MASSAGE_BEDS = [
  { name: 'Table 1' },
  { name: 'Table 2' },
  { name: 'Table 3' },
];

// day_of_week: 0=Sunday, 6=Saturday
const BUSINESS_HOURS = [
  { dayOfWeek: 0, openTime: '10:00', closeTime: '17:00', isClosed: true },
  { dayOfWeek: 1, openTime: '09:00', closeTime: '19:00', isClosed: false },
  { dayOfWeek: 2, openTime: '09:00', closeTime: '19:00', isClosed: false },
  { dayOfWeek: 3, openTime: '09:00', closeTime: '19:00', isClosed: false },
  { dayOfWeek: 4, openTime: '09:00', closeTime: '19:00', isClosed: false },
  { dayOfWeek: 5, openTime: '09:00', closeTime: '19:00', isClosed: false },
  { dayOfWeek: 6, openTime: '10:00', closeTime: '17:00', isClosed: false },
];

const USERS = [
  {
    email: 'owner@atlasmassage.com',
    password: 'atlas-owner-2024',
    firstName: 'Alex',
    lastName: 'Rivera',
    roles: ['owner', 'therapist'],
    therapist: {
      bio: 'Practice owner and senior therapist.',
      specialties: ['deep tissue', 'sports massage'],
      isAcceptingClients: true,
    },
  },
  {
    email: 'sarah@atlasmassage.com',
    password: 'atlas-therapist-2024',
    firstName: 'Sarah',
    lastName: 'Chen',
    roles: ['therapist'],
    therapist: {
      bio: 'Specializing in relaxation and prenatal massage.',
      specialties: ['swedish', 'prenatal'],
      isAcceptingClients: true,
    },
  },
  {
    email: 'marcus@atlasmassage.com',
    password: 'atlas-therapist-2024',
    firstName: 'Marcus',
    lastName: 'Johnson',
    roles: ['therapist'],
    therapist: {
      bio: 'Sports massage and injury recovery specialist.',
      specialties: ['sports massage', 'trigger point'],
      isAcceptingClients: true,
    },
  },
  {
    email: 'client1@example.com',
    password: 'atlas-client-2024',
    firstName: 'Jamie',
    lastName: 'Torres',
    roles: ['client'],
    client: { notes: 'Prefers morning appointments.' },
  },
  {
    email: 'client2@example.com',
    password: 'atlas-client-2024',
    firstName: 'Morgan',
    lastName: 'Lee',
    roles: ['client'],
    client: {},
  },
  {
    email: 'client3@example.com',
    password: 'atlas-client-2024',
    firstName: 'Taylor',
    lastName: 'Kim',
    roles: ['client'],
    client: { notes: 'Neck and shoulder tension.' },
  },
];

// day_of_week: 0=Sunday, 6=Saturday. Days omitted = not working.
const THERAPIST_SCHEDULES = {
  'owner@atlasmassage.com': {
    1: { startTime: '09:00', endTime: '18:00' },
    2: { startTime: '09:00', endTime: '18:00' },
    3: { startTime: '09:00', endTime: '18:00' },
    4: { startTime: '09:00', endTime: '18:00' },
    5: { startTime: '09:00', endTime: '18:00' },
    6: { startTime: '10:00', endTime: '16:00' },
  },
  'sarah@atlasmassage.com': {
    1: { startTime: '09:00', endTime: '17:00' },
    2: { startTime: '09:00', endTime: '17:00' },
    4: { startTime: '09:00', endTime: '17:00' },
    5: { startTime: '09:00', endTime: '17:00' },
    6: { startTime: '10:00', endTime: '15:00' },
  },
  'marcus@atlasmassage.com': {
    2: { startTime: '10:00', endTime: '19:00' },
    3: { startTime: '10:00', endTime: '19:00' },
    4: { startTime: '10:00', endTime: '19:00' },
    5: { startTime: '10:00', endTime: '19:00' },
    6: { startTime: '11:00', endTime: '16:00' },
  },
};

async function seed() {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Wipe all mutable data so each dev start is a clean slate.
    // TRUNCATE ... CASCADE follows all FKs. The roles lookup table is left
    // intact (seeded by migration 001).
    await client.query(
      'TRUNCATE users, services, massage_beds, business_hours, membership_plans RESTART IDENTITY CASCADE'
    );
    logger.info('seed_truncated');

    for (const p of MEMBERSHIP_PLANS) {
      await client.query(
        `INSERT INTO membership_plans (name, description, price_monthly_cents, credits_per_month, stripe_price_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [p.name, p.description, p.priceMonthlyCents, p.creditsPerMonth, p.stripePriceId]
      );
    }
    logger.info('seed_membership_plans', { count: MEMBERSHIP_PLANS.length });

    for (const s of SERVICES) {
      await client.query(
        `INSERT INTO services (name, description, duration_minutes, price_cents)
         VALUES ($1, $2, $3, $4)`,
        [s.name, s.description, s.durationMinutes, s.priceCents]
      );
    }
    logger.info('seed_services', { count: SERVICES.length });

    for (const b of MASSAGE_BEDS) {
      await client.query('INSERT INTO massage_beds (name) VALUES ($1)', [b.name]);
    }
    logger.info('seed_massage_beds', { count: MASSAGE_BEDS.length });

    for (const h of BUSINESS_HOURS) {
      await client.query(
        `INSERT INTO business_hours (day_of_week, open_time, close_time, is_closed)
         VALUES ($1, $2, $3, $4)`,
        [h.dayOfWeek, h.openTime, h.closeTime, h.isClosed]
      );
    }
    logger.info('seed_business_hours', { count: BUSINESS_HOURS.length });

    const seededUserIds = {};

    for (const u of USERS) {
      const passwordHash = await bcrypt.hash(u.password, BCRYPT_ROUNDS);

      const { rows: [user] } = await client.query(
        `INSERT INTO users (email, password_hash, first_name, last_name)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [u.email, passwordHash, u.firstName, u.lastName]
      );

      seededUserIds[u.email] = user.id;

      for (const role of u.roles) {
        await client.query(
          `INSERT INTO user_roles (user_id, role_id)
           SELECT $1, id FROM roles WHERE name = $2`,
          [user.id, role]
        );
      }

      if (u.therapist) {
        await client.query(
          `INSERT INTO therapists (user_id, bio, specialties, is_accepting_clients)
           VALUES ($1, $2, $3, $4)`,
          [user.id, u.therapist.bio, u.therapist.specialties, u.therapist.isAcceptingClients]
        );
      }

      if (u.client) {
        await client.query(
          `INSERT INTO clients (user_id, notes) VALUES ($1, $2)`,
          [user.id, u.client.notes ?? null]
        );
      }

      logger.info('seed_insert', { email: u.email, roles: u.roles });
    }

    // Seed availability for the next 35 days based on each therapist's schedule
    let availCount = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const [email, schedule] of Object.entries(THERAPIST_SCHEDULES)) {
      const userId = seededUserIds[email];
      if (!userId) continue;
      for (let i = 0; i < 35; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() + i);
        const dow = d.getDay();
        if (!schedule[dow]) continue;
        const year = d.getFullYear();
        const mo = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const { startTime, endTime } = schedule[dow];
        await client.query(
          `INSERT INTO availability (therapist_id, specific_date, start_time, end_time)
           VALUES ($1, $2, $3, $4)`,
          [userId, `${year}-${mo}-${day}`, startTime, endTime]
        );
        availCount++;
      }
    }
    logger.info('seed_availability', { count: availCount });

    // Seed a few upcoming appointments to exercise buffer-checking logic
    const { rows: [swedish] } = await client.query(
      "SELECT id FROM services WHERE name = 'Massage'"
    );
    const clientUserId = seededUserIds['client1@example.com'];

    // Find next Tuesday and Wednesday (skip to next week if today is that day)
    function nextWeekday(fromDate, targetDow) {
      const d = new Date(fromDate);
      const diff = (targetDow - d.getDay() + 7) % 7 || 7;
      d.setDate(d.getDate() + diff);
      const y = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, '0');
      const dy = String(d.getDate()).padStart(2, '0');
      return `${y}-${mo}-${dy}`;
    }
    const nextTuesday = nextWeekday(today, 2);
    const nextWednesday = nextWeekday(today, 3);

    // Sarah has a 10:00 appointment next Tuesday (blocks 09:06–10:59 for her)
    await client.query(
      `INSERT INTO appointments
         (client_id, therapist_id, service_id, scheduled_at, duration_minutes, status)
       VALUES ($1, $2, $3, $4, 60, 'confirmed')`,
      [clientUserId, seededUserIds['sarah@atlasmassage.com'], swedish.id, `${nextTuesday}T10:00:00Z`]
    );
    // Marcus has a 13:00 appointment next Wednesday
    await client.query(
      `INSERT INTO appointments
         (client_id, therapist_id, service_id, scheduled_at, duration_minutes, status)
       VALUES ($1, $2, $3, $4, 60, 'confirmed')`,
      [clientUserId, seededUserIds['marcus@atlasmassage.com'], swedish.id, `${nextWednesday}T13:00:00Z`]
    );
    logger.info('seed_appointments', { count: 2 });

    await client.query('COMMIT');
    logger.info('seed_complete', { users: USERS.length });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('seed_failed', { message: err.message });
    throw err;
  } finally {
    client.release();
    await closePool();
  }
}

seed().catch((err) => {
  const msg = err.errors ? err.errors.map(e => e.message).join('; ') : err.message;
  process.stderr.write(`Seed failed: ${msg}\n`);
  process.exit(1);
});
