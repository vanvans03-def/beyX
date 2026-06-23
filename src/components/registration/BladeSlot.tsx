"use client";

import { cn } from "@/lib/utils";
import { Plus, ChevronRight } from "lucide-react";
import { ImageWithLoading } from "@/components/ui/ImageWithLoading";
import gameData from "@/data/game-data.json";
import gameDataStandard from "@/data/game-data-standard.json";
import gameDataSouth from "@/data/game-data-south.json";
import imageMap from "@/data/image-map.json";
import cxAttachments from "@/data/cx-attachments.json";
import beySeries from "@/data/bey-series.json";

type RegistrationMode = "Under10" | "Under10Custom" | "NoMoreMeta" | "Standard";

const allBeys = Object.entries(gameData.points).flatMap(([point, names]) =>
    names.map((name) => ({ name, point: parseInt(point) }))
);
allBeys.sort((a, b) => a.name.localeCompare(b.name));

type BladeSlotProps = {
    name: string;
    type: 'main';
    slotIndex: number;
    mode: RegistrationMode | "Standard";
    onPress: () => void;
    banList?: string[];
    t: any;
    lockChip?: string | null;
    assistBlade?: string | null;
    rachet?: string | null;
    bit?: string | null;
    isModified?: boolean;
    beybladesList?: { name: string; points_standard: number; is_banned: boolean; image_url: string; type?: string; }[];
    dynamicBanList?: string[];
    cxEnabled?: boolean;
    onCustomizePress?: () => void;
};

export const BladeSlot = ({
    name,
    type,
    slotIndex,
    mode,
    onPress,
    banList,
    t,
    lockChip,
    assistBlade,
    rachet,
    bit,
    isModified,
    beybladesList,
    dynamicBanList,
    cxEnabled = true,
    onCustomizePress
}: BladeSlotProps) => {
    // Lookup in database catalog if loaded
    const dbBey = beybladesList?.find(x => x.name === name);

    // Get point value based on mode
    let pt: number | undefined = undefined;
    if (mode === "Under10" || mode === "Under10Custom") {
        if (dbBey) {
            pt = dbBey.points_standard;
        } else {
            const pointData = mode === "Under10Custom" ? gameDataSouth : gameDataStandard;
            const modeAllBeys = Object.entries(pointData.points).flatMap(([point, names]) =>
                names.map((name) => ({ name, point: parseInt(point) }))
            );
            pt = modeAllBeys.find(b => b.name === name)?.point;
        }
    }

    // Resolve Image URL
    const imgPath = dbBey?.image_url || (imageMap as any)[name];

    const fallbackBanList = (banList && banList.length > 0) ? banList : gameData.banList;
    const effectiveBanList = (beybladesList && beybladesList.length > 0) ? dynamicBanList : fallbackBanList;
    const isBanned = mode !== "Under10" && mode !== "Under10Custom" && mode !== "Standard" && (effectiveBanList?.includes(name) || dbBey?.is_banned);

    const isCX = name && (dbBey?.type === 'CX' || beySeries.series.CX.includes(name));
    const showAllAttachments = mode === "Under10Custom";

    const selectedParts = [
        isCX && lockChip ? `Chip: ${lockChip}` : null,
        isCX && assistBlade ? `Assist: ${assistBlade}` : null,
        rachet ? `Rachet: ${rachet}` : null,
        bit ? `Bit: ${bit}` : null
    ].filter(Boolean);

    return (
        <div className="flex items-center gap-2">
            <div
                onClick={onPress}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onPress();
                    }
                }}
                className={cn(
                    "relative flex items-center gap-3 p-3 rounded-xl border border-input transition-all w-full text-left group cursor-pointer select-none",
                    name ? "bg-card/80" : "bg-secondary/30 dashed-border",
                    !name && "border-dashed border-2",
                    isBanned && "border-destructive bg-destructive/10",
                    isModified && "border-primary/50 bg-primary/5 shadow-[0_0_15px_rgba(34,197,94,0.1)]"
                )}
            >
                {isModified && (
                    <div className="absolute -top-2 -right-2 z-10 px-2 py-0.5 rounded-full bg-primary text-black text-[10px] font-bold shadow-lg animate-bounce">
                        MODIFIED
                    </div>
                )}
                <div className="relative w-12 h-12 shrink-0 bg-black/20 rounded-lg overflow-hidden flex items-center justify-center">
                    {name && imgPath ? (
                        <ImageWithLoading src={imgPath} alt={name} fill className="object-cover" />
                    ) : name ? (
                        <span className="text-[10px] font-bold text-muted-foreground break-all p-1 text-center">{name.substring(0, 3)}</span>
                    ) : (
                        <Plus className="h-5 w-5 text-muted-foreground opacity-50" />
                    )}
                </div>

                <div className="flex-1 min-w-0">
                    {name ? (
                        <>
                            <div className="font-bold text-sm truncate text-foreground">{name}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                                {(mode === 'Under10' || mode === 'Under10Custom') && (
                                    <span className="text-[10px] font-mono bg-secondary px-1.5 py-0.5 rounded text-muted-foreground">
                                        {pt} PTS
                                    </span>
                                )}
                                {isBanned && (
                                    <span className="text-[10px] text-destructive font-bold uppercase">{t('reg.banned')}</span>
                                )}
                            </div>
                            {/* Customized parts list under the name (responsive wrapping) */}
                            {showAllAttachments && selectedParts.length > 0 && (
                                <div className="text-[10px] text-muted-foreground mt-1.5 leading-normal font-mono break-words max-w-full">
                                    {selectedParts.join(' | ')}
                                </div>
                            )}
                        </>
                    ) : (
                        <span className="text-sm font-medium text-muted-foreground">{t('reg.select')}</span>
                    )}
                </div>

                {name && showAllAttachments && (
                    <div className="ml-auto shrink-0 flex items-center">
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (onCustomizePress) onCustomizePress();
                            }}
                            className={cn(
                                "flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer",
                                selectedParts.length > 0
                                    ? "bg-primary/20 text-primary border-primary/30 hover:bg-primary/30"
                                    : "bg-secondary text-muted-foreground border-white/5 hover:bg-secondary/80"
                            )}
                        >
                            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                            {selectedParts.length > 0 
                                ? t('reg.btn.customize_active') || "Customized" 
                                : t('reg.btn.customize') || "Customize"
                            }
                        </button>
                    </div>
                )}

                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-50 ml-1 shrink-0" />
            </div>
        </div>
    );
};
