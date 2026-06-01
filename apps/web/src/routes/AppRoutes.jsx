import { Routes, Route } from 'react-router-dom';
import PublicLayout from '../layouts/PublicLayout.jsx';
import AuthLayout from '../layouts/AuthLayout.jsx';
import DashboardLayout from '../layouts/DashboardLayout.jsx';
import OwnerLayout from '../layouts/OwnerLayout.jsx';
import ProtectedRoute from '../components/ProtectedRoute.jsx';
import OwnerRoute from '../components/OwnerRoute.jsx';

import HomePage from '../pages/HomePage.jsx';
import ServicesPage from '../pages/ServicesPage.jsx';
import TestimonialsPage from '../pages/TestimonialsPage.jsx';
import TeamPage from '../pages/TeamPage.jsx';
import LoginPage from '../pages/LoginPage.jsx';
import SignupPage from '../pages/SignupPage.jsx';
import ForgotPasswordPage from '../pages/ForgotPasswordPage.jsx';
import ResetPasswordPage from '../pages/ResetPasswordPage.jsx';
import BookingPage from '../pages/BookingPage.jsx';
import SettingsPage from '../pages/SettingsPage.jsx';
import TherapistSchedulePage from '../pages/therapist/TherapistSchedulePage.jsx';
import TherapistSettingsPage from '../pages/therapist/TherapistSettingsPage.jsx';
import OwnerDashboardPage from '../pages/owner/OwnerDashboardPage.jsx';
import BusinessDetailsPage from '../pages/owner/BusinessDetailsPage.jsx';
import TherapistManagementPage from '../pages/owner/TherapistManagementPage.jsx';
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
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Route>

      <Route element={<DashboardLayout />}>
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        <Route path="/therapist/schedule" element={<ProtectedRoute><TherapistSchedulePage /></ProtectedRoute>} />
        <Route path="/therapist/settings" element={<ProtectedRoute><TherapistSettingsPage /></ProtectedRoute>} />
      </Route>

      <Route element={<OwnerRoute><OwnerLayout /></OwnerRoute>}>
        <Route path="/owner/dashboard" element={<OwnerDashboardPage />} />
        <Route path="/owner/business" element={<BusinessDetailsPage />} />
        <Route path="/owner/therapists" element={<TherapistManagementPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
