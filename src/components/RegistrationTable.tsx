"use client";

import { useMemo, memo } from "react";
import { Loader2, RefreshCw, Copy, CheckCircle, XCircle, AlertCircle, ArrowLeft, Trash2, Users, Trophy, Clock, Edit, Search, Download, Share2, ImageIcon, ArrowUp, ArrowDown, Eye, Check, Play, Lock, Unlock, Gavel, Shuffle, MonitorPlay, Volume2, ArrowLeftRight } from "lucide-react";
import gameData from "@/data/game-data.json";
import gameDataStandard from "@/data/game-data-standard.json";
import gameDataSouth from "@/data/game-data-south.json";

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
};

type Props = {
    data: Registration[];
    loading: boolean;
    searchQuery: string;
    onDelete: (row: Registration) => void;
    tournamentType?: string;
    sameDeviceConflicts?: number[];
    swapSelection?: number[];
    onSwapSelect?: (index: number) => void;
};

// Extracted validation logic
const validateRow = (row: Registration, tournamentType?: string) => {
    const mainBeys = [row.Main_Bey1, row.Main_Bey2, row.Main_Bey3];

    // Check Tournament Type Mismatch
    if (tournamentType) {
        let isMatch = false;
        if (tournamentType === 'U10' && row.Mode === 'Under10') isMatch = true;
        else if (tournamentType === 'U10South' && row.Mode === 'Under10South') isMatch = true;
        else if (tournamentType === 'NoMoreMeta' && row.Mode === 'NoMoreMeta') isMatch = true;
        else if ((tournamentType === 'Open' || tournamentType === 'Standard') && (row.Mode === 'Standard' || row.Mode === 'Open')) isMatch = true;

        if (!isMatch) {
            return { status: "fail", msg: `Type Mismatch (${row.Mode})` };
        }
    }

    const checkDeck = (deck: string[]) => {
        // Strip attachments for validation
        const cleanDeck = deck.map(d => d ? d.split('|')[0] : '');

        if (row.Mode === "Under10" || row.Mode === "Under10South") {
            // Use appropriate point mapping based on mode
            const pointData = row.Mode === "Under10South" ? gameDataSouth : gameDataStandard;
            const pointsMap: Record<string, number> = {};
            Object.entries(pointData.points).forEach(([pt, names]) => {
                names.forEach(name => pointsMap[name] = parseInt(pt));
            });
            let pts = cleanDeck.reduce((sum, name) => sum + (pointsMap[name] || 0), 0);

            // Add points for attachments if U10South
            if (row.Mode === "Under10South") {
                deck.forEach(d => {
                    const parts = d.split('|');
                    if (parts.length > 1 && (parts[1] === 'Heavy' || parts[1] === 'Wheel')) {
                        pts += 1;
                    }
                });
            }

            if (pts > 10) return { valid: false, msg: `${pts}/10` };
            return { valid: true, msg: "OK" };
        } else {
            const banned = cleanDeck.filter(name => gameData.banList.includes(name));
            if (banned.length > 0) return { valid: false, msg: "Banned" };
            return { valid: true, msg: "OK" };
        }
    };

    const mainVal = checkDeck(mainBeys);
    if (!mainVal.valid) return { status: "fail", msg: `Main: ${mainVal.msg}` };

    return { status: "pass", msg: "OK" };
};

// Wrap in memo to prevent re-renders when parent state changes (like modals)
import { useTranslation } from "@/hooks/useTranslation";

