"use client";

import { cn } from "@/lib/utils";
import { Plus, ChevronRight } from "lucide-react";
import { ImageWithLoading } from "@/components/ui/ImageWithLoading";
import gameData from "@/data/game-data.json";
import gameDataStandard from "@/data/game-data-standard.json";
import gameDataSouth from "@/data/game-data-south.json";
import imageMap from "@/data/image-map.json";
import cxAttachments from "@/data/cx-attachments.json";

type RegistrationMode = "Under10" | "Under10South" | "NoMoreMeta" | "Standard";

const allBeys = Object.entries(gameData.points).flatMap(([point, names]) =>
    names.map((name) => ({ name, point: parseInt(point) }))
);
allBeys.sort((a, b) => a.name.localeCompare(b.name));

type BladeSlotProps = {
    name: string;
    type: 'main' | 'reserve';
    deckIndex?: number;
    slotIndex: number;
    mode: RegistrationMode | "Standard";
    onPress: () => void;
    banList?: string[];
    t: any;
    attachment?: string | null;
    onAttachmentPress?: () => void;
};

export const BladeSlot = ({
    name,
    type,
    deckIndex = 0,
    slotIndex,
    mode,
    onPress,
    banList,
    t,
    attachment,
    onAttachmentPress
}: BladeSlotProps) => {
    // Get point value based on mode
    let pt: number | undefined = undefined;
    if (mode === "Under10" || mode === "Under10South") {
        const pointData = mode === "Under10South" ? gameDataSouth : gameDataStandard;
        const modeAllBeys = Object.entries(pointData.points).flatMap(([point, names]) =>
            names.map((name) => ({ name, point: parseInt(point) }))
        );
        pt = modeAllBeys.find(b => b.name === name)?.point;

        if (name === "HellsScythe") {
            console.log('[BladeSlot DEBUG] HellsScythe - mode:', mode, 'pt:', pt, 'using:', mode === "Under10South" ? 'gameDataSouth' : 'gameDataStandard');
        }
    }

    // @ts-ignore
    const imgPath = (imageMap as any)[name];

    // Get attachment image if exists
    // @ts-ignore
    const attachmentData = attachment ? (cxAttachments.attachments as any)[attachment] : null;

    const effectiveBanList = (banList && banList.length > 0) ? banList : gameData.banList;
    const isBanned = mode !== "Under10" && mode !== "Under10South" && mode !== "Standard" && effectiveBanList.includes(name);

    return (
        <div className="flex items-center gap-2">
            <button
                type="button"
                onClick={onPress}
                className={cn(
                    "relative flex items-center gap-3 p-3 rounded-xl border border-input transition-all w-full text-left group",
                    name ? "bg-card/80" : "bg-secondary/30 dashed-border",
                    !name && "border-dashed border-2",
                    isBanned && "border-destructive bg-destructive/10"
                )}
            >
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
                                {(mode === 'Under10' || mode === 'Under10South') && (
                                    <span className="text-[10px] font-mono bg-secondary px-1.5 py-0.5 rounded text-muted-foreground">
                                        {pt} PTS
                                    </span>
                                )}
                                {isBanned && (
                                    <span className="text-[10px] text-destructive font-bold uppercase">{t('reg.banned')}</span>
                                )}
                            </div>
                        </>
                    ) : (
                        <span className="text-sm font-medium text-muted-foreground">{t('reg.select')}</span>
                    )}
                </div>

                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-50" />
            </button>

            {/* Attachment Indicator (Only for U10South) */}
            {name && attachment && mode === "Under10South" && (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        if (onAttachmentPress) onAttachmentPress();
                    }}
                    className="shrink-0 w-12 h-full flex flex-col items-center justify-center gap-1 p-1 rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors"
                >
                    <div className="relative w-8 h-8">
                        {attachmentData?.image ? (
                            <ImageWithLoading src={attachmentData.image} alt={attachment} fill className="object-contain" />
                        ) : (
                            <div className="w-full h-full bg-primary/20 rounded-full" />
                        )}
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-[8px] font-bold flex items-center justify-center rounded-full">
                            +1
                        </div>
                    </div>
                    <span className="text-[8px] font-bold text-primary truncate max-w-full px-1">{attachment}</span>
                </button>
            )}
        </div>
    );
};
