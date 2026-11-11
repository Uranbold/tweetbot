import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="card empty-page">
      <h1>Page not found</h1>
      <p className="muted">The page you were looking for does not exist.</p>
      <Link className="btn btn--primary" to="/">
        Go to today’s weather
      </Link>
    </div>
  );
}
