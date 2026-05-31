import { Outlet } from 'react-router-dom';

export default function AuthLayout() {
  return (
    <div className="layout layout--auth">
      <main className="layout__content layout__content--centered">
        <Outlet />
      </main>
    </div>
  );
}
