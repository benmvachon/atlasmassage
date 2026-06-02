/**
 * Unit tests for all repository classes using a mocked pg pool.
 * These tests verify SQL is called with the right parameters and
 * that return values are mapped correctly.
 */

import { jest } from '@jest/globals';

import { UserRepository } from '../repositories/userRepository.js';
import { RefreshTokenRepository } from '../repositories/refreshTokenRepository.js';
import { NotificationRepository } from '../repositories/notificationRepository.js';
import { AvailabilityRepository } from '../repositories/availabilityRepository.js';
import { BusinessRepository } from '../repositories/businessRepository.js';
import { MembershipRepository } from '../repositories/membershipRepository.js';
import { PaymentRepository } from '../repositories/paymentRepository.js';
import { TherapistRepository } from '../repositories/therapistRepository.js';
import { TransferRequestRepository } from '../repositories/transferRequestRepository.js';
import { AppointmentRepository } from '../repositories/appointmentRepository.js';

// ── Pool helpers ──────────────────────────────────────────────────────────────

function makePool(rows = []) {
  return {
    query: jest.fn().mockResolvedValue({ rows }),
    connect: jest.fn(),
  };
}

function makeTxPool(queryResults = []) {
  let callIndex = 0;
  const mockClient = {
    query: jest.fn().mockImplementation(() => {
      const result = queryResults[callIndex] ?? { rows: [] };
      callIndex++;
      return Promise.resolve(result);
    }),
    release: jest.fn(),
  };
  return {
    pool: { query: jest.fn().mockResolvedValue({ rows: [] }), connect: jest.fn().mockResolvedValue(mockClient) },
    client: mockClient,
  };
}

const USER_ROW = {
  id: 'user-uuid',
  email: 'test@example.com',
  first_name: 'Jane',
  last_name: 'Doe',
  phone: null,
  is_active: true,
  password_hash: '$2b$12$hash',
  password_reset_token_hash: null,
  password_reset_expires_at: null,
  created_at: new Date(),
  updated_at: new Date(),
  roles: ['client'],
};

// ── UserRepository ────────────────────────────────────────────────────────────

describe('UserRepository', () => {
  describe('findByEmail', () => {
    it('returns the user when found', async () => {
      const pool = makePool([USER_ROW]);
      const repo = new UserRepository(pool);
      const result = await repo.findByEmail('test@example.com');
      expect(result).toEqual(USER_ROW);
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['test@example.com']);
    });

    it('returns null when not found', async () => {
      const pool = makePool([]);
      const result = await new UserRepository(pool).findByEmail('nobody@example.com');
      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('returns the user when found', async () => {
      const pool = makePool([USER_ROW]);
      const result = await new UserRepository(pool).findById('user-uuid');
      expect(result.id).toBe('user-uuid');
    });

    it('returns null when not found', async () => {
      const pool = makePool([]);
      expect(await new UserRepository(pool).findById('missing')).toBeNull();
    });
  });

  describe('findByResetToken', () => {
    it('returns user with matching reset token', async () => {
      const pool = makePool([USER_ROW]);
      const result = await new UserRepository(pool).findByResetToken('hash123');
      expect(result).toEqual(USER_ROW);
    });
  });

  describe('create', () => {
    it('inserts user, assigns client role, and returns with roles', async () => {
      const { pool, client } = makeTxPool([
        undefined,                // BEGIN
        { rows: [USER_ROW] },    // INSERT users
        { rows: [] },            // INSERT user_roles
        { rows: [] },            // UPDATE appointments (guest link)
      ]);
      const repo = new UserRepository(pool);
      const result = await repo.create({
        email: 'test@example.com',
        passwordHash: '$2b$12$hash',
        firstName: 'Jane',
        lastName: 'Doe',
        phone: null,
      });
      expect(result.roles).toEqual(['client']);
      expect(client.query).toHaveBeenCalledWith('COMMIT');
    });

    it('rolls back on error', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce() // BEGIN
          .mockRejectedValueOnce(new Error('Unique violation')),
        release: jest.fn(),
      };
      const pool = { query: jest.fn(), connect: jest.fn().mockResolvedValue(mockClient) };
      await expect(new UserRepository(pool).create({
        email: 'dup@example.com', passwordHash: 'h', firstName: 'A', lastName: 'B',
      })).rejects.toThrow('Unique violation');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('update', () => {
    it('updates only provided fields', async () => {
      const pool = makePool([USER_ROW]);
      await new UserRepository(pool).update('user-uuid', { firstName: 'Jay' });
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('first_name'),
        expect.arrayContaining(['Jay', 'user-uuid'])
      );
    });
  });

  describe('updatePasswordHash', () => {
    it('calls UPDATE with the new hash', async () => {
      const pool = makePool([]);
      await new UserRepository(pool).updatePasswordHash('user-uuid', '$2b$12$new');
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['$2b$12$new', 'user-uuid']);
    });
  });

  describe('setResetToken', () => {
    it('updates the reset token columns', async () => {
      const pool = makePool([]);
      const expiresAt = new Date();
      await new UserRepository(pool).setResetToken('user-uuid', 'hash', expiresAt);
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['hash', expiresAt, 'user-uuid']);
    });
  });

  describe('clearResetToken', () => {
    it('nulls out the reset token columns', async () => {
      const pool = makePool([]);
      await new UserRepository(pool).clearResetToken('user-uuid');
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('NULL'), ['user-uuid']);
    });
  });

  describe('updateStripeCustomerId', () => {
    it('updates stripe_customer_id column', async () => {
      const pool = makePool([]);
      await new UserRepository(pool).updateStripeCustomerId('user-uuid', 'cus_123');
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['cus_123', 'user-uuid']);
    });
  });
});

