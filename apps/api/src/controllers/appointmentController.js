import { getPool } from '../database/pool.js';
import { AppointmentRepository } from '../repositories/appointmentRepository.js';
import { AvailabilityRepository } from '../repositories/availabilityRepository.js';
import { BusinessRepository } from '../repositories/businessRepository.js';
import { ConsentRepository } from '../repositories/consentRepository.js';
import { HealthRecordRepository } from '../repositories/healthRecordRepository.js';
import { SoapNoteRepository } from '../repositories/soapNoteRepository.js';
import { ClientFeedbackRepository } from '../repositories/clientFeedbackRepository.js';
import { ClientHistoryRepository } from '../repositories/clientHistoryRepository.js';
import { TransferRequestRepository } from '../repositories/transferRequestRepository.js';
import { PaymentService } from '../services/paymentService.js';
import { MembershipService } from '../services/membershipService.js';
import { GiftCardService } from '../services/giftCardService.js';
import { NotificationService } from '../services/notificationService.js';
import { generateSlots } from '../services/slotService.js';
import { AppError } from '../middleware/errorHandler.js';
import { config } from '../config/index.js';
import { logger } from '../logging/logger.js';

const SLOT_DURATION = 60;

const SLOT_BUFFER_MS = 15 * 60 * 1000;

function repos() {
  const pool = getPool();
  return {
    appointment: new AppointmentRepository(pool),
    availability: new AvailabilityRepository(pool),
    business: new BusinessRepository(pool),
    consent: new ConsentRepository(pool),
    health: new HealthRecordRepository(pool),
    soap: new SoapNoteRepository(pool),
    feedback: new ClientFeedbackRepository(pool),
    history: new ClientHistoryRepository(pool),
    transfer: new TransferRequestRepository(pool),
  };
}

function pickAvailableBed(activeBeds, existingAppts, slotStartMs, slotDurationMs) {
  const slotEnd = slotStartMs + slotDurationMs;
  const occupiedBedIds = new Set(
    existingAppts
      .filter(a => {
        if (!a.bed_id) return false;
        const aStart = new Date(a.scheduled_at).getTime();
        const aEnd = aStart + a.duration_minutes * 60_000;
        return slotStartMs < aEnd + SLOT_BUFFER_MS && slotEnd > aStart - SLOT_BUFFER_MS;
      })
      .map(a => a.bed_id)
  );
  return activeBeds.find(b => !occupiedBedIds.has(b.id)) ?? null;
}

