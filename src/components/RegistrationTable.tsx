"use client";

import { useMemo, memo } from "react";
import { CheckCircle, XCircle, Trash2, Users, Loader2 } from "lucide-react";
import gameData from "@/data/game-data.json";

// Define Types (subset of what is used in page.tsx)
type Registration = {
    TournamentID: string;
    RoundID: string;
    Timestamp: string;
    DeviceUUID: string;
    PlayerName: string;
    Mode: string;
    Main_Bey1: string;
    Main_Bey2: string;
    Main_Bey3: string;
    TotalPoints: string;
    Reserve_Data: string;
};

type Props = {
    data: Registration[];
    loading: boolean;
    searchQuery: string;
    onDelete: (row: Registration) => void;
};

// Extracted validation logic
const validateRow = (row: Registration) => {
    const mainBeys = [row.Main_Bey1, row.Main_Bey2, row.Main_Bey3];
    // Parse reserves
    let reserveDecks: string[][] = [];
    try {
        const parsed = JSON.parse(row.Reserve_Data);
        // Handle legacy format (single array of strings) if any
        if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'string') {
            // @ts-ignore
            reserveDecks = [parsed];
        } else {
            reserveDecks = parsed;
        }
    } catch (e) { }

    const checkDeck = (deck: string[]) => {
        if (row.Mode === "Under10") {
            const pointsMap: Record<string, number> = {};
            Object.entries(gameData.points).forEach(([pt, names]) => {
                names.forEach(name => pointsMap[name] = parseInt(pt));
            });
            const pts = deck.reduce((sum, name) => sum + (pointsMap[name] || 0), 0);
            if (pts > 10) return { valid: false, msg: `${pts}/10` };
            return { valid: true, msg: "OK" };
        } else {
            const banned = deck.filter(name => gameData.banList.includes(name));
            if (banned.length > 0) return { valid: false, msg: "Banned" };
            return { valid: true, msg: "OK" };
        }
    };

    const mainVal = checkDeck(mainBeys);
    if (!mainVal.valid) return { status: "fail", msg: `Main: ${mainVal.msg}`, reserveDecks };

    // Check Reserves
    for (let i = 0; i < reserveDecks.length; i++) {
        const deck = reserveDecks[i];
        if (!deck || deck.length === 0) continue;
        const resVal = checkDeck(deck);
        if (!resVal.valid) return { status: "fail", msg: `Res ${i + 1}: ${resVal.msg}`, reserveDecks };
    }

    return { status: "pass", msg: "OK", reserveDecks };
};

