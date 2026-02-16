"use client";

import { useState } from "react";
import { X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ImageWithLoading } from "@/components/ui/ImageWithLoading";
import cxAttachments from "@/data/cx-attachments.json";

interface CXAttachmentSelectorProps {
    onSelect: (attachment: string | null) => void;
    onClose: () => void;
    currentAttachment?: string | null;
    usedAttachments?: (string | null)[];
}

export function CXAttachmentSelector({
    onSelect,
    onClose,
    currentAttachment,
    usedAttachments = []
}: CXAttachmentSelectorProps) {
    const [selected, setSelected] = useState<string | null>(currentAttachment || null);

    const handleSelect = (attachment: string | null) => {
        setSelected(attachment);
        onSelect(attachment);
        onClose();
    };

    const options = [
        { name: null, displayName: "None", points: 0, image: null },
        { name: "Heavy", displayName: cxAttachments.attachments.Heavy.displayName, points: cxAttachments.attachments.Heavy.points, image: cxAttachments.attachments.Heavy.image },
        { name: "Wheel", displayName: cxAttachments.attachments.Wheel.displayName, points: cxAttachments.attachments.Wheel.points, image: cxAttachments.attachments.Wheel.image }
    ];

    return (
        <div
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 backdrop-blur-sm animate-in fade-in p-4 pt-12"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="w-full max-w-sm bg-zinc-950 border border-white/10 rounded-3xl p-5 gap-4 shadow-2xl animate-in slide-in-from-top-10 flex flex-col max-h-[85vh]">
                {/* Header */}
                <div className="flex items-center justify-between flex-none">
                    <div>
                        <h3 className="text-xl font-bold text-white">ส่วนเสริมพิเศษ CX</h3>
                        <p className="text-sm text-zinc-400">เลือกส่วนเสริมพิเศษสำหรับ CX Blade</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Options List */}
                <div className="flex-1 overflow-y-auto -mx-2 px-2 space-y-3">
                    {options.map((opt) => {
                        const isDisabled = opt.name && usedAttachments.includes(opt.name);
                        const isSelected = selected === opt.name;

                        return (
                            <button
                                key={opt.name || "none"}
                                disabled={!!isDisabled}
                                onClick={() => !isDisabled && handleSelect(opt.name)}
                                className={cn(
                                    "w-full flex items-center gap-4 p-3 rounded-2xl border transition-all relative overflow-hidden group",
                                    isDisabled
                                        ? "bg-zinc-900/50 border-white/5 opacity-50 cursor-not-allowed"
                                        : isSelected
                                            ? "bg-primary/20 border-primary shadow-[0_0_15px_-3px_rgba(var(--primary),0.3)]"
                                            : "bg-zinc-900/80 border-white/10 hover:bg-zinc-800 hover:border-white/20"
                                )}
                            >
                                {/* Background Gradient for Selected */}
                                {isSelected && (
                                    <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent pointer-events-none" />
                                )}

                                {/* Image / Icon */}
                                <div className={cn(
                                    "relative w-16 h-16 shrink-0 rounded-xl flex items-center justify-center p-2",
                                    opt.image ? "bg-black/40" : "bg-zinc-800"
                                )}>
                                    {opt.image ? (
                                        <>
                                            <ImageWithLoading
                                                src={opt.image}
                                                alt={opt.displayName}
                                                fill
                                                className={cn("object-contain drop-shadow-md p-1", isDisabled && "grayscale")}
                                                sizes="64px"
                                            />
                                            {opt.points > 0 && (
                                                <div className="absolute -top-1 -right-1 bg-zinc-950 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-primary/30 shadow-sm z-10">
                                                    +{opt.points}
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <XCircle className="h-6 w-6 text-zinc-500" />
                                    )}
                                </div>

                                {/* Text Info */}
                                <div className="flex-1 text-left min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className={cn("font-bold truncate", !opt.image ? "text-sm" : "text-base", isSelected ? "text-primary" : "text-zinc-100")}>
                                            {opt.displayName}
                                        </p>
                                        {isDisabled && (
                                            <span className="text-[10px] bg-red-500/10 text-red-500 px-1.5 py-0.5 rounded border border-red-500/20 whitespace-nowrap">
                                                เลือกไปแล้ว
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-zinc-500 mt-0.5">
                                        {opt.points > 0 ? `เพิ่มคะแนน +${opt.points} คะแนน` : "ไม่ใช้ชิ้นส่วนเสริมตามที่กำหนด"}
                                    </p>
                                </div>

                                {/* Radio Indicator */}
                                <div className={cn(
                                    "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                                    isSelected ? "border-primary bg-primary" : "border-zinc-700 bg-transparent"
                                )}>
                                    {isSelected && <div className="w-2 h-2 rounded-full bg-black" />}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
