import { useState, useEffect, useRef } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import logoSvg from '../assets/atlas.svg';

export default function Header() {
  const { user, logout } = useAuth();
  const isOwner = user?.roles?.includes('owner');
  const isTherapist = user?.roles?.includes('therapist');
  const [menuOpen, setMenuOpen] = useState(false);
  const navRef = useRef(null);
  const toggleRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleOutside(e) {
      if (navRef.current?.contains(e.target) || toggleRef.current?.contains(e.target)) return;
      setMenuOpen(false);
    }
    function handleEscape(e) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside, { passive: true });
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [menuOpen]);

  function close() { setMenuOpen(false); }

  return (
    <header className="header">
      <a href="#main-content" className="skip-nav">Skip to main content</a>
      <div className="header__inner container">
        <Link to="/" className="header__logo" onClick={close}>
          <img src={logoSvg} alt="" className="header__logo-icon" aria-hidden="true" />
          <span className="header__logo-text">ATLAS</span>
        </Link>
        <button
          ref={toggleRef}
          className={`header__menu-toggle${menuOpen ? ' header__menu-toggle--open' : ''}`}
          aria-expanded={menuOpen}
          aria-controls="header-nav"
          aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          onClick={() => setMenuOpen(v => !v)}
        >
          <span className="header__menu-toggle-bar" />
          <span className="header__menu-toggle-bar" />
          <span className="header__menu-toggle-bar" />
        </button>
        <nav
          id="header-nav"
          ref={navRef}
          className={`header__nav${menuOpen ? ' header__nav--open' : ''}`}
          aria-label="Main navigation"
        >
          <NavLink to="/" end onClick={close}>Home</NavLink>
          <NavLink to="/services" onClick={close}>Services</NavLink>
          <NavLink to="/team" onClick={close}>Team</NavLink>
          <NavLink to="/pathology" onClick={close}>Pathology</NavLink>
          <NavLink to="/testimonials" onClick={close}>Testimonials</NavLink>
          {/* <NavLink to="/memberships" onClick={close}>Memberships</NavLink> */}
          <NavLink to="/gift-cards" onClick={close}>Gift Cards</NavLink>
          <NavLink to="/booking" className="btn btn--primary" onClick={close}>Book Now</NavLink>
          {isTherapist && !isOwner && (
            <NavLink to="/therapist/schedule" className="header__schedule-link" onClick={close}>
              My Schedule
            </NavLink>
          )}
          {isOwner && (
            <NavLink to="/owner/dashboard" className="btn btn--outline" onClick={close}>
              Admin
            </NavLink>
          )}
          {user && (
            <NavLink
              to={isTherapist && !isOwner ? '/therapist/settings' : '/settings'}
              className="btn btn--outline"
              onClick={close}
            >
              Settings
            </NavLink>
          )}
          {user ? (
            <button className="btn btn--ghost header__signout" onClick={() => { logout(); close(); }}>
              Sign out
            </button>
          ) : (
            <NavLink to="/login" className="btn btn--outline" onClick={close}>Sign in</NavLink>
          )}
        </nav>
      </div>
    </header>
  );
}
