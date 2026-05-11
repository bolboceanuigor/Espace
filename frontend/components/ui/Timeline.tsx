'use client';

import { forwardRef, type ReactNode } from 'react';
import { Check, Circle, AlertCircle, Clock } from 'lucide-react';

export type TimelineItemStatus = 'completed' | 'current' | 'upcoming' | 'error' | 'warning';

export interface TimelineItem {
  id: string;
  title: string;
  description?: string;
  status: TimelineItemStatus;
  timestamp?: string;
  icon?: ReactNode;
}

export interface TimelineProps extends React.HTMLAttributes<HTMLDivElement> {
  items: TimelineItem[];
  variant?: 'vertical' | 'horizontal';
}

const statusStyles = {
  completed: {
    dot: 'bg-emerald-500 border-emerald-200',
    text: 'text-foreground',
    line: 'bg-emerald-200',
    icon: Check,
  },
  current: {
    dot: 'bg-sky-500 border-sky-200 ring-4 ring-sky-100',
    text: 'text-foreground font-medium',
    line: 'bg-border',
    icon: Circle,
  },
  upcoming: {
    dot: 'bg-muted border-border',
    text: 'text-muted-foreground',
    line: 'bg-border',
    icon: Circle,
  },
  error: {
    dot: 'bg-rose-500 border-rose-200',
    text: 'text-rose-600',
    line: 'bg-rose-200',
    icon: AlertCircle,
  },
  warning: {
    dot: 'bg-amber-500 border-amber-200',
    text: 'text-amber-600',
    line: 'bg-amber-200',
    icon: Clock,
  },
} as const;

const Timeline = forwardRef<HTMLDivElement, TimelineProps>(function Timeline(
  { items, variant = 'vertical', className = '', ...props },
  ref
) {
  if (variant === 'horizontal') {
    return (
      <div
        ref={ref}
        className={`flex items-start overflow-x-auto pb-2 ${className}`.trim()}
        {...props}
      >
        {items.map((item, index) => {
          const styles = statusStyles[item.status];
          const IconComponent = item.icon ? null : styles.icon;
          const isLast = index === items.length - 1;

          return (
            <div key={item.id} className="flex-shrink-0 flex flex-col items-center min-w-[120px]">
              <div className="flex items-center w-full">
                <div
                  className={`flex items-center justify-center size-8 rounded-full border-2 ${styles.dot}`}
                >
                  {item.icon || (IconComponent && (
                    <IconComponent className="size-4 text-white" />
                  ))}
                </div>
                {!isLast && (
                  <div className={`flex-1 h-0.5 ${styles.line}`} />
                )}
              </div>
              <div className="mt-2 text-center px-2">
                <p className={`text-xs ${styles.text}`}>{item.title}</p>
                {item.timestamp && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">{item.timestamp}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div ref={ref} className={`relative ${className}`.trim()} {...props}>
      {items.map((item, index) => {
        const styles = statusStyles[item.status];
        const IconComponent = item.icon ? null : styles.icon;
        const isLast = index === items.length - 1;

        return (
          <div key={item.id} className="flex gap-4 pb-6 last:pb-0">
            <div className="flex flex-col items-center">
              <div
                className={`flex items-center justify-center size-8 rounded-full border-2 flex-shrink-0 ${styles.dot}`}
              >
                {item.icon || (IconComponent && (
                  <IconComponent className="size-4 text-white" />
                ))}
              </div>
              {!isLast && (
                <div className={`w-0.5 flex-1 mt-2 ${styles.line}`} />
              )}
            </div>
            <div className="flex-1 pt-1">
              <p className={`text-sm ${styles.text}`}>{item.title}</p>
              {item.description && (
                <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
              )}
              {item.timestamp && (
                <p className="text-xs text-muted-foreground mt-1">{item.timestamp}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
});

export default Timeline;

// Stepper variant for wizard flows
export interface StepperProps {
  steps: { id: string; label: string; description?: string }[];
  currentStep: number;
  className?: string;
}

export function Stepper({ steps, currentStep, className = '' }: StepperProps) {
  return (
    <div className={`flex items-center ${className}`.trim()}>
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;
        const isLast = index === steps.length - 1;

        return (
          <div key={step.id} className="flex items-center flex-1 last:flex-initial">
            <div className="flex flex-col items-center">
              <div
                className={`flex items-center justify-center size-8 rounded-full border-2 text-sm font-medium transition-colors ${
                  isCompleted
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : isCurrent
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'bg-muted border-border text-muted-foreground'
                }`}
              >
                {isCompleted ? <Check className="size-4" /> : index + 1}
              </div>
              <div className="mt-2 text-center">
                <p
                  className={`text-xs font-medium ${
                    isCurrent ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {step.label}
                </p>
              </div>
            </div>
            {!isLast && (
              <div
                className={`flex-1 h-0.5 mx-3 ${
                  isCompleted ? 'bg-emerald-200' : 'bg-border'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
