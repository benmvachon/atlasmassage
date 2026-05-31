import { Link, NavLink } from 'react-router-dom';

export default function Header() {
  return (
    <header className="header">
      <div className="header__inner container">
        <Link to="/" className="header__logo">
          Atlas Massage
        </Link>
        <nav className="header__nav" aria-label="Main navigation">
          <NavLink to="/" end>Home</NavLink>
          <NavLink to="/services">Services</NavLink>
          <NavLink to="/team">Team</NavLink>
          <NavLink to="/testimonials">Testimonials</NavLink>
          <NavLink to="/booking" className="btn btn--primary">Book Now</NavLink>
        </nav>
      </div>
    </header>
  );
}
