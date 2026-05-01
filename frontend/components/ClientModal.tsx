'use client';

import { useState, useEffect } from 'react';
import { clientsApi } from '@/lib/api';
import { Modal, ModalHeader, ModalBody, ModalFooter, ModalCloseButton, Button } from '@/components/ui';

export interface ClientFormData {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  notes: string;
}

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message?: string) => void;
}

const defaultForm: ClientFormData = {
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  notes: '',
};

export default function ClientModal({ isOpen, onClose, onSuccess }: ClientModalProps) {
  const [formData, setFormData] = useState<ClientFormData>(defaultForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setFormData(defaultForm);
      setError('');
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim() || undefined,
        phone: formData.phone.trim(),
        email: formData.email.trim() || undefined,
        notes: formData.notes.trim() || undefined,
      };
      if (!payload.firstName || !payload.phone) {
        setError('First name and phone are required');
        setLoading(false);
        return;
      }
      await clientsApi.create(payload);
      onSuccess('Client created.');
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="lg">
      <ModalHeader title="Add Client" onClose={onClose} />
      <form onSubmit={handleSubmit}>
        <ModalBody className="space-y-4">
          {error && <div className="error-box">{error}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">First name *</label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                className="input"
                required
              />
            </div>
            <div>
              <label className="label">Last name</label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                className="input"
              />
            </div>
          </div>
          <div>
            <label className="label">Phone *</label>
            <input
              type="text"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="input"
              required
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="input"
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <ModalCloseButton onClick={onClose}>Cancel</ModalCloseButton>
          <Button type="submit" disabled={loading}>
            {loading ? 'Creating...' : 'Create'}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
