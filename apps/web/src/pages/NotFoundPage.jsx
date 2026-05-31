import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="page page--not-found">
      <h1>404 — Page Not Found</h1>
      <p>The page you&apos;re looking for doesn&apos;t exist.</p>
      <Link to="/" className="btn btn--primary">Go Home</Link>
    </div>
  );
}
