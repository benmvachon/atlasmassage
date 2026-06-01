import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

export default function OwnerDashboardPage() {
  const { user } = useAuth();

  return (
    <div className="page owner-hub">
      <div className="owner-hub__header">
        <h1>Welcome back, {user?.first_name}.</h1>
        <p className="owner-hub__greeting">
          Use the sidebar to manage your business.
        </p>
      </div>
      <div className="owner-hub__grid">
        <Link to="/owner/business" className="owner-hub__card">
          <h2 className="owner-hub__card-title">Business Details</h2>
          <p className="owner-hub__card-desc">
            Manage operating hours, massage tables, and service offerings.
          </p>
          <span className="owner-hub__card-cta">Manage &rarr;</span>
        </Link>
        <Link to="/owner/therapists" className="owner-hub__card">
          <h2 className="owner-hub__card-title">Therapist Management</h2>
          <p className="owner-hub__card-desc">
            Add, edit, and manage your team of licensed therapists.
          </p>
          <span className="owner-hub__card-cta">Manage &rarr;</span>
        </Link>
      </div>
    </div>
  );
}
