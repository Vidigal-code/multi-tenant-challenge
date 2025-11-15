import React from 'react';

interface ConfirmModalProps {
  open: boolean;
  title?: string;
  children: React.ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
}

export function ConfirmModal({
  open,
  title,
  children,
  onCancel,
  onConfirm,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
}: ConfirmModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/80 backdrop-blur-md flex items-center justify-center z-[10001] p-4">
      <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg
       shadow-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
        {title && <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">{title}</h3>}
        <div className="mb-6 text-sm sm:text-base text-gray-700 dark:text-gray-300">{children}</div>
        <div className="flex flex-col sm:flex-row justify-end gap-3">
          <button onClick={onCancel} className="w-full sm:w-auto px-4 py-2 border border-gray-200
           dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-white
            hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors font-medium text-sm">{cancelLabel}</button>
          <button onClick={onConfirm} className="w-full sm:w-auto px-4 py-2 bg-red-600 dark:bg-red-700 text-white
          rounded-lg hover:bg-red-700 dark:hover:bg-red-600 transition-colors font-medium text-sm">{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}