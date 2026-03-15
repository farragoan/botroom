import React from 'react';
import type { DebateAction } from '@/types/debate';

type BadgeVariant = 'default' | 'maker' | 'checker';

interface BadgeProps {
  action?: DebateAction;
  variant?: BadgeVariant;
  children?: React.ReactNode;
  className?: string;
}

const actionClasses: Record<DebateAction, string> = {
  CONTINUE: 'bg-slate-700 text-slate-300',
  CONCLUDE: 'bg-emerald-900/50 text-emerald-400 border border-emerald-800',
  CONCEDE: 'bg-amber-900/50 text-amber-400 border border-amber-800',
};

const actionLabels: Record<DebateAction, string> = {
  CONTINUE: 'Continue',
  CONCLUDE: 'Conclude',
  CONCEDE: 'Concede',
};

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-slate-700 text-slate-300',
  maker: 'bg-maker-dim text-maker border border-maker-border',
  checker: 'bg-checker-dim text-checker border border-checker-border',
};

export function Badge({ action, variant = 'default', children, className }: BadgeProps) {
  const baseClasses = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium';

  const colorClasses = action ? actionClasses[action] : variantClasses[variant];

  const classes = [baseClasses, colorClasses, className].filter(Boolean).join(' ');

  return (
    <span className={classes}>
      {action ? actionLabels[action] : children}
    </span>
  );
}
