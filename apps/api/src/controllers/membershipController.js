import { AppError } from '../middleware/errorHandler.js';

const stub = (_req, _res, next) => next(new AppError('Not implemented', 501, 'NOT_IMPLEMENTED'));

export const listPlans = stub;
export const getPlan = stub;
export const createPlan = stub;
export const updatePlan = stub;
export const listMemberships = stub;
export const subscribe = stub;
export const getMembership = stub;
export const cancelMembership = stub;
export const pauseMembership = stub;
