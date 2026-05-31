import { Outlet } from 'react-router-dom';
import Header from '../components/Header';

export default function DashboardLayout() {
  return (
    <div className="layout layout--dashboard">
      <Header />
      <div className="layout__body">
        <main className="layout__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
