import { CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';
import { useClinic } from '../../context/ClinicContext';

export function ToastContainer() {
  const { toasts, dismissToast } = useClinic();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 w-full max-w-sm pointer-events-none px-4 sm:px-0"
    >
      {toasts.map((toast) => {
        const icon =
          toast.variant === 'warning' || toast.variant === 'error' ? (
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          ) : toast.variant === 'info' ? (
            <Info className="w-4 h-4 text-[#0B6657] shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-[#20B875] shrink-0 mt-0.5" />
          );

        return (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-start gap-3 bg-white border border-[#E2EAE5] rounded-xl px-4 py-3 shadow-lg text-sm"
          >
            {icon}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-[#172B27] truncate">{toast.title}</p>
              {toast.description && (
                <p className="text-xs text-[#84938D] mt-0.5 line-clamp-2">
                  {toast.description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss notification"
              className="p-1 text-[#84938D] hover:text-[#172B27] rounded-md transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
