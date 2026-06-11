import { NotificationRepository } from '../repositories/notificationRepository.js';
import { sendSms } from './smsService.js';
import { send as sendEmail } from './emailService.js';
import { logger } from '../logging/logger.js';
import { config } from '../config/index.js';

function fmtDate(dt) {
  return new Date(dt).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    timeZone: 'UTC',
  });
}

function fmtTime(dt) {
  return new Date(dt).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit',
    timeZone: 'UTC',
  });
}

// ── Email templates ────────────────────────────────────────────────────────────

const LOGO_SVG = `<svg width="40" height="40" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:middle"><path fill="#af3e4d" d="M256 22.115c-5.825 0-11.563.366-17.193 1.074l25.27 19.44 27.44-15.832A136.438 136.438 0 0 0 256 22.115zm-31.406 3.64C164.628 39.899 120.115 93.66 120.115 158c0 70.687 53.73 128.608 122.65 135.244.11-.089.213-.183.323-.271 8.263-6.629 19.152-10.972 31.252-12.305 6.22-.685 12.228-.512 17.822.457l.006-.025v-.002c1.954-7.778 6.776-13.879 12.527-17.332 4.314-2.59 8.978-3.837 13.528-4.137 1.516-.1 3.022-.094 4.496.002 5.895.383 11.445 2.11 16.095 5.584.123.092.244.195.366.29 31.612-24.477 52.098-62.602 52.681-105.62-6.228-5.54-16.99-15.23-18.4-17.346-1.987-2.98-21.852-22.348-21.852-22.348l-44.199-2.484 19.865 24.336-26.818 11.422-20.494-27.983 24.85 59.018-16.856 67.424-33.713-1.406-14.748-62.506-53.379-11.239 19.666-58.996h69.082l3.41-6.275-36.312-19.03-41.799 18.985-.701-41.437s21.068-18.964 21.068-24.582c0-3.13 2.132-12.118 4.063-19.682zm95.91 251.806c-2.437.009-4.81.597-6.543 1.638-1.982 1.19-3.436 2.711-4.334 6.287l-.006.018-13.79 53.928-8.073-1.25c-12.118-1.876-25.705-2.017-32.533-1.07-4.91 1.625-7.226 4.484-7.848 6.286-.635 1.842-.734 2.198 1.135 3.5.717.457 5.872 2.645 12.074 4.186 6.256 1.554 13.908 2.898 21.277 3.61 7.37.71 14.537.749 19.438.023 4.9-.726 5.96-2.624 5.191-.912 13.432-29.903 16.61-45.388 21.844-74.057-.08-.024-.02.092-.293-.111-1.067-.797-3.7-1.864-6.492-2.045-.35-.023-.699-.033-1.047-.031zm-40.055 20.785c-1.604.011-3.25.106-4.926.29-8.933.985-16.716 4.342-21.64 8.292-4.924 3.95-6.649 7.762-6.438 10.965a8.07 8.07 0 0 0 .633 2.617 37.532 37.532 0 0 1 2.498-.854l.582-.174.602-.093c8.147-1.276 19.2-1.204 30.615.006l5.25-20.53a44.952 44.952 0 0 0-7.176-.52zm-49.455 11.103c-32.373 12.647-66.581 48.933-73.314 87.27 8.55 13.94 15.925 25.451 42.213 28.804 20.25 2.584 36.195-3.383 53.138-11.421-4.61 27.314-9.023 54.627-22.347 81.941l61.582 1.49-1.987-11.422-37.248-4.47c10.766-27.243 34.074-58.795 28.309-88.399-18.755-3.482-37.817-6.687-69.527 1.49 2.954-8.21 13.434-21.073 25.947-33.408-7.491-5.58-10.196-15.685-7.399-23.795a24.701 24.701 0 0 1 2.993-5.914c-2.137-3.465-3.52-7.4-3.807-11.752-.238-3.613.312-7.107 1.447-10.414zm-65.64 120.928c5.496 14.215 12.952 27.97 20.136 41.58-17.916-10.752-58.268-14.487-64.808-14.402-3.1 17.06-10.632 26.4-25.02 35.74l14.899 2.978 19.804-23.074c26.19 15.067 75.1 30.943 84.442 19.444.305-9.276-.076-28.955-5.8-49.584-17.281.494-32.183-4.853-43.653-12.682z"/></svg>`;

