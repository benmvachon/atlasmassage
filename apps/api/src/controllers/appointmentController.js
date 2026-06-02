import { getPool } from '../database/pool.js';
import { AppointmentRepository } from '../repositories/appointmentRepository.js';
import { AvailabilityRepository } from '../repositories/availabilityRepository.js';
import { TransferRequestRepository } from '../repositories/transferRequestRepository.js';
import { PaymentService } from '../services/paymentService.js';
import { MembershipService } from '../services/membershipService.js';
import { NotificationService } from '../services/notificationService.js';
import { generateSlots } from '../services/slotService.js';
import { AppError } from '../middleware/errorHandler.js';
import { config } from '../config/index.js';
import { logger } from '../logging/logger.js';

const SLOT_DURATION = 60;

function repos() {
  const pool = getPool();
  return {
    appointment: new AppointmentRepository(pool),
    availability: new AvailabilityRepository(pool),
    transfer: new TransferRequestRepository(pool),
  };
}

export async function createAppointment(req, res, next) {
  try {
    const {
      therapistId, serviceId, scheduledAt,
      guestName, guestEmail, guestPhone,
      notes, paymentMethodId, waiverSignature,
    } = req.body;

    const clientId = req.user?.sub ?? null;
    if (!clientId && (!guestEmail || !guestName)) {
      throw new AppError('Guest name and email are required', 400, 'BAD_REQUEST');
    }

    const { appointment: apptRepo, availability: availRepo } = repos();

    const apptDate = new Date(scheduledAt);
    if (apptDate < new Date(Date.now() + 24 * 60 * 60 * 1000)) {
      throw new AppError('Bookings must be made at least 24 hours in advance', 400, 'TOO_SOON');
    }
    const dateStr = apptDate.toISOString().slice(0, 10);

    const [availRows, existingAppts] = await Promise.all([
      availRepo.getForDateRange(dateStr, dateStr, therapistId || null),
      apptRepo.getByDateRange(dateStr, dateStr),
    ]);

    const slots = generateSlots(availRows, existingAppts, {});
    const slotTime = `${String(apptDate.getUTCHours()).padStart(2, '0')}:${String(apptDate.getUTCMinutes()).padStart(2, '0')}`;
    const matchingSlot = slots.find(s => s.startTime === slotTime);

    let resolvedTherapistId = therapistId;
    if (!resolvedTherapistId) {
      if (!matchingSlot || matchingSlot.availableTherapists.length === 0) {
        throw new AppError('This time slot is no longer available', 409, 'SLOT_UNAVAILABLE');
      }
      const candidates = matchingSlot.availableTherapists;
      resolvedTherapistId = candidates[Math.floor(Math.random() * candidates.length)].id;
    } else {
      const slotValid = matchingSlot?.availableTherapists.some(t => t.id === resolvedTherapistId);
      if (!slotValid) {
        throw new AppError('This time slot is no longer available', 409, 'SLOT_UNAVAILABLE');
      }
    }

    let appointment = await apptRepo.create({
      clientId,
      therapistId: resolvedTherapistId,
      serviceId,
      scheduledAt,
      durationMinutes: SLOT_DURATION,
      notes,
      guestName: clientId ? null : guestName,
      guestEmail: clientId ? null : guestEmail,
      guestPhone: clientId ? null : (guestPhone || null),
      waiverSignature,
    });

    // Check if the booking is covered by a membership credit.
    let clientSecret = null;
    if (clientId) {
      const membershipSvc = new MembershipService(getPool());
      const status = await membershipSvc.getMyStatus(clientId);
      if (status.active && status.creditsRemaining > 0) {
        await membershipSvc.consumeCredit(status.membershipId, appointment.id);
        await apptRepo.setMembership(appointment.id, status.membershipId);
        await apptRepo.updateStatus(appointment.id, 'confirmed');
        appointment = { ...appointment, status: 'confirmed', membership_id: status.membershipId };

        new NotificationService(getPool()).sendBookingConfirmation(appointment.id).catch(err => {
          logger.error('notification_error', { appointmentId: appointment.id, message: err.message });
        });

        return res.status(201).json({ success: true, data: { appointment, clientSecret: null } });
      }
    }

    // Create a payment intent when Stripe is configured.
    // Service price is authoritative — never trust client-provided amounts.
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

    // Fire booking confirmation — don't let notification failures break the booking response
    new NotificationService(getPool()).sendBookingConfirmation(appointment.id).catch(err => {
      logger.error('notification_error', { appointmentId: appointment.id, message: err.message });
    });

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

export async function listAppointments(req, res, next) {
  try {
    const { appointment } = repos();
    const roles = req.user.roles ?? [];
    const therapistId = req.user.sub;

    if (!roles.includes('therapist') && !roles.includes('owner')) {
      return next(new AppError('Forbidden', 403, 'FORBIDDEN'));
    }

    const { month, client, status } = req.query;
    const appointments = await appointment.listForTherapist({
      therapistId,
      month: month || null,
      clientSearch: client || null,
      statusFilter: status || null,
    });

    res.json({ success: true, data: appointments });
  } catch (err) {
    next(err);
  }
}

export async function getAppointment(req, res, next) {
  try {
    const appt = await repos().appointment.findById(req.params.id);
    if (!appt) return next(new AppError('Appointment not found', 404, 'NOT_FOUND'));

    const isOwner = req.user.roles?.includes('owner');
    const isTherapist = appt.therapist_id === req.user.sub;
    const isClient = appt.client_id === req.user.sub;

    if (!isOwner && !isTherapist && !isClient) {
      return next(new AppError('Forbidden', 403, 'FORBIDDEN'));
    }

    res.json({ success: true, data: appt });
  } catch (err) {
    next(err);
  }
}

function checkModificationAuth(appt, user, cancelToken) {
  const isOwner = user?.roles?.includes('owner');
  const isAuthClient = user?.sub && appt.client_id === user.sub;
  const isGuestWithToken = !user && !appt.client_id && cancelToken && cancelToken === appt.cancel_token;
  return { isOwner, isAuthClient, isGuestWithToken, allowed: isOwner || isAuthClient || isGuestWithToken };
}

export async function cancelAppointment(req, res, next) {
  try {
    const { appointment: apptRepo } = repos();
    const appt = await apptRepo.findById(req.params.id);
    if (!appt) return next(new AppError('Appointment not found', 404, 'NOT_FOUND'));

    const { isOwner, allowed } = checkModificationAuth(appt, req.user, req.body.cancelToken);
    if (!allowed) return next(new AppError('Forbidden', 403, 'FORBIDDEN'));

    if (!isOwner && new Date(appt.scheduled_at) <= new Date(Date.now() + 24 * 60 * 60 * 1000)) {
      return next(new AppError('Appointments cannot be cancelled within 24 hours of the scheduled time', 400, 'MODIFICATION_WINDOW_CLOSED'));
    }

    if (['cancelled', 'completed', 'no_show'].includes(appt.status)) {
      return next(new AppError('Appointment cannot be cancelled in its current state', 400, 'BAD_REQUEST'));
    }

    const updated = await apptRepo.updateStatus(req.params.id, 'cancelled');
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

export async function rescheduleAppointment(req, res, next) {
  try {
    const { scheduledAt, therapistId, cancelToken } = req.body;
    const { appointment: apptRepo, availability: availRepo } = repos();

    const appt = await apptRepo.findById(req.params.id);
    if (!appt) return next(new AppError('Appointment not found', 404, 'NOT_FOUND'));

    const { isOwner, allowed } = checkModificationAuth(appt, req.user, cancelToken);
    if (!allowed) return next(new AppError('Forbidden', 403, 'FORBIDDEN'));

    if (!isOwner && new Date(appt.scheduled_at) <= new Date(Date.now() + 24 * 60 * 60 * 1000)) {
      return next(new AppError('Appointments cannot be rescheduled within 24 hours of the scheduled time', 400, 'MODIFICATION_WINDOW_CLOSED'));
    }

    if (['cancelled', 'completed', 'no_show'].includes(appt.status)) {
      return next(new AppError('Appointment cannot be rescheduled in its current state', 400, 'BAD_REQUEST'));
    }

    const newDate = new Date(scheduledAt);
    if (newDate < new Date(Date.now() + 24 * 60 * 60 * 1000)) {
      throw new AppError('New appointment time must be at least 24 hours in the future', 400, 'TOO_SOON');
    }

    const targetTherapistId = therapistId || appt.therapist_id;
    const dateStr = newDate.toISOString().slice(0, 10);

    const [availRows, existingAppts] = await Promise.all([
      availRepo.getForDateRange(dateStr, dateStr, targetTherapistId),
      apptRepo.getByDateRange(dateStr, dateStr, { excludeId: appt.id }),
    ]);

    const slots = generateSlots(availRows, existingAppts, {});
    const slotTime = `${String(newDate.getUTCHours()).padStart(2, '0')}:${String(newDate.getUTCMinutes()).padStart(2, '0')}`;
    if (!slots.some(s => s.startTime === slotTime && s.availableTherapists.some(t => t.id === targetTherapistId))) {
      throw new AppError('The requested time slot is not available', 409, 'SLOT_UNAVAILABLE');
    }

    const updated = await apptRepo.reschedule(appt.id, { scheduledAt, therapistId: targetTherapistId });
    res.json({ success: true, data: { appointment: updated } });
  } catch (err) {
    next(err);
  }
}

export async function completeAppointment(req, res, next) {
  try {
    const { appointment: apptRepo } = repos();
    const appt = await apptRepo.findById(req.params.id);
    if (!appt) return next(new AppError('Appointment not found', 404, 'NOT_FOUND'));

    const isOwner = req.user.roles?.includes('owner');
    const isTherapist = appt.therapist_id === req.user.sub;
    if (!isOwner && !isTherapist) {
      return next(new AppError('Forbidden', 403, 'FORBIDDEN'));
    }

    const updated = await apptRepo.updateStatus(req.params.id, 'completed');
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

export async function requestTransfer(req, res, next) {
  try {
    const { appointment: apptRepo, transfer } = repos();
    const appt = await apptRepo.findById(req.params.id);
    if (!appt) return next(new AppError('Appointment not found', 404, 'NOT_FOUND'));

    if (appt.therapist_id !== req.user.sub) {
      return next(new AppError('You can only request transfers for your own appointments', 403, 'FORBIDDEN'));
    }

    if (!['pending', 'confirmed'].includes(appt.status) || new Date(appt.scheduled_at) <= new Date()) {
      return next(new AppError('Transfers can only be requested for upcoming appointments', 400, 'BAD_REQUEST'));
    }

    const existing = await transfer.findPendingByAppointment(req.params.id);
    if (existing) {
      return next(new AppError('A transfer request is already pending for this appointment', 409, 'CONFLICT'));
    }

    const request = await transfer.create(req.params.id, req.user.sub, req.body.reason);
    res.status(201).json({ success: true, data: request });
  } catch (err) {
    next(err);
  }
}

export const updateAppointment = (_req, _res, next) =>
  next(new AppError('Not implemented', 501, 'NOT_IMPLEMENTED'));
