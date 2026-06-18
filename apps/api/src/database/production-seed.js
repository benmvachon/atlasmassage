/**
 * Production seed script.
 * Clears all user-related data, then inserts a default set of users.
 *
 * Only runs in production.
 */

import 'dotenv/config';
import bcrypt from 'bcrypt';
import { getPool, closePool } from './pool.js';
import { logger } from '../logging/logger.js';

if (process.env.NODE_ENV !== 'production') {
  logger.error('seed_refused', { reason: 'will not run in production' });
  process.exit(1);
}

const BCRYPT_ROUNDS = 10; // lower cost than production for dev speed

const TESTIMONIALS = [
  {
    authorName: 'Jamie T.',
    body: 'I\'ve been coming to Atlas for six months and my chronic neck pain has improved dramatically. Laura takes the time to understand what\'s going on and adjusts every session accordingly. I leave feeling like a different person.',
    rating: 5,
    isPublished: true,
    displayOrder: 1,
  },
  {
    authorName: 'Taylor K.',
    body: 'Ben helped me recover from a hamstring strain way faster than I expected. He really knows his stuff when it comes to sports massage and injury recovery. Back to running in half the time my doctor predicted.',
    rating: 5,
    isPublished: true,
    displayOrder: 2,
  },
  {
    authorName: 'Casey R.',
    body: 'The atmosphere here is calm and professional without feeling clinical. My therapist listened to every concern and the session was exactly what I needed after a stressful few weeks at work.',
    rating: 5,
    isPublished: true,
    displayOrder: 3,
  },
  {
    authorName: 'Jordan M.',
    body: 'I\'ve tried a handful of massage studios in the area and Atlas is by far the best. The booking process is easy, the space is beautiful, and the quality is consistently excellent.',
    rating: 5,
    isPublished: true,
    displayOrder: 4,
  },
];

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
  { name: 'Massage+', description: 'An extended session with additional time for deeper work, broader coverage, or a more leisurely pace — tailored to your needs.', durationMinutes: 90, priceCents: 21000 },
  { name: 'Massage++', description: 'Our most comprehensive session. Ideal for clients seeking full-body attention, intensive therapeutic work, or simply an indulgent experience.', durationMinutes: 120, priceCents: 26000 },
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
    email: 'benmvachon@gmail.com',
    password: 'changeme123!',
    firstName: 'Ben',
    lastName: 'Vachon',
    roles: ['owner', 'therapist'],
    therapist: {
      bio: 'Ben is a licensed massage therapist with dedicated experience in deep tissue, trigger point, and sports massage. Ben founded Atlas with a commitment to developing a clinical practice that helps clients move and feel better longterm.',
      specialties: ['deep tissue', 'sports massage'],
      isAcceptingClients: true,
      headshotUrl: '/headshots/generic-male-headshot.png',
    },
  },
  {
    email: 'cloudconnoisseur@gmail.com',
    password: 'changeme123!',
    firstName: 'Laura',
    lastName: 'Zhang',
    roles: ['owner', 'therapist'],
    therapist: {
      bio: 'Through careful assessment and the use of therapeutic massage techniques, including deep tissue work, myofascial techniques, stretching, and individualized treatment planning, Laura addresses the unique needs of each client.',
      specialties: ['lymphatic drainage', 'prenatal'],
      isAcceptingClients: true,
      headshotUrl: '/headshots/generic-female-headshot.png',
    },
  },
];

async function seed() {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Wipe all mutable data so each dev start is a clean slate.
    // TRUNCATE ... CASCADE follows all FKs. The roles lookup table is left
    // intact (seeded by migration 001).
    await client.query(
      'TRUNCATE users, services, massage_beds, business_hours, membership_plans, testimonials RESTART IDENTITY CASCADE'
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

    for (const t of TESTIMONIALS) {
      await client.query(
        `INSERT INTO testimonials (author_name, body, rating, is_published, display_order)
         VALUES ($1, $2, $3, $4, $5)`,
        [t.authorName, t.body, t.rating, t.isPublished, t.displayOrder]
      );
    }
    logger.info('seed_testimonials', { count: TESTIMONIALS.length });

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
          `INSERT INTO therapists (user_id, bio, specialties, is_accepting_clients, headshot_url)
           VALUES ($1, $2, $3, $4, $5)`,
          [user.id, u.therapist.bio, u.therapist.specialties, u.therapist.isAcceptingClients, u.therapist.headshotUrl ?? null]
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

    await client.query('COMMIT');
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
