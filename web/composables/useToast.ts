export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

export function useToast() {
  const toasts = useState<Toast[]>('toasts', () => []);

  function show(message: string, type: ToastType = 'success', duration: number = 3000) {
    const id = Math.random().toString(36).substring(7);
    
    toasts.value.push({
      id,
      message,
      type,
      duration
    });

    // Auto-remove after duration
    if (duration > 0) {
      setTimeout(() => {
        remove(id);
      }, duration);
    }
  }

  function remove(id: string) {
    toasts.value = toasts.value.filter(t => t.id !== id);
  }

  function success(message: string, duration?: number) {
    show(message, 'success', duration);
  }

  function error(message: string, duration?: number) {
    show(message, 'error', duration);
  }

  function warning(message: string, duration?: number) {
    show(message, 'warning', duration);
  }

  function info(message: string, duration?: number) {
    show(message, 'info', duration);
  }

  return {
    toasts,
    show,
    remove,
    success,
    error,
    warning,
    info
  };
}

