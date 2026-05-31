import { AppError } from '../middleware/errorHandler.js';

const stub = (_req, _res, next) => next(new AppError('Not implemented', 501, 'NOT_IMPLEMENTED'));

export const listAvailableTherapists = stub;
export const getAvailableSlots = stub;
export const getTherapistAvailability = stub;
export const setTherapistAvailability = stub;
