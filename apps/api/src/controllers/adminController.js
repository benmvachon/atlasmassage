import bcrypt from 'bcrypt';
import { getPool } from '../database/pool.js';
import { BusinessRepository } from '../repositories/businessRepository.js';
import { TherapistRepository } from '../repositories/therapistRepository.js';
import { UserRepository } from '../repositories/userRepository.js';
import { AppError } from '../middleware/errorHandler.js';

const BCRYPT_ROUNDS = 12;

function repos() {
  const pool = getPool();
  return {
    business: new BusinessRepository(pool),
    therapist: new TherapistRepository(pool),
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
    const service = await repos().business.createService({ name, description, durationMinutes, priceCents });
    res.status(201).json({ success: true, data: service });
  } catch (err) {
    next(err);
  }
}

export async function updateService(req, res, next) {
  try {
    const { name, description, durationMinutes, priceCents, isActive } = req.body;
    const service = await repos().business.updateService(req.params.id, {
      name, description, durationMinutes, priceCents, isActive,
    });
    if (!service) throw new AppError('Service not found', 404, 'NOT_FOUND');
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
    const { bio, specialties, isAcceptingClients } = req.body;
    const result = await repos().therapist.updateProfile(req.params.id, { bio, specialties, isAcceptingClients });
    if (!result) throw new AppError('Therapist not found', 404, 'NOT_FOUND');
    const updated = await repos().therapist.findById(req.params.id);
    res.json({ success: true, data: updated });
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

// ── Unimplemented stubs ───────────────────────────────────────────────────────

const stub = (_req, _res, next) => next(new AppError('Not implemented', 501, 'NOT_IMPLEMENTED'));

export const getDashboard = stub;
export const listUsers = stub;
export const listAppointments = stub;
export const getRevenue = stub;
export const updateSettings = stub;
export const getAuditLogs = stub;
