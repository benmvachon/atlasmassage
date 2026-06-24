import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
              {therapist.bio && (
                <p className="therapist-card__bio">{therapist.bio}</p>
              )}
              {therapist.is_accepting_clients ? (
                <Link
                  to={`/booking?therapistId=${therapist.id}`}
                  className="btn btn--primary btn--sm therapist-card__cta"
                >
                  View availability
                </Link>
              ) : (
                <p className="therapist-card__status">Not currently accepting new clients</p>
              )}
            </div>
          </li>
        ))}
      </ul>
      <p className="team__mission-statement">
      At Atlas Massage, it is our mission to provide therapeutic massage services that help people
      reduce pain, improve movement, recover from physical stress, and enhance their overall
      quality of life. We serve athletes, active individuals, and members of our community from all
      walks of life because we believe massage therapy is an essential part of health and wellness
      for everyone. Through personalized care and evidence-informed techniques, including sports
      massage, deep tissue therapy, and myofascial work, we address each client&apos;s unique needs
      and goals. We are committed to creating an inclusive, welcoming environment where every
      client can experience the healing, restorative, and performance-enhancing benefits of massage
      therapy.
      </p>
    </div>
  );
}
