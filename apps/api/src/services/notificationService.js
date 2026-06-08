import { NotificationRepository } from '../repositories/notificationRepository.js';
import { sendSms } from './smsService.js';
import { send as sendEmail } from './emailService.js';
import { logger } from '../logging/logger.js';
import { config } from '../config/index.js';

function fmtDate(dt) {
  return new Date(dt).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

function fmtTime(dt) {
  return new Date(dt).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  });
}

// ── Email templates ────────────────────────────────────────────────────────────

function baseLayout(title, body) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:system-ui,-apple-system,sans-serif;color:#1a1a2e;max-width:560px;margin:0 auto;padding:40px 24px">
  <div style="text-align:center;margin-bottom:32px">
    <span style="font-size:22px;font-weight:700;color:#2c6e49">Atlas Bodywork</span>
  </div>
  <h2 style="font-size:20px;font-weight:700;margin-bottom:20px">${title}</h2>
  ${body}
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0">
  <p style="color:#9ca3af;font-size:12px;text-align:center">Atlas Bodywork &mdash; We&rsquo;ll see you soon!</p>
</body></html>`;
}

function apptCard(appt) {
  return `
    <div style="background:#f3f4f6;border-radius:8px;padding:20px;margin-bottom:24px">
      <div style="margin-bottom:10px"><strong>Service:</strong> ${appt.service_name}</div>
      <div style="margin-bottom:10px"><strong>Therapist:</strong> ${appt.therapist_first_name} ${appt.therapist_last_name}</div>
      <div style="margin-bottom:10px"><strong>Date:</strong> ${fmtDate(appt.scheduled_at)}</div>
      <div><strong>Time:</strong> ${fmtTime(appt.scheduled_at)}</div>
    </div>`;
}

function clientConfirmHtml(name, appt, manageUrl = null) {
  const manageSection = manageUrl
    ? `<p style="margin-top:4px;font-size:14px">
         <a href="${manageUrl}" style="color:#2c6e49;font-weight:600">Cancel or reschedule your appointment</a>
         &mdash; this link works up to 24 hours before your appointment.
       </p>`
    : `<p style="color:#6b7280;font-size:14px">
         Need to cancel or reschedule? Log into your account at least 24 hours in advance.
       </p>`;
  return baseLayout('Booking Confirmed ✓', `
    <p style="margin-bottom:16px">Hi ${name},</p>
    <p style="margin-bottom:24px">Your appointment at Atlas Bodywork is confirmed.</p>
    ${apptCard(appt)}
    ${manageSection}`);
}

function therapistNewBookingHtml(therapistName, clientName, appt) {
  return baseLayout('New Appointment Booked', `
    <p style="margin-bottom:16px">Hi ${therapistName},</p>
    <p style="margin-bottom:24px">A new appointment has been booked with you.</p>
    ${apptCard(appt)}
    <p style="margin-bottom:0"><strong>Client:</strong> ${clientName}</p>`);
}

function reminderHtml(name, appt) {
  return baseLayout('Appointment Reminder', `
    <p style="margin-bottom:16px">Hi ${name},</p>
    <p style="margin-bottom:24px">This is a friendly reminder that you have an appointment tomorrow.</p>
    ${apptCard(appt)}
    <p style="color:#6b7280;font-size:14px">
      Need to cancel? Please let us know as soon as possible.
    </p>`);
}

function feedbackRequestHtml(name, appt) {
  const feedbackUrl = `${config.app.url}/feedback?id=${appt.id}&token=${appt.feedback_token}`;
  return baseLayout('How was your visit?', `
    <p style="margin-bottom:16px">Hi ${name},</p>
    <p style="margin-bottom:24px">We hope you enjoyed your ${appt.service_name} yesterday. Your feedback helps us continue to improve — we&rsquo;d love to hear how it went.</p>
    ${apptCard(appt)}
    <div style="text-align:center;margin-bottom:24px">
      <a href="${feedbackUrl}" style="background:#2c6e49;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block">
        Leave Feedback
      </a>
    </div>
    <p style="color:#6b7280;font-size:14px;text-align:center">Thank you for choosing Atlas Bodywork!</p>`);
}

function weekFollowupHtml(name, bookingUrl) {
  return baseLayout('Time for another session?', `
    <p style="margin-bottom:16px">Hi ${name},</p>
    <p style="margin-bottom:24px">It&rsquo;s been a week since your last visit at Atlas Bodywork. Regular massage therapy delivers the best results &mdash; we&rsquo;d love to have you back!</p>
    <div style="text-align:center;margin-bottom:24px">
      <a href="${bookingUrl}" style="background:#2c6e49;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block">
        Book Your Next Session
      </a>
    </div>
    <p style="color:#6b7280;font-size:14px;text-align:center">We look forward to seeing you soon.</p>`);
}

function monthFollowupHtml(name, bookingUrl) {
  return baseLayout("It's been a month — you deserve it", `
    <p style="margin-bottom:16px">Hi ${name},</p>
    <p style="margin-bottom:24px">A month has passed since your last appointment at Atlas Bodywork. Take a moment for yourself &mdash; you&rsquo;ve earned it.</p>
    <div style="text-align:center;margin-bottom:24px">
      <a href="${bookingUrl}" style="background:#2c6e49;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block">
        Schedule Your Next Visit
      </a>
    </div>
    <p style="color:#6b7280;font-size:14px;text-align:center">We look forward to seeing you soon.</p>`);
}

function therapistReminderHtml(therapistName, clientName, appt) {
  return baseLayout('Appointment Reminder', `
    <p style="margin-bottom:16px">Hi ${therapistName},</p>
    <p style="margin-bottom:24px">You have an appointment tomorrow.</p>
    ${apptCard(appt)}
    <p style="margin-bottom:0"><strong>Client:</strong> ${clientName}</p>`);
}

// ── SMS templates ──────────────────────────────────────────────────────────────

function confirmSms(name, appt) {
  return `Atlas Bodywork: Hi ${name}, your ${appt.service_name} is confirmed for ${fmtDate(appt.scheduled_at)} at ${fmtTime(appt.scheduled_at)} with ${appt.therapist_first_name} ${appt.therapist_last_name}.`;
}

function reminderSms(name, appt) {
  return `Atlas Bodywork reminder: Hi ${name}, you have a ${appt.service_name} tomorrow at ${fmtTime(appt.scheduled_at)} with ${appt.therapist_first_name} ${appt.therapist_last_name}.`;
}

// ── Service ────────────────────────────────────────────────────────────────────

export class NotificationService {
  constructor(pool) {
    this.repo = new NotificationRepository(pool);
  }

  async sendBookingConfirmation(appointmentId) {
    const appt = await this.repo.findAppointmentWithDetails(appointmentId);
    if (!appt) return;

    const clientName = appt.client_first_name ?? appt.guest_name ?? 'there';
    const clientEmail = appt.client_email ?? appt.guest_email;
    const isGuest = !appt.client_id;

    // ── Notify client / guest ──
    if (clientEmail) {
      const sendClientEmail = isGuest
        ? true
        : (await this.repo.getOrCreatePreferences(appt.client_id)).email_booking_confirm;

      if (sendClientEmail) {
        const manageUrl = isGuest && appt.cancel_token
          ? `${config.app.url}/booking/manage?id=${appt.id}&token=${appt.cancel_token}`
          : null;
        await this._email({
          userId: appt.client_id,
          to: clientEmail,
          subject: 'Your Atlas Bodywork appointment is confirmed',
          html: clientConfirmHtml(clientName, appt, manageUrl),
        });
      }

      if (!isGuest) {
        const prefs = await this.repo.getOrCreatePreferences(appt.client_id);
        if (prefs.sms_booking_confirm && appt.client_phone) {
          await this._sms({
            userId: appt.client_id,
            to: appt.client_phone,
            body: confirmSms(clientName, appt),
          });
        }
      }
    }

    // ── Notify therapist ──
    const therapistPrefs = await this.repo.getOrCreatePreferences(appt.therapist_user_id);
    if (therapistPrefs.email_booking_confirm && appt.therapist_email) {
      await this._email({
        userId: appt.therapist_user_id,
        to: appt.therapist_email,
        subject: `New booking: ${appt.service_name} on ${fmtDate(appt.scheduled_at)}`,
        html: therapistNewBookingHtml(
          appt.therapist_first_name,
          clientName,
          appt
        ),
      });
    }
  }

  async sendPendingReminders() {
    const appointments = await this.repo.findAppointmentsNeedingReminders();
    logger.info('reminder_worker_found', { count: appointments.length });

    for (const appt of appointments) {
      try {
        await this._sendReminder(appt);
        await this.repo.markReminded(appt.id);
      } catch (err) {
        logger.error('reminder_send_error', { appointmentId: appt.id, message: err.message });
      }
    }
  }

  async _sendReminder(appt) {
    const clientName = appt.client_first_name ?? appt.guest_name ?? 'there';
    const clientEmail = appt.client_email ?? appt.guest_email;
    const isGuest = !appt.client_id;

    // ── Remind client / guest ──
    if (clientEmail) {
      const sendClientEmail = isGuest
        ? true
        : (await this.repo.getOrCreatePreferences(appt.client_id)).email_appointment_remind;

      if (sendClientEmail) {
        await this._email({
          userId: appt.client_id,
          to: clientEmail,
          subject: 'Appointment reminder — Atlas Bodywork',
          html: reminderHtml(clientName, appt),
        });
      }

      if (!isGuest) {
        const prefs = await this.repo.getOrCreatePreferences(appt.client_id);
        if (prefs.sms_appointment_remind && appt.client_phone) {
          await this._sms({
            userId: appt.client_id,
            to: appt.client_phone,
            body: reminderSms(clientName, appt),
          });
        }
      }
    }

    // ── Remind therapist ──
    const therapistPrefs = await this.repo.getOrCreatePreferences(appt.therapist_user_id);
    if (therapistPrefs.email_appointment_remind && appt.therapist_email) {
      await this._email({
        userId: appt.therapist_user_id,
        to: appt.therapist_email,
        subject: `Reminder: appointment tomorrow at ${fmtTime(appt.scheduled_at)}`,
        html: therapistReminderHtml(
          appt.therapist_first_name,
          appt.client_first_name ?? appt.guest_name ?? 'Guest',
          appt
        ),
      });
    }

    if (therapistPrefs.sms_appointment_remind && appt.therapist_phone) {
      await this._sms({
        userId: appt.therapist_user_id,
        to: appt.therapist_phone,
        body: reminderSms(appt.therapist_first_name, appt),
      });
    }
  }

  async sendPendingFeedbackRequests() {
    const appointments = await this.repo.findAppointmentsNeedingFeedback();
    logger.info('feedback_worker_found', { count: appointments.length });

    for (const appt of appointments) {
      try {
        const clientName = appt.client_first_name ?? appt.guest_name ?? 'there';
        const clientEmail = appt.client_email ?? appt.guest_email;
        if (!clientEmail) continue;

        const shouldSend = appt.client_id
          ? (await this.repo.getOrCreatePreferences(appt.client_id)).email_appointment_remind
          : true;

        if (shouldSend) {
          await this._email({
            userId: appt.client_id,
            to: clientEmail,
            subject: 'How was your Atlas Bodywork visit?',
            html: feedbackRequestHtml(clientName, appt),
          });
        }
        await this.repo.markFeedbackSent(appt.id);
      } catch (err) {
        logger.error('feedback_send_error', { appointmentId: appt.id, message: err.message });
      }
    }
  }

  async sendPendingWeekFollowups() {
    const appointments = await this.repo.findAppointmentsNeedingWeekFollowup();
    logger.info('followup_1w_worker_found', { count: appointments.length });

    for (const appt of appointments) {
      try {
        await this._sendFollowup(appt, 'week');
        await this.repo.markFollowup1wSent(appt.id);
      } catch (err) {
        logger.error('followup_1w_send_error', { appointmentId: appt.id, message: err.message });
      }
    }
  }

  async sendPendingMonthFollowups() {
    const appointments = await this.repo.findAppointmentsNeedingMonthFollowup();
    logger.info('followup_1m_worker_found', { count: appointments.length });

    for (const appt of appointments) {
      try {
        await this._sendFollowup(appt, 'month');
        await this.repo.markFollowup1mSent(appt.id);
      } catch (err) {
        logger.error('followup_1m_send_error', { appointmentId: appt.id, message: err.message });
      }
    }
  }

  async _sendFollowup(appt, period) {
    const clientEmail = appt.client_email;
    if (!clientEmail) return;

    const prefs = await this.repo.getOrCreatePreferences(appt.client_id);
    if (!prefs.email_appointment_remind) return;

    const clientName = appt.client_first_name ?? 'there';
    const bookingUrl = `${config.app.url}/booking`;

    await this._email({
      userId: appt.client_id,
      to: clientEmail,
      subject: period === 'week'
        ? 'Time for another session at Atlas Bodywork?'
        : "It's been a month — book your next Atlas Bodywork visit",
      html: period === 'week'
        ? weekFollowupHtml(clientName, bookingUrl)
        : monthFollowupHtml(clientName, bookingUrl),
    });
  }

  async _email({ userId, to, subject, html }) {
    try {
      await sendEmail({ to, subject, html });
      if (userId) {
        await this.repo.logNotification({ userId, channel: 'email', subject, body: subject, status: 'sent' });
      }
    } catch (err) {
      logger.error('notification_email_error', { to, message: err.message });
      if (userId) {
        await this.repo.logNotification({
          userId, channel: 'email', subject, body: subject,
          status: 'failed', errorMessage: err.message,
        });
      }
    }
  }

  async _sms({ userId, to, body }) {
    try {
      await sendSms({ to, body });
      if (userId) {
        await this.repo.logNotification({ userId, channel: 'sms', body, status: 'sent' });
      }
    } catch (err) {
      logger.error('notification_sms_error', { to, message: err.message });
      if (userId) {
        await this.repo.logNotification({
          userId, channel: 'sms', body,
          status: 'failed', errorMessage: err.message,
        });
      }
    }
  }
}
