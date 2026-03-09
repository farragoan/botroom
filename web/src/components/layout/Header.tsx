import React from 'react';

export function Header() {
  return (
    <header className="sticky top-0 z-50 bg-[#0a0a0f]/80 backdrop-blur-md h-14 flex flex-col justify-end">
      <div className="flex items-center justify-between px-6 pb-3">
        <span
          className="text-xl font-bold tracking-widest bg-gradient-to-r from-maker to-checker bg-clip-text text-transparent select-none"
        >
          BOTROOM
        </span>
        <span className="text-sm text-slate-400 tracking-wide">AI Debate Arena</span>
      </div>
      {/* Thin gradient divider line */}
      <div className="h-px bg-gradient-to-r from-maker via-checker to-maker opacity-60" />
    </header>
  );
}
