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
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-[10000]">
      <div className="bg-white p-4 rounded shadow max-w-md w-full mx-4">
        {title && <h3 className="font-semibold mb-2">{title}</h3>}
        <div className="mb-4 text-sm">{children}</div>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-3 py-1 border rounded hover:bg-gray-50">{cancelLabel}</button>
          <button onClick={onConfirm} className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700">{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}