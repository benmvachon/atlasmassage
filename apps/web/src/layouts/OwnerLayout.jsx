import { NavLink, Outlet } from 'react-router-dom';
import Header from '../components/Header.jsx';

const NAV_ITEMS = [
  { to: '/owner/dashboard', label: 'Overview', end: true },
  { to: '/owner/appointments', label: 'Calendar' },
  { to: '/owner/revenue', label: 'Revenue' },
  { to: '/owner/business', label: 'Business Details' },
  { to: '/owner/therapists', label: 'Therapists' },
];

export default function OwnerLayout() {
  return (
    <div className="layout layout--owner">
      <Header />
      <div className="layout__body">
        <nav className="owner-sidebar" aria-label="Admin navigation">
          <p className="owner-sidebar__heading">Admin</p>
          <ul className="owner-sidebar__list">
            {NAV_ITEMS.map(({ to, label, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
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
