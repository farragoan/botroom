export function Footer() {
  return (
    <footer className="mt-auto">
      <div className="h-px bg-gradient-to-r from-maker via-checker to-maker opacity-30" />
      <div className="flex items-center justify-center px-6 py-3">
        <span className="text-xs text-slate-600 tracking-widest font-mono select-none">
          build {__APP_VERSION__}
        </span>
      </div>
    </footer>
  );
}
