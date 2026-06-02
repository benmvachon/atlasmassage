import SidebarLayout from './SidebarLayout.jsx';

const NAV_ITEMS = [
  { to: '/therapist/bookings', label: 'My Bookings' },
  { to: '/therapist/schedule', label: 'Schedule' },
  { to: '/therapist/settings', label: 'Settings' },
];

export default function TherapistLayout() {
  return <SidebarLayout heading="Therapist" navItems={NAV_ITEMS} />;
}
