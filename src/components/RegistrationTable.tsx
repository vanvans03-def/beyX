"use client";

import { useMemo, memo } from "react";
import { Loader2, RefreshCw, Copy, CheckCircle, XCircle, AlertCircle, ArrowLeft, Trash2, Users, Trophy, Clock, Edit, Search, Download, Share2, ImageIcon, ArrowUp, ArrowDown, Eye, Check, Play, Lock, Unlock, Gavel, Shuffle, MonitorPlay, Volume2, ArrowLeftRight } from "lucide-react";
import gameData from "@/data/game-data.json";
import gameDataStandard from "@/data/game-data-standard.json";
import gameDataSouth from "@/data/game-data-south.json";

// Define Types (subset of what is used in page.tsx)
type Registration = {
    tournament_id: string;
    id: string;
    timestamp: string;
    device_uuid: string;
    player_name: string;
    mode: string;
    main_bey1: string;
    main_bey2: string;
    main_bey3: string;
    total_points: string;
};

type Props = {
    data: Registration[];
    loading: boolean;
    searchQuery: string;
    onDelete: (row: Registration) => void;
    onEditSession?: (row: Registration) => void;
    onEditName?: (row: Registration) => void;
    isEditNameDisabled?: boolean;
    tournamentType?: string;
    sameDeviceConflicts?: number[];
    swapSelection?: number[];
    onSwapSelect?: (index: number) => void;
};

