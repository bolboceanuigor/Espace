'use client';

import { useEffect } from 'react';
import Button from './Button';

const overlayClass = 'fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-md';
const panelBase =
  'w-full max-h-[90vh] overflow-y-auto rounded-2xl border border-border/50 bg-white shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)] animate-modal-in';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Max width: sm (max-w-sm), md (max-w-md), lg (max-w-lg), xl (max-w-xl), 2xl (max-w-2xl). Default: lg */
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  /** Click overlay to close. Default: true */
  closeOnOverlayClick?: boolean;
}

const maxWidthClass = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
};

export default function Modal({
  isOpen,
  onClose,
  children,
  maxWidth = 'lg',
  closeOnOverlayClick = true,
}: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className={overlayClass}
      onClick={closeOnOverlayClick ? (e) => e.target === e.currentTarget && onClose() : undefined}
    >
      <div className={`${panelBase} mx-4 ${maxWidthClass[maxWidth]}`} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function ModalHeader({
  title,
  onClose,
  className = '',
}: {
  title: string;
  onClose?: () => void;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-between border-b border-border/40 px-6 py-5 ${className}`.trim()}>
      <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-muted-foreground transition-all duration-200 hover:bg-muted/50 hover:text-foreground"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

export function ModalBody({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`px-6 py-5 ${className}`.trim()} {...props} />;
}

export function ModalFooter({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`flex flex-wrap justify-end gap-2.5 border-t border-border/40 px-6 py-4 ${className}`.trim()} {...props} />
  );
}

export function ModalCloseButton({ onClick, children = 'Close' }: { onClick: () => void; children?: React.ReactNode }) {
  return (
    <Button variant="secondary" onClick={onClick}>
      {children}
    </Button>
  );
}

export function ModalPrimaryButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button onClick={onClick} disabled={disabled}>
      {children}
    </Button>
  );
}
