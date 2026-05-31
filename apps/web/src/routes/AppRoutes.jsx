import { Routes, Route } from 'react-router-dom';
import PublicLayout from '../layouts/PublicLayout.jsx';
import AuthLayout from '../layouts/AuthLayout.jsx';
import DashboardLayout from '../layouts/DashboardLayout.jsx';
import ProtectedRoute from '../components/ProtectedRoute.jsx';

import HomePage from '../pages/HomePage.jsx';
import ServicesPage from '../pages/ServicesPage.jsx';
import TestimonialsPage from '../pages/TestimonialsPage.jsx';
import TeamPage from '../pages/TeamPage.jsx';
import LoginPage from '../pages/LoginPage.jsx';
import SignupPage from '../pages/SignupPage.jsx';
import BookingPage from '../pages/BookingPage.jsx';
import SettingsPage from '../pages/SettingsPage.jsx';
import TherapistSchedulePage from '../pages/therapist/TherapistSchedulePage.jsx';
import TherapistSettingsPage from '../pages/therapist/TherapistSettingsPage.jsx';
import OwnerDashboardPage from '../pages/owner/OwnerDashboardPage.jsx';
import NotFoundPage from '../pages/NotFoundPage.jsx';

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
        <Route path="/signup" element={<SignupPage />} />
      </Route>

      <Route element={<DashboardLayout />}>
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        <Route path="/therapist/schedule" element={<ProtectedRoute><TherapistSchedulePage /></ProtectedRoute>} />
        <Route path="/therapist/settings" element={<ProtectedRoute><TherapistSettingsPage /></ProtectedRoute>} />
        <Route path="/owner/dashboard" element={<ProtectedRoute><OwnerDashboardPage /></ProtectedRoute>} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
