import { useEffect } from 'react';
import { AlertTriangle, CheckCircle } from 'lucide-react';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}

export function Toast({ message, type, onClose }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onClose, 2500);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className={`fixed top-6 right-6 z-[100] flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl border animate-slide-in
      ${
        type === 'success'
          ? 'bg-emerald-900/90 border-emerald-500/50 text-emerald-200'
          : 'bg-red-900/90 border-red-500/50 text-red-200'
      }`}
    >
      {type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
      <span className="font-medium">{message}</span>
    </div>
  );
}
