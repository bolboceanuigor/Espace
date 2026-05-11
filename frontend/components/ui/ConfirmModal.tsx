'use client';

import Modal, { ModalBody, ModalFooter, ModalHeader } from './Modal';
import Button from './Button';

type ConfirmModalProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
  isLoading?: boolean;
  disabled?: boolean;
  onClose: () => void;
  onConfirm: () => void;
  children?: React.ReactNode;
};

export default function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = 'Confirmă',
  cancelLabel = 'Anulează',
  variant = 'default',
  isLoading,
  disabled,
  onClose,
  onConfirm,
  children,
}: ConfirmModalProps) {
  return (
    <Modal isOpen={open} onClose={onClose} maxWidth="md">
      <ModalHeader title={title} onClose={onClose} />
      <ModalBody>
        {description ? <p className="text-sm leading-6 text-slate-600">{description}</p> : null}
        {children ? <div className="mt-4">{children}</div> : null}
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" disabled={isLoading} onClick={onClose}>{cancelLabel}</Button>
        <Button variant={variant === 'danger' ? 'danger' : 'primary'} disabled={disabled} isLoading={isLoading} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