export async function createAppointment(req, res, next) {
  try {
    const {
      therapistId, serviceId, scheduledAt,
      guestName, guestEmail, guestPhone,
      guestAddressLine1, guestAddressLine2, guestCity, guestState, guestZip,
      notes, paymentMethodId, waiverSignature, giftCardCode,
      healthCurrentMedications, healthRecentSurgeries, healthPregnancyStatus, healthInjuries, healthDateOfBirth,
    } = req.body;

    const clientId = req.user?.sub ?? null;
    if (!clientId && (!guestEmail || !guestName)) {
      throw new AppError('Guest name and email are required', 400, 'BAD_REQUEST');
    }

    const { appointment: apptRepo, availability: availRepo, business: businessRepo, consent: consentRepo, health: healthRepo } = repos();

    const apptDate = new Date(scheduledAt);
    if (apptDate < new Date(Date.now() + 24 * 60 * 60 * 1000)) {
      throw new AppError('Bookings must be made at least 24 hours in advance', 400, 'TOO_SOON');
    }
    const dateStr = apptDate.toISOString().slice(0, 10);

    const [availRows, existingAppts, allBeds] = await Promise.all([
      availRepo.getForDateRange(dateStr, dateStr, therapistId || null),
      apptRepo.getByDateRange(dateStr, dateStr),
      businessRepo.getMassageBeds(),
    ]);

    const activeBeds = allBeds.filter(b => b.is_active);
    if (activeBeds.length === 0) {
      throw new AppError('No massage tables are currently available', 503, 'NO_BEDS_AVAILABLE');
    }

    const slots = generateSlots(availRows, existingAppts, { activeBedCount: activeBeds.length });
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

    const bed = pickAvailableBed(activeBeds, existingAppts, apptDate.getTime(), SLOT_DURATION * 60_000);
    if (!bed) {
      throw new AppError('This time slot is no longer available', 409, 'SLOT_UNAVAILABLE');
    }
    const resolvedBedId = bed.id;

    // Resolve or create health record.
    // Authenticated clients reuse their most recent record; guests always create a new one.
    let healthRecordId = null;
    if (clientId) {
      const existingHealth = await healthRepo.findLatestByClientId(clientId);
      if (existingHealth) {
        healthRecordId = existingHealth.id;
      } else {
        const created = await healthRepo.create({
          clientId,
          currentMedications: healthCurrentMedications,
          recentSurgeries: healthRecentSurgeries,
          pregnancyStatus: healthPregnancyStatus,
          injuries: healthInjuries,
          dateOfBirth: healthDateOfBirth,
        });
        healthRecordId = created.id;
      }
    } else {
      const created = await healthRepo.create({
        guestEmail,
        currentMedications: healthCurrentMedications,
        recentSurgeries: healthRecentSurgeries,
        pregnancyStatus: healthPregnancyStatus,
        injuries: healthInjuries,
        dateOfBirth: healthDateOfBirth,
      });
      healthRecordId = created.id;
    }

    // Resolve or create consent signature.
    // Authenticated clients who have signed before skip the waiver; guests always sign.
    let consentSignatureId = null;
    if (clientId) {
      const existing = await consentRepo.findByClientId(clientId);
      if (existing) {
        consentSignatureId = existing.id;
      } else {
        if (!waiverSignature) {
          throw new AppError('A signed waiver is required to book an appointment', 400, 'WAIVER_REQUIRED');
        }
        const created = await consentRepo.create({ clientId, signature: waiverSignature });
        consentSignatureId = created.id;
      }
    } else {
      if (!waiverSignature) {
        throw new AppError('A signed waiver is required to book an appointment', 400, 'WAIVER_REQUIRED');
      }
      const created = await consentRepo.create({ guestEmail, signature: waiverSignature });
      consentSignatureId = created.id;
    }

    let appointment = await apptRepo.create({
      clientId,
      therapistId: resolvedTherapistId,
      serviceId,
      bedId: resolvedBedId,
      scheduledAt,
      durationMinutes: SLOT_DURATION,
      notes,
      guestName: clientId ? null : guestName,
      guestEmail: clientId ? null : guestEmail,
      guestPhone: clientId ? null : (guestPhone || null),
      guestAddressLine1: clientId ? null : (guestAddressLine1 || null),
      guestAddressLine2: clientId ? null : (guestAddressLine2 || null),
      guestCity: clientId ? null : (guestCity || null),
      guestState: clientId ? null : (guestState || null),
      guestZip: clientId ? null : (guestZip || null),
      waiverSignature: waiverSignature ?? null,
      consentSignatureId,
      healthRecordId,
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

    // Apply gift card if a code was provided.
    if (giftCardCode) {
      const pool = getPool();
      const service = await apptRepo.findServiceById(serviceId);
      const giftCardSvc = new GiftCardService(pool);
      const dbClient = await pool.connect();
      try {
        await dbClient.query('BEGIN');
        await giftCardSvc.applyToAppointment(dbClient, {
          code: giftCardCode.trim().toUpperCase(),
          appointmentId: appointment.id,
          clientId: clientId ?? null,
          servicePriceCents: service?.price_cents ?? 0,
        });
        await dbClient.query('COMMIT');
      } catch (err) {
        await dbClient.query('ROLLBACK');
        // Cancel the pending appointment so it doesn't linger
        await apptRepo.updateStatus(appointment.id, 'cancelled').catch(() => {});
        throw err;
      } finally {
        dbClient.release();
      }
    }

    // Collect card on file for potential no-show charges. Payment is not
    // collected now — it is taken in-person after the appointment completes.
    if (config.stripe.secretKey) {
      const paymentSvc = new PaymentService(getPool());

      if (clientId && paymentMethodId) {
        // Returning client chose an existing saved card — no setup intent needed.
        // Look up the Stripe PM ID and save it on the appointment so we can
        // charge a no-show fee later without re-prompting for card details.
        const pm = await paymentSvc.payments.findPaymentMethodById(paymentMethodId);
        if (pm && pm.client_id === clientId) {
          await apptRepo.updateStripePaymentMethodId(appointment.id, pm.stripe_payment_method_id);
          await apptRepo.updateStatus(appointment.id, 'confirmed');
          appointment = { ...appointment, status: 'confirmed' };

          new NotificationService(getPool()).sendBookingConfirmation(appointment.id).catch(err => {
            logger.error('notification_error', { appointmentId: appointment.id, message: err.message });
          });

          return res.status(201).json({ success: true, data: { appointment, clientSecret: null } });
        }
      }

      // New card or guest — create a SetupIntent to save the card without charging.
      const result = await paymentSvc.createBookingSetupIntent({
        appointmentId: appointment.id,
        userId: clientId ?? undefined,
        guestEmail: clientId ? undefined : guestEmail,
        guestName: clientId ? undefined : guestName,
      });
      clientSecret = result.clientSecret;
    } else {
      // Stripe not configured — confirm the appointment immediately.
      await apptRepo.updateStatus(appointment.id, 'confirmed');
      appointment = { ...appointment, status: 'confirmed' };
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

    const { allowed } = checkModificationAuth(appt, req.user, req.body.cancelToken);
    if (!allowed) return next(new AppError('Forbidden', 403, 'FORBIDDEN'));

    // The frontend sends the Stripe PM ID after confirming the SetupIntent so we
    // can charge a no-show fee later without prompting for card details again.
    const { stripePaymentMethodId } = req.body;
    if (stripePaymentMethodId && !appt.stripe_payment_method_id) {
      await apptRepo.updateStripePaymentMethodId(req.params.id, stripePaymentMethodId);
    }

    const updated = await apptRepo.updateStatus(req.params.id, 'confirmed');

    new NotificationService(getPool()).sendBookingConfirmation(req.params.id).catch(err => {
      logger.error('notification_error', { appointmentId: req.params.id, message: err.message });
    });

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

    // Pending appointments were never paid — skip the 24-hour window restriction
    if (!isOwner && appt.status !== 'pending' && new Date(appt.scheduled_at) <= new Date(Date.now() + 24 * 60 * 60 * 1000)) {
      return next(new AppError('Appointments cannot be cancelled within 24 hours of the scheduled time', 400, 'MODIFICATION_WINDOW_CLOSED'));
    }

    if (['cancelled', 'completed', 'no_show'].includes(appt.status)) {
      return next(new AppError('Appointment cannot be cancelled in its current state', 400, 'BAD_REQUEST'));
    }

    const updated = await apptRepo.updateStatus(req.params.id, 'cancelled');

    // Restore any gift card balance that was applied to this appointment
    new GiftCardService(getPool()).giftCards
      .restoreForAppointment(req.params.id)
      .catch(err => logger.error('gift_card_restore_error', { appointmentId: req.params.id, message: err.message }));

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

    const { business: businessRepo } = repos();
    const [availRows, existingAppts, allBeds] = await Promise.all([
      availRepo.getForDateRange(dateStr, dateStr, targetTherapistId),
      apptRepo.getByDateRange(dateStr, dateStr, { excludeId: appt.id }),
      businessRepo.getMassageBeds(),
    ]);

    const activeBeds = allBeds.filter(b => b.is_active);
    const slots = generateSlots(availRows, existingAppts, { activeBedCount: activeBeds.length });
    const slotTime = `${String(newDate.getUTCHours()).padStart(2, '0')}:${String(newDate.getUTCMinutes()).padStart(2, '0')}`;
    if (!slots.some(s => s.startTime === slotTime && s.availableTherapists.some(t => t.id === targetTherapistId))) {
      throw new AppError('The requested time slot is not available', 409, 'SLOT_UNAVAILABLE');
    }

    const bed = pickAvailableBed(activeBeds, existingAppts, newDate.getTime(), SLOT_DURATION * 60_000);
    const updated = await apptRepo.reschedule(appt.id, {
      scheduledAt,
      therapistId: targetTherapistId,
      bedId: bed?.id ?? null,
    });
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

    const notifSvc = new NotificationService(getPool());
    notifSvc.sendFeedbackRequest(req.params.id).catch(err => {
      logger.error('feedback_send_error', { appointmentId: req.params.id, message: err.message });
    });
    notifSvc.sendSoapNotesRequest(req.params.id).catch(err => {
      logger.error('soap_notes_request_send_error', { appointmentId: req.params.id, message: err.message });
    });

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

export async function recordPayment(req, res, next) {
  try {
    const { appointment: apptRepo } = repos();
    const appt = await apptRepo.findById(req.params.id);
    if (!appt) return next(new AppError('Appointment not found', 404, 'NOT_FOUND'));

    const isOwner = req.user.roles?.includes('owner');
    const isTherapist = appt.therapist_id === req.user.sub;
    if (!isOwner && !isTherapist) return next(new AppError('Forbidden', 403, 'FORBIDDEN'));

    const { amountCents, method } = req.body;
    if (!amountCents || amountCents <= 0) {
      return next(new AppError('A positive amountCents is required', 400, 'BAD_REQUEST'));
    }
    const VALID_METHODS = ['cash', 'card', 'check'];
    if (method && !VALID_METHODS.includes(method)) {
      return next(new AppError(`method must be one of: ${VALID_METHODS.join(', ')}`, 400, 'BAD_REQUEST'));
    }

    const svc = new PaymentService(getPool());
    const payment = await svc.recordInPersonPayment({
      appointmentId: appt.id,
      amountCents,
      method: method ?? 'cash',
    });
    res.status(201).json({ success: true, data: { payment } });
  } catch (err) {
    next(err);
  }
}

export async function chargeNoShow(req, res, next) {
  try {
    const { appointment: apptRepo } = repos();
    const appt = await apptRepo.findById(req.params.id);
    if (!appt) return next(new AppError('Appointment not found', 404, 'NOT_FOUND'));

    const isOwner = req.user.roles?.includes('owner');
    const isTherapist = appt.therapist_id === req.user.sub;
    if (!isOwner && !isTherapist) return next(new AppError('Forbidden', 403, 'FORBIDDEN'));

    let amountCents = req.body.amountCents;
    if (!amountCents) {
      const service = await apptRepo.findServiceById(appt.service_id);
      amountCents = service?.price_cents ?? 0;
    }
    if (!amountCents || amountCents <= 0) {
      return next(new AppError('A positive amount is required to charge a no-show fee', 400, 'BAD_REQUEST'));
    }

    const svc = new PaymentService(getPool());
    const { payment } = await svc.chargeNoShow(appt.id, amountCents);
    res.json({ success: true, data: { payment } });
  } catch (err) {
    next(err);
  }
}

export const updateAppointment = (_req, _res, next) =>
  next(new AppError('Not implemented', 501, 'NOT_IMPLEMENTED'));

export async function getConsentStatus(req, res, next) {
  try {
    const consentRepo = new ConsentRepository(getPool());
    const existing = await consentRepo.findByClientId(req.user.sub);
    res.json({
      success: true,
      data: { hasSigned: !!existing, signedAt: existing?.signed_at ?? null },
    });
  } catch (err) {
    next(err);
  }
}

export async function getHealthStatus(req, res, next) {
  try {
    const healthRepo = new HealthRecordRepository(getPool());
    const existing = await healthRepo.findLatestByClientId(req.user.sub);
    res.json({
      success: true,
      data: { hasRecord: !!existing },
    });
  } catch (err) {
    next(err);
  }
}

export async function getSoapNotes(req, res, next) {
  try {
    const { soap: soapRepo } = repos();
    const notes = await soapRepo.findByAppointmentId(req.params.id);
    res.json({ success: true, data: notes });
  } catch (err) {
    next(err);
  }
}

export async function upsertSoapNotes(req, res, next) {
  try {
    const { appointment: apptRepo, soap: soapRepo } = repos();
    const appt = await apptRepo.findById(req.params.id);
    if (!appt) return next(new AppError('Appointment not found', 404, 'NOT_FOUND'));

    const isOwner = req.user.roles?.includes('owner');
    if (!isOwner && appt.therapist_id !== req.user.sub) {
      return next(new AppError('You can only add SOAP notes for your own appointments', 403, 'FORBIDDEN'));
    }

    const { subjective, objective, assessment, plan } = req.body;
    const notes = await soapRepo.upsert({
      appointmentId: appt.id,
      therapistId: req.user.sub,
      subjective,
      objective,
      assessment,
      plan,
    });
    res.json({ success: true, data: notes });
  } catch (err) {
    next(err);
  }
}

export async function getClientHistory(req, res, next) {
  try {
    const { history: historyRepo } = repos();
    const result = await historyRepo.findByAppointment(req.params.id);
    if (!result) return next(new AppError('Appointment not found', 404, 'NOT_FOUND'));
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function getGuestAppointment(req, res, next) {
  try {
    const { appointment: apptRepo } = repos();
    const appt = await apptRepo.findGuestAppointment(req.params.id, req.query.token);
    if (!appt) return next(new AppError('Not found', 404, 'NOT_FOUND'));
    res.json({ success: true, data: {
      id: appt.id,
      status: appt.status,
      scheduledAt: appt.scheduled_at,
      guestName: appt.guest_name,
      serviceName: appt.service_name,
      durationMinutes: appt.duration_minutes,
      therapistFirstName: appt.therapist_first_name,
      therapistLastName: appt.therapist_last_name,
    }});
  } catch (err) {
    next(err);
  }
}

export async function getFeedbackInfo(req, res, next) {
  try {
    const { appointment: apptRepo, feedback: feedbackRepo } = repos();
    const appt = await apptRepo.findById(req.params.id);
    if (!appt) return next(new AppError('Not found', 404, 'NOT_FOUND'));
    if (appt.feedback_token !== req.query.token) {
      return next(new AppError('Invalid token', 403, 'FORBIDDEN'));
    }
    const service = await apptRepo.findServiceById(appt.service_id);
    const existing = await feedbackRepo.findByAppointmentId(appt.id);
    res.json({
      success: true,
      data: {
        serviceName: service?.name ?? 'Massage',
        scheduledAt: appt.scheduled_at,
        alreadySubmitted: !!existing,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function submitFeedback(req, res, next) {
  try {
    const { appointment: apptRepo, feedback: feedbackRepo } = repos();
    const appt = await apptRepo.findById(req.params.id);
    if (!appt) return next(new AppError('Appointment not found', 404, 'NOT_FOUND'));

    if (appt.feedback_token !== req.body.feedbackToken) {
      return next(new AppError('Invalid feedback token', 403, 'FORBIDDEN'));
    }

    if (appt.status !== 'completed') {
      return next(new AppError('Feedback can only be submitted for completed appointments', 400, 'BAD_REQUEST'));
    }

    const existing = await feedbackRepo.findByAppointmentId(appt.id);
    if (existing) {
      return next(new AppError('Feedback has already been submitted for this appointment', 409, 'CONFLICT'));
    }

    const { rating, comments } = req.body;
    const feedback = await feedbackRepo.create({
      appointmentId: appt.id,
      clientId: appt.client_id ?? null,
      guestEmail: appt.guest_email ?? null,
      rating,
      comments,
    });
    res.status(201).json({ success: true, data: feedback });
  } catch (err) {
    next(err);
  }
}
