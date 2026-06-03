import { useEffect, useState } from 'react';
import { api } from '../services/api.js';

function Stars({ rating }) {
  if (!rating) return null;
  return (
    <p className="testimonial-card__stars" aria-label={`${rating} out of 5 stars`}>
      {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
    </p>
  );
}

export default function TestimonialsPage() {
  const [testimonials, setTestimonials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/testimonials')
      .then(res => setTestimonials(res.data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="page page--testimonials">
      <p className="testimonials__loading">Loading…</p>
    </div>
  );

  if (error) return (
    <div className="page page--testimonials">
      <p className="testimonials__error">Unable to load testimonials. Please try again later.</p>
    </div>
  );

  return (
    <div className="page page--testimonials">
      <div className="testimonials__intro">
        <h1 className="testimonials__heading">What Our Clients Say</h1>
        <p className="testimonials__tagline">
          Real experiences from the people we have the privilege of caring for.
        </p>
      </div>

      {testimonials.length === 0 ? (
        <p className="testimonials__empty">No testimonials yet — check back soon.</p>
      ) : (
        <ul className="testimonials__grid">
          {testimonials.map(t => (
            <li key={t.id} className="testimonial-card">
              <Stars rating={t.rating} />
              <blockquote className="testimonial-card__body">
                <p>{t.body}</p>
              </blockquote>
              <footer className="testimonial-card__author">— {t.author_name}</footer>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
