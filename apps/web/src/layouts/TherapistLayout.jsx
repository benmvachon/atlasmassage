import { NavLink, Outlet } from 'react-router-dom';
import Header from '../components/Header.jsx';

const NAV_ITEMS = [
  { to: '/therapist/bookings', label: 'My Bookings' },
  { to: '/therapist/schedule', label: 'Schedule' },
  { to: '/therapist/settings', label: 'Settings' },
];

export default function TherapistLayout() {
  return (
    <div className="layout layout--owner">
      <Header />
      <div className="layout__body">
        <nav className="owner-sidebar" aria-label="Therapist navigation">
          <p className="owner-sidebar__heading">Therapist</p>
          <ul className="owner-sidebar__list">
            {NAV_ITEMS.map(({ to, label }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  className={({ isActive }) =>
                    `owner-sidebar__link${isActive ? ' owner-sidebar__link--active' : ''}`
                  }
                >
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <main className="layout__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
