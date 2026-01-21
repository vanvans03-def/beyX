import { useState, useMemo, useEffect, memo } from "react";
import Image from "next/image";
import { Search, X, Check, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import imageMap from "@/data/image-map.json";

interface MultiVisualSelectorProps {
    label: string;
    initialSelected: string[];
    onConfirm: (selected: string[]) => void;
    options: { name: string; point: number; blocked?: boolean }[];
    onClose: () => void;
}

function MultiVisualSelectorComponent({
    label,
    initialSelected,
    onConfirm,
    options,
    onClose,
    variant = "modal",
    className
}: MultiVisualSelectorProps & { variant?: "modal" | "inline"; className?: string }) {
    const [query, setQuery] = useState("");
    // Use a Set for easier toggling
    const [selected, setSelected] = useState<Set<string>>(() => new Set(initialSelected));

    // Sync selected when initialSelected changes (e.g. external reset)
    useEffect(() => {
        setSelected(new Set(initialSelected));
    }, [initialSelected]);

    const toggleSelection = (name: string) => {
        const newSet = new Set(selected);
        if (newSet.has(name)) {
            newSet.delete(name);
        } else {
            newSet.add(name);
        }
        setSelected(newSet);

        // Immediate update for inline mode
        if (variant === "inline") {
            onConfirm(Array.from(newSet));
        }
    };

    const handleConfirm = () => {
        onConfirm(Array.from(selected));
        onClose?.();
    };

    const filteredOptions = useMemo(() => {
        let filtered = options.filter((opt) =>
            opt.name.toLowerCase().includes(query.toLowerCase())
        );

        // Sort: Selected first, then Name Asc
        filtered.sort((a, b) => {
            const aSel = selected.has(a.name);
            const bSel = selected.has(b.name);
            if (aSel && !bSel) return -1;
            if (!aSel && bSel) return 1;
            return a.name.localeCompare(b.name);
        });

        return filtered;
    }, [options, query, selected]);

    const content = (
        <>
            {/* Header - Only for Modal */}
            {variant === "modal" && (
                <div className="flex items-center justify-between p-3 border-b border-border/50 bg-background/80 glass-card rounded-b-xl">
                    <div className="flex flex-col">
                        <h3 className="text-base font-bold text-foreground">{label}</h3>
                        <p className="text-[10px] text-muted-foreground">{selected.size} Selected</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleConfirm}
                            className="flex items-center gap-1.5 bg-primary text-black px-3 py-1.5 rounded-full text-xs font-bold hover:bg-primary/90 transition-colors"
                        >
                            <Save className="h-3.5 w-3.5" />
                            Done
                        </button>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-full bg-secondary hover:bg-destructive/20 hover:text-destructive transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            )}

            {/* Controls */}
            <div className={cn("p-3 pb-0", variant === "inline" && "p-0 mb-3")}>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                        autoFocus={variant === "modal"}
                        type="text"
                        placeholder="Search to add/remove..."
                        className="w-full bg-secondary rounded-lg py-2.5 pl-9 pr-4 text-sm font-medium outline-none border border-transparent focus:border-primary transition-all"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* Grid */}
            <div className={cn(
                "flex-1 overflow-y-auto grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2 content-start",
                variant === "modal" ? "p-3 pb-20" : "max-h-[400px] pr-2"
            )}>
                {filteredOptions.map((opt) => {
                    // @ts-ignore
                    const imgPath = imageMap[opt.name];
                    const isSelected = selected.has(opt.name);

                    return (
                        <button
                            key={opt.name}
                            type="button" // Prevent form submission
                            className={cn(
                                "relative flex flex-col items-center gap-1.5 p-1.5 rounded-lg border transition-all",
                                isSelected
                                    ? "bg-destructive/10 border-destructive ring-1 ring-destructive"
                                    : "bg-card/50 border-transparent hover:bg-accent/50 hover:border-border",
                                opt.blocked && !isSelected && "opacity-50"
                            )}
                            onClick={() => toggleSelection(opt.name)}
                        >
                            <div className="relative w-full aspect-square">
                                {imgPath ? (
                                    <Image
                                        src={imgPath}
                                        alt={opt.name}
                                        fill
                                        className={cn("object-contain drop-shadow-md transition-all", isSelected && "grayscale")}
                                        sizes="(max-width: 768px) 25vw, 15vw"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-secondary rounded text-[8px] text-muted-foreground">
                                        No Img
                                    </div>
                                )}

                                {/* Selected Badge */}
                                {isSelected && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-md backdrop-blur-[1px]">
                                        <div className="bg-destructive text-white rounded-full p-1 shadow-lg">
                                            <X className="h-4 w-4" />
                                        </div>
                                    </div>
                                )}
                            </div>
                            <span className={cn(
                                "text-[9px] font-medium leading-tight text-center line-clamp-2 w-full",
                                isSelected ? "text-destructive font-bold" : "text-muted-foreground/90"
                            )}>
                                {opt.name}
                            </span>
                        </button>
                    );
                })}
            </div>
        </>
    );

    if (variant === "inline") {
        return <div className={cn("w-full flex flex-col", className)}>{content}</div>;
    }

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-5">
            {content}
        </div>
    );
}

export const MultiVisualSelector = memo(MultiVisualSelectorComponent);
