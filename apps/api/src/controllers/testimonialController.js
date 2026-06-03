import { getPool } from '../database/pool.js';
import { TestimonialRepository } from '../repositories/testimonialRepository.js';
import { AppError } from '../middleware/errorHandler.js';

function repo() {
  return new TestimonialRepository(getPool());
}

export async function listPublished(_req, res, next) {
  try {
    const testimonials = await repo().findPublished();
    res.json({ success: true, data: testimonials });
  } catch (err) {
    next(err);
  }
}

export async function listAll(_req, res, next) {
  try {
    const testimonials = await repo().findAll();
    res.json({ success: true, data: testimonials });
  } catch (err) {
    next(err);
  }
}

export async function createTestimonial(req, res, next) {
  try {
    const { authorName, body, rating, isPublished, displayOrder } = req.body;
    const testimonial = await repo().create({ authorName, body, rating, isPublished, displayOrder });
    res.status(201).json({ success: true, data: testimonial });
  } catch (err) {
    next(err);
  }
}

export async function updateTestimonial(req, res, next) {
  try {
    const { authorName, body, rating, isPublished, displayOrder } = req.body;
    const testimonial = await repo().update(req.params.id, { authorName, body, rating, isPublished, displayOrder });
    if (!testimonial) throw new AppError('Testimonial not found', 404, 'NOT_FOUND');
    res.json({ success: true, data: testimonial });
  } catch (err) {
    next(err);
  }
}

export async function deleteTestimonial(req, res, next) {
  try {
    const result = await repo().delete(req.params.id);
    if (!result) throw new AppError('Testimonial not found', 404, 'NOT_FOUND');
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}
