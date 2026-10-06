import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <main>
      <div style={{ textAlign: "center", padding: "4rem 1rem" }}>
        <h1 style={{ fontSize: "2.2rem", marginBottom: "0.75rem" }}>Page not found</h1>
        <p style={{ marginBottom: "1.5rem" }}>
          The page you're looking for doesn't exist, or the link might be out of date.
        </p>
        <Link to="/dashboard" className="btn btn-gold">
          Back to your groups
        </Link>
      </div>
    </main>
  );
}
