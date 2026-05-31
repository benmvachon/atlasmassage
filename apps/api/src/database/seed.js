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

async function seed() {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Wipe all user-related data so each dev start is a clean slate.
    // TRUNCATE ... CASCADE follows every FK that references users.
    // The roles lookup table is left intact (seeded by migration 001).
    await client.query('TRUNCATE users CASCADE');
    logger.info('seed_truncated');

    for (const u of USERS) {
      const passwordHash = await bcrypt.hash(u.password, BCRYPT_ROUNDS);

      const { rows: [user] } = await client.query(
        `INSERT INTO users (email, password_hash, first_name, last_name)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [u.email, passwordHash, u.firstName, u.lastName]
      );

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
