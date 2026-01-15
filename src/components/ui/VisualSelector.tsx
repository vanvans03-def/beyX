"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { Search, X, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import imageMap from "@/data/image-map.json";

interface VisualSelectorProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: { name: string; point: number; blocked?: boolean }[];
    maxPoint?: number;
    onClose: () => void;
}

export function VisualSelector({
    label,
    value,
    onChange,
    options,
    maxPoint,
    onClose
}: VisualSelectorProps) {
    const [query, setQuery] = useState("");
    const [pointFilter, setPointFilter] = useState<number | "ALL">("ALL");

    // Get unique points for filter chips, sorted desc
    const availablePoints = useMemo(() => {
        // Only show points that are <= maxPoint if set
        let validOptions = options;
        if (typeof maxPoint !== 'undefined') {
            validOptions = options.filter(o => o.point <= maxPoint);
        }
        const pts = new Set(validOptions.map(o => o.point));
        return Array.from(pts).sort((a, b) => b - a);
    }, [options, maxPoint]);

    const filteredOptions = useMemo(() => {
        let filtered = options.filter((opt) =>
            opt.name.toLowerCase().includes(query.toLowerCase())
        );

        if (typeof maxPoint !== 'undefined') {
            filtered = filtered.filter(opt => opt.point <= maxPoint);
        }

        if (pointFilter !== "ALL") {
            filtered = filtered.filter(opt => opt.point === pointFilter);
        }

        // Sort by Point Desc, then Name Asc
        filtered.sort((a, b) => {
            if (b.point !== a.point) return b.point - a.point;
            return a.name.localeCompare(b.name);
        });

        return filtered;
    }, [options, query, pointFilter]);

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-5">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-border/50 bg-background/80 glass-card rounded-b-xl">
                <div className="flex flex-col">
                    <h3 className="text-base font-bold text-foreground">Select {label}</h3>
                    <p className="text-[10px] text-muted-foreground">{filteredOptions.length} Blades</p>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 rounded-full bg-secondary hover:bg-destructive/20 hover:text-destructive transition-colors"
                >
                    <X className="h-5 w-5" />
                </button>
            </div>

            {/* Controls */}
            <div className="space-y-2 p-3 pb-0">
                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search Blade..."
                        className="w-full bg-secondary rounded-lg py-2.5 pl-9 pr-4 text-sm font-medium outline-none border border-transparent focus:border-primary transition-all"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                </div>

                {/* Point Filters */}
                <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-none no-scrollbar">
                    <button
                        type="button"
                        onClick={() => setPointFilter("ALL")}
                        className={cn(
                            "px-3 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap border transition-all",
                            pointFilter === "ALL"
                                ? "bg-primary text-black border-primary"
                                : "bg-secondary text-muted-foreground border-border hover:bg-secondary/80"
                        )}
                    >
                        ALL
                    </button>
                    {availablePoints.map(pt => (
                        <button
                            key={pt}
                            type="button"
                            onClick={() => setPointFilter(pt)}
                            className={cn(
                                "px-2.5 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap border transition-all",
                                pointFilter === pt
                                    ? "bg-primary/20 text-primary border-primary"
                                    : "bg-secondary text-muted-foreground border-border hover:bg-secondary/80"
                            )}
                        >
                            {pt} PT
                        </button>
                    ))}
                </div>
            </div>

            {/* Grid - Made smaller (4 cols mobile, 5 sm, 6 md) */}
            <div className="flex-1 overflow-y-auto p-3 grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2 pb-20 content-start">
                {filteredOptions.map((opt) => {
                    // @ts-ignore
                    const imgPath = imageMap[opt.name];
                    return (
                        <button
                            key={opt.name}
                            className={cn(
                                "relative flex flex-col items-center gap-1.5 p-1.5 rounded-lg border border-transparent transition-all",
                                opt.blocked ? "opacity-30 grayscale" : "hover:bg-accent/50 hover:border-border active:scale-95",
                                value === opt.name ? "bg-primary/10 border-primary ring-1 ring-primary" : "bg-card/50"
                            )}
                            onClick={() => {
                                if (!opt.blocked) {
                                    onChange(opt.name);
                                    onClose();
                                }
                            }}
                        >
                            <div className="relative w-full aspect-square">
                                {imgPath ? (
                                    <Image
                                        src={imgPath}
                                        alt={opt.name}
                                        fill
                                        className="object-contain drop-shadow-md"
                                        sizes="(max-width: 768px) 25vw, 15vw"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-secondary rounded text-[8px] text-muted-foreground">
                                        No Img
                                    </div>
                                )}
                                {/* Point Badge */}
                                <div className="absolute -top-1 -right-1 bg-black/80 backdrop-blur text-primary text-[8px] font-bold px-1.5 py-0.5 rounded-full border border-primary/20 shadow-sm">
                                    {opt.point}
                                </div>
                            </div>
                            <span className="text-[9px] font-medium leading-tight text-center line-clamp-2 w-full text-muted-foreground/90">
                                {opt.name}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
