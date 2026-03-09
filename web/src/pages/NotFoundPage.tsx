import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-56px)] gap-4 px-4 text-center">
      <p className="text-7xl font-black text-slate-700 select-none">404</p>
      <h1 className="text-2xl font-bold text-slate-50">Page not found</h1>
      <p className="text-slate-400 text-sm max-w-xs">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        to="/"
        className="mt-2 text-sm text-cyan-400 hover:text-cyan-300 underline underline-offset-2 transition-colors"
      >
        Back to home
      </Link>
    </div>
  );
}
