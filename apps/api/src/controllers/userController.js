import { AppError } from '../middleware/errorHandler.js';

const stub = (_req, _res, next) => next(new AppError('Not implemented', 501, 'NOT_IMPLEMENTED'));

export const getMe = stub;
export const updateMe = stub;
export const changePassword = stub;
export const listUsers = stub;
export const getUser = stub;
export const updateUser = stub;
export const deleteUser = stub;
