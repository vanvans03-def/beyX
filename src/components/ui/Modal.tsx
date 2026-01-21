import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    content?: React.ReactNode;
    children?: React.ReactNode;
    type?: "alert" | "confirm" | "custom";
    onConfirm?: () => void;
    confirmText?: string;
    cancelText?: string;
    variant?: "default" | "destructive";
}

export function Modal({
    isOpen,
    onClose,
    title,
    description,
    content,
    children,
    type = "custom",
    onConfirm,
    confirmText = "Confirm",
    cancelText = "Cancel",
    variant = "default"
}: ModalProps) {
    const [mounted, setMounted] = useState(false);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (isOpen) {
            setVisible(true);
            document.body.style.overflow = "hidden";
        } else {
            const timer = setTimeout(() => setVisible(false), 300);
            document.body.style.overflow = "unset";
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    if (!mounted) return null;
    if (!visible && !isOpen) return null;

    return createPortal(
        <div className={cn(
            "fixed inset-0 z-[9999] flex items-start justify-center px-4 pt-20 overflow-y-auto transition-all duration-300",
            isOpen ? "opacity-100" : "opacity-0"
        )}>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/60"
                onClick={onClose}
            />

            {/* Content */}
            <div className={cn(
                "relative z-10 w-full max-w-md glass-card p-6 rounded-2xl border border-white/10 shadow-2xl transition-all duration-300 transform",
                isOpen ? "scale-100 translate-y-0" : "scale-95 translate-y-4"
            )}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                        {title}
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-white/10 rounded-full transition-colors text-muted-foreground hover:text-white"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {description && (
                    <p className="text-sm text-muted-foreground mb-6">
                        {description}
                    </p>
                )}

                {content && (
                    <div className="mb-6">
                        {content}
                    </div>
                )}

                {children}

                {type !== "custom" && (
                    <div className="flex gap-3 mt-6 justify-end">
                        {(type === "confirm") && (
                            <button
                                onClick={onClose}
                                className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/5 transition-colors"
                            >
                                {cancelText}
                            </button>
                        )}
                        <button
                            onClick={() => {
                                onConfirm?.();
                                if (type === "alert") onClose();
                            }}
                            className={cn(
                                "px-6 py-2 rounded-lg text-sm font-bold text-black transition-colors shadow-lg shadow-black/20",
                                variant === "destructive"
                                    ? "bg-red-500 hover:bg-red-400"
                                    : "bg-primary hover:bg-primary/90"
                            )}
                        >
                            {confirmText}
                        </button>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}
