"use client";

import { useState, useRef, useEffect } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface ComboSelectProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: { name: string; point: number; blocked?: boolean }[];
    placeholder?: string;
    className?: string;
    error?: string;
}

export function ComboSelect({
    label,
    value,
    onChange,
    options,
    placeholder = "Select Bey...",
    className,
    error,
}: ComboSelectProps) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);

    // Close when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target as Node)
            ) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filteredOptions = options.filter((opt) =>
        opt.name.toLowerCase().includes(query.toLowerCase())
    );

    const selectedOption = options.find((opt) => opt.name === value);

    return (
        <div className={cn("flex flex-col gap-1.5 w-full", className)} ref={containerRef}>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">
                {label}
            </label>
            <div className="relative">
                <button
                    type="button"
                    onClick={() => setOpen(!open)}
                    className={cn(
                        "flex w-full items-center justify-between rounded-lg border border-input bg-secondary/50 px-3 py-2.5 text-sm font-medium shadow-sm transition-all hover:bg-secondary/80 focus:outline-none focus:ring-2 focus:ring-ring",
                        error ? "border-destructive ring-destructive" : "",
                        value ? "text-foreground" : "text-muted-foreground"
                    )}
                >
                    {value ? (
                        <span className="flex items-center gap-2">
                            <span className="truncate">{value}</span>
                            {selectedOption && (
                                <span className="inline-flex items-center justify-center rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                                    {selectedOption.point}pt
                                </span>
                            )}
                        </span>
                    ) : (
                        placeholder
                    )}
                    <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                </button>

                {open && (
                    <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-input bg-popover p-1 text-popover-foreground shadow-xl animate-in fade-in zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:zoom-out-95">
                        <div className="flex items-center border-b border-border px-3 pb-2 pt-2">
                            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                            <input
                                className="flex h-6 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                                placeholder="Search..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <div className="pt-1">
                            {filteredOptions.length === 0 ? (
                                <div className="py-6 text-center text-sm text-muted-foreground">
                                    No results found.
                                </div>
                            ) : (
                                filteredOptions.map((opt) => (
                                    <div
                                        key={opt.name}
                                        className={cn(
                                            "relative flex cursor-pointer select-none items-center rounded-md px-2 py-2 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                                            opt.blocked && "opacity-50 cursor-not-allowed",
                                            value === opt.name && "bg-accent text-accent-foreground"
                                        )}
                                        onClick={() => {
                                            if (!opt.blocked) {
                                                onChange(opt.name);
                                                setOpen(false);
                                                setQuery("");
                                            }
                                        }}
                                    >
                                        <div className="flex flex-1 items-center justify-between">
                                            <span className={cn(opt.blocked && "line-through")}>
                                                {opt.name}
                                            </span>
                                            <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                                                {opt.point}pt
                                            </span>
                                        </div>
                                        {value === opt.name && (
                                            <Check className="ml-2 h-4 w-4 text-primary" />
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>
            {error && <span className="text-xs text-destructive ml-1">{error}</span>}
        </div>
    );
}
