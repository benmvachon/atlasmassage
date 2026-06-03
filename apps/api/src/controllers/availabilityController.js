import { getPool } from '../database/pool.js';
import { AvailabilityRepository } from '../repositories/availabilityRepository.js';
import { AppointmentRepository } from '../repositories/appointmentRepository.js';
import { BusinessRepository } from '../repositories/businessRepository.js';
import { TherapistRepository } from '../repositories/therapistRepository.js';
import { generateSlots, availableDaysForMonth } from '../services/slotService.js';
import { AppError } from '../middleware/errorHandler.js';

function repos() {
  const pool = getPool();
  return {
    availability: new AvailabilityRepository(pool),
    appointment: new AppointmentRepository(pool),
    business: new BusinessRepository(pool),
    therapist: new TherapistRepository(pool),
  };
}

function timeToMinutes(s) {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
}

function buildCountsByTherapist(apptRows) {
  const counts = {};
  for (const appt of apptRows) {
    counts[appt.therapist_id] = (counts[appt.therapist_id] || 0) + 1;
  }
  return counts;
}

function weekBoundsFor(dateStr) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  const dow = d.getUTCDay(); // 0=Sun
  const start = new Date(d);
  start.setUTCDate(d.getUTCDate() - dow);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)];
}

function filterByCapacity(availRows, dailyCounts, weeklyCounts, therapistMap) {
  return availRows.filter(avail => {
    const t = therapistMap[avail.therapist_id];
    if (!t) return true;
    if ((dailyCounts[avail.therapist_id] || 0) >= t.daily_booking_limit) return false;
    if (weeklyCounts && (weeklyCounts[avail.therapist_id] || 0) >= t.weekly_booking_limit) return false;
    return true;
  });
}

// ── Therapist schedule (owner/therapist-facing) ───────────────────────────────

export async function listAvailableTherapists(req, res, next) {
  try {
    const therapists = await repos().therapist.findAll();
    res.json({ success: true, data: therapists.filter(t => t.is_accepting_clients) });
  } catch (err) {
    next(err);
  }
}

export const getAvailableSlots = (_req, _res, next) =>
  next(new AppError('Not implemented', 501, 'NOT_IMPLEMENTED'));

