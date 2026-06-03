import { useEffect, useState } from 'react';
import { api } from '../services/api.js';

export default function TeamPage() {
  const [therapists, setTherapists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/team')
      .then(res => setTherapists(res.data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page page--team"><p className="team__loading">Loading…</p></div>;
  if (error) return <div className="page page--team"><p className="team__error">Unable to load team. Please try again later.</p></div>;

  return (
    <div className="page page--team">
      <div className="team__intro">
        <h1 className="team__heading">Meet Our Team</h1>
        <p className="team__tagline">
          Our licensed massage therapists bring expertise, care, and intention to every session.
        </p>
      </div>

      <ul className="team__grid">
        {therapists.map(therapist => (
          <li key={therapist.id} className="therapist-card">
            <div className="therapist-card__photo">
              {therapist.headshot_url
                ? <img src={therapist.headshot_url} alt={`${therapist.first_name} ${therapist.last_name}`} />
                : <div className="therapist-card__photo-placeholder" aria-hidden="true" />}
            </div>
            <div className="therapist-card__body">
              <h2 className="therapist-card__name">
                {therapist.first_name} {therapist.last_name}
              </h2>
              {therapist.specialties?.length > 0 && (
                <ul className="therapist-card__specialties">
                  {therapist.specialties.map(s => (
                    <li key={s} className="therapist-card__specialty">{s}</li>
                  ))}
                </ul>
              )}
              {therapist.bio && (
                <p className="therapist-card__bio">{therapist.bio}</p>
              )}
              {!therapist.is_accepting_clients && (
                <p className="therapist-card__status">Not currently accepting new clients</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
