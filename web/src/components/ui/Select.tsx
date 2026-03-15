import React from 'react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: SelectOption[];
  label?: string;
  error?: string;
  className?: string;
}

export function Select({
  options,
  label,
  error,
  className,
  id,
  ...props
}: SelectProps) {
  const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

  const selectClasses = [
    'w-full bg-surface border rounded-lg px-3 py-2 text-slate-50',
    'focus:outline-none focus:ring-2 transition-colors duration-150',
    'appearance-none cursor-pointer',
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
        <label htmlFor={selectId} className="text-sm font-medium text-slate-300">
          {label}
        </label>
      )}
      <div className="relative">
        <select id={selectId} className={selectClasses} {...props}>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-surface text-slate-50">
              {opt.label}
            </option>
          ))}
        </select>
        {/* Custom chevron */}
        <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
          <svg
            className="w-4 h-4 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      {error && (
        <p className="text-xs text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
