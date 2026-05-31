import { AppError } from '../middleware/errorHandler.js';

const stub = (_req, _res, next) => next(new AppError('Not implemented', 501, 'NOT_IMPLEMENTED'));

export const getPreferences = stub;
export const updatePreferences = stub;
export const listNotifications = stub;
