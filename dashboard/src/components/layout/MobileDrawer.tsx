import { X } from "lucide-react";
import { Sidebar } from "./Sidebar";

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function MobileDrawer({ open, onClose }: MobileDrawerProps) {
  if (!open) return null;
  return (
    <div className="md:hidden fixed inset-0 z-50 flex">
      <div
        className="absolute inset-0 bg-black/40 animate-fade-in"
        onClick={onClose}
        role="presentation"
      />
      <div className="relative h-full w-60 bg-white shadow-xl animate-slide-in-right">
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar menú"
          className="absolute right-2 top-2 h-9 w-9 inline-flex items-center justify-center rounded-md hover:bg-ai-surface"
        >
          <X className="h-5 w-5" />
        </button>
        <Sidebar collapsed={false} onCloseMobile={onClose} />
      </div>
    </div>
  );
}