// Extracted validation logic
const validateRow = (row: Registration, tournamentType?: string) => {
    const mainBeys = [row.main_bey1, row.main_bey2, row.main_bey3];

    // Check Tournament Type Mismatch
    if (tournamentType) {
        let isMatch = false;
        if (tournamentType === 'U10' && row.mode === 'Under10') isMatch = true;
        else if (tournamentType === 'U10South' && row.mode === 'Under10South') isMatch = true;
        else if (tournamentType === 'NoMoreMeta' && row.mode === 'NoMoreMeta') isMatch = true;
        else if ((tournamentType === 'Open' || tournamentType === 'Standard') && (row.mode === 'Standard' || row.mode === 'Open')) isMatch = true;

        if (!isMatch) {
            return { status: "fail", msg: `Type Mismatch (${row.mode})` };
        }
    }

    const checkDeck = (deck: string[]) => {
        // Strip attachments for validation
        const cleanDeck = deck.map(d => d ? d.split('|')[0] : '');

        if (row.mode === "Under10" || row.mode === "Under10South") {
            // Use appropriate point mapping based on mode
            const pointData = row.mode === "Under10South" ? gameDataSouth : gameDataStandard;
            const pointsMap: Record<string, number> = {};
            Object.entries(pointData.points).forEach(([pt, names]) => {
                names.forEach(name => pointsMap[name] = parseInt(pt));
            });
            let pts = cleanDeck.reduce((sum, name) => sum + (pointsMap[name] || 0), 0);

            // Add points for attachments if U10South
            if (row.mode === "Under10South") {
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

const RegistrationTable = memo(function RegistrationTable({ data, loading, searchQuery, onDelete, onEditSession, onEditName, isEditNameDisabled, tournamentType, sameDeviceConflicts = [], swapSelection = [], onSwapSelect }: Props) {
    const { t } = useTranslation();

    // Memoize the processed data to avoid re-parsing JSON and re-validating on every render
    // This is crucial for performance with 250+ rows
    const processedData = useMemo(() => {
        // Pre-calculate device counts for duplicate detection
        const deviceCounts: Record<string, number> = {};
        data.forEach(r => {
            deviceCounts[r.device_uuid] = (deviceCounts[r.device_uuid] || 0) + 1;
        });

        // Pre-calculate some color hashes for devices
        const deviceColors: Record<string, string> = {};
        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
        Object.keys(deviceCounts).forEach((uuid, i) => {
            deviceColors[uuid] = colors[i % colors.length];
        });

        // Filter first (support searching player name and main beys)
        const filtered = data.filter(r => {
            if (!searchQuery) return true;
            const query = searchQuery.toLowerCase();
            return (
                r.player_name.toLowerCase().includes(query) ||
                (r.main_bey1 && r.main_bey1.toLowerCase().includes(query)) ||
                (r.main_bey2 && r.main_bey2.toLowerCase().includes(query)) ||
                (r.main_bey3 && r.main_bey3.toLowerCase().includes(query))
            );
        });

        return filtered.map((row) => {
            const validation = validateRow(row, tournamentType);
            const isMulti = (deviceCounts[row.device_uuid] || 0) > 1;

            // Generate color for multi-device (use pre-calculated theme color, fallback to HSL)
            let deviceColor = isMulti ? deviceColors[row.device_uuid] : undefined;
            if (isMulti && !deviceColor) {
                let hash = 0;
                for (let i = 0; i < row.device_uuid.length; i++) hash = row.device_uuid.charCodeAt(i) + ((hash << 5) - hash);
                const hue = Math.abs(hash % 360);
                deviceColor = `hsl(${hue}, 70%, 60%)`;
            }

            // Find original index in data (before search filter) for conflict matching
            const originalIdx = data.indexOf(row);
            const isConflict = sameDeviceConflicts.includes(originalIdx);
            const isSwapSelected = swapSelection.includes(originalIdx);
            const isSwapping = isSwapSelected;

            return {
                ...row,
                validation,
                isMulti,
                deviceColor,
                isConflict,
                isSwapSelected,
                isSwapping,
                originalIdx
            };
        });
    }, [data, searchQuery, tournamentType, sameDeviceConflicts, swapSelection]);

    return (
        <div className="overflow-x-auto rounded-lg border border-white/10 glass-card">
            <table className="w-full text-sm text-left border-collapse">
                <thead className="text-xs uppercase bg-secondary/50 text-muted-foreground border-b border-white/10">
                    <tr>
                        <th className="p-4 font-bold">{t('table.header.no')}</th>
                        <th className="p-4 font-bold">{t('table.header.time')}</th>
                        <th className="p-4 font-bold">{t('table.header.player')}</th>
                        <th className="p-4 font-bold">{t('table.header.mode')}</th>
                        <th className="p-4 font-bold">{t('table.header.deck')}</th>
                        <th className="p-4 font-bold text-right">{t('table.header.status')}</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/5 bg-black/40">
                    {processedData.map((row, i) => (
                        <tr
                            key={`${row.id}-${i}`}
                            className={`hover:bg-accent/5 transition-colors group ${row.isConflict ? 'bg-amber-500/10 border-l-2 border-l-amber-500' : ''} ${row.isSwapSelected ? 'bg-blue-500/15 ring-1 ring-blue-500/50' : ''} ${onSwapSelect ? 'cursor-pointer select-none' : ''}`}
                            onClick={() => {
                                if (onSwapSelect) onSwapSelect(row.originalIdx);
                            }}
                        >
                            <td className="p-4 whitespace-nowrap">
                                <div className={`h-8 w-8 rounded-lg flex items-center justify-center font-bold text-xs border ${row.isSwapping ? 'bg-blue-500 border-blue-400 text-white animate-pulse' : 'bg-secondary border-white/5 text-muted-foreground'}`}>
                                    {row.isSwapping ? (
                                        <ArrowLeftRight className="h-3.5 w-3.5" />
                                    ) : (
                                        <span>{row.originalIdx + 1}</span>
                                    )}
                                </div>
                            </td>
                            <td className="p-4 whitespace-nowrap text-muted-foreground">
                                {new Date(row.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="p-4 font-medium text-foreground min-w-[150px] max-w-[200px]">
                                <div className="flex items-center gap-2 break-all leading-tight">
                                    {row.player_name}
                                    {row.isMulti && (
                                        <div
                                            className="flex items-center justify-center p-1 rounded-full bg-white/10"
                                            title={`Multi-player Device: ${row.device_uuid.substring(0, 4)}...`}
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
                                <span className={`px-2 py-1 rounded text-[10px] font-bold ${row.mode === "Under10" ? "bg-blue-500/20 text-blue-400" :
                                    row.mode === "Under10South" ? "bg-cyan-500/20 text-cyan-400" :
                                        row.mode === "Standard" || row.mode === "Open" ? "bg-green-500/20 text-green-400" :
                                            "bg-purple-500/20 text-purple-400"
                                    }`}>
                                    {row.mode === "Under10" ? "U10" :
                                        row.mode === "Under10South" ? "U10S" :
                                            row.mode === "Standard" || row.mode === "Open" ? "OPEN" : "NMM"}
                                </span>
                            </td>
                            <td className="p-4 text-xs space-y-1 min-w-[200px]">
                                <div className="flex gap-1 flex-wrap">
                                    {[row.main_bey1, row.main_bey2, row.main_bey3].map((b, idx) => {
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
                                                    (row.validation.msg.includes('Type Mismatch')) ? t('table.status.mismatch', { mode: row.mode }) :
                                                        row.validation.msg}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {onEditSession && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onEditSession(row);
                                                }}
                                                className="p-2 text-muted-foreground hover:text-blue-500 transition-all"
                                                title="Edit Session (QR)"
                                            >
                                                <Share2 className="h-4 w-4" />
                                            </button>
                                        )}
                                        {onEditName && (
                                            <button
                                                disabled={isEditNameDisabled}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onEditName(row);
                                                }}
                                                className={`p-2 transition-all ${isEditNameDisabled ? 'text-muted-foreground/30 cursor-not-allowed' : 'text-muted-foreground hover:text-primary'}`}
                                                title={isEditNameDisabled ? "Cannot edit player name after tournament starts" : "Edit Player Name"}
                                            >
                                                <Edit className="h-4 w-4" />
                                            </button>
                                        )}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDelete(row);
                                            }}
                                            className="p-2 text-muted-foreground hover:text-red-500 transition-all"
                                            title={t('gen.delete')}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
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
