import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Header() {
  const { user, logout } = useAuth();
  const isOwner = user?.roles?.includes('owner');
  const isTherapist = user?.roles?.includes('therapist');

  return (
    <header className="header">
      <div className="header__inner container">
        <Link to="/" className="header__logo">
          Atlas Massage
        </Link>
        <nav className="header__nav" aria-label="Main navigation">
          <NavLink to="/" end>Home</NavLink>
          <NavLink to="/services">Services</NavLink>
          <NavLink to="/memberships">Memberships</NavLink>
          <NavLink to="/team">Team</NavLink>
          <NavLink to="/testimonials">Testimonials</NavLink>
          <NavLink to="/booking" className="btn btn--primary">Book Now</NavLink>
          {isTherapist && !isOwner && (
            <NavLink to="/therapist/schedule" className="header__schedule-link">
              My Schedule
            </NavLink>
          )}
          {isOwner && (
            <NavLink to="/owner/dashboard" className="header__admin-link">
              Admin
            </NavLink>
          )}
          {user && (
            <NavLink
              to={isTherapist && !isOwner ? '/therapist/settings' : '/settings'}
              className="header__settings-link"
            >
              Settings
            </NavLink>
          )}
          {user ? (
            <button className="btn btn--ghost header__signout" onClick={logout}>
              Sign out
            </button>
          ) : (
            <NavLink to="/login" className="btn btn--outline">Sign in</NavLink>
          )}
        </nav>
      </div>
    </header>
  );
}