// ── RefreshTokenRepository ────────────────────────────────────────────────────

describe('RefreshTokenRepository', () => {
  const TOKEN_ROW = { id: 'rt-uuid', user_id: 'user-uuid', token_hash: 'h', expires_at: new Date(), revoked_at: null };

  describe('create', () => {
    it('inserts a refresh token row', async () => {
      const pool = makePool([TOKEN_ROW]);
      const result = await new RefreshTokenRepository(pool).create({
        userId: 'user-uuid',
        tokenHash: 'h',
        expiresAt: new Date(),
      });
      expect(result.id).toBe('rt-uuid');
    });
  });

  describe('findByHash', () => {
    it('returns the token when found', async () => {
      const pool = makePool([TOKEN_ROW]);
      expect(await new RefreshTokenRepository(pool).findByHash('h')).toEqual(TOKEN_ROW);
    });

    it('returns null when not found', async () => {
      const pool = makePool([]);
      expect(await new RefreshTokenRepository(pool).findByHash('miss')).toBeNull();
    });
  });

  describe('revoke', () => {
    it('calls UPDATE SET revoked_at', async () => {
      const pool = makePool([]);
      await new RefreshTokenRepository(pool).revoke('rt-uuid');
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('revoked_at'), ['rt-uuid']);
    });
  });

  describe('revokeAllForUser', () => {
    it('calls UPDATE for all unrevoked tokens', async () => {
      const pool = makePool([]);
      await new RefreshTokenRepository(pool).revokeAllForUser('user-uuid');
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('revoked_at'), ['user-uuid']);
    });
  });
});

// ── NotificationRepository ────────────────────────────────────────────────────