const RegistrationTable = memo(function RegistrationTable({ data, loading, searchQuery, onDelete, tournamentType, sameDeviceConflicts = [], swapSelection = [], onSwapSelect }: Props) {
    const { t } = useTranslation();

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

        return filtered.map((row, filteredIdx) => {
            const validation = validateRow(row, tournamentType);
            const isMulti = (deviceCounts[row.DeviceUUID] || 0) > 1;

            // Generate color for multi-device
            let deviceColor = undefined;
            if (isMulti) {
                let hash = 0;
                for (let i = 0; i < row.DeviceUUID.length; i++) hash = row.DeviceUUID.charCodeAt(i) + ((hash << 5) - hash);
                const hue = Math.abs(hash % 360);
                deviceColor = `hsl(${hue}, 70%, 60%)`;
            }

            // Find original index in data (before search filter) for conflict matching
            const originalIdx = data.indexOf(row);
            const isConflict = sameDeviceConflicts.includes(originalIdx);
            const isSwapSelected = swapSelection.includes(originalIdx);

            return {
                ...row,
                validation,
                isMulti,
                deviceColor,
                isConflict,
                isSwapSelected,
                originalIdx
            };
        });
    }, [data, searchQuery, tournamentType, sameDeviceConflicts, swapSelection]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] glass-card rounded-xl">
                <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
                <h3 className="text-xl font-bold italic tracking-tighter text-white animate-pulse">
                    <span className="text-primary">{t('table.loading')}</span>
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
                        <th className="p-4 whitespace-nowrap w-8">#</th>
                        <th className="p-4 whitespace-nowrap">{t('table.header.time')}</th>
                        <th className="p-4 whitespace-nowrap">{t('table.header.player')}</th>
                        <th className="p-4 whitespace-nowrap">{t('table.header.mode')}</th>
                        <th className="p-4 whitespace-nowrap">{t('table.header.deck')}</th>
                        <th className="p-4 whitespace-nowrap">{t('table.header.status')}</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border">
                    {processedData.map((row, i) => (
                        <tr
                            key={`${row.RoundID}-${i}`}
                            className={`hover:bg-accent/5 transition-colors group ${row.isConflict ? 'bg-amber-500/10 border-l-2 border-l-amber-500' : ''} ${row.isSwapSelected ? 'bg-blue-500/15 ring-1 ring-blue-500/50' : ''} ${onSwapSelect ? 'cursor-pointer select-none' : ''}`}
                            onClick={() => {
                                if (onSwapSelect) onSwapSelect(row.originalIdx);
                            }}
                        >
                            <td className="p-4 whitespace-nowrap text-muted-foreground text-xs">
                                <div className="flex items-center gap-1">
                                    {row.isSwapSelected ? (
                                        <ArrowLeftRight className="h-3.5 w-3.5 text-blue-400" />
                                    ) : (
                                        <span>{row.originalIdx + 1}</span>
                                    )}
                                </div>
                            </td>
                            <td className="p-4 whitespace-nowrap text-muted-foreground">
                                {new Date(row.Timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="p-4 font-medium text-foreground min-w-[150px] max-w-[200px]">
                                <div className="flex items-center gap-2 break-all leading-tight">
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
                                    {row.isConflict && (
                                        <div
                                            className="flex items-center justify-center p-1 rounded-full bg-amber-500/20 text-amber-500"
                                            title="จับคู่เจอเครื่องเดียวกัน! (Same Device Matchup)"
                                        >
                                            <AlertCircle className="h-3.5 w-3.5" />
                                        </div>
                                    )}
                                </div>
                            </td>
                            <td className="p-4 whitespace-nowrap">
                                <span className={`px-2 py-1 rounded text-[10px] font-bold ${row.Mode === "Under10" ? "bg-blue-500/20 text-blue-400" :
                                    row.Mode === "Under10South" ? "bg-cyan-500/20 text-cyan-400" :
                                        row.Mode === "Standard" || row.Mode === "Open" ? "bg-green-500/20 text-green-400" :
                                            "bg-purple-500/20 text-purple-400"
                                    }`}>
                                    {row.Mode === "Under10" ? "U10" :
                                        row.Mode === "Under10South" ? "U10S" :
                                            row.Mode === "Standard" || row.Mode === "Open" ? "OPEN" : "NMM"}
                                </span>
                            </td>
                            <td className="p-4 text-xs space-y-1 min-w-[200px]">
                                <div className="flex gap-1 flex-wrap">
                                    {[row.Main_Bey1, row.Main_Bey2, row.Main_Bey3].map((b, idx) => {
                                        const parts = b ? b.split('|') : [''];
                                        const name = parts[0];
                                        const attachment = parts[1];
                                        return (
                                            <span key={idx} className="bg-secondary px-1.5 py-0.5 rounded border border-border/50 whitespace-nowrap flex items-center gap-1">
                                                {name}
                                                {attachment && <span className="text-[9px] text-muted-foreground bg-black/20 px-1 rounded">{attachment}</span>}
                                            </span>
                                        );
                                    })}
                                </div>
                            </td>
                            <td className="p-4 whitespace-nowrap">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-2">
                                        {row.validation.status === "pass" && <CheckCircle className="h-4 w-4 text-green-500" />}
                                        {row.validation.status === "fail" && <XCircle className="h-4 w-4 text-red-500" />}
                                        <span className={`font-bold ${row.validation.status === "pass" ? "text-green-500" :
                                            row.validation.status === "fail" ? "text-red-500" : "text-yellow-500"
                                            }`}>
                                            {(row.validation.status === "pass" && row.validation.msg === 'OK') ? t('table.status.ok') :
                                                (row.validation.msg === 'Banned') ? t('table.status.banned') :
                                                    (row.validation.msg.includes('Type Mismatch')) ? t('table.status.mismatch', { mode: row.Mode }) :
                                                        row.validation.msg}
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => onDelete(row)}
                                        className="p-2 text-muted-foreground hover:text-red-500 transition-all"
                                        title={t('gen.delete')}
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
                                {t('table.empty')}
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
});

export default RegistrationTable;
