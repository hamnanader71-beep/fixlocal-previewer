import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center">
        <div className="text-6xl font-semibold">404</div>
        <p className="mt-2 text-muted-foreground">The page you're looking for doesn't exist.</p>
        <Link to="/dashboard" className="mt-4 inline-block text-primary hover:underline">Back to dashboard</Link>
      </div>
    </div>
  );
}
