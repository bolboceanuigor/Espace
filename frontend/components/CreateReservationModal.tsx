'use client';

import { useState, useEffect } from 'react';
import { ApiClientError, reservationsApi, propertiesApi } from '@/lib/api';
import { Modal, ModalHeader, ModalBody, ModalFooter, ModalCloseButton, Button, useToast } from '@/components/ui';
import { useTranslations } from 'next-intl';

interface Property {
  id: string;
  name: string;
  address: string;
}

interface CreateReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialPropertyId?: string;
  initialCheckIn?: string;
  initialCheckOut?: string;
}

export default function CreateReservationModal({
  isOpen,
  onClose,
  onSuccess,
  initialPropertyId,
  initialCheckIn,
  initialCheckOut,
}: CreateReservationModalProps) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const tForm = useTranslations('form');
  const tActions = useTranslations('actions');
  const tErrors = useTranslations('errors');
  const tCommon = useTranslations('common');
  const tStatus = useTranslations('status');
  const tCalendar = useTranslations('calendar');
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    propertyId: initialPropertyId || '',
    guestName: '',
    phoneNumber: '',
    checkIn: initialCheckIn || '',
    checkOut: initialCheckOut || '',
    status: 'CONFIRMED',
    source: 'DIRECT',
    notes: '',
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      fetchProperties();
      if (initialPropertyId) {
        setFormData((prev) => ({ ...prev, propertyId: initialPropertyId }));
      }
      if (initialCheckIn) {
        setFormData((prev) => ({ ...prev, checkIn: initialCheckIn }));
      }
      if (initialCheckOut) {
        setFormData((prev) => ({ ...prev, checkOut: initialCheckOut }));
      }
    }
  }, [isOpen, initialPropertyId, initialCheckIn, initialCheckOut]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const fetchProperties = async () => {
    try {
      const response = await propertiesApi.getAll();
      setProperties(response.data);
    } catch (err) {
      console.error('Error fetching properties:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setLoading(true);

    try {
      const nextErrors: Record<string, string> = {};
      if (!formData.propertyId) nextErrors.propertyId = tErrors('required');
      if (!formData.guestName.trim()) nextErrors.guestName = tErrors('required');
      if (!formData.checkIn) nextErrors.checkIn = tErrors('required');
      if (!formData.checkOut) nextErrors.checkOut = tErrors('required');
      if (formData.checkIn && formData.checkOut && formData.checkIn >= formData.checkOut) {
        nextErrors.checkOut = tErrors('invalidDate');
      }
      if (Object.keys(nextErrors).length > 0) {
        setFieldErrors(nextErrors);
        setLoading(false);
        return;
      }

      await reservationsApi.create({
        propertyId: formData.propertyId,
        guestName: formData.guestName.trim(),
        phoneNumber: formData.phoneNumber.trim() || undefined,
        checkIn: formData.checkIn,
        checkOut: formData.checkOut,
        status: formData.status,
        source: formData.source,
        notes: formData.notes.trim() || undefined,
      });

      onSuccess();
      onClose();
      showToast(tCommon('saved'), 'success');
      setFormData({
        propertyId: '',
        guestName: '',
        phoneNumber: '',
        checkIn: '',
        checkOut: '',
        status: 'CONFIRMED',
        source: 'DIRECT',
        notes: '',
      });
    } catch (err: unknown) {
      const message =
        err instanceof ApiClientError && err.status === 409
          ? tErrors('overlap')
          : err instanceof Error && err.message
            ? err.message
            : tCommon('error');
      setError(message);
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="2xl">
      <ModalHeader title={tCalendar('newReservation')} onClose={onClose} />
      <form onSubmit={handleSubmit}>
        <ModalBody className="space-y-4">
          {error && <div className="error-box">{error}</div>}
          <div>
            <label className="label">{tForm('property')} *</label>
            <select
              autoFocus
              value={formData.propertyId}
              onChange={(e) => setFormData({ ...formData, propertyId: e.target.value })}
              className="select"
              required
            >
              <option value="">{tForm('property')}</option>
              {properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name} - {property.address}
                </option>
              ))}
            </select>
            {fieldErrors.propertyId ? <p className="mt-1 text-xs text-red-600">{fieldErrors.propertyId}</p> : null}
          </div>
          <div>
            <label className="label">{tForm('guestName')} *</label>
            <input
              type="text"
              value={formData.guestName}
              onChange={(e) => setFormData({ ...formData, guestName: e.target.value })}
              className="input"
              required
            />
            {fieldErrors.guestName ? <p className="mt-1 text-xs text-red-600">{fieldErrors.guestName}</p> : null}
          </div>
          <div>
            <label className="label">{tForm('phone')}</label>
            <input
              type="tel"
              value={formData.phoneNumber}
              onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
              className="input"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{tForm('startDate')} *</label>
              <input
                type="date"
                value={formData.checkIn}
                onChange={(e) => setFormData({ ...formData, checkIn: e.target.value })}
                className="input"
                required
              />
              {fieldErrors.checkIn ? <p className="mt-1 text-xs text-red-600">{fieldErrors.checkIn}</p> : null}
            </div>
            <div>
              <label className="label">{tForm('endDateCheckout')} *</label>
              <input
                type="date"
                value={formData.checkOut}
                onChange={(e) => setFormData({ ...formData, checkOut: e.target.value })}
                className="input"
                required
              />
            <p className="mt-1 text-xs text-muted-foreground">{tCalendar('endDateHelp')}</p>
              {fieldErrors.checkOut ? <p className="mt-1 text-xs text-red-600">{fieldErrors.checkOut}</p> : null}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{tForm('status')}</label>
              <select
                className="select"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                <option value="CONFIRMED">{tStatus('CONFIRMED')}</option>
                <option value="PENDING">{tStatus('PENDING')}</option>
                <option value="CANCELLED">{tStatus('CANCELLED')}</option>
                <option value="BLOCKED">{tStatus('BLOCKED')}</option>
              </select>
            </div>
            <div>
              <label className="label">{tForm('source')}</label>
              <select
                className="select"
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
              >
                <option value="DIRECT">DIRECT</option>
                <option value="AIRBNB">AIRBNB</option>
                <option value="BOOKING">BOOKING</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">{tForm('notes')}</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="input min-h-[90px]"
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <ModalCloseButton onClick={onClose}>{tActions('cancel')}</ModalCloseButton>
          <Button type="submit" disabled={loading}>
            {loading ? '...' : tActions('create')}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