// Wrap in memo to prevent re-renders when parent state changes (like modals)
const RegistrationTable = memo(function RegistrationTable({ data, loading, searchQuery, onDelete }: Props) {

    // Memoize the processed data to avoid re-parsing JSON and re-validating on every render
    // This is crucial for performance with 250+ rows
    const processedData = useMemo(() => {
        // Pre-calculate device counts for duplicate detection
        const deviceCounts: Record<string, number> = {};
        data.forEach(r => {
            deviceCounts[r.DeviceUUID] = (deviceCounts[r.DeviceUUID] || 0) + 1;
        });

        // Filter first
        const filtered = data.filter(r =>
            r.PlayerName.toLowerCase().includes(searchQuery.toLowerCase())
        );

        return filtered.map(row => {
            const validation = validateRow(row);
            const isMulti = (deviceCounts[row.DeviceUUID] || 0) > 1;

            // Generate color for multi-device
            let deviceColor = undefined;
            if (isMulti) {
                let hash = 0;
                for (let i = 0; i < row.DeviceUUID.length; i++) hash = row.DeviceUUID.charCodeAt(i) + ((hash << 5) - hash);
                const hue = Math.abs(hash % 360);
                deviceColor = `hsl(${hue}, 70%, 60%)`;
            }

            return {
                ...row,
                validation,
                isMulti,
                deviceColor,
                reserveDecks: validation.reserveDecks
            };
        });
    }, [data, searchQuery]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] glass-card rounded-xl">
                <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
                <h3 className="text-xl font-bold italic tracking-tighter text-white animate-pulse">
                    FETCHING <span className="text-primary">DATA</span>
                </h3>
            </div>
        );
    }

    return (
        <div
            className="glass-card rounded-xl overflow-hidden overflow-x-auto"
            style={{ contentVisibility: 'auto', containIntrinsicSize: '0 500px' }} // Rendering Optimization
        >
            <table className="w-full text-sm text-left">
                <thead className="bg-secondary/50 text-muted-foreground uppercase text-xs font-bold tracking-wider">
                    <tr>
                        <th className="p-4 whitespace-nowrap">Time</th>
                        <th className="p-4 whitespace-nowrap">Player</th>
                        <th className="p-4 whitespace-nowrap">Mode</th>
                        <th className="p-4 whitespace-nowrap">Main Deck</th>
                        <th className="p-4 whitespace-nowrap">Reserves</th>
                        <th className="p-4 whitespace-nowrap">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border">
                    {processedData.map((row, i) => (
                        <tr key={`${row.RoundID}-${i}`} className="hover:bg-accent/5 transition-colors group">
                            <td className="p-4 whitespace-nowrap text-muted-foreground">
                                {new Date(row.Timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="p-4 font-medium text-foreground whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                    {row.PlayerName}
                                    {row.isMulti && (
                                        <div
                                            className="flex items-center justify-center p-1 rounded-full bg-white/10"
                                            title={`Multi-player Device: ${row.DeviceUUID.substring(0, 4)}...`}
                                            style={{ color: row.deviceColor }}
                                        >
                                            <Users className="h-3.5 w-3.5" />
                                        </div>
                                    )}
                                </div>
                            </td>
                            <td className="p-4 whitespace-nowrap">
                                <span className={`px-2 py-1 rounded text-[10px] font-bold ${row.Mode === "Under10" ? "bg-blue-500/20 text-blue-400" : row.Mode === "Standard" || row.Mode === "Open" ? "bg-green-500/20 text-green-400" : "bg-purple-500/20 text-purple-400"}`}>
                                    {row.Mode === "Under10" ? "U10" : row.Mode === "Standard" || row.Mode === "Open" ? "OPEN" : "NMM"}
                                </span>
                            </td>
                            <td className="p-4 text-xs space-y-1 min-w-[200px]">
                                <div className="flex gap-1 flex-wrap">
                                    {[row.Main_Bey1, row.Main_Bey2, row.Main_Bey3].map((b, idx) => (
                                        <span key={idx} className="bg-secondary px-1.5 py-0.5 rounded border border-border/50 whitespace-nowrap">
                                            {b}
                                        </span>
                                    ))}
                                </div>
                            </td>
                            <td className="p-4 text-xs space-y-2 min-w-[200px]">
                                {row.reserveDecks.map((deck, idx) => (
                                    <div key={idx} className="flex gap-1 items-center opacity-80 flex-wrap">
                                        <span className="text-[9px] w-4 text-muted-foreground">#{idx + 1}</span>
                                        {deck.map((b, bIdx) => (
                                            <span key={bIdx} className="bg-secondary/50 px-1 py-0.5 rounded border border-border/30 whitespace-nowrap">
                                                {b}
                                            </span>
                                        ))}
                                    </div>
                                ))}
                            </td>
                            <td className="p-4 whitespace-nowrap">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-2">
                                        {row.validation.status === "pass" && <CheckCircle className="h-4 w-4 text-green-500" />}
                                        {row.validation.status === "fail" && <XCircle className="h-4 w-4 text-red-500" />}
                                        <span className={`font-bold ${row.validation.status === "pass" ? "text-green-500" :
                                            row.validation.status === "fail" ? "text-red-500" : "text-yellow-500"
                                            }`}>
                                            {row.validation.msg}
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => onDelete(row)}
                                        className="p-2 text-muted-foreground hover:text-red-500 transition-all"
                                        title="Delete"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                    {processedData.length === 0 && !loading && (
                        <tr>
                            <td colSpan={6} className="p-8 text-center text-muted-foreground">
                                No matching registrations found.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
});

export default RegistrationTable;
