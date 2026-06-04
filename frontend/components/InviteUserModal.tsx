'use client';

import { useState, useEffect } from 'react';
import { organizationsApi } from '@/lib/api';
import { Modal, ModalHeader, ModalBody, ModalFooter, ModalCloseButton, Button } from '@/components/ui';

interface InviteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function InviteUserModal({ isOpen, onClose, onSuccess }: InviteUserModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('manager');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tempPassword, setTempPassword] = useState('');

  useEffect(() => {
    if (isOpen) {
      setEmail('');
      setRole('manager');
      setFirstName('');
      setLastName('');
      setError('');
      setTempPassword('');
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await organizationsApi.invite({
        email: email.trim(),
        role,
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
      });
      if (res.data?.temporaryPassword) {
        setTempPassword(res.data.temporaryPassword);
        setEmail('');
        setRole('manager');
        setFirstName('');
        setLastName('');
      } else {
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Nu am putut trimite invitația.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setTempPassword('');
    onClose();
  };

  const handleDone = () => {
    onSuccess();
    handleClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} maxWidth="lg">
      <ModalHeader
        title={tempPassword ? 'Utilizator invitat' : 'Invită utilizator'}
        onClose={tempPassword ? handleDone : handleClose}
      />
      {tempPassword ? (
        <ModalBody className="space-y-4">
          <p className="text-sm text-gray-600">
            Transmite această parolă temporară utilizatorului. Se poate autentifica folosind emailul și parola de mai jos.
          </p>
          <div className="bg-gray-100 rounded-lg p-4 font-mono text-sm break-all">{tempPassword}</div>
          <div className="flex justify-end">
            <Button onClick={handleDone}>Am înțeles</Button>
          </div>
        </ModalBody>
      ) : (
        <form onSubmit={handleSubmit}>
          <ModalBody className="space-y-4">
            {error && <div className="error-box">{error}</div>}
            <div>
              <label className="label">Email *</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" required />
            </div>
            <div>
              <label className="label">Rol *</label>
              <select value={role} onChange={(e) => setRole(e.target.value)} className="select">
                <option value="owner">Proprietar</option>
                <option value="manager">Manager</option>
                <option value="cleaner">Curățenie</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Prenume</label>
                <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="input" />
              </div>
              <div>
                <label className="label">Nume</label>
                <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className="input" />
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <ModalCloseButton onClick={handleClose}>Anulează</ModalCloseButton>
            <Button type="submit" disabled={loading}>
              {loading ? 'Se trimite...' : 'Trimite invitația'}
            </Button>
          </ModalFooter>
        </form>
      )}
    </Modal>
  );
}
