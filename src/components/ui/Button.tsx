import React from 'react';
import { Spinner } from '@/components/ui/Spinner';

type ButtonVariant = 'primary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  className?: string;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-r from-maker to-checker text-white border-transparent hover:opacity-90 active:opacity-80',
  ghost:
    'bg-transparent border border-slate-700 text-slate-300 hover:border-slate-500 hover:text-slate-100 active:bg-slate-800/50',
  danger:
    'bg-red-600 border-transparent text-white hover:bg-red-500 active:bg-red-700',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-6 py-3 text-base gap-2',
};

const spinnerSizeMap: Record<ButtonSize, 'sm' | 'md' | 'lg'> = {
  sm: 'sm',
  md: 'sm',
  lg: 'md',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const baseClasses =
    'inline-flex items-center justify-center font-medium rounded-lg border transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-maker/50 select-none';

  const disabledClasses = isDisabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'cursor-pointer';

  const classes = [baseClasses, variantClasses[variant], sizeClasses[size], disabledClasses, className]
    .filter(Boolean)
    .join(' ');

  return (
    <button {...props} disabled={isDisabled} className={classes}>
      {loading && <Spinner size={spinnerSizeMap[size]} />}
      {children}
    </button>
  );
}
