'use client';

import Badge from './Badge';

type StatusBadgeProps = {
  status: string;
  className?: string;
};

const SUCCESS = new Set(['SUCCESS', 'DONE', 'RESOLVED', 'ACTIVE', 'CONFIRMED', 'PAID', 'COMPLETED']);
const WARNING = new Set(['WARNING', 'PENDING', 'IN_PROGRESS', 'WAITING', 'TRIAL', 'PAST_DUE']);
const ERROR = new Set(['ERROR', 'FAILED', 'CANCELLED', 'CLOSED', 'SUSPENDED', 'OVERDUE', 'URGENT']);

export default function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const normalized = String(status || '').toUpperCase();
  const variant = SUCCESS.has(normalized)
    ? 'success'
    : WARNING.has(normalized)
      ? 'warning'
      : ERROR.has(normalized)
        ? 'error'
        : 'default';

  return <Badge variant={variant} className={className}>{normalized || 'INFO'}</Badge>;
}
