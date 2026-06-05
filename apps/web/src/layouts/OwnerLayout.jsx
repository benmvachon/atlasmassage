import { useAuth } from '../context/AuthContext.jsx';
import SidebarLayout from './SidebarLayout.jsx';

const OWNER_NAV_ITEMS = [
  { to: '/owner/dashboard',      label: 'Overview',        end: true },
  { to: '/owner/appointments',   label: 'Calendar' },
  { to: '/owner/transfers',      label: 'Transfers' },
  { to: '/owner/revenue',        label: 'Revenue' },
  { to: '/owner/business',       label: 'Business Details' },
  { to: '/owner/therapists',     label: 'Therapists' },
  { to: '/owner/testimonials',   label: 'Testimonials' },
];

const THERAPIST_NAV_ITEMS = [
  { divider: true,                   label: 'My Schedule' },
  { to: '/therapist/bookings',       label: 'My Bookings' },
  { to: '/therapist/schedule',       label: 'Schedule' },
  { to: '/therapist/settings',       label: 'Settings' },
];

export default function OwnerLayout() {
  const { user } = useAuth();
  const isAlsoTherapist = user?.roles?.includes('therapist');
  const navItems = isAlsoTherapist
    ? [...OWNER_NAV_ITEMS, ...THERAPIST_NAV_ITEMS]
    : OWNER_NAV_ITEMS;

  return <SidebarLayout heading="Admin" navItems={navItems} />;
}
