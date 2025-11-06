import { useState } from 'react';

type ToastOptions = {
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
};

export function useToast() {
  const [toasts, setToasts] = useState<ToastOptions[]>([]);

  const toast = (options: ToastOptions) => {
    console.log('[Toast]', options);
    // For now, just use alert - you can implement a proper toast later
    if (options.variant === 'destructive') {
      alert(`❌ ${options.title}\n${options.description || ''}`);
    } else {
      alert(`✅ ${options.title}\n${options.description || ''}`);
    }
  };

  return { toast, toasts };
}
