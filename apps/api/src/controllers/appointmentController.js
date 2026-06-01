import { getPool } from '../database/pool.js';
import { AppointmentRepository } from '../repositories/appointmentRepository.js';
import { AvailabilityRepository } from '../repositories/availabilityRepository.js';
import { PaymentService } from '../services/paymentService.js';
import { generateSlots } from '../services/slotService.js';
import { AppError } from '../middleware/errorHandler.js';
import { config } from '../config/index.js';

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
    const {
      therapistId, serviceId, scheduledAt,
      guestName, guestEmail, guestPhone,
      notes, paymentMethodId,
    } = req.body;

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

    // Create a payment intent when Stripe is configured.
    // Service price is authoritative — never trust client-provided amounts.
    let clientSecret = null;
    if (config.stripe.secretKey) {
      const service = await apptRepo.findServiceById(serviceId);
      if (service?.price_cents > 0) {
        const paymentSvc = new PaymentService(getPool());
        const result = clientId
          ? await paymentSvc.createPaymentIntent(clientId, {
              amountCents: service.price_cents,
              currency: 'usd',
              paymentMethodId: paymentMethodId || undefined,
              appointmentId: appointment.id,
            })
          : await paymentSvc.createGuestPaymentIntent({
              amountCents: service.price_cents,
              currency: 'usd',
              appointmentId: appointment.id,
            });
        clientSecret = result.clientSecret;
      }
    }

    res.status(201).json({ success: true, data: { appointment, clientSecret } });
  } catch (err) {
    next(err);
  }
}

export async function confirmAppointment(req, res, next) {
  try {
    const { appointment: apptRepo } = repos();
    const appt = await apptRepo.findById(req.params.id);
    if (!appt) return next(new AppError('Appointment not found', 404, 'NOT_FOUND'));

    const isOwner = req.user.roles?.includes('owner');
    if (!isOwner && appt.client_id !== req.user.sub) {
      return next(new AppError('Forbidden', 403, 'FORBIDDEN'));
    }

    const updated = await apptRepo.updateStatus(req.params.id, 'confirmed');
    res.json({ success: true, data: { appointment: updated } });
  } catch (err) {
    next(err);
  }
}

const stub = (_req, _res, next) => next(new AppError('Not implemented', 501, 'NOT_IMPLEMENTED'));

export const listAppointments = stub;
export const getAppointment = stub;
export const updateAppointment = stub;
export const cancelAppointment = stub;
export const completeAppointment = stub;
