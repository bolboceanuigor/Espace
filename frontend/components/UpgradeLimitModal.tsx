'use client';

interface UpgradeLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
}

export default function UpgradeLimitModal({
  isOpen,
  onClose,
  title = 'Limit reached',
  message = 'You reached the current limit. Contact your administrator.',
}: UpgradeLimitModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full max-w-md mx-4 p-6 animate-modal-in">
        <h2 className="text-xl font-semibold tracking-tight text-gray-900">{title}</h2>
        <p className="mt-2 text-sm text-gray-600">{message}</p>
        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-all duration-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
