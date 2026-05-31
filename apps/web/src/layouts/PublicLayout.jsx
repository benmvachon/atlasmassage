import { Outlet } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';

export default function PublicLayout() {
  return (
    <div className="layout layout--public">
      <Header />
      <main className="layout__content">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
