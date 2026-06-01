import { getPool } from '../database/pool.js';
import { NotificationRepository } from '../repositories/notificationRepository.js';

function repo() {
  return new NotificationRepository(getPool());
}

export async function getPreferences(req, res, next) {
  try {
    const preferences = await repo().getOrCreatePreferences(req.user.sub);
    res.json({ success: true, data: { preferences } });
  } catch (err) {
    next(err);
  }
}

export async function updatePreferences(req, res, next) {
  try {
    const { emailAppointmentRemind, emailBookingConfirm, smsAppointmentRemind, smsBookingConfirm } = req.body;
    const preferences = await repo().updatePreferences(req.user.sub, {
      emailAppointmentRemind,
      emailBookingConfirm,
      smsAppointmentRemind,
      smsBookingConfirm,
    });
    res.json({ success: true, data: { preferences } });
  } catch (err) {
    next(err);
  }
}

export async function listNotifications(req, res, next) {
  try {
    const notifications = await repo().findByUser(req.user.sub);
    res.json({ success: true, data: { notifications } });
  } catch (err) {
    next(err);
  }
}
