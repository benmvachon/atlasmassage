import { getPool } from '../database/pool.js';
import { AppointmentRepository } from '../repositories/appointmentRepository.js';
import { AvailabilityRepository } from '../repositories/availabilityRepository.js';
import { generateSlots } from '../services/slotService.js';
import { AppError } from '../middleware/errorHandler.js';

const SLOT_DURATION = 60;

function repos() {
  const pool = getPool();
  return {
    appointment: new AppointmentRepository(pool),
    availability: new AvailabilityRepository(pool),
  };
}

export async function createAppointment(req, res, next) {
  try {
    const { therapistId, serviceId, scheduledAt, guestName, guestEmail, guestPhone, notes } = req.body;

    const clientId = req.user?.sub ?? null;
    if (!clientId && (!guestEmail || !guestName)) {
      throw new AppError('Guest name and email are required', 400, 'BAD_REQUEST');
    }

    const { appointment: apptRepo, availability: availRepo } = repos();

    const apptDate = new Date(scheduledAt);
    const dateStr = apptDate.toISOString().slice(0, 10);

    const [availRows, existingAppts] = await Promise.all([
      availRepo.getForDateRange(dateStr, dateStr, therapistId),
      apptRepo.getByDateRange(dateStr, dateStr),
    ]);

    // Verify the requested slot is still valid for this therapist
    const slots = generateSlots(availRows, existingAppts, {});
    const slotTime = `${String(apptDate.getUTCHours()).padStart(2, '0')}:${String(apptDate.getUTCMinutes()).padStart(2, '0')}`;
    const slotValid = slots.some(
      s => s.startTime === slotTime && s.availableTherapists.some(t => t.id === therapistId)
    );
    if (!slotValid) {
      throw new AppError('This time slot is no longer available', 409, 'SLOT_UNAVAILABLE');
    }

    const appointment = await apptRepo.create({
      clientId,
      therapistId,
      serviceId,
      scheduledAt,
      durationMinutes: SLOT_DURATION,
      notes,
      guestName: clientId ? null : guestName,
      guestEmail: clientId ? null : guestEmail,
      guestPhone: clientId ? null : (guestPhone || null),
    });

    res.status(201).json({ success: true, data: appointment });
  } catch (err) {
    next(err);
  }
}

const stub = (_req, _res, next) => next(new AppError('Not implemented', 501, 'NOT_IMPLEMENTED'));

export const listAppointments = stub;
export const getAppointment = stub;
export const updateAppointment = stub;
export const cancelAppointment = stub;
export const confirmAppointment = stub;
export const completeAppointment = stub;