describe('NotificationRepository', () => {
  const PREFS = { user_id: 'u1', email_booking_confirm: true, email_appointment_remind: true };
  const NOTIF = { id: 'n1', user_id: 'u1', channel: 'email', status: 'sent' };
  const APPT  = { id: 'a1', client_email: 'c@test.com', therapist_email: 't@test.com' };

  describe('getOrCreatePreferences — existing', () => {
    it('returns existing prefs without inserting', async () => {
      const pool = makePool([PREFS]);
      const result = await new NotificationRepository(pool).getOrCreatePreferences('u1');
      expect(result).toEqual(PREFS);
      expect(pool.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('getOrCreatePreferences — new', () => {
    it('inserts default prefs when none exist', async () => {
      const pool = { query: jest.fn()
        .mockResolvedValueOnce({ rows: [] })       // SELECT → empty
        .mockResolvedValueOnce({ rows: [PREFS] })  // INSERT RETURNING
      };
      const result = await new NotificationRepository(pool).getOrCreatePreferences('u1');
      expect(result).toEqual(PREFS);
      expect(pool.query).toHaveBeenCalledTimes(2);
    });
  });

  describe('updatePreferences', () => {
    it('upserts preference values', async () => {
      const pool = makePool([PREFS]);
      const result = await new NotificationRepository(pool).updatePreferences('u1', {
        emailAppointmentRemind: true,
        emailBookingConfirm: false,
        smsAppointmentRemind: false,
        smsBookingConfirm: false,
      });
      expect(result).toEqual(PREFS);
    });
  });

  describe('logNotification', () => {
    it('inserts a notification log row with sent_at when status is sent', async () => {
      const pool = makePool([NOTIF]);
      const result = await new NotificationRepository(pool).logNotification({
        userId: 'u1', channel: 'email', subject: 'Hi', body: 'body', status: 'sent',
      });
      expect(result).toEqual(NOTIF);
      const [, params] = pool.query.mock.calls[0];
      expect(params[4]).toBe('sent');
      expect(params[5]).toBeInstanceOf(Date); // sent_at
    });

    it('passes null for sent_at when status is failed', async () => {
      const pool = makePool([NOTIF]);
      await new NotificationRepository(pool).logNotification({
        userId: 'u1', channel: 'email', subject: 'Hi', body: 'body', status: 'failed',
      });
      const [, params] = pool.query.mock.calls[0];
      expect(params[5]).toBeNull();
    });
  });

  describe('findByUser', () => {
    it('returns notifications for the user', async () => {
      const pool = makePool([NOTIF]);
      const result = await new NotificationRepository(pool).findByUser('u1');
      expect(result).toEqual([NOTIF]);
    });
  });

  describe('findAppointmentWithDetails', () => {
    it('returns the appointment when found', async () => {
      const pool = makePool([APPT]);
      expect(await new NotificationRepository(pool).findAppointmentWithDetails('a1')).toEqual(APPT);
    });

    it('returns null when not found', async () => {
      expect(await new NotificationRepository(makePool([])).findAppointmentWithDetails('missing')).toBeNull();
    });
  });

  describe('findAppointmentsNeedingReminders / markReminded', () => {
    it('returns rows matching the reminder window', async () => {
      const pool = makePool([APPT]);
      const result = await new NotificationRepository(pool).findAppointmentsNeedingReminders();
      expect(result).toEqual([APPT]);
    });

    it('markReminded updates reminded_at', async () => {
      const pool = makePool([]);
      await new NotificationRepository(pool).markReminded('a1');
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('reminded_at'), ['a1']);
    });
  });

  describe('findAppointmentsNeedingFeedback / markFeedbackSent', () => {
    it('returns rows matching the feedback window', async () => {
      const pool = makePool([APPT]);
      expect(await new NotificationRepository(pool).findAppointmentsNeedingFeedback()).toEqual([APPT]);
    });

    it('markFeedbackSent updates feedback_sent_at', async () => {
      const pool = makePool([]);
      await new NotificationRepository(pool).markFeedbackSent('a1');
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('feedback_sent_at'), ['a1']);
    });
  });

  describe('findAppointmentsNeedingWeekFollowup / markFollowup1wSent', () => {
    it('returns rows matching the 1-week followup window', async () => {
      const pool = makePool([APPT]);
      expect(await new NotificationRepository(pool).findAppointmentsNeedingWeekFollowup()).toEqual([APPT]);
    });

    it('markFollowup1wSent updates followup_1w_sent_at', async () => {
      const pool = makePool([]);
      await new NotificationRepository(pool).markFollowup1wSent('a1');
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('followup_1w_sent_at'), ['a1']);
    });
  });

  describe('findAppointmentsNeedingMonthFollowup / markFollowup1mSent', () => {
    it('returns rows matching the 1-month followup window', async () => {
      const pool = makePool([APPT]);
      expect(await new NotificationRepository(pool).findAppointmentsNeedingMonthFollowup()).toEqual([APPT]);
    });

    it('markFollowup1mSent updates followup_1m_sent_at', async () => {
      const pool = makePool([]);
      await new NotificationRepository(pool).markFollowup1mSent('a1');
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('followup_1m_sent_at'), ['a1']);
    });
  });
});

// ── AvailabilityRepository ────────────────────────────────────────────────────

describe('AvailabilityRepository', () => {
  const AVAIL_ROW = { id: 'av1', therapist_id: 't1', specific_date: '2030-01-10', start_time: '09:00', end_time: '17:00' };

  describe('getForDateRange', () => {
    it('queries without therapistId filter when none provided', async () => {
      const pool = makePool([AVAIL_ROW]);
      const result = await new AvailabilityRepository(pool).getForDateRange('2030-01-01', '2030-01-31');
      expect(result).toEqual([AVAIL_ROW]);
      expect(pool.query.mock.calls[0][1]).toHaveLength(2);
    });

    it('adds therapistId filter when provided', async () => {
      const pool = makePool([AVAIL_ROW]);
      await new AvailabilityRepository(pool).getForDateRange('2030-01-01', '2030-01-31', 't1');
      expect(pool.query.mock.calls[0][1]).toHaveLength(3);
    });
  });

  describe('getByTherapistAndMonth', () => {
    it('queries for the correct month range', async () => {
      const pool = makePool([AVAIL_ROW]);
      const result = await new AvailabilityRepository(pool).getByTherapistAndMonth('t1', 2030, 1);
      expect(result).toEqual([AVAIL_ROW]);
    });
  });

  describe('upsertMany', () => {
    it('returns empty array when entries is empty', async () => {
      const pool = makePool([]);
      const result = await new AvailabilityRepository(pool).upsertMany('t1', []);
      expect(result).toEqual([]);
      expect(pool.connect).not.toHaveBeenCalled();
    });

    it('inserts entries in a transaction', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce()  // BEGIN
          .mockResolvedValueOnce({ rows: [AVAIL_ROW] }) // INSERT
          .mockResolvedValueOnce(), // COMMIT
        release: jest.fn(),
      };
      const pool = { connect: jest.fn().mockResolvedValue(mockClient), query: jest.fn() };
      const result = await new AvailabilityRepository(pool).upsertMany('t1', [
        { date: '2030-01-10', startTime: '09:00', endTime: '17:00' },
      ]);
      expect(result).toEqual([AVAIL_ROW]);
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('rolls back on error', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce()  // BEGIN
          .mockRejectedValueOnce(new Error('conflict')),
        release: jest.fn(),
      };
      const pool = { connect: jest.fn().mockResolvedValue(mockClient) };
      await expect(new AvailabilityRepository(pool).upsertMany('t1', [
        { date: '2030-01-10', startTime: '09:00', endTime: '17:00' },
      ])).rejects.toThrow('conflict');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('deleteMany', () => {
    it('deletes the specified dates', async () => {
      const pool = makePool([{ specific_date: '2030-01-10' }]);
      const result = await new AvailabilityRepository(pool).deleteMany('t1', ['2030-01-10']);
      expect(result).toHaveLength(1);
    });
  });

  describe('updateLimits', () => {
    it('returns updated limits', async () => {
      const pool = makePool([{ user_id: 't1', daily_booking_limit: 3, weekly_booking_limit: 15 }]);
      const result = await new AvailabilityRepository(pool).updateLimits('t1', { dailyBookingLimit: 3, weeklyBookingLimit: 15 });
      expect(result.daily_booking_limit).toBe(3);
    });

    it('returns null when therapist not found', async () => {
      const pool = makePool([]);
      expect(await new AvailabilityRepository(pool).updateLimits('missing', { dailyBookingLimit: 3, weeklyBookingLimit: 15 })).toBeNull();
    });
  });
});

// ── BusinessRepository ────────────────────────────────────────────────────────

describe('BusinessRepository', () => {
  const BH_ROW = { id: 'bh1', day_of_week: 1, open_time: '09:00', close_time: '17:00', is_closed: false };
  const BED_ROW = { id: 'bed1', name: 'Bed 1', is_active: true };
  const SVC_ROW = { id: 'svc1', name: 'Swedish', price_cents: 8000, duration_minutes: 60, is_active: true };

  it('getBusinessHours returns all business hours', async () => {
    const pool = makePool([BH_ROW]);
    expect(await new BusinessRepository(pool).getBusinessHours()).toEqual([BH_ROW]);
  });

  it('upsertBusinessHours inserts or updates a day', async () => {
    const pool = makePool([BH_ROW]);
    const result = await new BusinessRepository(pool).upsertBusinessHours(1, { openTime: '09:00', closeTime: '17:00', isClosed: false });
    expect(result).toEqual(BH_ROW);
  });

  it('getMassageBeds returns all beds', async () => {
    const pool = makePool([BED_ROW]);
    expect(await new BusinessRepository(pool).getMassageBeds()).toEqual([BED_ROW]);
  });

  it('createMassageBed inserts a new bed', async () => {
    const pool = makePool([BED_ROW]);
    const result = await new BusinessRepository(pool).createMassageBed('Bed 1');
    expect(result.name).toBe('Bed 1');
  });

  it('updateMassageBed updates and returns the bed', async () => {
    const pool = makePool([BED_ROW]);
    const result = await new BusinessRepository(pool).updateMassageBed('bed1', { name: 'Bed A', isActive: true });
    expect(result).toEqual(BED_ROW);
  });

  it('updateMassageBed returns null when not found', async () => {
    expect(await new BusinessRepository(makePool([])).updateMassageBed('missing', { name: 'x', isActive: true })).toBeNull();
  });

  it('deleteMassageBed returns the deleted id', async () => {
    const pool = makePool([{ id: 'bed1' }]);
    expect(await new BusinessRepository(pool).deleteMassageBed('bed1')).toEqual({ id: 'bed1' });
  });

  it('getServices returns all services', async () => {
    const pool = makePool([SVC_ROW]);
    expect(await new BusinessRepository(pool).getServices()).toEqual([SVC_ROW]);
  });

  it('createService inserts and returns the service', async () => {
    const pool = makePool([SVC_ROW]);
    const result = await new BusinessRepository(pool).createService({ name: 'Swedish', durationMinutes: 60, priceCents: 8000 });
    expect(result.name).toBe('Swedish');
  });

  it('updateService updates and returns the service', async () => {
    const pool = makePool([SVC_ROW]);
    const result = await new BusinessRepository(pool).updateService('svc1', { name: 'Swedish', durationMinutes: 60, priceCents: 8000, isActive: true });
    expect(result).toEqual(SVC_ROW);
  });

  it('deactivateService returns the deactivated service', async () => {
    const pool = makePool([{ ...SVC_ROW, is_active: false }]);
    const result = await new BusinessRepository(pool).deactivateService('svc1');
    expect(result.is_active).toBe(false);
  });
});

// ── MembershipRepository ──────────────────────────────────────────────────────

describe('MembershipRepository', () => {
  const PLAN_ROW = { id: 'p1', name: 'Wellness', price_monthly_cents: 9900, credits_per_month: 2, is_active: true };
  const MEM_ROW  = { id: 'm1', client_id: 'u1', plan_id: 'p1', status: 'active', credits_remaining: 2 };

  it('findActivePlans returns active plans', async () => {
    const pool = makePool([PLAN_ROW]);
    expect(await new MembershipRepository(pool).findActivePlans()).toEqual([PLAN_ROW]);
  });

  it('findAllPlans returns all plans', async () => {
    const pool = makePool([PLAN_ROW]);
    expect(await new MembershipRepository(pool).findAllPlans()).toEqual([PLAN_ROW]);
  });

  it('findPlanById returns null when not found', async () => {
    expect(await new MembershipRepository(makePool([])).findPlanById('missing')).toBeNull();
  });

  it('createPlan inserts the plan', async () => {
    const pool = makePool([PLAN_ROW]);
    const result = await new MembershipRepository(pool).createPlan({
      name: 'Wellness', description: null, priceMonthlyCents: 9900, creditsPerMonth: 2,
    });
    expect(result).toEqual(PLAN_ROW);
  });

  it('updatePlan updates only provided fields', async () => {
    const pool = makePool([PLAN_ROW]);
    const result = await new MembershipRepository(pool).updatePlan('p1', { name: 'Premium', isActive: true });
    expect(result).toEqual(PLAN_ROW);
  });

  it('findMembershipsByClient returns memberships', async () => {
    const pool = makePool([MEM_ROW]);
    expect(await new MembershipRepository(pool).findMembershipsByClient('u1')).toEqual([MEM_ROW]);
  });
});

// ── PaymentRepository ─────────────────────────────────────────────────────────

describe('PaymentRepository', () => {
  const PM_ROW  = { id: 'pm1', client_id: 'u1', stripe_payment_method_id: 'pm_123', is_default: true };
  const PAY_ROW = { id: 'pay1', client_id: 'u1', amount_cents: 9000, status: 'pending' };

  it('findPaymentMethodsByClient returns methods', async () => {
    const pool = makePool([PM_ROW]);
    expect(await new PaymentRepository(pool).findPaymentMethodsByClient('u1')).toEqual([PM_ROW]);
  });

  it('findPaymentMethodById returns null when not found', async () => {
    expect(await new PaymentRepository(makePool([])).findPaymentMethodById('missing')).toBeNull();
  });

  it('createPaymentMethod inserts a payment method', async () => {
    const pool = makePool([PM_ROW]);
    const result = await new PaymentRepository(pool).createPaymentMethod({
      clientId: 'u1', stripePaymentMethodId: 'pm_123', brand: 'visa', last4: '4242',
      expiryMonth: 12, expiryYear: 2027, isDefault: true,
    });
    expect(result).toEqual(PM_ROW);
  });

  it('setDefault runs a transaction to update default status', async () => {
    const mockClient = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn(),
    };
    const pool = { connect: jest.fn().mockResolvedValue(mockClient), query: jest.fn() };
    await new PaymentRepository(pool).setDefault('pm1', 'u1');
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('deletePaymentMethod calls DELETE', async () => {
    const pool = makePool([]);
    await new PaymentRepository(pool).deletePaymentMethod('pm1');
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('DELETE'), ['pm1']);
  });

  it('createPayment inserts a payment record', async () => {
    const pool = makePool([PAY_ROW]);
    const result = await new PaymentRepository(pool).createPayment({
      clientId: 'u1', appointmentId: 'a1', amountCents: 9000, currency: 'usd',
      status: 'pending', stripePaymentIntentId: 'pi_123',
    });
    expect(result).toEqual(PAY_ROW);
  });
});

// ── TherapistRepository ───────────────────────────────────────────────────────

describe('TherapistRepository', () => {
  const T_ROW = { id: 't1', first_name: 'Alice', last_name: 'B', is_accepting_clients: true, roles: ['therapist'] };

  it('findAll returns all therapists', async () => {
    const pool = makePool([T_ROW]);
    expect(await new TherapistRepository(pool).findAll()).toEqual([T_ROW]);
  });

  it('findById returns null when not found', async () => {
    expect(await new TherapistRepository(makePool([])).findById('missing')).toBeNull();
  });

  it('create inserts user, role, and therapist profile in a transaction', async () => {
    const mockClient = {
      query: jest.fn()
        .mockResolvedValueOnce()                        // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 't1' }] }) // INSERT users
        .mockResolvedValueOnce({ rows: [] })             // INSERT user_roles
        .mockResolvedValueOnce({ rows: [] })             // INSERT therapists
        .mockResolvedValueOnce(),                        // COMMIT
      release: jest.fn(),
    };
    const pool = { connect: jest.fn().mockResolvedValue(mockClient) };
    const id = await new TherapistRepository(pool).create({
      email: 'alice@example.com', passwordHash: 'h', firstName: 'Alice', lastName: 'B',
    });
    expect(id).toBe('t1');
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
  });

  it('create rolls back on error', async () => {
    const mockClient = {
      query: jest.fn()
        .mockResolvedValueOnce()  // BEGIN
        .mockRejectedValueOnce(new Error('dup email')),
      release: jest.fn(),
    };
    const pool = { connect: jest.fn().mockResolvedValue(mockClient) };
    await expect(new TherapistRepository(pool).create({ email: 'x@x.com', passwordHash: 'h', firstName: 'A', lastName: 'B' }))
      .rejects.toThrow('dup email');
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
  });

  it('updateProfile updates bio and specialties', async () => {
    const pool = makePool([{ user_id: 't1' }]);
    const result = await new TherapistRepository(pool).updateProfile('t1', {
      bio: 'Expert', specialties: ['Swedish'], isAcceptingClients: true,
    });
    expect(result).toEqual({ user_id: 't1' });
  });

  it('deactivate marks user as inactive', async () => {
    const pool = makePool([{ id: 't1' }]);
    const result = await new TherapistRepository(pool).deactivate('t1');
    expect(result).toEqual({ id: 't1' });
  });

  it('deactivate returns null when not found', async () => {
    expect(await new TherapistRepository(makePool([])).deactivate('missing')).toBeNull();
  });
});

// ── TransferRequestRepository ─────────────────────────────────────────────────

describe('TransferRequestRepository', () => {
  const TR_ROW = { id: 'tr1', appointment_id: 'a1', from_therapist_id: 't1', status: 'pending', reason: 'conflict' };

  it('create inserts a transfer request', async () => {
    const pool = makePool([TR_ROW]);
    const result = await new TransferRequestRepository(pool).create('a1', 't1', 'conflict');
    expect(result).toEqual(TR_ROW);
  });

  it('findPendingByAppointment returns pending request', async () => {
    const pool = makePool([TR_ROW]);
    expect(await new TransferRequestRepository(pool).findPendingByAppointment('a1')).toEqual(TR_ROW);
  });

  it('findPendingByAppointment returns null when none pending', async () => {
    expect(await new TransferRequestRepository(makePool([])).findPendingByAppointment('a1')).toBeNull();
  });

  it('listPending returns all pending requests', async () => {
    const pool = makePool([TR_ROW]);
    expect(await new TransferRequestRepository(pool).listPending()).toEqual([TR_ROW]);
  });

  it('approve runs a transaction to update request and appointment', async () => {
    const mockClient = {
      query: jest.fn()
        .mockResolvedValueOnce()                        // BEGIN
        .mockResolvedValueOnce({ rows: [TR_ROW] })     // UPDATE transfer request
        .mockResolvedValueOnce({ rows: [] })             // UPDATE appointment
        .mockResolvedValueOnce(),                        // COMMIT
      release: jest.fn(),
    };
    const pool = { connect: jest.fn().mockResolvedValue(mockClient) };
    const result = await new TransferRequestRepository(pool).approve('tr1', 't2', 'owner-uuid');
    expect(result).toEqual(TR_ROW);
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
  });

  it('approve rolls back when request not found', async () => {
    const mockClient = {
      query: jest.fn()
        .mockResolvedValueOnce()                    // BEGIN
        .mockResolvedValueOnce({ rows: [] }),        // UPDATE → no rows = not found
      release: jest.fn(),
    };
    const pool = { connect: jest.fn().mockResolvedValue(mockClient) };
    await expect(new TransferRequestRepository(pool).approve('missing', 't2', 'owner'))
      .rejects.toThrow();
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
  });

  it('deny updates request status to denied', async () => {
    const pool = makePool([{ ...TR_ROW, status: 'denied' }]);
    const result = await new TransferRequestRepository(pool).deny('tr1', 'owner-uuid');
    expect(result.status).toBe('denied');
  });

  it('deny returns null when not found', async () => {
    expect(await new TransferRequestRepository(makePool([])).deny('missing', 'owner')).toBeNull();
  });
});

// ── AppointmentRepository ─────────────────────────────────────────────────────

describe('AppointmentRepository', () => {
  const APPT_ROW = {
    id: 'a1', client_id: 'u1', therapist_id: 't1', service_id: 's1',
    scheduled_at: '2030-06-15T10:00:00Z', status: 'pending',
  };

  it('getByDateRange returns appointments in range', async () => {
    const pool = makePool([APPT_ROW]);
    const result = await new AppointmentRepository(pool).getByDateRange('2030-06-15', '2030-06-15');
    expect(result).toEqual([APPT_ROW]);
  });

  it('getByDateRange adds excludeId clause when provided', async () => {
    const pool = makePool([]);
    await new AppointmentRepository(pool).getByDateRange('2030-06-15', '2030-06-15', { excludeId: 'a2' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('id !=');
    expect(params).toContain('a2');
  });

  it('findById returns the appointment', async () => {
    const pool = makePool([APPT_ROW]);
    expect(await new AppointmentRepository(pool).findById('a1')).toEqual(APPT_ROW);
  });

  it('findById returns null when not found', async () => {
    expect(await new AppointmentRepository(makePool([])).findById('missing')).toBeNull();
  });

  it('findServiceById returns the service', async () => {
    const svcRow = { id: 's1', name: 'Swedish', price_cents: 8000, duration_minutes: 60 };
    const pool = makePool([svcRow]);
    expect(await new AppointmentRepository(pool).findServiceById('s1')).toEqual(svcRow);
  });

  it('updateStatus returns the updated appointment', async () => {
    const pool = makePool([{ ...APPT_ROW, status: 'confirmed' }]);
    const result = await new AppointmentRepository(pool).updateStatus('a1', 'confirmed');
    expect(result.status).toBe('confirmed');
  });

  it('listForOwner returns appointments and therapists', async () => {
    const pool = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [APPT_ROW] })   // appointments query
        .mockResolvedValueOnce({ rows: [] }),            // therapists query
    };
    const result = await new AppointmentRepository(pool).listForOwner({ start: '2030-06-01', end: '2030-06-30' });
    expect(result.appointments).toEqual([APPT_ROW]);
    expect(result.therapists).toEqual([]);
  });

  it('listForOwner filters by therapistId when provided', async () => {
    const pool = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    };
    await new AppointmentRepository(pool).listForOwner({ start: '2030-06-01', end: '2030-06-30', therapistId: 't1' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('therapist_id');
    expect(params).toContain('t1');
  });
});
