import { NavLink, Outlet } from 'react-router-dom';
import Header from '../components/Header.jsx';

/**
 * Shared sidebar layout used by TherapistLayout and OwnerLayout.
 * Renders Header + left sidebar nav + main content area.
 */
export default function SidebarLayout({ heading, navItems }) {
  return (
    <div className="layout layout--owner">
      <Header />
      <div className="layout__body">
        <nav className="owner-sidebar" aria-label={`${heading} navigation`}>
          <p className="owner-sidebar__heading">{heading}</p>
          <ul className="owner-sidebar__list">
            {navItems.map(({ to, label, end }) => (
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
        <main id="main-content" className="layout__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
