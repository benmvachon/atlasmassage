import { AppError } from '../middleware/errorHandler.js';

const stub = (_req, _res, next) => next(new AppError('Not implemented', 501, 'NOT_IMPLEMENTED'));

export const getDashboard = stub;
export const listUsers = stub;
export const listAppointments = stub;
export const getRevenue = stub;
export const listTherapists = stub;
export const updateSettings = stub;
export const getAuditLogs = stub;
