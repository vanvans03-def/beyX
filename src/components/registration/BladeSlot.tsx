"use client";

import { cn } from "@/lib/utils";
import { Plus, ChevronRight } from "lucide-react";
import { ImageWithLoading } from "@/components/ui/ImageWithLoading";
import gameData from "@/data/game-data.json";
import imageMap from "@/data/image-map.json";

type RegistrationMode = "Under10" | "NoMoreMeta" | "Standard";

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
};

export const BladeSlot = ({
    name,
    type,
    deckIndex = 0,
    slotIndex,
    mode,
    onPress,
    banList,
    t
}: BladeSlotProps) => {
    // @ts-ignore
    const imgPath = (imageMap as any)[name];
    const pt = allBeys.find(b => b.name === name)?.point;

    const effectiveBanList = (banList && banList.length > 0) ? banList : gameData.banList;
    const isBanned = mode !== "Under10" && mode !== "Standard" && effectiveBanList.includes(name);

    return (
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
                            {mode === 'Under10' && (
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
    );
};
