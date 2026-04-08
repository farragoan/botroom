import { SignIn } from '@clerk/react';
import { Link } from 'react-router-dom';

export default function SignInPage() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#09090b]/95 backdrop-blur-sm px-4">
      {/* Logo */}
      <Link
        to="/"
        className="mb-8 font-mono text-base font-bold tracking-widest bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent select-none"
      >
        BOTROOM
      </Link>

      {/* Clerk sign-in widget */}
      <SignIn routing="path" path="/sign-in" fallbackRedirectUrl="/arena" />

      {/* Back link */}
      <Link
        to="/"
        className="mt-6 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
      >
        ← Back to home
      </Link>
    </div>
  );
}
