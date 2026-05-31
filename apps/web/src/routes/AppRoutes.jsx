import { Routes, Route } from 'react-router-dom';
import PublicLayout from '../layouts/PublicLayout';
import AuthLayout from '../layouts/AuthLayout';
import DashboardLayout from '../layouts/DashboardLayout';

import HomePage from '../pages/HomePage';
import ServicesPage from '../pages/ServicesPage';
import TestimonialsPage from '../pages/TestimonialsPage';
import TeamPage from '../pages/TeamPage';
import LoginPage from '../pages/LoginPage';
import BookingPage from '../pages/BookingPage';
import SettingsPage from '../pages/SettingsPage';
import TherapistSchedulePage from '../pages/therapist/TherapistSchedulePage';
import TherapistSettingsPage from '../pages/therapist/TherapistSettingsPage';
import OwnerDashboardPage from '../pages/owner/OwnerDashboardPage';
import NotFoundPage from '../pages/NotFoundPage';

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/testimonials" element={<TestimonialsPage />} />
        <Route path="/team" element={<TeamPage />} />
        <Route path="/booking" element={<BookingPage />} />
      </Route>

      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>

      <Route element={<DashboardLayout />}>
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/therapist/schedule" element={<TherapistSchedulePage />} />
        <Route path="/therapist/settings" element={<TherapistSettingsPage />} />
        <Route path="/owner/dashboard" element={<OwnerDashboardPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
