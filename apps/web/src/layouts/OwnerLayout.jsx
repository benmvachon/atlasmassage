import SidebarLayout from './SidebarLayout.jsx';

const NAV_ITEMS = [
  { to: '/owner/dashboard',   label: 'Overview',        end: true },
  { to: '/owner/appointments',label: 'Calendar' },
  { to: '/owner/transfers',   label: 'Transfers' },
  { to: '/owner/revenue',     label: 'Revenue' },
  { to: '/owner/business',    label: 'Business Details' },
  { to: '/owner/therapists',  label: 'Therapists' },
];

export default function OwnerLayout() {
  return <SidebarLayout heading="Admin" navItems={NAV_ITEMS} />;
}
