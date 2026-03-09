import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  className?: string;
}

export function Input({
  label,
  error,
  helperText,
  className,
  id,
  ...props
}: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

  const inputClasses = [
    'w-full bg-surface border rounded-lg px-3 py-2 text-slate-50 placeholder-slate-500',
    'focus:outline-none focus:ring-2 transition-colors duration-150',
    error
      ? 'border-red-500 focus:border-red-400 focus:ring-red-500/30'
      : 'border-slate-700 focus:border-maker focus:ring-maker/30',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-slate-300">
          {label}
        </label>
      )}
      <input id={inputId} className={inputClasses} {...props} />
      {error && (
        <p className="text-xs text-red-400" role="alert">
          {error}
        </p>
      )}
      {!error && helperText && (
        <p className="text-xs text-slate-500">{helperText}</p>
      )}
    </div>
  );
}