function baseLayout(title, body) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:Georgia,'Times New Roman',serif;color:#2e1a1a;background:#faf9f9;margin:0;padding:0">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf9f9">
    <tr><td align="center" style="padding:40px 16px">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.08)">
        <tr>
          <td style="background:#2e1a1a;padding:28px 32px;text-align:center">
            ${LOGO_SVG}
            <span style="display:inline-block;vertical-align:middle;margin-left:12px;font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;color:#fefae0;letter-spacing:0.04em">Atlas Bodywork</span>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 32px 28px">
            <h2 style="font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:700;color:#2e1a1a;margin:0 0 20px">${title}</h2>
            ${body}
          </td>
        </tr>
        <tr>
          <td style="border-top:1px solid #d1d5db;padding:20px 32px;text-align:center">
            <p style="color:#806b6b;font-size:12px;font-family:Georgia,'Times New Roman',serif;margin:0">Atlas Bodywork &mdash; We&rsquo;ll see you soon!</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function apptCard(appt) {
  return `
    <div style="background:#f6f5f3;border-radius:8px;padding:20px;margin-bottom:24px;border-left:3px solid #af3e4d">
      <div style="margin-bottom:10px"><strong>Service:</strong> ${appt.service_name}</div>
      <div style="margin-bottom:10px"><strong>Therapist:</strong> ${appt.therapist_first_name} ${appt.therapist_last_name}</div>
      <div style="margin-bottom:10px"><strong>Date:</strong> ${fmtDate(appt.scheduled_at)}</div>
      <div><strong>Time:</strong> ${fmtTime(appt.scheduled_at)}</div>
    </div>`;
}

function ctaButton(href, label) {
  return `
    <div style="text-align:center;margin-bottom:24px">
      <a href="${href}" style="background:#af3e4d;color:#ffffff;padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:700;font-family:Georgia,'Times New Roman',serif;display:inline-block;letter-spacing:0.02em">
        ${label}
      </a>
    </div>`;
}

function clientConfirmHtml(name, appt, manageUrl = null) {
  const manageSection = manageUrl
    ? `<p style="margin-top:4px;font-size:14px">
         <a href="${manageUrl}" style="color:#af3e4d;font-weight:600">Cancel or reschedule your appointment</a>
         &mdash; this link works up to 24 hours before your appointment.
       </p>`
    : `<p style="color:#806b6b;font-size:14px">
         Need to cancel or reschedule? Log into your account at least 24 hours in advance.
       </p>`;
  return baseLayout('Booking Confirmed', `
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
    <p style="color:#806b6b;font-size:14px">
      Need to cancel? Please let us know as soon as possible.
    </p>`);
}

function feedbackRequestHtml(name, appt) {
  const feedbackUrl = `${config.app.url}/feedback?id=${appt.id}&token=${appt.feedback_token}`;
  return baseLayout('How was your visit?', `
    <p style="margin-bottom:16px">Hi ${name},</p>
    <p style="margin-bottom:24px">We hope you enjoyed your ${appt.service_name} today. Your feedback helps us continue to improve &mdash; we&rsquo;d love to hear how it went.</p>
    ${apptCard(appt)}
    ${ctaButton(feedbackUrl, 'Leave Feedback')}
    <p style="color:#806b6b;font-size:14px;text-align:center">Thank you for choosing Atlas Bodywork!</p>`);
}

function weekFollowupHtml(name, bookingUrl) {
  return baseLayout('Time for another session?', `
    <p style="margin-bottom:16px">Hi ${name},</p>
    <p style="margin-bottom:24px">It&rsquo;s been a week since your last visit at Atlas Bodywork. Regular massage therapy delivers the best results &mdash; we&rsquo;d love to have you back!</p>
    ${ctaButton(bookingUrl, 'Book Your Next Session')}
    <p style="color:#806b6b;font-size:14px;text-align:center">We look forward to seeing you soon.</p>`);
}

