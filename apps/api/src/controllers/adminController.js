import bcrypt from 'bcrypt';
import Stripe from 'stripe';
import { getPool } from '../database/pool.js';
import { config } from '../config/index.js';
import { AppointmentRepository } from '../repositories/appointmentRepository.js';
import { AuditLogRepository } from '../repositories/auditLogRepository.js';
import { BusinessRepository } from '../repositories/businessRepository.js';
import { TherapistRepository } from '../repositories/therapistRepository.js';
import { TransferRequestRepository } from '../repositories/transferRequestRepository.js';
import { UserRepository } from '../repositories/userRepository.js';
import { MembershipService } from '../services/membershipService.js';
import { PaymentService } from '../services/paymentService.js';
import { AppError } from '../middleware/errorHandler.js';

function getStripe() {
  if (!config.stripe.secretKey) return null;
  return new Stripe(config.stripe.secretKey, { apiVersion: '2024-06-20' });
}

const BCRYPT_ROUNDS = 12;

function repos() {
  const pool = getPool();
  return {
    appointment: new AppointmentRepository(pool),
    business: new BusinessRepository(pool),
    therapist: new TherapistRepository(pool),
    transfer: new TransferRequestRepository(pool),
    user: new UserRepository(pool),
  };
}

// ── Business details ──────────────────────────────────────────────────────────

export async function getBusinessDetails(req, res, next) {
  try {
    const { business } = repos();
    const [hours, beds, services] = await Promise.all([
      business.getBusinessHours(),
      business.getMassageBeds(),
      business.getServices(),
    ]);
    res.json({ success: true, data: { hours, beds, services } });
  } catch (err) {
    next(err);
  }
}

