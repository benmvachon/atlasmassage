import { Outlet } from 'react-router-dom';
import Header from '../components/Header.jsx';
import Footer from '../components/Footer.jsx';

export default function AuthLayout() {
  return (
    <div className="layout layout--auth">
      <Header />
      <main className="layout__content layout__content--centered">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