function monthFollowupHtml(name, bookingUrl) {
  return baseLayout("It&rsquo;s been a month &mdash; you deserve it", `
    <p style="margin-bottom:16px">Hi ${name},</p>
    <p style="margin-bottom:24px">A month has passed since your last appointment at Atlas Bodywork. Take a moment for yourself &mdash; you&rsquo;ve earned it.</p>
    ${ctaButton(bookingUrl, 'Schedule Your Next Visit')}
    <p style="color:#806b6b;font-size:14px;text-align:center">We look forward to seeing you soon.</p>`);
}

function therapistReminderHtml(therapistName, clientName, appt) {
  return baseLayout('Appointment Reminder', `
    <p style="margin-bottom:16px">Hi ${therapistName},</p>
    <p style="margin-bottom:24px">You have an appointment tomorrow.</p>
    ${apptCard(appt)}
    <p style="margin-bottom:0"><strong>Client:</strong> ${clientName}</p>`);
}

function paymentPromptHtml(therapistName, clientName, appt, actionUrl) {
  const isNoShow = appt.status === 'no_show';
  const hasCard  = !!appt.stripe_payment_method_id;
  const price    = appt.price_cents ? `$${(appt.price_cents / 100).toFixed(2)}` : null;

  let intro, actionLabel;
  if (isNoShow && hasCard) {
    intro       = `<strong>${clientName}</strong> did not appear for their ${appt.service_name} session. Their card is on file — you can charge the no-show fee directly from your bookings dashboard.`;
    actionLabel = `Charge No-Show Fee${price ? ` (${price})` : ''}`;
  } else if (isNoShow) {
    intro       = `<strong>${clientName}</strong> did not appear for their ${appt.service_name} session. No card is on file, so no automatic charge is possible — please note this in your records.`;
    actionLabel = 'View Appointment';
  } else {
    intro       = `Your ${appt.service_name} session with <strong>${clientName}</strong> has ended. Please record the in-person payment when you&rsquo;re ready.`;
    actionLabel = `Record In-Person Payment${price ? ` (${price})` : ''}`;
  }

  return baseLayout('Payment Action Required', `
    <p style="margin-bottom:16px">Hi ${therapistName},</p>
    <p style="margin-bottom:24px">${intro}</p>
    ${apptCard(appt)}
    ${ctaButton(actionUrl, actionLabel)}
    <p style="color:#806b6b;font-size:13px;text-align:center">
      This link takes you directly to your bookings dashboard where you can complete the action in one click.
    </p>`);
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

  async sendFeedbackRequest(appointmentId) {
    const appt = await this.repo.findAppointmentWithDetails(appointmentId);
    if (!appt) return;

    const clientName = appt.client_first_name ?? appt.guest_name ?? 'there';
    const clientEmail = appt.client_email ?? appt.guest_email;
    if (!clientEmail) return;

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
    await this.repo.markFeedbackSent(appointmentId);
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

  async sendPendingPaymentPrompts() {
    const appointments = await this.repo.findAppointmentsNeedingPaymentPrompt();
    logger.info('payment_prompt_worker_found', { count: appointments.length });

    for (const appt of appointments) {
      try {
        const actionUrl = `${config.app.url}/therapist/bookings?appt=${appt.id}`;
        const clientName = appt.client_first_name ?? appt.guest_name ?? 'your client';
        await this._email({
          userId: appt.therapist_user_id,
          to: appt.therapist_email,
          subject: appt.status === 'no_show'
            ? `No-show: ${clientName} — ${appt.service_name}`
            : `Please record payment: ${clientName} — ${appt.service_name}`,
          html: paymentPromptHtml(appt.therapist_first_name, clientName, appt, actionUrl),
        });
        await this.repo.markPaymentPromptSent(appt.id);
      } catch (err) {
        logger.error('payment_prompt_send_error', { appointmentId: appt.id, message: err.message });
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
