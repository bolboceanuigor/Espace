'use client';

import { useState, useEffect } from 'react';
import { propertiesApi } from '@/lib/api';
import { Modal, ModalHeader, ModalBody, ModalFooter, ModalCloseButton, Button } from '@/components/ui';

export interface PropertyFormData {
  name: string;
  address: string;
  basePrice: string;
  cleaningFee: string;
  rooms: string;
  status: string;
}

interface PropertyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message?: string) => void;
  onLimitReached?: () => void;
  editProperty?: {
    id: string;
    name: string;
    address: string;
    basePrice: number;
    cleaningFee: number;
    rooms: number;
    status: string;
  } | null;
}

const defaultForm: PropertyFormData = {
  name: '',
  address: '',
  basePrice: '',
  cleaningFee: '',
  rooms: '1',
  status: 'active',
};

export default function PropertyModal({
  isOpen,
  onClose,
  onSuccess,
  onLimitReached,
  editProperty,
}: PropertyModalProps) {
  const [formData, setFormData] = useState<PropertyFormData>(defaultForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (editProperty) {
        setFormData({
          name: editProperty.name,
          address: editProperty.address,
          basePrice: String(editProperty.basePrice),
          cleaningFee: String(editProperty.cleaningFee),
          rooms: String(editProperty.rooms),
          status: editProperty.status || 'active',
        });
      } else {
        setFormData(defaultForm);
      }
      setError('');
    }
  }, [isOpen, editProperty]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = {
        name: formData.name.trim(),
        address: formData.address.trim(),
        basePrice: Math.max(0.01, parseFloat(formData.basePrice) || 0),
        cleaningFee: parseFloat(formData.cleaningFee) || 0,
        rooms: Math.max(1, parseInt(formData.rooms, 10) || 1),
        status: formData.status || 'active',
      };
      if (!payload.name || !payload.address) {
        setError('Name and address are required');
        setLoading(false);
        return;
      }
      if (editProperty) {
        await propertiesApi.update(editProperty.id, payload);
        onSuccess('Property updated.');
      } else {
        await propertiesApi.create(payload);
        onSuccess('Property created.');
      }
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Something went wrong';
      setError(msg);
      if ((msg.includes('limit') || msg.includes('Upgrade')) && onLimitReached) onLimitReached();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="lg">
      <ModalHeader title={editProperty ? 'Edit Property' : 'Add Property'} onClose={onClose} />
      <form onSubmit={handleSubmit}>
        <ModalBody className="space-y-4">
          {error && <div className="error-box">{error}</div>}
          <div>
            <label className="label">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input"
              required
            />
          </div>
          <div>
            <label className="label">Address *</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="input"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Base Price (€)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={formData.basePrice}
                onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="label">Cleaning Fee (€)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.cleaningFee}
                onChange={(e) => setFormData({ ...formData, cleaningFee: e.target.value })}
                className="input"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Rooms</label>
              <input
                type="number"
                min="1"
                value={formData.rooms}
                onChange={(e) => setFormData({ ...formData, rooms: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="label">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="select"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <ModalCloseButton onClick={onClose}>Cancel</ModalCloseButton>
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving...' : editProperty ? 'Update' : 'Create'}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
