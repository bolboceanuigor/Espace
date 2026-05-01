'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2 } from 'lucide-react';
import { getToken } from '@/lib/auth';
import { organizationsApi, propertiesApi, clientsApi } from '@/lib/api';

const STEPS = 4;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 2: first property
  const [propertyName, setPropertyName] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [rooms, setRooms] = useState('1');

  // Step 3: first client (optional)
  const [clientFirstName, setClientFirstName] = useState('');
  const [clientLastName, setClientLastName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace('/');
      return;
    }
    organizationsApi.getMe().then((res) => {
      if (res.data?.onboardingCompleted === true) {
        router.replace('/calendar');
      }
    }).catch(() => {});
  }, [router]);

  const handleStartSetup = () => {
    setError('');
    setStep(2);
  };

  const handleCreateProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await propertiesApi.create({
        name: propertyName.trim(),
        address: 'Address to be updated',
        basePrice: Math.max(0.01, parseFloat(basePrice) || 0),
        cleaningFee: 0,
        rooms: Math.max(1, parseInt(rooms, 10) || 1),
      });
      setStep(3);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create property');
    } finally {
      setLoading(false);
    }
  };

  const handleSkipClient = () => {
    setError('');
    setStep(4);
  };

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!clientFirstName.trim() || !clientPhone.trim()) {
      setError('First name and phone are required');
      return;
    }
    setLoading(true);
    try {
      await clientsApi.create({
        firstName: clientFirstName.trim(),
        lastName: clientLastName.trim() || undefined,
        phone: clientPhone.trim(),
        email: clientEmail.trim() || undefined,
      });
      setStep(4);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to add client');
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = async () => {
    setError('');
    setLoading(true);
    try {
      await organizationsApi.updateMe({ onboardingCompleted: true });
      router.replace('/calendar');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Something went wrong');
      setLoading(false);
    }
  };

  const progress = (step / STEPS) * 100;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Progress bar */}
      <div className="h-1 bg-gray-200">
        <div
          className="h-full bg-gray-800 transition-all duration-300 ease-in-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 transition-all duration-200 ease-in-out">
            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Step 1: Welcome */}
            {step === 1 && (
              <div className="text-center animate-modal-in">
                <div className="w-20 h-20 mx-auto mb-6 bg-gray-100 rounded-2xl flex items-center justify-center text-4xl">
                  <Building2 className="h-8 w-8 text-gray-700" />
                </div>
                <h1 className="text-xl font-semibold tracking-tight text-gray-800">
                  Welcome to Espace PMS
                </h1>
                <p className="mt-4 text-sm text-gray-600 max-w-sm mx-auto">
                  Set up your first property and client in a few steps. You can always add more later from the dashboard.
                </p>
                <button
                  type="button"
                  onClick={handleStartSetup}
                  className="mt-8 w-full sm:w-auto px-8 py-3 text-sm font-medium text-white bg-black rounded-lg hover:opacity-90 transition-all duration-200"
                >
                  Start Setup
                </button>
              </div>
            )}

            {/* Step 2: Create first property */}
            {step === 2 && (
              <div className="animate-modal-in">
                <h2 className="text-base font-medium text-gray-800">
                  Add your first property
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  Name, base price, and number of rooms.
                </p>
                <form onSubmit={handleCreateProperty} className="mt-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                    <input
                      type="text"
                      value={propertyName}
                      onChange={(e) => setPropertyName(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
                      placeholder="e.g. Beach House"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Base price (€) *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={basePrice}
                        onChange={(e) => setBasePrice(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
                        placeholder="0"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Rooms *</label>
                      <input
                        type="number"
                        min="1"
                        value={rooms}
                        onChange={(e) => setRooms(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
                        required
                      />
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-all duration-200"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-4 py-2 text-sm font-medium text-white bg-black rounded-lg hover:opacity-90 transition-all duration-200 disabled:opacity-50"
                    >
                      {loading ? 'Creating...' : 'Continue'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Step 3: Add first client (optional) */}
            {step === 3 && (
              <div className="animate-modal-in">
                <h2 className="text-base font-medium text-gray-800">
                  Add your first client
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  Optional. You can skip and add clients later.
                </p>
                <form onSubmit={handleAddClient} className="mt-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">First name</label>
                      <input
                        type="text"
                        value={clientFirstName}
                        onChange={(e) => setClientFirstName(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
                        placeholder="John"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Last name</label>
                      <input
                        type="text"
                        value={clientLastName}
                        onChange={(e) => setClientLastName(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
                        placeholder="Doe"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      type="text"
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
                      placeholder="+33 6 12 34 56 78"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
                      placeholder="john@example.com"
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-all duration-200"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleSkipClient}
                      className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-all duration-200"
                    >
                      Skip
                    </button>
                    <button
                      type="submit"
                      disabled={loading || (!clientFirstName.trim() || !clientPhone.trim())}
                      className="px-4 py-2 text-sm font-medium text-white bg-black rounded-lg hover:opacity-90 transition-all duration-200 disabled:opacity-50"
                    >
                      {loading ? 'Adding...' : 'Add client'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Step 4: Confirmation */}
            {step === 4 && (
              <div className="text-center animate-modal-in">
                <div className="w-20 h-20 mx-auto mb-6 bg-green-50 rounded-2xl flex items-center justify-center text-4xl">
                  ✓
                </div>
                <h1 className="text-xl font-semibold tracking-tight text-gray-800">
                  You&apos;re all set
                </h1>
                <p className="mt-4 text-sm text-gray-600 max-w-sm mx-auto">
                  Your workspace is ready. Go to the dashboard to manage properties, clients, and reservations.
                </p>
                <button
                  type="button"
                  onClick={handleFinish}
                  disabled={loading}
                  className="mt-8 w-full sm:w-auto px-8 py-3 text-sm font-medium text-white bg-black rounded-lg hover:opacity-90 transition-all duration-200 disabled:opacity-50"
                >
                  {loading ? 'Loading...' : 'Go to Dashboard'}
                </button>
              </div>
            )}
          </div>

          <p className="mt-6 text-center text-xs text-gray-400">
            Step {step} of {STEPS}
          </p>
        </div>
      </div>
    </div>
  );
}