export async function getTherapistAvailability(req, res, next) {
  try {
    const { therapistId } = req.params;
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const month = parseInt(req.query.month, 10) || (new Date().getMonth() + 1);

    const { availability: availRepo, business: businessRepo, therapist: therapistRepo } = repos();
    const therapist = await therapistRepo.findById(therapistId);
    if (!therapist) throw new AppError('Therapist not found', 404, 'NOT_FOUND');

    const [availability, businessHours] = await Promise.all([
      availRepo.getByTherapistAndMonth(therapistId, year, month),
      businessRepo.getBusinessHours(),
    ]);

    res.json({
      success: true,
      data: {
        availability,
        businessHours,
        dailyBookingLimit: therapist.daily_booking_limit,
        weeklyBookingLimit: therapist.weekly_booking_limit,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function setTherapistAvailability(req, res, next) {
  try {
    const { therapistId } = req.params;

    if (!req.user.roles.includes('owner') && req.user.sub !== therapistId) {
      throw new AppError('Forbidden', 403, 'FORBIDDEN');
    }

    const { availability: availRepo, business: businessRepo, therapist: therapistRepo } = repos();

    const therapist = await therapistRepo.findById(therapistId);
    if (!therapist) throw new AppError('Therapist not found', 404, 'NOT_FOUND');

    const businessHours = await businessRepo.getBusinessHours();
    const { entries } = req.body;

    for (const entry of entries) {
      const dayOfWeek = new Date(`${entry.date}T12:00:00Z`).getUTCDay();
      const bh = businessHours.find(h => h.day_of_week === dayOfWeek);
      if (!bh || bh.is_closed) {
        throw new AppError(`Business is closed on ${entry.date}`, 400, 'INVALID_DATE');
      }
      const open = timeToMinutes(bh.open_time);
      const close = timeToMinutes(bh.close_time);
      if (timeToMinutes(entry.startTime) < open || timeToMinutes(entry.endTime) > close) {
        throw new AppError(
          `Availability on ${entry.date} must be within business hours (${bh.open_time.slice(0, 5)}–${bh.close_time.slice(0, 5)})`,
          400,
          'OUT_OF_HOURS'
        );
      }
    }

    const result = await availRepo.upsertMany(therapistId, entries);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function deleteTherapistAvailability(req, res, next) {
  try {
    const { therapistId } = req.params;

    if (!req.user.roles.includes('owner') && req.user.sub !== therapistId) {
      throw new AppError('Forbidden', 403, 'FORBIDDEN');
    }

    const deleted = await repos().availability.deleteMany(therapistId, req.body.dates);
    res.json({ success: true, data: { deleted: deleted.length } });
  } catch (err) {
    next(err);
  }
}

export async function updateTherapistLimits(req, res, next) {
  try {
    const { therapistId } = req.params;

    if (!req.user.roles.includes('owner') && req.user.sub !== therapistId) {
      throw new AppError('Forbidden', 403, 'FORBIDDEN');
    }

    const { dailyBookingLimit, weeklyBookingLimit } = req.body;
    const result = await repos().availability.updateLimits(therapistId, { dailyBookingLimit, weeklyBookingLimit });
    if (!result) throw new AppError('Therapist not found', 404, 'NOT_FOUND');
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// ── Client booking calendar (public) ─────────────────────────────────────────

export async function getBookingCalendar(req, res, next) {
  try {
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const month = parseInt(req.query.month, 10) || (new Date().getMonth() + 1);
    const { therapistId, timeOfDay } = req.query;

    const { availability: availRepo, appointment: apptRepo, business: businessRepo, therapist: therapistRepo } = repos();

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const [availRows, apptRows, businessHours, allTherapists, services] = await Promise.all([
      availRepo.getForDateRange(startDate, endDate, therapistId || null),
      apptRepo.getByDateRange(startDate, endDate),
      businessRepo.getBusinessHours(),
      therapistRepo.findAll(),
      businessRepo.getServices(),
    ]);

    // Group by ISO date string — use toISOString() to avoid locale-string pitfall with Date objects
    const availByDate = {};
    for (const row of availRows) {
      const ds = new Date(row.specific_date).toISOString().slice(0, 10);
      if (!availByDate[ds]) availByDate[ds] = [];
      availByDate[ds].push(row);
    }
    const apptsByDate = {};
    for (const row of apptRows) {
      const ds = new Date(row.scheduled_at).toISOString().slice(0, 10);
      if (!apptsByDate[ds]) apptsByDate[ds] = [];
      apptsByDate[ds].push(row);
    }

    const therapistMap = Object.fromEntries(allTherapists.map(t => [t.id, t]));
    const filteredAvailByDate = {};
    for (const [ds, dayAvails] of Object.entries(availByDate)) {
      const dailyCounts = buildCountsByTherapist(apptsByDate[ds] ?? []);
      filteredAvailByDate[ds] = filterByCapacity(dayAvails, dailyCounts, null, therapistMap);
    }

    const notBefore = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const availableDays = availableDaysForMonth(filteredAvailByDate, apptsByDate, { timeOfDay, notBefore });

    res.json({
      success: true,
      data: {
        availableDays,
        businessHours,
        therapists: allTherapists
          .filter(t => t.is_accepting_clients)
          .map(t => ({ id: t.id, firstName: t.first_name, lastName: t.last_name, specialties: t.specialties })),
        services: services
          .filter(s => s.is_active && s.duration_minutes === 60)
          .map(s => ({ id: s.id, name: s.name, priceCents: s.price_cents })),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getBookingSlots(req, res, next) {
  try {
    const { date, therapistId, timeOfDay } = req.query;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new AppError('date query param required (YYYY-MM-DD)', 400, 'BAD_REQUEST');
    }

    const { availability: availRepo, appointment: apptRepo, therapist: therapistRepo } = repos();
    const [weekStart, weekEnd] = weekBoundsFor(date);

    const [availRows, apptRows, weekApptRows, therapists] = await Promise.all([
      availRepo.getForDateRange(date, date, therapistId || null),
      apptRepo.getByDateRange(date, date),
      apptRepo.getByDateRange(weekStart, weekEnd),
      therapistRepo.findAll(),
    ]);

    const therapistMap = Object.fromEntries(therapists.map(t => [t.id, t]));
    const dailyCounts = buildCountsByTherapist(apptRows);
    const weeklyCounts = buildCountsByTherapist(weekApptRows);
    const filteredAvailRows = filterByCapacity(availRows, dailyCounts, weeklyCounts, therapistMap);

    const notBefore = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const slots = generateSlots(filteredAvailRows, apptRows, { timeOfDay, notBefore });
    res.json({ success: true, data: { slots } });
  } catch (err) {
    next(err);
  }
}
