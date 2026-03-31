export function Footer() {
  return (
    <footer className="mt-auto border-t border-zinc-800/60">
      <div className="flex items-center justify-center px-6 py-3">
        <span className="text-xs text-zinc-700 tracking-widest font-mono select-none tabular-nums">
          {__APP_VERSION__}
        </span>
      </div>
    </footer>
  );
}
