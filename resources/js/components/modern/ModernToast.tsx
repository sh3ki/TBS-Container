import React, { useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ModernToastProps {
  type: ToastType;
  message: string;
  title?: string;
  duration?: number;
  onClose: () => void;
}

const toastConfig = {
  success: {
    icon: CheckCircle,
    bgColor: '#10B981',
    borderColor: '#059669',
  },
  error: {
    icon: XCircle,
    bgColor: '#EF4444',
    borderColor: '#DC2626',
  },
  warning: {
    icon: AlertTriangle,
    bgColor: '#F59E0B',
    borderColor: '#D97706',
  },
  info: {
    icon: Info,
    bgColor: '#3E9AF4',
    borderColor: '#2563EB',
  },
};

export const ModernToast: React.FC<ModernToastProps> = ({
  type,
  message,
  title,
  duration = 3000,
  onClose,
}) => {
  const config = toastConfig[type];
  const Icon = config.icon;

  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div
      className="fixed top-4 right-4 z-[9999] w-96 animate-in slide-in-from-top-5 fade-in duration-300"
      role="alert"
    >
      <div
        className="rounded-lg shadow-lg overflow-hidden border-l-4"
        style={{
          backgroundColor: 'white',
          borderLeftColor: config.bgColor,
        }}
      >
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div
              className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: `${config.bgColor}20` }}
            >
              <Icon className="w-5 h-5" style={{ color: config.bgColor }} />
            </div>
            <div className="flex-1 min-w-0">
              {title && (
                <h4 className="text-sm font-semibold text-gray-900 mb-1">
                  {title}
                </h4>
              )}
              <p className="text-sm text-gray-600">{message}</p>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 ml-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Toast Container Component
interface ToastContainerProps {
  toasts: Array<{
    id: string;
    type: ToastType;
    message: string;
    title?: string;
    duration?: number;
  }>;
  removeToast: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, removeToast }) => {
  return (
    <div className="fixed top-4 right-4 z-[9999] space-y-3">
      {toasts.map((toast, index) => (
        <div
          key={toast.id}
          style={{ marginTop: index > 0 ? '12px' : '0' }}
        >
          <ModernToast
            type={toast.type}
            message={toast.message}
            title={toast.title}
            duration={toast.duration}
            onClose={() => removeToast(toast.id)}
          />
        </div>
      ))}
    </div>
  );
};

// Custom hook for using toast
export const useModernToast = () => {
  const [toasts, setToasts] = React.useState<Array<{
    id: string;
    type: ToastType;
    message: string;
    title?: string;
    duration?: number;
  }>>([]);

  const showToast = (
    type: ToastType,
    message: string,
    title?: string,
    duration?: number
  ) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message, title, duration }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  return {
    toasts,
    showToast,
    removeToast,
    success: (message: string, title?: string) => showToast('success', message, title),
    error: (message: string, title?: string) => showToast('error', message, title),
    warning: (message: string, title?: string) => showToast('warning', message, title),
    info: (message: string, title?: string) => showToast('info', message, title),
  };
};

// Add to global CSS for progress animation
const style = document.createElement('style');
style.textContent = `
  @keyframes progress {
    from {
      width: 100%;
    }
    to {
      width: 0%;
    }
  }
  
  .animate-progress {
    animation: progress 3000ms linear;
  }
`;
document.head.appendChild(style);
