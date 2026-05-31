import { AppError } from '../middleware/errorHandler.js';

const stub = (_req, _res, next) => next(new AppError('Not implemented', 501, 'NOT_IMPLEMENTED'));

export const listAppointments = stub;
export const createAppointment = stub;
export const getAppointment = stub;
export const updateAppointment = stub;
export const cancelAppointment = stub;
export const confirmAppointment = stub;
export const completeAppointment = stub;
