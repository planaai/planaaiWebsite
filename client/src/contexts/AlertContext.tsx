'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Info } from 'lucide-react';

interface AlertState {
  isOpen: boolean;
  title: string;
  message: string | ReactNode;
  onConfirm?: () => void;
  onCancel?: () => void;
}

interface AlertContextType {
  showAlert: (title: string, message: string | ReactNode) => void;
  showConfirm: (title: string, message: string | ReactNode, onConfirm: () => void, onCancel?: () => void) => void;
  hideAlert: () => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export function useAlert() {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
}

export function AlertProvider({ children }: { children: ReactNode }) {
  const [alertState, setAlertState] = useState<AlertState>({
    isOpen: false,
    title: '',
    message: ''
  });

  const showAlert = (title: string, message: string | ReactNode) => {
    setAlertState({
      isOpen: true,
      title,
      message,
      onConfirm: undefined,
      onCancel: undefined
    });
  };

  const showConfirm = (title: string, message: string | ReactNode, onConfirm: () => void, onCancel?: () => void) => {
    setAlertState({
      isOpen: true,
      title,
      message,
      onConfirm,
      onCancel
    });
  };

  const hideAlert = () => {
    setAlertState((prev) => ({ ...prev, isOpen: false }));
  };

  const handleConfirm = () => {
    if (alertState.onConfirm) {
      alertState.onConfirm();
    }
    hideAlert();
  };

  const handleCancel = () => {
    if (alertState.onCancel) {
      alertState.onCancel();
    }
    hideAlert();
  };

  return (
    <AlertContext.Provider value={{ showAlert, showConfirm, hideAlert }}>
      {children}
      {alertState.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm fade-in-anim" style={{ animationDuration: '0.2s' }}>
          <div className="bg-white border-2 border-[var(--plana-primary)] rounded-xl shadow-[0_10px_40px_rgba(255,166,201,0.4)] w-full max-w-sm overflow-hidden flex flex-col transform transition-all slide-in-right-anim" style={{ animationDelay: '0s', animationDuration: '0.25s' }}>
            <div className="bg-gradient-to-r from-[var(--plana-primary)] to-[var(--plana-primary-light)] p-4 flex justify-between items-center text-white">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Info size={20} className="opacity-90" />
                <span>{alertState.title}</span>
              </h3>
              <button 
                onClick={handleCancel}
                className="text-white hover:text-pink-100 transition-colors focus:outline-none"
              >
                ✕
              </button>
            </div>
            <div className="p-8 text-center text-slate-700 text-lg font-bold">
              {alertState.message}
            </div>
            <div className="p-4 bg-slate-50 flex justify-center border-t border-slate-100 gap-3">
              {alertState.onConfirm ? (
                <>
                  <button
                    onClick={handleCancel}
                    className="px-6 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-bold transition-all"
                  >
                    아니오
                  </button>
                  <button
                    onClick={handleConfirm}
                    className="px-6 py-2.5 bg-[var(--plana-primary)] hover:bg-[var(--plana-primary-dark)] text-white rounded-lg font-bold transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5 active:translate-y-0"
                  >
                    네
                  </button>
                </>
              ) : (
                <button
                  onClick={handleConfirm}
                  className="px-8 py-2.5 bg-[var(--plana-primary)] hover:bg-[var(--plana-primary-dark)] text-white rounded-lg font-bold transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5 active:translate-y-0"
                >
                  확인
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </AlertContext.Provider>
  );
}