export async function updateBusinessHours(req, res, next) {
  try {
    const { business } = repos();
    const dayOfWeek = parseInt(req.params.dayOfWeek, 10);
    const { openTime, closeTime, isClosed } = req.body;
    const updated = await business.upsertBusinessHours(dayOfWeek, { openTime, closeTime, isClosed });
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

// ── Booking restrictions ──────────────────────────────────────────────────────

export async function getBookingRestrictions(req, res, next) {
  try {
    const restrictions = await repos().business.getBookingRestrictions();
    res.json({ success: true, data: restrictions ?? { restrict_pregnancy: true, restrict_minors: true } });
  } catch (err) {
    next(err);
  }
}

export async function updateBookingRestrictions(req, res, next) {
  try {
    const { restrictPregnancy, restrictMinors } = req.body;
    const updated = await repos().business.updateBookingRestrictions({ restrictPregnancy, restrictMinors });
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

// ── Scheduling settings ──────────────────────────────────────────────────────

export async function getSchedulingSettings(req, res, next) {
  try {
    const settings = await repos().business.getSchedulingSettings();
    res.json({ success: true, data: settings ?? { buffer_minutes: 15 } });
  } catch (err) {
    next(err);
  }
}

export async function updateSchedulingSettings(req, res, next) {
  try {
    const { bufferMinutes } = req.body;
    const updated = await repos().business.updateSchedulingSettings({ bufferMinutes });
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

// ── Business contact info ────────────────────────────────────────────────────

export async function getBusinessContactInfo(req, res, next) {
  try {
    const contactInfo = await repos().business.getBusinessContactInfo();
    res.json({ success: true, data: contactInfo });
  } catch (err) {
    next(err);
  }
}

export async function updateBusinessContactInfo(req, res, next) {
  try {
    const { addressLine1, addressLine2, city, state, zip, phone, email } = req.body;
    const updated = await repos().business.updateBusinessContactInfo({
      addressLine1, addressLine2, city, state, zip, phone, email,
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

// ── Travel settings ───────────────────────────────────────────────────────────

export async function getTravelSettings(req, res, next) {
  try {
    const settings = await repos().business.getTravelSettings();
    res.json({ success: true, data: settings ?? { travel_mode_enabled: false } });
  } catch (err) {
    next(err);
  }
}

export async function updateTravelSettings(req, res, next) {
  try {
    const { travelModeEnabled, maxDriveMinutes } = req.body;
    const updated = await repos().business.updateTravelSettings({ travelModeEnabled, maxDriveMinutes });
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

// ── Massage beds ──────────────────────────────────────────────────────────────

export async function listMassageBeds(req, res, next) {
  try {
    const beds = await repos().business.getMassageBeds();
    res.json({ success: true, data: beds });
  } catch (err) {
    next(err);
  }
}

export async function createMassageBed(req, res, next) {
  try {
    const bed = await repos().business.createMassageBed(req.body.name);
    res.status(201).json({ success: true, data: bed });
  } catch (err) {
    next(err);
  }
}

export async function updateMassageBed(req, res, next) {
  try {
    const { name, isActive } = req.body;
    const bed = await repos().business.updateMassageBed(req.params.id, { name, isActive });
    if (!bed) throw new AppError('Massage table not found', 404, 'NOT_FOUND');
    res.json({ success: true, data: bed });
  } catch (err) {
    next(err);
  }
}

export async function deleteMassageBed(req, res, next) {
  try {
    const result = await repos().business.deleteMassageBed(req.params.id);
    if (!result) throw new AppError('Massage table not found', 404, 'NOT_FOUND');
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

// ── Services ──────────────────────────────────────────────────────────────────

export async function listServices(req, res, next) {
  try {
    const services = await repos().business.getServices();
    res.json({ success: true, data: services });
  } catch (err) {
    next(err);
  }
}

export async function createService(req, res, next) {
  try {
    const { name, description, durationMinutes, priceCents } = req.body;
    let stripeProductId = null;
    let stripePriceId = null;

    const stripe = getStripe();
    if (stripe) {
      const product = await stripe.products.create({
        name,
        ...(description && { description }),
        metadata: { type: 'service' },
      });
      stripeProductId = product.id;

      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: priceCents,
        currency: 'usd',
      });
      stripePriceId = price.id;
    }

    const service = await repos().business.createService({ name, description, durationMinutes, priceCents, stripeProductId, stripePriceId });
    res.status(201).json({ success: true, data: service });
  } catch (err) {
    next(err);
  }
}

export async function updateService(req, res, next) {
  try {
    const { name, description, durationMinutes, priceCents, isActive } = req.body;
    const { business } = repos();
    const current = await business.findServiceById(req.params.id);
    if (!current) throw new AppError('Service not found', 404, 'NOT_FOUND');

    let stripeProductId;
    let stripePriceId;

    const stripe = getStripe();
    if (stripe && priceCents !== undefined && priceCents !== current.price_cents) {
      let productId = current.stripe_product_id;

      if (!productId && current.stripe_price_id) {
        const existing = await stripe.prices.retrieve(current.stripe_price_id);
        productId = typeof existing.product === 'string' ? existing.product : existing.product.id;
      }

      if (!productId) {
        const product = await stripe.products.create({
          name: name ?? current.name,
          metadata: { type: 'service' },
        });
        productId = product.id;
      }

      const newPrice = await stripe.prices.create({
        product: productId,
        unit_amount: priceCents,
        currency: 'usd',
      });
      stripePriceId = newPrice.id;

      if (current.stripe_price_id) {
        await stripe.prices.update(current.stripe_price_id, { active: false });
      }

      if (!current.stripe_product_id && productId) {
        stripeProductId = productId;
      }
    }

    if (stripe && current.stripe_product_id && (name !== undefined || description !== undefined)) {
      await stripe.products.update(current.stripe_product_id, {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
      });
    }

    const service = await business.updateService(req.params.id, {
      name, description, durationMinutes, priceCents, isActive, stripeProductId, stripePriceId,
    });
    res.json({ success: true, data: service });
  } catch (err) {
    next(err);
  }
}

export async function deactivateService(req, res, next) {
  try {
    const service = await repos().business.deactivateService(req.params.id);
    if (!service) throw new AppError('Service not found', 404, 'NOT_FOUND');
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

// ── Therapists ────────────────────────────────────────────────────────────────

export async function listTherapists(req, res, next) {
  try {
    const therapists = await repos().therapist.findAll();
    res.json({ success: true, data: therapists });
  } catch (err) {
    next(err);
  }
}

export async function getTherapist(req, res, next) {
  try {
    const therapist = await repos().therapist.findById(req.params.id);
    if (!therapist) throw new AppError('Therapist not found', 404, 'NOT_FOUND');
    res.json({ success: true, data: therapist });
  } catch (err) {
    next(err);
  }
}

export async function createTherapist(req, res, next) {
  try {
    const { email, password, firstName, lastName, phone, bio, specialties, isAcceptingClients } = req.body;
    const { user, therapist } = repos();
    const existing = await user.findByEmail(email);
    if (existing) throw new AppError('An account with this email already exists', 409, 'CONFLICT');
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const newId = await therapist.create({
      email, passwordHash, firstName, lastName, phone, bio, specialties, isAcceptingClients,
    });
    const created = await therapist.findById(newId);
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
}

export async function updateTherapist(req, res, next) {
  try {
    const { bio, specialties, isAcceptingClients, displayOrder } = req.body;
    const result = await repos().therapist.updateProfile(req.params.id, { bio, specialties, isAcceptingClients, displayOrder });
    if (!result) throw new AppError('Therapist not found', 404, 'NOT_FOUND');
    const updated = await repos().therapist.findById(req.params.id);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

export async function uploadTherapistHeadshot(req, res, next) {
  try {
    if (!req.file) throw new AppError('No image file provided', 400, 'BAD_REQUEST');
    const therapist = await repos().therapist.findById(req.params.id);
    if (!therapist) throw new AppError('Therapist not found', 404, 'NOT_FOUND');
    const headshotUrl = `/headshots/${req.file.filename}`;
    await repos().therapist.updateHeadshot(req.params.id, headshotUrl);
    res.json({ success: true, data: { headshotUrl } });
  } catch (err) {
    next(err);
  }
}

export async function deactivateTherapist(req, res, next) {
  try {
    if (req.params.id === req.user.sub) {
      throw new AppError('Cannot deactivate your own account', 400, 'BAD_REQUEST');
    }
    const result = await repos().therapist.deactivate(req.params.id);
    if (!result) throw new AppError('Therapist not found', 404, 'NOT_FOUND');
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

// ── Dashboard summary ─────────────────────────────────────────────────────────

export async function getDashboard(req, res, next) {
  try {
    const stats = await repos().appointment.getDashboardStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
}

// ── Appointments (calendar) ───────────────────────────────────────────────────

export async function listAppointments(req, res, next) {
  try {
    const { start, end, therapistId } = req.query;
    if (!start || !end) {
      throw new AppError('start and end query params are required', 400, 'BAD_REQUEST');
    }
    const data = await repos().appointment.listForOwner({ start, end, therapistId });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function updateAppointmentStatus(req, res, next) {
  try {
    const VALID = ['pending', 'confirmed', 'cancelled', 'completed', 'no_show'];
    const { status } = req.body;
    if (!VALID.includes(status)) {
      throw new AppError(`status must be one of: ${VALID.join(', ')}`, 400, 'BAD_REQUEST');
    }
    const appt = await repos().appointment.updateStatus(req.params.id, status);
    if (!appt) throw new AppError('Appointment not found', 404, 'NOT_FOUND');
    res.json({ success: true, data: appt });
  } catch (err) {
    next(err);
  }
}

export async function chargeNoShow(req, res, next) {
  try {
    const appt = await repos().appointment.findById(req.params.id);
    if (!appt) throw new AppError('Appointment not found', 404, 'NOT_FOUND');

    // Use the service's price if no amount was specified.
    let amountCents = req.body.amountCents;
    if (!amountCents) {
      const service = await repos().appointment.findServiceById(appt.service_id);
      amountCents = service?.price_cents ?? 0;
    }
    if (!amountCents || amountCents <= 0) {
      throw new AppError('A positive amount is required to charge a no-show fee', 400, 'BAD_REQUEST');
    }

    const svc = new PaymentService(getPool());
    const { payment } = await svc.chargeNoShow(appt.id, amountCents);
    res.json({ success: true, data: { payment } });
  } catch (err) {
    next(err);
  }
}

export async function recordInPersonPayment(req, res, next) {
  try {
    const { amountCents, method } = req.body;
    if (!amountCents || amountCents <= 0) {
      throw new AppError('A positive amountCents is required', 400, 'BAD_REQUEST');
    }
    const VALID_METHODS = ['cash', 'card', 'check'];
    if (method && !VALID_METHODS.includes(method)) {
      throw new AppError(`method must be one of: ${VALID_METHODS.join(', ')}`, 400, 'BAD_REQUEST');
    }

    const svc = new PaymentService(getPool());
    const payment = await svc.recordInPersonPayment({
      appointmentId: req.params.id,
      amountCents,
      method: method ?? 'cash',
    });
    res.status(201).json({ success: true, data: { payment } });
  } catch (err) {
    next(err);
  }
}

// ── Revenue ───────────────────────────────────────────────────────────────────

export async function getRevenue(req, res, next) {
  try {
    const end = req.query.end || new Date().toISOString().slice(0, 10);
    const defaultStart = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
    const start = req.query.start || defaultStart;
    const data = await repos().appointment.getRevenueStats({ start, end });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// ── Marketing attribution ──────────────────────────────────────────────────────

function defaultRange(req) {
  const end = req.query.end || new Date().toISOString().slice(0, 10);
  const start = req.query.start || new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
  return { start, end };
}

// Opaque base64 keyset cursor: { scheduledAt, id }. Malformed cursors are ignored
// (treated as "start from the beginning") so a stale client can't 500 the endpoint.
function decodeCursor(raw) {
  if (!raw) return null;
  try {
    const obj = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
    if (obj && obj.scheduledAt && obj.id) return obj;
  } catch { /* ignore malformed cursor */ }
  return null;
}

function encodeCursor(cursor) {
  return cursor ? Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64') : null;
}

export async function getMarketingSources(req, res, next) {
  try {
    const { start, end } = defaultRange(req);
    const touch = req.query.touch === 'last' ? 'last' : 'first';
    const data = await repos().appointment.getSourceAttributionStats({ start, end, touch });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getAttributionTimeseries(req, res, next) {
  try {
    const { start, end } = defaultRange(req);
    const touch = req.query.touch === 'last' ? 'last' : 'first';
    const data = await repos().appointment.getAttributionTimeseries({ start, end, touch });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function listAttributedAppointments(req, res, next) {
  try {
    const { start, end } = defaultRange(req);
    const touch = req.query.touch === 'last' ? 'last' : 'first';
    const { source, medium, campaign, status } = req.query;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), 100);
    const cursor = decodeCursor(req.query.cursor);

    const { rows, nextCursor } = await repos().appointment.listAttributedAppointments({
      start, end, touch, source, medium, campaign, status, limit, cursor,
    });
    res.json({ success: true, data: { appointments: rows, nextCursor: encodeCursor(nextCursor) } });
  } catch (err) {
    next(err);
  }
}

// ── Transfer requests ─────────────────────────────────────────────────────────

export async function listTransferRequests(req, res, next) {
  try {
    const [requests, therapists] = await Promise.all([
      repos().transfer.listPending(),
      repos().therapist.findAll(),
    ]);
    res.json({ success: true, data: { requests, therapists } });
  } catch (err) {
    next(err);
  }
}

export async function approveTransferRequest(req, res, next) {
  try {
    const { toTherapistId } = req.body;
    if (!toTherapistId) {
      throw new AppError('toTherapistId is required', 400, 'BAD_REQUEST');
    }
    const result = await repos().transfer.approve(req.params.id, toTherapistId, req.user.sub);
    if (!result) throw new AppError('Transfer request not found or already resolved', 404, 'NOT_FOUND');
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function denyTransferRequest(req, res, next) {
  try {
    const result = await repos().transfer.deny(req.params.id, req.user.sub);
    if (!result) throw new AppError('Transfer request not found or already resolved', 404, 'NOT_FOUND');
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// ── Membership plans ─────────────────────────────────────────────────────────

function membershipService() {
  return new MembershipService(getPool());
}

export async function listMembershipPlans(req, res, next) {
  try {
    const plans = await membershipService().memberships.findAllPlans();
    res.json({ success: true, data: { plans } });
  } catch (err) {
    next(err);
  }
}

export async function createMembershipPlan(req, res, next) {
  try {
    const { name, description, priceMonthlyCents, creditsPerMonth } = req.body;
    const plan = await membershipService().createPlan({ name, description, priceMonthlyCents, creditsPerMonth });
    res.status(201).json({ success: true, data: { plan } });
  } catch (err) {
    next(err);
  }
}

export async function updateMembershipPlan(req, res, next) {
  try {
    const plan = await membershipService().updatePlan(req.params.id, req.body);
    res.json({ success: true, data: { plan } });
  } catch (err) {
    next(err);
  }
}

// ── Audit logs ────────────────────────────────────────────────────────────────

const AUDIT_PAGE_SIZE = 50;
const MAX_AUDIT_PAGE_SIZE = 200;

export async function getAuditLogs(req, res, next) {
  try {
    const audit = new AuditLogRepository(getPool());

    const limit = Math.min(
      Number.parseInt(req.query.limit, 10) || AUDIT_PAGE_SIZE,
      MAX_AUDIT_PAGE_SIZE
    );
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);

    // `end` is an inclusive calendar day from the UI; the repository compares
    // with `<`, so push it to the following midnight or the last day is missed.
    let end = null;
    if (req.query.end) {
      const parsed = new Date(`${req.query.end}T00:00:00.000Z`);
      if (!Number.isNaN(parsed.getTime())) {
        parsed.setUTCDate(parsed.getUTCDate() + 1);
        end = parsed.toISOString();
      }
    }

    const [{ entries, total }, actions] = await Promise.all([
      audit.list({
        action: req.query.action || null,
        entity: req.query.entity || null,
        userId: req.query.userId || null,
        start: req.query.start ? `${req.query.start}T00:00:00.000Z` : null,
        end,
        limit,
        offset: (page - 1) * limit,
      }),
      audit.distinctActions(),
    ]);

    res.json({
      success: true,
      data: {
        entries,
        actions,
        total,
        page,
        limit,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    });
  } catch (err) {
    next(err);
  }
}

// ── Remaining stubs ───────────────────────────────────────────────────────────

const stub = (_req, _res, next) => next(new AppError('Not implemented', 501, 'NOT_IMPLEMENTED'));

export const listUsers = stub;
export const updateSettings = stub;
