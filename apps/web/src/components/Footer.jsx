import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer__inner container">
        <p className="footer__copy">&copy; {new Date().getFullYear()} Atlas Bodywork. All rights reserved.</p>
        <nav className="footer__nav" aria-label="Footer navigation">
          <Link to="/anatomy">Anatomy</Link>
          <Link to="/booking">Book</Link>
          <Link to="/login">Login</Link>
        </nav>
      </div>
    </footer>
  );
}
