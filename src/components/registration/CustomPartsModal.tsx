"use client";

import { useState } from "react";
import { X, ChevronDown, ChevronRight, CheckCircle2, Lock } from "lucide-react";
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
    // Determine active group (expand Rachet by default, or Lock Chip if CX)
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
            { name: null, displayName: lang === 'TH' ? "ไม่ใส่ชิ้นส่วน (None)" : "None", points: 0, image: null, isBanned: false }
        ];

        if (beybladesList && beybladesList.length > 0) {
            const filtered = beybladesList.filter((b) => b.type === dbType);
            filtered.forEach((b) => {
                // Attachments are only banned in NoMoreMeta mode
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
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/85 backdrop-blur-md animate-in fade-in p-4 pt-12 overflow-y-auto"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="w-full max-w-md bg-zinc-950 border border-white/10 rounded-3xl p-5 gap-4 shadow-2xl animate-in slide-in-from-top-10 flex flex-col my-auto max-h-[85vh]">
                {/* Header */}
                <div className="flex items-center justify-between flex-none pb-2 border-b border-white/10">
                    <div>
                        <h3 className="text-xl font-black text-white tracking-wide">
                            {title || (lang === 'TH' ? "ปรับแต่งชิ้นส่วนพิเศษ" : "Customize Beyblade")}
                        </h3>
                        <p className="text-xs text-zinc-400 mt-0.5">
                            {description || `${beyName}`}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Groups Accordion List */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 -mr-1">
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
                                        ? "border-white/5 opacity-40" 
                                        : isExpanded
                                            ? "border-primary/45 bg-zinc-900/60 shadow-[0_0_15px_-5px_rgba(34,197,94,0.15)]"
                                            : "border-white/10 hover:border-white/20"
                                )}
                            >
                                {/* Accordion Header */}
                                <button
                                    type="button"
                                    disabled={isLocked}
                                    onClick={() => setExpandedGroup(isExpanded ? (isCX ? 'lock_chip' : 'rachet') : group.id)}
                                    className={cn(
                                        "w-full flex items-center justify-between p-4 text-left select-none",
                                        isLocked ? "cursor-not-allowed" : "cursor-pointer"
                                    )}
                                >
                                    <div className="flex-1 min-w-0 mr-3">
                                        <div className="flex items-center gap-2">
                                            <p className="font-bold text-sm text-zinc-100">{label}</p>
                                            {isLocked && <Lock className="h-3 w-3 text-zinc-500 shrink-0" />}
                                        </div>
                                        <p className="text-xs text-zinc-400 mt-0.5 truncate font-mono">
                                            {isLocked 
                                                ? (lang === 'TH' ? "ต้องเป็นเบย์ประเภท CX เท่านั้น" : "Requires CX Blade") 
                                                : group.currentValue 
                                                    ? `${group.currentValue}` 
                                                    : (lang === 'TH' ? "ยังไม่ได้เลือก" : "None Selected")
                                            }
                                        </p>
                                    </div>
                                    <div className="shrink-0 text-zinc-500 hover:text-white transition-colors">
                                        {isExpanded ? (
                                            <ChevronDown className="h-5 w-5 text-primary" />
                                        ) : (
                                            <ChevronRight className="h-5 w-5" />
                                        )}
                                    </div>
                                </button>

                                {/* Accordion Content Options Grid */}
                                {isExpanded && !isLocked && (
                                    <div className="px-4 pb-4 pt-1 border-t border-white/5 bg-zinc-950/40">
                                        <div className="grid grid-cols-2 gap-2.5 max-h-[220px] overflow-y-auto p-0.5">
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
                                                            "flex items-center gap-2 p-2.5 rounded-xl border transition-all text-left relative overflow-hidden group select-none cursor-pointer",
                                                            isDisabled
                                                                ? "bg-zinc-900/30 border-white/5 opacity-50 cursor-not-allowed"
                                                                : isSelected
                                                                    ? "bg-primary/10 border-primary/60 shadow-[0_0_8px_-2px_rgba(34,197,94,0.2)]"
                                                                    : "bg-zinc-900/60 border-white/5 hover:bg-zinc-800/80 hover:border-white/10"
                                                        )}
                                                    >
                                                        {/* Image container */}
                                                        <div className={cn(
                                                            "relative w-10 h-10 shrink-0 rounded-lg flex items-center justify-center p-1 bg-black/20",
                                                            opt.image ? "" : "border border-dashed border-white/10"
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
                                                                        <div className="absolute -top-1 -right-1 bg-zinc-950 text-primary text-[8px] font-bold px-1 rounded-full border border-primary/20 shadow-sm z-10">
                                                                            +{opt.points}
                                                                        </div>
                                                                    )}
                                                                </>
                                                            ) : (
                                                                <span className="text-[10px] text-zinc-500 font-bold">X</span>
                                                            )}
                                                        </div>

                                                        {/* Text container */}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-1.5">
                                                                <p className={cn(
                                                                    "font-bold text-xs truncate leading-snug",
                                                                    isSelected ? "text-primary" : "text-zinc-200"
                                                                )}>
                                                                    {opt.displayName}
                                                                </p>
                                                            </div>
                                                            <p className="text-[9px] text-zinc-500 leading-none mt-0.5 font-mono">
                                                                {opt.points > 0 ? `+${opt.points} PTS` : "0 PTS"}
                                                            </p>
                                                            {isDuplicate && (
                                                                <span className="text-[8px] bg-red-500/10 text-red-400 px-1 rounded border border-red-500/20 whitespace-nowrap mt-0.5 inline-block">
                                                                    {lang === 'TH' ? "ซ้ำซ้อน" : "Duplicate"}
                                                                </span>
                                                            )}
                                                            {opt.isBanned && (
                                                                <span className="text-[8px] bg-red-500/10 text-red-400 px-1 rounded border border-red-500/20 whitespace-nowrap mt-0.5 inline-block">
                                                                    {lang === 'TH' ? "โดนแบน" : "Banned"}
                                                                </span>
                                                            )}
                                                        </div>
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

                {/* Footer Save Button */}
                <div className="flex-none pt-3 border-t border-white/10 mt-auto">
                    <button
                        onClick={onClose}
                        className="w-full py-3 bg-primary hover:bg-primary-hover text-black font-extrabold rounded-2xl transition-all shadow-[0_4px_12px_rgba(34,197,94,0.2)] active:scale-[0.98]"
                    >
                        {lang === 'TH' ? "บันทึก / ยืนยันการปรับแต่ง" : "Confirm Settings"}
                    </button>
                </div>
            </div>
        </div>
    );
}
