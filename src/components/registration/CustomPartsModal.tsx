"use client";

import { useState } from "react";
import { X, ChevronDown, ChevronRight, CheckCircle2, Lock, Sparkles, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { ImageWithLoading } from "@/components/ui/ImageWithLoading";

interface CustomPartsModalProps {
    title?: string;
    description?: string;
    onClose: () => void;
    beyName: string;
    isCX: boolean;
    mode?: string;
    currentLockChip: string | null;
    currentAssistBlade: string | null;
    currentRachet: string | null;
    currentBit: string | null;
    usedAttachments: string[];
    beybladesList: { name: string; points_standard: number; is_banned: boolean; image_url: string; type?: string; }[];
    onSelectPart: (partType: 'lock_chip' | 'assist_blade' | 'rachet' | 'bit', name: string | null) => void;
    lang?: string;
}

type PartType = 'lock_chip' | 'assist_blade' | 'rachet' | 'bit';

export function CustomPartsModal({
    title,
    description,
    onClose,
    beyName,
    isCX,
    mode,
    currentLockChip,
    currentAssistBlade,
    currentRachet,
    currentBit,
    usedAttachments = [],
    beybladesList = [],
    onSelectPart,
    lang = 'TH'
}: CustomPartsModalProps) {
    // Determine active group (expand Lock Chip if CX, else Rachet)
    const [expandedGroup, setExpandedGroup] = useState<PartType>(isCX ? 'lock_chip' : 'rachet');

    // Grouping configuration
    const groups: {
        id: PartType;
        titleTH: string;
        titleEN: string;
        dbType: string;
        isCXOnly: boolean;
        currentValue: string | null;
    }[] = [
        {
            id: 'lock_chip',
            titleTH: "Lock Chip (เฉพาะ CX)",
            titleEN: "Lock Chip (CX Only)",
            dbType: 'LOCK_CHIP',
            isCXOnly: true,
            currentValue: currentLockChip
        },
        {
            id: 'assist_blade',
            titleTH: "Assist Blade (เฉพาะ CX)",
            titleEN: "Assist Blade (CX Only)",
            dbType: 'ASSIST_BLADE',
            isCXOnly: true,
            currentValue: currentAssistBlade
        },
        {
            id: 'rachet',
            titleTH: "Rachet (ทุกสาย)",
            titleEN: "Rachet (All Lines)",
            dbType: 'RACHET',
            isCXOnly: false,
            currentValue: currentRachet
        },
        {
            id: 'bit',
            titleTH: "Bit (ทุกสาย)",
            titleEN: "Bit (All Lines)",
            dbType: 'BIT',
            isCXOnly: false,
            currentValue: currentBit
        }
    ];

    // Helper to get options for a group
    const getOptionsForGroup = (dbType: string) => {
        const options: { name: string | null; displayName: string; points: number; image: string | null; isBanned?: boolean; }[] = [
            { 
                name: null, 
                displayName: lang === 'TH' ? "ไม่ใส่ชิ้นส่วน" : "None", 
                points: 0, 
                image: null, 
                isBanned: false 
            }
        ];

        if (beybladesList && beybladesList.length > 0) {
            const filtered = beybladesList.filter((b) => b.type === dbType);
            filtered.forEach((b) => {
                const isBanned = mode === 'NoMoreMeta' && b.is_banned;
                options.push({
                    name: b.name,
                    displayName: b.name,
                    points: b.points_standard,
                    image: b.image_url,
                    isBanned
                });
            });
        } else {
            // Fallback default attachments if API fails/empty
            if (dbType === 'LOCK_CHIP') {
                options.push(
                    { name: 'Heavy', displayName: 'Heavy', points: 1, image: '/images/Blade/Heavy.webp', isBanned: false },
                    { name: 'Wheel', displayName: 'Wheel', points: 1, image: '/images/Blade/Wheel.webp', isBanned: false }
                );
            } else if (dbType === 'ASSIST_BLADE') {
                options.push(
                    { name: 'Valkyrie', displayName: 'Valkyrie', points: 1, image: '/images/Blade/Valkyrie.webp', isBanned: mode === 'NoMoreMeta' },
                    { name: 'Emperor', displayName: 'Emperor', points: 1, image: '/images/Blade/Emperor.webp', isBanned: mode === 'NoMoreMeta' }
                );
            }
        }

        return options;
    };

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md animate-in fade-in p-3 sm:p-4 touch-none"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="w-full max-w-lg bg-zinc-950 border border-white/15 rounded-3xl p-4 sm:p-5 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col my-auto max-h-[88dvh] touch-auto">
                {/* Modal Header */}
                <div className="flex items-center justify-between flex-none pb-3 border-b border-white/10">
                    <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-primary shrink-0" />
                            <h3 className="text-base sm:text-lg font-black text-white tracking-wide truncate">
                                {title || (lang === 'TH' ? "ปรับแต่งชิ้นส่วนพิเศษ" : "Customize Beyblade")}
                            </h3>
                        </div>
                        <p className="text-xs text-primary font-mono font-bold mt-0.5 truncate">
                            {description || `${beyName}`}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors shrink-0 cursor-pointer"
                        title="Close"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Groups Accordion List */}
                <div className="flex-1 overflow-y-auto space-y-2.5 py-3 pr-1 overscroll-contain touch-pan-y">
                    {groups.map((group) => {
                        const isLocked = group.isCXOnly && !isCX;
                        const isExpanded = expandedGroup === group.id;
                        const label = lang === 'TH' ? group.titleTH : group.titleEN;
                        const options = getOptionsForGroup(group.dbType);

                        return (
                            <div 
                                key={group.id} 
                                className={cn(
                                    "border rounded-2xl transition-all overflow-hidden bg-zinc-900/40",
                                    isLocked 
                                        ? "border-white/5 opacity-45" 
                                        : isExpanded
                                            ? "border-primary/50 bg-zinc-900/70 shadow-[0_0_15px_-5px_rgba(34,197,94,0.2)]"
                                            : "border-white/10 hover:border-white/20"
                                )}
                            >
                                {/* Accordion Header */}
                                <button
                                    type="button"
                                    disabled={isLocked}
                                    onClick={() => setExpandedGroup(isExpanded ? (isCX ? 'lock_chip' : 'rachet') : group.id)}
                                    className={cn(
                                        "w-full flex items-center justify-between p-3.5 sm:p-4 text-left select-none",
                                        isLocked ? "cursor-not-allowed" : "cursor-pointer"
                                    )}
                                >
                                    <div className="flex-1 min-w-0 mr-2">
                                        <div className="flex items-center gap-2">
                                            <p className="font-bold text-xs sm:text-sm text-zinc-100">{label}</p>
                                            {isLocked && <Lock className="h-3 w-3 text-zinc-500 shrink-0" />}
                                        </div>
                                        <p className="text-[11px] sm:text-xs text-zinc-400 mt-0.5 truncate font-mono">
                                            {isLocked 
                                                ? (lang === 'TH' ? "ต้องเป็นเบย์ประเภท CX เท่านั้น" : "Requires CX Blade") 
                                                : group.currentValue 
                                                    ? `✓ ${group.currentValue}` 
                                                    : (lang === 'TH' ? "ยังไม่ได้เลือก" : "None Selected")
                                            }
                                        </p>
                                    </div>
                                    <div className="shrink-0 text-zinc-400">
                                        {isExpanded ? (
                                            <ChevronDown className="h-5 w-5 text-primary" />
                                        ) : (
                                            <ChevronRight className="h-4 w-4" />
                                        )}
                                    </div>
                                </button>

                                {/* Accordion Content Options Grid */}
                                {isExpanded && !isLocked && (
                                    <div className="px-3 pb-3.5 pt-1.5 border-t border-white/5 bg-zinc-950/60">
                                        {/* Mobile: 1 Column on tiny screens, 2 Columns on xs/sm screens to prevent text truncation */}
                                        <div className="grid grid-cols-1 xs:grid-cols-2 gap-2 max-h-[260px] sm:max-h-[300px] overflow-y-auto pr-1 touch-pan-y">
                                            {options.map((opt) => {
                                                const isDuplicate = opt.name && usedAttachments.includes(opt.name);
                                                const isDisabled = isDuplicate || opt.isBanned;
                                                const isSelected = group.currentValue === opt.name;

                                                return (
                                                    <button
                                                        key={opt.name || "none"}
                                                        type="button"
                                                        disabled={!!isDisabled}
                                                        onClick={() => !isDisabled && onSelectPart(group.id, opt.name)}
                                                        className={cn(
                                                            "flex items-center gap-2.5 p-2.5 sm:p-3 rounded-xl border transition-all text-left relative overflow-hidden group select-none cursor-pointer w-full min-h-[52px]",
                                                            isDisabled
                                                                ? "bg-zinc-900/30 border-white/5 opacity-50 cursor-not-allowed"
                                                                : isSelected
                                                                    ? "bg-primary/15 border-primary/70 shadow-[0_0_10px_-2px_rgba(34,197,94,0.3)] ring-1 ring-primary/40"
                                                                    : "bg-zinc-900/80 border-white/10 hover:bg-zinc-800 hover:border-white/20"
                                                        )}
                                                    >
                                                        {/* Image / Icon container */}
                                                        <div className={cn(
                                                            "relative w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-lg flex items-center justify-center bg-black/40 border border-white/10 p-0.5",
                                                            opt.image ? "" : "border-dashed"
                                                        )}>
                                                            {opt.image ? (
                                                                <>
                                                                    <ImageWithLoading
                                                                        src={opt.image}
                                                                        alt={opt.displayName}
                                                                        fill
                                                                        className={cn("object-contain p-0.5", isDisabled && "grayscale")}
                                                                        sizes="40px"
                                                                    />
                                                                    {opt.points > 0 && (
                                                                        <div className="absolute -top-1 -right-1 bg-black/90 text-primary text-[8px] font-bold px-1 rounded-full border border-primary/30 shadow-sm z-10">
                                                                            +{opt.points}
                                                                        </div>
                                                                    )}
                                                                </>
                                                            ) : (
                                                                <span className="text-[10px] text-zinc-400 font-bold">✕</span>
                                                            )}
                                                        </div>

                                                        {/* Text container */}
                                                        <div className="flex-1 min-w-0 pr-1">
                                                            <p className={cn(
                                                                "font-bold text-xs sm:text-sm line-clamp-1 leading-snug",
                                                                isSelected ? "text-primary" : "text-zinc-100"
                                                            )} title={opt.displayName}>
                                                                {opt.displayName}
                                                            </p>
                                                            
                                                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                                                <span className="text-[9px] text-zinc-400 font-mono font-bold">
                                                                    {opt.points > 0 ? `+${opt.points} PTS` : "0 PTS"}
                                                                </span>

                                                                {isDuplicate && (
                                                                    <span className="text-[8px] bg-red-500/15 text-red-400 font-bold px-1 py-0.5 rounded border border-red-500/30 whitespace-nowrap">
                                                                        {lang === 'TH' ? "ใช้ไปแล้ว" : "Used"}
                                                                    </span>
                                                                )}
                                                                {opt.isBanned && (
                                                                    <span className="text-[8px] bg-red-500/15 text-red-400 font-bold px-1 py-0.5 rounded border border-red-500/30 whitespace-nowrap">
                                                                        {lang === 'TH' ? "โดนแบน" : "Banned"}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Selection Check Icon */}
                                                        {isSelected && (
                                                            <CheckCircle2 className="h-4 w-4 text-primary shrink-0 ml-auto" />
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Modal Footer Confirm Button */}
                <div className="flex-none pt-3 border-t border-white/10 mt-auto">
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full py-3 sm:py-3.5 bg-primary hover:bg-primary/90 text-black font-extrabold text-xs sm:text-sm rounded-2xl transition-all shadow-[0_4px_16px_rgba(34,197,94,0.25)] active:scale-[0.98] cursor-pointer"
                    >
                        {lang === 'TH' ? "บันทึก / ยืนยันการปรับแต่งชิ้นส่วน" : "Confirm Custom Parts"}
                    </button>
                </div>
            </div>
        </div>
    );
}
