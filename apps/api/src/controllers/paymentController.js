import { AppError } from '../middleware/errorHandler.js';

const stub = (_req, _res, next) => next(new AppError('Not implemented', 501, 'NOT_IMPLEMENTED'));

export const listPaymentMethods = stub;
export const addPaymentMethod = stub;
export const removePaymentMethod = stub;
export const setDefaultPaymentMethod = stub;
export const createPaymentIntent = stub;
export const handleWebhook = stub;
