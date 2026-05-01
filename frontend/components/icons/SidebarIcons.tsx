'use client';

import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const baseProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export function CalendarIcon({ className = 'h-5 w-5', ...props }: IconProps) {
  return (
    <svg {...baseProps} className={className} {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" />
      <path d="M8 14h3M13 14h3M8 18h3" />
    </svg>
  );
}

export function PropertiesIcon({ className = 'h-5 w-5', ...props }: IconProps) {
  return (
    <svg {...baseProps} className={className} {...props}>
      <rect x="3" y="4" width="7" height="16" rx="1.5" />
      <rect x="14" y="4" width="7" height="16" rx="1.5" />
      <path d="M6.5 8h0M6.5 12h0M6.5 16h0M17.5 8h0M17.5 12h0M17.5 16h0" />
    </svg>
  );
}

export function ReservationsIcon({ className = 'h-5 w-5', ...props }: IconProps) {
  return (
    <svg {...baseProps} className={className} {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" />
      <path d="m8 15 2.2 2.2L16 12.8" />
    </svg>
  );
}

export function ClientsIcon({ className = 'h-5 w-5', ...props }: IconProps) {
  return (
    <svg {...baseProps} className={className} {...props}>
      <circle cx="8" cy="9" r="3" />
      <circle cx="16" cy="10" r="2.5" />
      <path d="M3.5 19c.7-2.7 2.8-4 4.5-4s3.8 1.3 4.5 4M12.7 19c.4-1.8 1.8-3.1 3.3-3.4 1-.2 2.2.1 3.3 1" />
    </svg>
  );
}

export function CleaningsIcon({ className = 'h-5 w-5', ...props }: IconProps) {
  return (
    <svg {...baseProps} className={className} {...props}>
      <path d="M7 5h10M9 5v3l-4 4v2h14v-2l-4-4V5" />
      <path d="M8 17h8M10 20h4" />
    </svg>
  );
}

export function TeamIcon({ className = 'h-5 w-5', ...props }: IconProps) {
  return (
    <svg {...baseProps} className={className} {...props}>
      <circle cx="9" cy="8.5" r="3" />
      <path d="M4.5 19c.8-2.8 2.9-4.3 4.5-4.3s3.7 1.5 4.5 4.3" />
      <path d="M16.5 8.5h4M18.5 6.5v4" />
    </svg>
  );
}

export function SettingsIcon({ className = 'h-5 w-5', ...props }: IconProps) {
  return (
    <svg {...baseProps} className={className} {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.4.7a7.2 7.2 0 0 0-1.7-1L14.5 3h-5l-.3 2.7a7.2 7.2 0 0 0-1.7 1L5.1 6 3 9.5l2 1.5A7 7 0 0 0 5 12c0 .3 0 .7.1 1l-2 1.5L5.1 18l2.4-.7a7.2 7.2 0 0 0 1.7 1l.3 2.7h5l.3-2.7a7.2 7.2 0 0 0 1.7-1l2.4.7 2-3.5-2-1.5c.1-.3.1-.7.1-1Z" />
    </svg>
  );
}
