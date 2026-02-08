"use client";

import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { AlertTriangle, Info, X } from "lucide-react";

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** If provided, renders a scrollable detail section below the message */
  details?: string[];
  /** If true, shows only an "OK" button (no cancel) — like an alert */
  alertOnly?: boolean;
}

interface ConfirmModalContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmModalContext = createContext<ConfirmModalContextType | null>(null);

export function useConfirmModal() {
  const ctx = useContext(ConfirmModalContext);
  if (!ctx) throw new Error("useConfirmModal must be used within ConfirmModalProvider");
  return ctx;
}

export function ConfirmModalProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{
    isOpen: boolean;
    options: ConfirmOptions;
  }>({
    isOpen: false,
    options: { message: "" },
  });

  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setState({ isOpen: true, options });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    resolveRef.current?.(true);
    resolveRef.current = null;
    setState((s) => ({ ...s, isOpen: false }));
  }, []);

  const handleCancel = useCallback(() => {
    resolveRef.current?.(false);
    resolveRef.current = null;
    setState((s) => ({ ...s, isOpen: false }));
  }, []);

  const { isOpen, options } = state;

  return (
    <ConfirmModalContext.Provider value={{ confirm }}>
      {children}
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 mx-4">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2.5">
                {options.destructive ? (
                  <div className="p-1.5 rounded-lg bg-red-50">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                  </div>
                ) : (
                  <div className="p-1.5 rounded-lg bg-primary/10">
                    <Info className="h-5 w-5 text-primary" />
                  </div>
                )}
                <h3 className="font-semibold text-foreground">
                  {options.title || (options.alertOnly ? "Info" : "Confirm")}
                </h3>
              </div>
              <button
                onClick={handleCancel}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-4 w-4 text-gray-400" />
              </button>
            </div>

            {/* Content */}
            <div className="px-5 pb-4">
              <p className="text-sm text-gray-600 leading-relaxed">{options.message}</p>

              {/* Scrollable details (for validation results, etc.) */}
              {options.details && options.details.length > 0 && (
                <div className="mt-3 max-h-48 overflow-y-auto rounded-lg bg-gray-50 p-3 space-y-1">
                  {options.details.map((detail, i) => (
                    <p key={i} className="text-xs text-gray-600 font-mono leading-relaxed">
                      {detail}
                    </p>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 bg-gray-50/80">
              {!options.alertOnly && (
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  {options.cancelLabel || "Cancel"}
                </button>
              )}
              <button
                onClick={handleConfirm}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  options.destructive
                    ? "bg-red-500 text-white hover:bg-red-600"
                    : "bg-primary text-white hover:bg-primary-dark"
                }`}
              >
                {options.confirmLabel || (options.alertOnly ? "OK" : "Confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmModalContext.Provider>
  );
}
