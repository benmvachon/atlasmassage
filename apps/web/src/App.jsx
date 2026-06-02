import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { MembershipProvider } from './context/MembershipContext.jsx';
import AppRoutes from './routes/AppRoutes.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <MembershipProvider>
          <AppRoutes />
        </MembershipProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
