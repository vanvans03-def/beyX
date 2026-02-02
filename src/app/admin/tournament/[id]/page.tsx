"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import gameData from "@/data/game-data.json";
import { QRCodeSVG } from "qrcode.react";
import { toPng } from "html-to-image";
import { useRef } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { Loader2, RefreshCw, Copy, CheckCircle, XCircle, AlertCircle, ArrowLeft, Trash2, Users, Trophy, Clock, Edit, Search, Download, Share2, ImageIcon, ArrowUp, ArrowDown, Eye, Check, Play, Lock, Unlock, Gavel, Shuffle } from "lucide-react";
import imageMap from "@/data/image-map.json";
import Image from "next/image";
import { Modal } from "@/components/ui/Modal";
import TournamentBracket from "@/components/TournamentBracket";
import { toast } from "sonner";
import StandingsTable from "@/components/StandingsTable";
import RegistrationTable from "@/components/RegistrationTable";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

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

type Match = {
    id: number;
    state: string; // "open", "pending", "complete"
    player1_id: number;
    player2_id: number;
    winner_id: number | null;
    scores_csv: string;
    round: number;
    identifier: string; // "A", "B", etc.
    suggested_play_order?: number;
    player1?: { name: string; misc?: string };
    player2?: { name: string; misc?: string };
    completed_at?: string;
    updated_at?: string;
};

export default function TournamentDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { t } = useTranslation();
    const [id, setId] = useState<string>("");

    // Unwrap params
    useEffect(() => {
        params.then(p => setId(p.id));
    }, [params]);

    const [data, setData] = useState<Registration[]>([]);
    const [tournament, setTournament] = useState<any>(null); // Store full tournament details
    const [currentUser, setCurrentUser] = useState<{ username: string, shop_name: string } | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetch("/api/admin/profile")
            .then(res => {
                if (!res.ok) throw new Error("Failed to fetch profile");
                return res.json();
            })
            .then(data => {
                if (data.success) setCurrentUser(data.user);
            })
            .catch(err => console.error("Failed to fetch user profile", err));
    }, []);
    const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [matchSearchQuery, setMatchSearchQuery] = useState("");

    const cardRef = useRef<HTMLDivElement>(null);
    const banListRef = useRef<HTMLDivElement>(null);
    const activeMatchesRef = useRef<HTMLDivElement>(null);

    const [generating, setGenerating] = useState(false);
    const [generatingBanList, setGeneratingBanList] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [banListImage, setBanListImage] = useState<string | null>(null);
    const [bracketUrl, setBracketUrl] = useState<string>("");
    const [generatingBracket, setGeneratingBracket] = useState(false);

    // New States for Enhancements
    const [matches, setMatches] = useState<Match[]>([]);
    const [standings, setStandings] = useState<any[]>([]);
    const [loadingMatches, setLoadingMatches] = useState(false);
    const [settingsModalOpen, setSettingsModalOpen] = useState(false);
    const [tournamentType, setTournamentType] = useState("single elimination");
    const [isShuffle, setIsShuffle] = useState(true);
    const [isQuickAdvance, setIsQuickAdvance] = useState(true); // Default to true
    const [isQuickMode, setIsQuickMode] = useState(false);
    const [historyTooltip, setHistoryTooltip] = useState<{ x: number, y: number } | null>(null); // Replaces historyOpen
    const [editingMatchId, setEditingMatchId] = useState<number | null>(null); // Track which match in history is being edited


    // Config for Scoring
    const [scoreInputs, setScoreInputs] = useState<Record<number, { p1: string, p2: string }>>({});
    const [updatingMatchIds, setUpdatingMatchIds] = useState<number[]>([]); // Track updating matches for smooth UI

    // Arena State
    const [arenaCount, setArenaCount] = useState(0);
    const [selectedArenaMatchId, setSelectedArenaMatchId] = useState<number | null>(null);

    // Bulk Register State
    const [bulkPlayers, setBulkPlayers] = useState("");
    const [isRegistering, setIsRegistering] = useState(false);
    const [highlightedLines, setHighlightedLines] = useState<number[]>([]);
    const [dbConflicts, setDbConflicts] = useState<string[]>([]);
    const [internalConflicts, setInternalConflicts] = useState<string[]>([]);

    // Calculate duplicates on the fly
    const getDuplicateLines = (text: string) => {
        const lines = text.split('\n');
        const seen = new Map<string, number>(); // Content -> First Line Index
        const duplicates = new Set<number>();
        const internalNames = new Set<string>();

        lines.forEach((line, index) => {
            const trimmed = line.trim().toLowerCase();
            if (!trimmed) return;

            if (seen.has(trimmed)) {
                duplicates.add(index);
                duplicates.add(seen.get(trimmed)!); // Mark the first occurrence too if duplicate found later
                internalNames.add(line.trim());
            } else {
                seen.set(trimmed, index);
            }
        });

        return { indices: Array.from(duplicates), names: Array.from(internalNames) };
    };

    // Update highlights when text changes
    useEffect(() => {
        const { indices, names } = getDuplicateLines(bulkPlayers);
        // Merge with known DB conflicts (find lines that match dbConflicts)
        const lines = bulkPlayers.split('\n');
        const dbIndices: number[] = [];

        lines.forEach((line, idx) => {
            const val = line.trim();
            if (val && dbConflicts.map(d => d.toLowerCase()).includes(val.toLowerCase())) {
                dbIndices.push(idx);
            }
        });

        setHighlightedLines([...new Set([...indices, ...dbIndices])]);
        setInternalConflicts(names);
    }, [bulkPlayers, dbConflicts]);

    // Shuffle State
    const [isListShuffled, setIsListShuffled] = useState(false);
    const [shuffledData, setShuffledData] = useState<Registration[] | null>(null);

    // Combo Display Settings
    const [showPlayerCombo, setShowPlayerCombo] = useState(true);
    // Replace modal state with tooltip state
    const [hoveredCombo, setHoveredCombo] = useState<{ x: number, y: number, data: Registration, deckIndex: number } | null>(null);

    // Toggle tooltip logic
    const handleShowCombo = (e: React.MouseEvent, reg: Registration) => {
        e.stopPropagation();

        // If clicking the same button, close it
        if (hoveredCombo?.data.PlayerName === reg.PlayerName) {
            setHoveredCombo(null);
            return;
        }

        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        // Position hint: slightly below and right aligned or centered
        // Position hint: slightly below and right aligned or centered
        setHoveredCombo({
            x: rect.left + window.scrollX,
            y: rect.bottom + window.scrollY + 10,
            data: reg,
            deckIndex: 0 // Start at Main Deck (0)
        });
    };

    // Close on click elsewhere (via event listener or backdrop)
    useEffect(() => {
        const handleClickOutside = () => setHoveredCombo(null);
        if (hoveredCombo) {
            window.addEventListener('click', handleClickOutside);
        }
        return () => window.removeEventListener('click', handleClickOutside);
    }, [hoveredCombo]);

    const [origin, setOrigin] = useState("");

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setOrigin(window.location.origin);
            // Load settings
            const savedShowCombo = localStorage.getItem(`tournament_settings_${id}_showCombo`);
            if (savedShowCombo !== null) {
                setShowPlayerCombo(savedShowCombo === 'true');
            }
        }
    }, [id]);

    // Helper to clean URL for component prop if needed, though current component handles suffix
    const removeModuleSuffix = (url: string) => url.replace(/\/module$/, '');

    const handleShowHistory = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (historyTooltip) {
            setHistoryTooltip(null);
            return;
        }
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setHistoryTooltip({
            x: rect.left + window.scrollX,
            y: rect.bottom + window.scrollY + 10
        });
    };

    // Close tooltip on click outside
    useEffect(() => {
        const handleClickOutside = () => {
            if (historyTooltip) setHistoryTooltip(null);
        };
        if (historyTooltip) window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, [historyTooltip]);

    const handleGeneratePreview = async () => {
        setGenerating(true);

        // Wait a bit for any layouts to settle
        await new Promise((resolve) => setTimeout(resolve, 500));

        if (cardRef.current === null) {
            console.error("Card ref is null after waiting");
            setGenerating(false);
            return;
        }

        try {
            await document.fonts.ready;

            const imageElements = Array.from(cardRef.current.getElementsByTagName("img"));
            console.log(`Found ${imageElements.length} images`);

            // Force wait for all images to decode/paint
            await Promise.all(
                imageElements.map(async (img) => {
                    if (img.src && !img.complete) {
                        await new Promise((resolve) => {
                            img.onload = resolve;
                            img.onerror = resolve;
                            setTimeout(resolve, 2000); // Timeout
                        });
                    }
                    try {
                        // Crucial for iOS/Safari: Ensure image is decoded into memory
                        await img.decode();
                    } catch (e) {
                        console.warn("Image decode failed", e);
                    }
                })
            );

            console.log('Images ready, waiting for paint...');
            console.log('Images ready, waiting for paint...');
            await new Promise((resolve) => setTimeout(resolve, 4000)); // Increased wait time for better rendering (iOS safe)

            console.log('Capturing with html-to-image...');

            // Use html-to-image
            const dataUrl = await toPng(cardRef.current, {
                backgroundColor: '#030303',
                pixelRatio: 1.5, // Reduced from 2 for performance
                cacheBust: true
            });

            console.log('✓ Image generated successfully');
            setPreviewImage(dataUrl);

        } catch (err) {
            console.error('Image generation error:', err);
            setModalConfig({
                isOpen: true,
                title: "Error",
                desc: t('admin.error.gen_image'),
                type: "alert",
                variant: "destructive"
            });
        } finally {
            setGenerating(false);
        }
    };

    const handleExportBanList = async () => {
        setGeneratingBanList(true);

        await new Promise((resolve) => setTimeout(resolve, 500));

        if (banListRef.current === null) {
            console.error("Ban list ref is null after waiting");
            setGeneratingBanList(false);
            return;
        }

        try {
            await document.fonts.ready;

            const imageElements = Array.from(banListRef.current.getElementsByTagName("img"));
            console.log(`Found ${imageElements.length} ban list images`);

            await Promise.all(
                imageElements.map(async (img) => {
                    if (img.src && !img.complete) {
                        await new Promise((resolve) => {
                            img.onload = resolve;
                            img.onerror = resolve;
                            setTimeout(resolve, 2000);
                        });
                    }
                    try {
                        await img.decode();
                    } catch (e) {
                        console.warn("Image decode failed", e);
                    }
                })
            );

            console.log('Ban list images ready, waiting for paint...');
            await new Promise((resolve) => setTimeout(resolve, 1500));

            console.log('Capturing ban list with html-to-image...');

            // Use html-to-image
            const dataUrl = await toPng(banListRef.current, {
                backgroundColor: '#030303',
                pixelRatio: 1.5, // Reduced from 2 for performance
                cacheBust: true
            });

            console.log('✓ Ban list image generated successfully');
            setBanListImage(dataUrl);

        } catch (err) {
            console.error('Ban list generation error:', err);
            setModalConfig({
                isOpen: true,
                title: "Error",
                desc: t('admin.error.gen_ban_list'),
                type: "alert",
                variant: "destructive"
            });
        } finally {
            setGeneratingBanList(false);
        }
    };

    const handleSaveImage = async () => {
        if (!previewImage) return;

        try {
            // Convert data URL to blob for better compatibility
            const response = await fetch(previewImage);
            const blob = await response.blob();

            // Try modern Web Share API first (works in LINE, iOS Safari, etc.)
            if (navigator.share && navigator.canShare && navigator.canShare({ files: [new File([blob], 'invite.jpg', { type: 'image/jpeg' })] })) {
                const file = new File([blob], `invite-${tournament?.Name || 'tournament'}.jpg`, { type: 'image/jpeg' });
                await navigator.share({
                    files: [file],
                    title: t('admin.share.invite_title'),
                    text: t('admin.share.invite_text', { name: tournament?.Name || 'our tournament' })
                });
                return;
            }
        } catch (shareError) {
            console.log('Share API not available or failed, falling back to download:', shareError);
        }

        // Fallback: Traditional download link
        try {
            const link = document.createElement('a');
            link.download = `invite-${tournament?.Name || 'tournament'}.jpg`;
            link.href = previewImage;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();

            // Cleanup after a delay
            setTimeout(() => {
                document.body.removeChild(link);
            }, 100);
        } catch (downloadError) {
            console.error('Download failed:', downloadError);
            // Last resort: open in new tab
            window.open(previewImage, '_blank');
        }
    };

    const handleSaveBanList = async () => {
        if (!banListImage) return;

        try {
            const response = await fetch(banListImage);
            const blob = await response.blob();

            if (navigator.share && navigator.canShare && navigator.canShare({ files: [new File([blob], 'banlist.jpg', { type: 'image/jpeg' })] })) {
                const file = new File([blob], `banlist-${tournament?.Name || 'tournament'}.jpg`, { type: 'image/jpeg' });
                await navigator.share({
                    files: [file],
                    title: t('admin.share.ban_list_title'),
                    text: t('admin.share.ban_list_text', { name: tournament?.Name || 'our tournament' })
                });
                return;
            }
        } catch (shareError) {
            console.log('Share API not available or failed, falling back to download:', shareError);
        }

        try {
            const link = document.createElement('a');
            link.download = `banlist-${tournament?.Name || 'tournament'}.jpg`;
            link.href = banListImage;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();

            setTimeout(() => {
                document.body.removeChild(link);
            }, 100);
        } catch (downloadError) {
            console.error('Download failed:', downloadError);
            window.open(banListImage, '_blank');
        }
    };

    const fetchStandings = async () => {
        try {
            const res = await fetch(`/api/admin/tournaments/${id}/standings`);
            if (!res.ok) return;
            const json = await res.json();
            if (json.success) {
                setStandings(json.data);
            }
        } catch (e) {
            console.error("Failed to fetch standings", e);
        }
    };

    const pollTournamentStatus = async () => {
        try {
            const res = await fetch(`/api/admin/tournaments?id=${id}`);
            if (!res.ok) return;
            const json = await res.json();
            if (json.success && json.data) {
                const remoteStatus = json.data.Status;

                // Check if status changed from open to completed/closed
                if (tournament?.Status !== remoteStatus) {
                    setTournament((prev: any) => ({ ...prev, ...json.data }));

                    if (remoteStatus === 'COMPLETED' || remoteStatus === 'CLOSED') {
                        // If tournament just finished remotely, fetch standings immediately
                        fetchStandings();
                    }
                }
            }
        } catch (e) {
            console.error("Failed to poll status", e);
        }
    };

    const fetchMatches = async (url: string, silent = false) => {
        if (!silent) setLoadingMatches(true);
        try {
            const res = await fetch(`/api/admin/matches?tournamentUrl=${encodeURIComponent(url)}`);
            if (!res.ok) {
                console.error("Failed to fetch matches:", res.status, res.statusText);
                return;
            }
            const json = await res.json();
            if (json.matches) {
                // Check if we need to update to avoid re-renders if data is same (NextJS state update optimization might handle it, but good to be safe)
                // For now, simple set
                setMatches(prev => {
                    const isSame = JSON.stringify(prev) === JSON.stringify(json.matches);
                    return isSame ? prev : json.matches;
                });
            }
        } catch (e) {
            console.error("Failed to fetch matches", e);
        } finally {
            if (!silent) setLoadingMatches(false);
        }
    };

    const confirmUpdateMatch = async (matchId: number, scores: string, winnerId: number) => {
        if (!bracketUrl) return;

        // Start loading state for this match
        setUpdatingMatchIds(prev => [...prev, matchId]);

        // Broadcast start loading
        if (channelRef.current) {
            channelRef.current.send({
                type: 'broadcast',
                event: 'match-updating',
                payload: { matchId, isUpdating: true }
            });
        }

        // Optimistic update removed to prevent flickering colors as per user request
        // We rely on the loading spinner and final fetch to update UI state

        try {
            const res = await fetch('/api/admin/matches', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tournamentUrl: bracketUrl,
                    matchId,
                    scoresCsv: scores,
                    winnerId,
                    tournamentId: id
                })
            });
            if (!res.ok) throw new Error("Failed to update match");

            // Await the fetch to ensure UI stays in loading state until data is fresh
            await fetchMatches(bracketUrl, true);

            // Clear input state for this match to prevent stale data on next edit
            setScoreInputs(prev => {
                const newInputs = { ...prev };
                delete newInputs[matchId];
                return newInputs;
            });

            toast.success("Match result updated successfully!");
        } catch (e) {
            console.error(e);
            // Revert or just refresh to get true state
            fetchMatches(bracketUrl, true);
            setModalConfig({
                isOpen: true,
                title: "Error",
                desc: "Failed to update match result.",
                type: "alert",
                variant: "destructive"
            });
        } finally {
            // Remove from loading state
            setUpdatingMatchIds(prev => prev.filter(id => id !== matchId));

            // Broadcast stop loading
            if (channelRef.current) {
                channelRef.current.send({
                    type: 'broadcast',
                    event: 'match-updating',
                    payload: { matchId, isUpdating: false }
                });
            }
        }
    };

    const handleUpdateMatch = (matchId: number, scores: string, winnerId: number, playerName: string) => {
        // No hiding scores logic anymore
        if (isQuickMode) {
            // Skip confirmation in Quick Mode
            confirmUpdateMatch(matchId, scores, winnerId);
        } else {
            setModalConfig({
                isOpen: true,
                title: t('admin.matches.confirm_win'),
                content: (
                    <div className="text-center text-lg">
                        {t('admin.matches.win_confirm_text_prefix')} <span className="font-bold text-green-500 text-xl break-all">{playerName}</span> {t('admin.matches.win_confirm_text_suffix')}
                    </div>
                ),
                type: "confirm",
                onConfirm: () => {
                    setModalConfig(prev => ({ ...prev, isOpen: false }));
                    confirmUpdateMatch(matchId, scores, winnerId);
                }
            });
        }
    };



    // Initial fetch handled by other useEffect, but ensures we are live 

    const handleGenerateBracket = async () => {
        if (!tournament?.Name) return;
        setSettingsModalOpen(false); // Close modal
        setGeneratingBracket(true);
        // Save settings
        if (typeof window !== 'undefined') {
            localStorage.setItem(`tournament_settings_${id}_showCombo`, String(showPlayerCombo));
        }

        // Check Challonge Limits
        if (data.length > 256) {
            toast.error(t('admin.error.limit_exceeded'), {
                description: t('admin.error.limit_desc', { n: data.length })
            });
            setGeneratingBracket(false);
            return;
        }

        try {
            // Prepare players list
            const players = data.map(r => ({
                username: r.PlayerName,
                beyblade_combo: `${r.Main_Bey1} / ${r.Main_Bey2} / ${r.Main_Bey3}`
            }));

            const res = await fetch('/api/generate-bracket', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    roomName: tournament.Name,
                    players,
                    type: tournamentType,
                    shuffle: isShuffle,
                    quickAdvance: isQuickAdvance,
                    tournamentId: id, // Send ID to save URL
                    arenaCount: arenaCount // Send Arena Count
                })
            });

            const json = await res.json();

            // Validate Registrations here before starting
            // While RegistrationTable calculates it visually, we should ensure no "fail" status exists
            // Since we don't have the table's internal calculation here easily without duplicating logic,
            // we will do a quick check similarly or trust the standard "fail" logic reuse.
            // Let's reuse a simplified check or iterate similar to validateRow from table (re-implemented briefly here or check raw data)

            // Re-implement basic check:
            const invalidPlayers = data.filter(r => {
                let isMatch = false;
                if (tournament?.Type === 'U10' && r.Mode === 'Under10') isMatch = true;
                else if (tournament?.Type === 'NoMoreMeta' && r.Mode === 'NoMoreMeta') isMatch = true;
                else if ((tournament?.Type === 'Open' || tournament?.Type === 'Standard') && (r.Mode === 'Standard' || r.Mode === 'Open')) isMatch = true;
                return !isMatch;
            });

            if (invalidPlayers.length > 0) {
                toast.error(t('admin.error.start_failed'), {
                    description: t('admin.error.mismatched_modes', { n: invalidPlayers.length })
                });
                setGeneratingBracket(false);
                return;
            }

            if (!res.ok) {
                throw new Error(json.error || 'Failed to generate bracket');
            }

            setBracketUrl(json.url);

            // Update Status to STARTED
            await fetch('/api/admin/tournaments', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tournamentId: id, status: 'STARTED' })
            });
            // Update local state
            setTournament((prev: any) => ({ ...prev, Status: 'STARTED' }));

            fetchMatches(json.url); // Load matches immediately

            toast.success("Tournament bracket created successfully!");

        } catch (error: any) {
            console.error('Bracket generation failed:', error);

            const errorMessage = error.message;

            // Check if it's an API Key related error
            if (errorMessage && (errorMessage.includes("API Key") || errorMessage.includes("401"))) {
                setModalConfig({
                    isOpen: true,
                    title: t('admin.error.challonge_auth'),
                    desc: t('admin.error.challonge_auth_desc'),
                    type: "alert",
                    variant: 'destructive'
                });
            } else {
                toast.error(errorMessage || "Failed to generate bracket");
            }

        } finally {
            setGeneratingBracket(false);
        }
    };

    const handleEndTournament = async () => {
        setModalConfig({
            isOpen: true,
            title: t('admin.end_confirm_title'),
            desc: t('admin.end_confirm_desc', { name: tournament?.Name || '' }),
            type: "confirm",
            onConfirm: async () => {
                setModalConfig(prev => ({ ...prev, isOpen: false }));
                try {
                    const res = await fetch('/api/admin/tournaments', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ tournamentId: id, status: 'CLOSED' })
                    });

                    const json = await res.json();

                    if (!res.ok) {
                        throw new Error(json.error || json.message || "Failed to end tournament");
                    }

                    // Force refresh full dataset to get status update
                    setTournament((prev: any) => ({ ...prev, Status: 'CLOSED' }));
                    fetchStandings();
                    toast.success("Tournament ended successfully.");
                } catch (e: any) {
                    console.error("End tournament error:", e);
                    let msg = e.message || "Failed to end tournament";
                    if (msg.includes("Challonge Error")) {
                        msg = msg.replace("Challonge Error: ", "");
                    }
                    toast.error("Error ending tournament", {
                        description: msg
                    });
                }
            }
        });
    };

    const handleResetTournament = async () => {
        setModalConfig({
            isOpen: true,
            title: t('admin.reset.title'),
            desc: t('admin.reset.desc'),
            type: "confirm",
            variant: "destructive",
            confirmText: t('admin.reset.confirm'),
            onConfirm: async () => {
                setModalConfig(prev => ({ ...prev, isOpen: false }));
                try {
                    await fetch('/api/admin/tournaments/reset', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ tournamentId: id })
                    });
                    // Immediately clear local state
                    setBracketUrl("");
                    setMatches([]);
                    setStandings([]);
                    fetchData(); // Refresh all
                    toast.success(t('admin.toast.reset_complete'));
                } catch (e) {
                    console.error(e);
                    setModalConfig({
                        isOpen: true,
                        title: "Error",
                        desc: "Failed to reset tournament.",
                        type: "alert",
                        variant: "destructive"
                    });
                }
            }
        });
    }

    const handleBulkRegister = async () => {
        if (!bulkPlayers.trim()) return;
        setIsRegistering(true);
        setDbConflicts([]); // Clear previous DB conflicts

        // Check internal first
        if (internalConflicts.length > 0) {
            toast.error("Duplicate names found in list", { description: "Please fix duplicates highlighted in red." });
            setIsRegistering(false);
            return;
        }

        try {
            const players = bulkPlayers.split('\n').filter(p => p.trim());
            const res = await fetch('/api/admin/registrations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tournamentId: id,
                    players,
                    mode: tournament?.Type || 'Open'
                })
            });
            const json = await res.json();
            if (res.ok) {
                setBulkPlayers("");
                // Reset textarea height
                const ta = document.getElementById('bulk-textarea');
                if (ta) ta.style.height = '';
                setDbConflicts([]);
                fetchData();
                toast.success(json.message || "Players registered successfully");
            } else {
                // If 400 with details, show specific errors
                if (json.details) {
                    if (json.details.conflicts) {
                        setDbConflicts(json.details.conflicts);
                        toast.error("Registration Failed", { description: `Found ${json.details.conflicts.length} names already registered.` });
                    }
                    if (json.details.internal) {
                        // Should be caught by client-side check but just in case
                        toast.error("Registration Failed", { description: "Duplicate names in list." });
                    }
                } else {
                    toast.error("Failed to register players", { description: json.message });
                }
            }
        } catch (e) {
            console.error(e);
            toast.error("Error registering players");
        } finally {
            setIsRegistering(false);
        }
    };

    const handleShufflePlayers = () => {
        // Must allow unique shuffle every time
        const shuffled = [...data].sort(() => Math.random() - 0.5);
        setShuffledData(shuffled);
        setIsListShuffled(true);
    };

    // Modal State
    const [modalConfig, setModalConfig] = useState<{
        isOpen: boolean;
        title: string;
        desc?: string;
        content?: React.ReactNode;
        type: "alert" | "confirm" | "custom";
        variant?: "default" | "destructive";
        confirmText?: string;
        onConfirm?: () => void;
    }>({
        isOpen: false,
        title: "",
        type: "alert"
    });

    const fetchData = useCallback(async (silent = false) => {
        if (!id) return;
        if (!silent) setLoading(true);
        try {
            const [regRes, tourRes] = await Promise.all([
                fetch(`/api/admin/registrations?tournamentId=${id}`),
                fetch(`/api/admin/tournaments?id=${id}`)
            ]);



            if (!regRes.ok) {
                const text = await regRes.text();
                console.error(`Registrations fetch failed: ${regRes.status} ${text}`);
            }
            if (!tourRes.ok) {
                const text = await tourRes.text();
                console.error(`Tournament fetch failed: ${tourRes.status} ${text}`);
            }

            if (!regRes.ok || !tourRes.ok) throw new Error(`Failed to fetch data (Reg:${regRes.status}, Tour:${tourRes.status})`);

            const regJson = await regRes.json();
            const tourJson = await tourRes.json();

            if (regJson.success) {
                const sorted = regJson.data.sort((a: any, b: any) =>
                    new Date(b.Timestamp).getTime() - new Date(a.Timestamp).getTime()
                );
                setData(sorted);
            }

            if (tourJson.success) {
                setTournament(tourJson.data);
                // Check both cases just to be safe, but API returns ChallongeUrl
                const url = tourJson.data.ChallongeUrl || tourJson.data.challonge_url;
                if (url) {
                    console.log("Restoring bracket URL:", url);
                    setBracketUrl(url);
                    // Load matches if URL exists
                    fetchMatches(url, silent);
                    fetchStandings();
                } else {
                    setBracketUrl(""); // Reset if no URL
                }
            }

            if (!silent) setLastRefreshed(new Date());
        } catch (err) {
            console.error(err);
            setModalConfig({
                isOpen: true,
                title: "Error",
                desc: "Failed to fetch data.",
                type: "alert",
                variant: "destructive"
            });
        } finally {
            if (!silent) setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        if (id) fetchData();
    }, [id]);

    const copyToClipboard = () => {
        const text = data.map(r => `${r.PlayerName} (${r.Mode})`).join("\n");
        navigator.clipboard.writeText(text);
        setModalConfig({
            isOpen: true,
            title: "Success",
            desc: "Copied list to clipboard!",
            type: "alert"
        });
    };

    const handleDelete = useCallback((row: Registration) => {
        if (bracketUrl) {
            setModalConfig({
                isOpen: true,
                title: t('admin.matches.refresh').replace("Refresh Matches", "Error") === "Error" ? "Error" : "Error", // Fallback or just use "Error"
                desc: t('admin.error.delete_started'),
                type: "alert",
                variant: "destructive"
            });
            return;
        }

        setModalConfig({
            isOpen: true,
            title: "Delete Registration?",
            desc: `Are you sure you want to delete ${row.PlayerName}? This action cannot be undone.`,
            type: "confirm",
            variant: "destructive",
            onConfirm: async () => {
                setModalConfig(prev => ({ ...prev, isOpen: false }));
                try {
                    await fetch("/api/admin/registrations", {
                        method: "DELETE",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ roundId: row.RoundID })
                    });
                    fetchData();
                } catch (e) {
                    setModalConfig({
                        isOpen: true,
                        title: "Error",
                        desc: "Failed to delete registration.",
                        type: "alert",
                        variant: "destructive"
                    });
                }
            }
        });
    }, [fetchData, bracketUrl, t]);

    // Locked Matches State (Realtime Presence)
    const [lockedMatches, setLockedMatches] = useState<Record<number, { judgeName: string, judgeShop?: string, userId: string, arena?: number }>>({});
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

    const toggleMatchLock = async (matchId: number, arenaId?: number) => {
        if (!channelRef.current || !currentUser) return;

        // Get currently locked matches by me
        const myLockedMatchIds = Object.entries(lockedMatches)
            .filter(([_, lock]) => lock.userId === currentUser.username)
            .map(([id]) => Number(id));

        const isLockedByMe = myLockedMatchIds.includes(matchId);

        let newLockedIds: any[] = [...myLockedMatchIds]; // Use object array in future, simple ID list for now or enhanced object

        // Strategy: We track "my locks" as an array of objects { matchId, arena? }
        // But the current presence structure is simplified. Let's send the full state of MY locks.

        // Current implementation uses simple ID array for lockedMatchIds in presence.
        // To support Arena, we should ideally change presence structure or encode it.
        // Let's stick to the current "lockedMatchIds" array for backward comp, 
        // AND add a new "lockedMatchDetails" object to presence? Or just modify the existing logic.

        // Simpler approach for this task without breaking previous clients:
        // We will just handle the lock logic here.

        // If we are locking (not unlocking) and Arena Count > 0 AND no arena selected yet...
        // We probably need to show a UI.
        // Wait, this function `toggleMatchLock` is called by the UI.

        if (!isLockedByMe && !arenaId && (tournament?.ArenaCount && tournament.ArenaCount > 0)) {
            // Need to select arena!
            setSelectedArenaMatchId(matchId);
            return;
        }

        const currentLock = lockedMatches[matchId];

        // Simple array based locking for presence track (retaining compat)
        // If we want to broadcast Arena info, we need to add it to the tracked object

        // Let's refetch/calculate my current locks including the new one
        let myLocks = Object.entries(lockedMatches)
            .filter(([_, lock]) => lock.userId === currentUser.username)
            .map(([mid, lock]) => ({ matchId: Number(mid), arena: lock.arena }));

        if (isLockedByMe) {
            // Unlock
            myLocks = myLocks.filter(l => l.matchId !== matchId);
        } else {
            // Lock
            myLocks.push({ matchId, arena: arenaId });
        }

        // Send to Supabase
        // We need to change the tracking payload to include arena info
        // We'll map it to a new structure `lockedMatchesEx` or similar, or just update `lockedMatchIds` to be objects if possible?
        // To match `lockedMatchIds` (array of numbers), let's keep it.
        // We add `lockedMatchInfos` [ { id: 123, arena: 5 } ]

        await channelRef.current.track({
            user: currentUser.username,
            shop: currentUser.shop_name,
            lockedMatchIds: myLocks.map(l => l.matchId),
            lockedMatchInfos: myLocks
        });
    };

    // Realtime Subscription
    useEffect(() => {
        if (!id) return;

        const channel = supabase
            .channel(`admin-tournament-${id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'registrations',
                    filter: `tournament_id=eq.${id}`
                },
                (payload) => {
                    console.log('Realtime registration change:', payload);
                    fetchData(true);
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'tournaments',
                    filter: `id=eq.${id}`
                },
                (payload) => {
                    console.log('Realtime tournament update:', payload);
                    fetchData(true);
                }
            )
            .on(
                'broadcast',
                { event: 'match-update' },
                (payload) => {
                    console.log('Realtime match update received:', payload);
                    if (bracketUrl) {
                        fetchMatches(bracketUrl, true);
                    }
                }
            )
            .on(
                'broadcast',
                { event: 'match-updating' },
                (payload) => {
                    const { matchId, isUpdating } = payload.payload;
                    setUpdatingMatchIds(prev => {
                        if (isUpdating) {
                            return [...prev, matchId];
                        } else {
                            return prev.filter(id => id !== matchId);
                        }
                    });
                }
            )
            .on('presence', { event: 'sync' }, () => {
                const newState: Record<number, { judgeName: string, judgeShop?: string, userId: string, arena?: number }> = {};

                const state = channel.presenceState();
                console.log('Presence sync:', state);

                Object.values(state).forEach((presences: any) => {
                    presences.forEach((p: any) => {
                        // Handle both old (single) and new (array) structure for backward compatibility during transition
                        if (p.lockedMatchIds && Array.isArray(p.lockedMatchIds)) {
                            p.lockedMatchIds.forEach((mid: number) => {
                                newState[mid] = {
                                    judgeName: p.user,
                                    judgeShop: p.shop,
                                    userId: p.user,
                                    arena: undefined // Legacy support
                                };
                            });

                            // Check for new Info structure
                            if (p.lockedMatchInfos && Array.isArray(p.lockedMatchInfos)) {
                                p.lockedMatchInfos.forEach((info: any) => {
                                    if (newState[info.matchId]) {
                                        newState[info.matchId].arena = info.arena;
                                    }
                                });
                            }
                        } else if (p.lockedMatchId) {
                            newState[p.lockedMatchId] = {
                                judgeName: p.user,
                                judgeShop: p.shop,
                                userId: p.user
                            };
                        }
                    });
                });

                setLockedMatches(newState);
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    // Initialize presence
                    if (currentUser) {
                        await channel.track({
                            user: currentUser.username,
                            shop: currentUser.shop_name,
                            lockedMatchIds: [],
                            lockedMatchInfos: []
                        });
                    }
                }
            });

        channelRef.current = channel;

        return () => {
            supabase.removeChannel(channel);
            channelRef.current = null;
        };
    }, [id, fetchData, bracketUrl, currentUser]);

    // validateRow moved to RegistrationTable component

    const filteredData = data.filter(r =>
        r.PlayerName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Dynamic Sizing Logic for Ban List
    const banListCount = tournament?.BanList?.length || 0;
    let gridCols = "grid-cols-4";
    let gap = "gap-6";
    let fontSize = "text-xs";
    let iconSize = "p-2";

    // Filter matches
    // Filter active matches: Only show matches that are 'open' (ready to play)
    // Pending matches (waiting for opponents) are hidden as per user request
    const activeMatches = matches
        .filter(m => m.state === 'open')
        .filter(m => {
            if (!matchSearchQuery) return true;
            const q = matchSearchQuery.toLowerCase();
            return (
                m.player1?.name?.toLowerCase().includes(q) ||
                m.player2?.name?.toLowerCase().includes(q) ||
                m.round.toString().includes(q) ||
                m.identifier?.toLowerCase().includes(q) ||
                m.suggested_play_order?.toString().includes(q)
            );
        })
        .sort((a, b) => (a.suggested_play_order || 0) - (b.suggested_play_order || 0));
    const historyMatches = matches
        .filter(m => m.state === 'complete')
        .sort((a, b) => new Date(b.completed_at || b.updated_at || "").getTime() - new Date(a.completed_at || a.updated_at || "").getTime());

    // Polling active matches
    // Polling active matches & Tournament Status
    useEffect(() => {
        const interval = setInterval(() => {
            // Poll matches if we have a bracket and it's not closed
            // if (bracketUrl && tournament?.Status !== 'COMPLETED' && tournament?.Status !== 'CLOSED') {
            //     fetchMatches(bracketUrl, true);
            // }

            // Poll tournament status & registrations (fallback)
            pollTournamentStatus();
            fetchData(true);
        }, 5000);

        return () => clearInterval(interval);
    }, [bracketUrl, tournament?.Status, fetchData]);

    if (banListCount > 20) {
        gridCols = "grid-cols-6";
        gap = "gap-3";
        fontSize = "text-[9px]";
        iconSize = "p-1.5";
    } else if (banListCount > 12) {
        gridCols = "grid-cols-5";
        gap = "gap-4";
        fontSize = "text-[10px]";
        iconSize = "p-2";
    }



    return (
        <div className="min-h-screen bg-background p-4 md:p-6" data-aos="fade-in" suppressHydrationWarning>
            <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
                <header className="flex flex-col md:flex-row items-center justify-between gap-4 glass-card p-4 rounded-xl">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <Link href="/admin" className="p-2 hover:bg-secondary rounded-full transition-colors">
                            <ArrowLeft className="h-6 w-6" />
                        </Link>
                        <div>
                            <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-primary to-blue-500 bg-clip-text text-transparent">
                                {tournament?.Name || "Tournament Details"}
                            </h1>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground break-all">
                                <span>ID: {id}</span>
                                {tournament?.Status && (
                                    <>
                                        <span>•</span>
                                        <span className={cn(
                                            "font-bold",
                                            tournament.Status === 'OPEN' ? "text-green-500" :
                                                tournament.Status === 'COMPLETED' ? "text-blue-500" :
                                                    "text-muted-foreground"
                                        )}>
                                            {tournament.Status}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 w-full md:flex-1 md:max-w-sm justify-center">
                        <input
                            type="text"
                            placeholder="Search player name..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-secondary/50 border border-transparent focus:border-primary/50 rounded-lg px-3 py-2 text-sm outline-none transition-colors"
                        />
                    </div>

                    <div className="flex gap-2 w-full md:w-auto justify-end">
                        <button
                            onClick={() => fetchData()}
                            disabled={loading}
                            className="flex items-center gap-2 px-4 py-2 bg-secondary rounded-lg hover:bg-secondary/80 text-sm font-medium transition-colors"
                        >
                            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                            <span className="hidden md:inline">Refresh</span>
                        </button>

                    </div>
                </header>

                {/* Sharing & Info Section */}
                {/* Bracket Section - If URL exists */}
                {bracketUrl && (
                    <TournamentBracket url={bracketUrl} />
                )}

                {/* Standings Section */}
                {standings.length > 0 && (
                    <div className="bg-secondary/20 border border-white/10 rounded-xl p-4 mt-6">
                        <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                            <Trophy className="h-5 w-5 text-yellow-500" />
                            Final Standings
                        </h3>
                        <StandingsTable standings={standings} mode={tournament?.Type} />
                    </div>
                )}

                {/* Match Management Section */}
                {bracketUrl && (
                    <div className="bg-secondary/20 border border-white/10 rounded-xl p-4 mt-6">
                        <div className="sticky top-0 z-20 flex flex-col md:flex-row items-center justify-between gap-4 bg-black/80 backdrop-blur-xl p-4 -mx-4 -mt-4 mb-4 border-b border-white/10 rounded-t-xl transition-all">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                <Trophy className="h-5 w-5 text-yellow-500" />
                                {t('admin.matches.title')}
                            </h3>
                            <div className="flex items-center gap-2 w-full md:w-auto">
                                <div className="relative flex-1 md:w-64">
                                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <input
                                        type="text"
                                        placeholder="Search matches..."
                                        value={matchSearchQuery}
                                        onChange={(e) => setMatchSearchQuery(e.target.value)}
                                        className="w-full bg-black/20 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-sm outline-none focus:border-primary/50 transition-all"
                                    />
                                </div>
                                {/* History Button */}
                                <button
                                    onClick={handleShowHistory}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border whitespace-nowrap ${historyTooltip ? "bg-primary text-black border-primary" : "bg-secondary border-transparent hover:border-white/10"}`}
                                >
                                    <Clock className="h-4 w-4" />
                                    <span className="hidden sm:inline">History</span>
                                </button>
                                <button
                                    onClick={() => {
                                        if (activeMatchesRef.current) {
                                            activeMatchesRef.current.scrollTo({ top: 0, behavior: 'smooth' });
                                        }
                                    }}
                                    className="p-1.5 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors border border-transparent hover:border-white/10"
                                    title="Scroll to Top"
                                >
                                    <ArrowUp className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => {
                                        if (activeMatchesRef.current) {
                                            activeMatchesRef.current.scrollTo({ top: activeMatchesRef.current.scrollHeight, behavior: 'smooth' });
                                        }
                                    }}
                                    className="p-1.5 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors border border-transparent hover:border-white/10"
                                    title="Scroll to Bottom"
                                >
                                    <ArrowDown className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => fetchMatches(bracketUrl)}
                                    className="text-xs px-3 py-1.5 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors whitespace-nowrap"
                                >
                                    {t('admin.matches.refresh')}
                                </button>
                            </div>
                        </div>

                        {loadingMatches ? (
                            <div className="text-center py-8 text-muted-foreground">{t('admin.matches.loading')}</div>
                        ) : activeMatches.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">{t('admin.matches.empty')}</div>
                        ) : (
                            <div

                                ref={activeMatchesRef}
                                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[800px] overflow-y-auto custom-scrollbar pr-2"
                            >
                                {activeMatches.map((match) => {
                                    const lock = lockedMatches[match.id];
                                    const isLockedByMe = lock && currentUser && lock.userId === currentUser.username;
                                    const isLockedByOther = lock && !isLockedByMe;
                                    const isUpdating = updatingMatchIds.includes(match.id);

                                    return (
                                        <div
                                            key={match.id}
                                            className={cn(
                                                "relative p-4 rounded-xl flex flex-col gap-3 transition-all duration-300 border",
                                                isLockedByMe
                                                    ? "bg-primary/5 border-primary shadow-[0_0_15px_rgba(34,197,94,0.15)] ring-1 ring-primary/20"
                                                    : isLockedByOther
                                                        ? "bg-black/40 border-white/5 opacity-60 grayscale-[0.5]"
                                                        : "bg-background/50 border-white/20 hover:border-primary/30 shadow-sm"
                                            )}
                                        >
                                            {/* Updating Overlay */}
                                            {isUpdating && (
                                                <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-[1px] rounded-xl flex items-center justify-center fade-in animate-in duration-200">
                                                    <div className="bg-secondary p-3 rounded-full shadow-xl ring-1 ring-white/10">
                                                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                                    </div>
                                                </div>
                                            )}

                                            {/* Header Section */}
                                            <div className="flex items-center justify-between min-h-[24px]">
                                                {/* Round Info (Left) */}
                                                <div className="flex items-center gap-2">
                                                    {isLockedByMe && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>}
                                                    {match.suggested_play_order ? (
                                                        <div className="flex items-baseline gap-2">
                                                            <span className="text-sm font-black text-primary tracking-wide uppercase">
                                                                MATCH {match.suggested_play_order}
                                                            </span>
                                                            <span className="text-[10px] text-muted-foreground/40 font-bold uppercase tracking-widest border-l border-white/10 pl-2">
                                                                {t('admin.matches.round').replace('{n}', match.round.toString())}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                                            {t('admin.matches.round').replace('{n}', match.round.toString())}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Play/Lock Button (Right) */}
                                                <div className="z-10 ml-2">
                                                    {isLockedByOther ? (
                                                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 border border-white/5 text-[10px] font-bold text-muted-foreground cursor-not-allowed" title={`Judged by ${lock.judgeName}`}>
                                                            <Lock className="h-3 w-3" />
                                                            <span className="max-w-[60px] truncate">{lock.judgeName}</span>
                                                            {lock.arena && <span className="ml-1 text-purple-400">#{lock.arena}</span>}
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                toggleMatchLock(match.id);
                                                            }}
                                                            className={cn(
                                                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border shadow-sm",
                                                                isLockedByMe
                                                                    ? "bg-primary text-black border-primary hover:bg-primary/90"
                                                                    : "bg-secondary text-foreground border-white/10 hover:border-primary/50 hover:text-primary"
                                                            )}
                                                            title={isLockedByMe ? t('admin.matches.release') : t('admin.matches.judge')}
                                                        >
                                                            {isLockedByMe ? (
                                                                <>
                                                                    <Gavel className="h-3 w-3" />
                                                                    <span>{t('admin.matches.judging')}</span>
                                                                    {lock.arena && <span className="ml-1 bg-black/20 px-1 rounded text-white/90">#{lock.arena}</span>}
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Play className="h-3 w-3" />
                                                                    <span>{t('admin.matches.judge')}</span>
                                                                </>
                                                            )}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            <div className={cn("flex items-center justify-between gap-2 transition-opacity", isLockedByOther ? "opacity-50 pointer-events-none" : "")}>
                                                {/* Player 1 */}
                                                <div
                                                    role="button"
                                                    tabIndex={0}
                                                    className={`flex-1 min-w-0 text-center p-3 rounded-lg relative group transition-all flex flex-col items-center gap-1
                                                        ${match.winner_id === match.player1_id
                                                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                                            : 'bg-secondary/40 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300 border border-transparent hover:border-blue-500/30 cursor-pointer'
                                                        }`}
                                                    onClick={() => !isLockedByOther && handleUpdateMatch(match.id, "1-0", match.player1_id, match.player1?.name || t('admin.default.player1'))}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' || e.key === ' ') {
                                                            !isLockedByOther && handleUpdateMatch(match.id, "1-0", match.player1_id, match.player1?.name || t('admin.default.player1'));
                                                        }
                                                    }}
                                                >
                                                    <div className="font-bold text-sm w-full break-all line-clamp-2 leading-tight min-h-[2.5em] flex items-center justify-center">{match.player1?.name || "???"}</div>
                                                    <span className="text-[10px] opacity-0 group-hover:opacity-60 transition-opacity font-normal flex-1 flex items-center justify-center">{t('admin.matches.click_to_win')}</span>

                                                    {showPlayerCombo && (
                                                        <div className="text-[10px] text-muted-foreground w-full truncate mt-auto pt-2">
                                                            {(() => {
                                                                const p1Reg = data.find(r => r.PlayerName === match.player1?.name);
                                                                if (!p1Reg) return null;
                                                                return (
                                                                    <div className="flex flex-col items-center gap-1">
                                                                        {p1Reg.Main_Bey1 && (
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handleShowCombo(e, p1Reg);
                                                                                }}
                                                                                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold transition-colors border ${hoveredCombo?.data.PlayerName === p1Reg.PlayerName ? "bg-primary text-black border-primary" : "bg-primary/10 hover:bg-primary/20 text-primary border-primary/20"}`}
                                                                            >
                                                                                <Eye className="w-3 h-3" />
                                                                                {t('admin.matches.view_all') || "View All"}
                                                                                {tournament?.Type === 'U10' && (() => {
                                                                                    const decks = [p1Reg.Main_Bey1, p1Reg.Main_Bey2, p1Reg.Main_Bey3].filter(Boolean);
                                                                                    let total = 0;
                                                                                    decks.forEach(d => {
                                                                                        for (const [pt, names] of Object.entries((gameData as any).points)) {
                                                                                            if ((names as string[]).includes(d)) {
                                                                                                total += parseInt(pt);
                                                                                                break;
                                                                                            }
                                                                                        }
                                                                                    });
                                                                                    return <span className={total > 10 ? "text-red-500" : "text-green-500"}>({total}/10)</span>;
                                                                                })()}
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="text-xs font-bold text-muted-foreground px-1">VS</div>

                                                {/* Player 2 */}
                                                <div
                                                    role="button"
                                                    tabIndex={0}
                                                    className={`flex-1 min-w-0 text-center p-3 rounded-lg relative group transition-all flex flex-col items-center gap-1
                                                        ${match.winner_id === match.player2_id
                                                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                                            : 'bg-secondary/40 text-red-400 hover:bg-red-500/10 hover:text-red-300 border border-transparent hover:border-red-500/30 cursor-pointer'
                                                        }`}
                                                    onClick={() => !isLockedByOther && handleUpdateMatch(match.id, "0-1", match.player2_id, match.player2?.name || t('admin.default.player2'))}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' || e.key === ' ') {
                                                            !isLockedByOther && handleUpdateMatch(match.id, "0-1", match.player2_id, match.player2?.name || t('admin.default.player2'));
                                                        }
                                                    }}
                                                >
                                                    <div className="font-bold text-sm w-full break-all line-clamp-2 leading-tight min-h-[2.5em] flex items-center justify-center">{match.player2?.name || "???"}</div>
                                                    <span className="text-[10px] opacity-0 group-hover:opacity-60 transition-opacity font-normal flex-1 flex items-center justify-center">Click to Win</span>

                                                    {showPlayerCombo && (
                                                        <div className="text-[10px] text-muted-foreground w-full truncate mt-auto pt-2">
                                                            {(() => {
                                                                const p2Reg = data.find(r => r.PlayerName === match.player2?.name);
                                                                if (!p2Reg) return null;
                                                                return (
                                                                    <div className="flex flex-col items-center gap-1">
                                                                        {p2Reg.Main_Bey1 && (
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handleShowCombo(e, p2Reg);
                                                                                }}
                                                                                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold transition-colors border ${hoveredCombo?.data.PlayerName === p2Reg.PlayerName ? "bg-primary text-black border-primary" : "bg-primary/10 hover:bg-primary/20 text-primary border-primary/20"}`}
                                                                            >
                                                                                <Eye className="w-3 h-3" />
                                                                                {t('admin.matches.view_all') || "View All"}
                                                                                {tournament?.Type === 'U10' && (() => {
                                                                                    const decks = [p2Reg.Main_Bey1, p2Reg.Main_Bey2, p2Reg.Main_Bey3].filter(Boolean);
                                                                                    let total = 0;
                                                                                    decks.forEach(d => {
                                                                                        for (const [pt, names] of Object.entries((gameData as any).points)) {
                                                                                            if ((names as string[]).includes(d)) {
                                                                                                total += parseInt(pt);
                                                                                                break;
                                                                                            }
                                                                                        }
                                                                                    });
                                                                                    return <span className={total > 10 ? "text-red-500" : "text-green-500"}>({total}/10)</span>;
                                                                                })()}
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                <div className="glass-card p-4 md:p-6 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-secondary rounded-full">
                            <Trophy className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-foreground">{t('admin.control.title')}</h3>
                            <p className="text-sm text-muted-foreground">{t('admin.control.desc')}</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
                        {bracketUrl ? (
                            <>
                                <button
                                    onClick={handleEndTournament}
                                    disabled={tournament?.Status === 'CLOSED'}
                                    className="flex-1 md:flex-none text-xs flex items-center justify-center gap-2 bg-secondary hover:bg-green-500/20 text-white hover:text-green-400 px-4 py-2.5 rounded-lg font-bold transition-all border border-white/10 disabled:opacity-50"
                                >
                                    <CheckCircle className="h-4 w-4" />
                                    {tournament?.Status === 'COMPLETED' ? t('admin.btn.completed') : t('admin.btn.end')}
                                </button>
                                <button
                                    onClick={handleResetTournament}
                                    className="flex-1 md:flex-none text-xs flex items-center justify-center gap-2 bg-secondary hover:bg-destructive/20 text-white hover:text-destructive px-4 py-2.5 rounded-lg font-bold transition-all border border-white/10"
                                >
                                    <Trash2 className="h-4 w-4" />
                                    {t('admin.btn.reset')}
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => {
                                    fetchData(true);
                                    setSettingsModalOpen(true);
                                }}
                                disabled={generatingBracket || !data.length}
                                className="flex-1 md:flex-none text-xs flex items-center justify-center gap-2 bg-gradient-to-r from-orange-400 to-red-500 text-white px-5 py-2.5 rounded-lg font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {generatingBracket ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        {t('admin.btn.generating')}
                                    </>
                                ) : (
                                    <>
                                        <Trophy className="h-4 w-4" />
                                        {t('admin.btn.setup')}
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>

                {/* Settings Modal */}
                {settingsModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 p-4 pt-20 overflow-y-auto">
                        <div className="bg-background border border-white/10 rounded-xl p-6 w-full max-w-md space-y-4 relative animate-in fade-in zoom-in duration-200 mb-20">
                            <button
                                onClick={() => setSettingsModalOpen(false)}
                                className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
                            >
                                <XCircle className="h-5 w-5" />
                            </button>

                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <Trophy className="h-5 w-5 text-primary" />
                                {t('admin.settings.title')}
                            </h2>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">{t('admin.settings.format')}</label>
                                    <select
                                        value={tournamentType}
                                        onChange={(e) => setTournamentType(e.target.value)}
                                        className="w-full bg-secondary border border-transparent rounded-lg p-2 text-sm"
                                    >
                                        <option value="single elimination">Single Elimination</option>
                                        <option value="double elimination">Double Elimination</option>
                                        <option value="swiss">Swiss</option>
                                    </select>
                                </div>

                                <div className="flex items-center gap-3">
                                    <input
                                        type="checkbox"
                                        id="shuffle"
                                        checked={isShuffle}
                                        onChange={(e) => setIsShuffle(e.target.checked)}
                                        className="w-4 h-4 rounded border-gray-600"
                                    />
                                    <label htmlFor="shuffle" className="text-sm">{t('admin.settings.shuffle')}</label>
                                </div>

                                <div className="flex items-center gap-3">
                                    <input
                                        type="checkbox"
                                        id="showCombo"
                                        checked={showPlayerCombo && (tournament?.Type !== 'Open' && tournament?.Type !== 'Standard' && tournamentType !== 'Standard')}
                                        onChange={(e) => setShowPlayerCombo(e.target.checked)}
                                        disabled={tournament?.Type === 'Open' || tournament?.Type === 'Standard' || tournamentType === 'Standard'}
                                        className="w-4 h-4 rounded border-gray-600 disabled:opacity-50"
                                    />
                                    <label htmlFor="showCombo" className={`text-sm ${(tournament?.Type === 'Open' || tournament?.Type === 'Standard' || tournamentType === 'Standard') ? 'text-muted-foreground line-through' : ''}`}>{t('admin.settings.show_combo')}</label>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1">{t('admin.settings.arena_count')}</label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="50"
                                        value={arenaCount}
                                        onChange={(e) => setArenaCount(parseInt(e.target.value) || 0)}
                                        className="w-full bg-secondary border border-transparent rounded-lg p-2 text-sm"
                                        placeholder="0 for no arenas"
                                    />
                                    <p className="text-[10px] text-muted-foreground mt-1">{t('admin.settings.arena_desc')}</p>
                                </div>

                                <div className="p-3 bg-secondary/50 rounded-lg text-xs text-muted-foreground border border-white/5">
                                    {t('admin.settings.player_count').replace('{count}', data.length.toString())}
                                </div>

                                <button
                                    onClick={handleGenerateBracket}
                                    disabled={generatingBracket}
                                    className="w-full py-3 bg-gradient-to-r from-primary to-blue-600 text-white font-bold rounded-lg hover:shadow-lg transition-all"
                                >
                                    {generatingBracket ? t('admin.settings.creating_challonge') : t('admin.settings.start')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* History Tooltip */}
                {historyTooltip && (
                    <div
                        className="fixed z-50 animate-in fade-in zoom-in-95 duration-100 origin-top-right"
                        style={{
                            left: Math.min(historyTooltip.x, window.innerWidth - 380), // Ensure it fits on screen
                            top: historyTooltip.y
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="bg-popover/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl p-4 w-[90vw] max-w-[360px] max-h-[500px] flex flex-col text-popover-foreground">
                            <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/10">
                                <h4 className="font-bold text-sm flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-primary" />
                                    {t('admin.matches.history')}
                                </h4>
                                <button onClick={() => setHistoryTooltip(null)} className="text-muted-foreground hover:text-foreground">
                                    <XCircle className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                {historyMatches.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">{t('admin.matches.history_empty')}</div>
                                ) : (
                                    historyMatches

                                        .map(match => (
                                            <div key={match.id} className="bg-secondary/30 p-3 rounded flex items-center justify-between border border-white/5">
                                                <div className="flex flex-col gap-1 text-sm flex-1">
                                                    <div className="text-xs text-muted-foreground uppercase">Round {match.round}</div>
                                                    <div className="flex items-center gap-2">
                                                        <span className={(!updatingMatchIds.includes(match.id) && match.winner_id === match.player1_id) ? "font-bold text-green-400 whitespace-normal break-all flex-1 min-w-0 text-right leading-tight" : "whitespace-normal break-all flex-1 min-w-0 text-right leading-tight"}>{match.player1?.name}</span>
                                                        <span className="text-muted-foreground shrink-0 px-1">vs</span>
                                                        <span className={(!updatingMatchIds.includes(match.id) && match.winner_id === match.player2_id) ? "font-bold text-green-400 whitespace-normal break-all flex-1 min-w-0 text-left leading-tight" : "whitespace-normal break-all flex-1 min-w-0 text-left leading-tight"}>{match.player2?.name}</span>
                                                    </div>
                                                </div>

                                                {updatingMatchIds.includes(match.id) ? (
                                                    <div className="flex items-center justify-center p-4 animate-in fade-in bg-black/20 rounded-xl border border-white/5">
                                                        <div className="flex flex-col items-center gap-2">
                                                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                                            <span className="text-[10px] text-muted-foreground">{t('admin.matches.updating')}</span>
                                                        </div>
                                                    </div>
                                                ) : (tournament?.Status !== 'COMPLETED' && tournament?.Status !== 'CLOSED') && (
                                                    <button
                                                        onClick={() => {
                                                            setModalConfig({
                                                                isOpen: true,
                                                                title: t('admin.modal.custom_select_winner'),
                                                                content: (
                                                                    <div className="flex flex-col gap-3 mt-2">
                                                                        <button
                                                                            onClick={() => {
                                                                                confirmUpdateMatch(match.id, "1-0", match.player1_id);
                                                                                setModalConfig(prev => ({ ...prev, isOpen: false }));
                                                                            }}
                                                                            className={cn(
                                                                                "relative w-full p-4 rounded-xl text-sm font-bold transition-all border flex items-center justify-between gap-3 text-left group/btn",
                                                                                match.winner_id === match.player1_id
                                                                                    ? "bg-green-500/10 text-green-400 border-green-500/50 shadow-[inset_0_0_10px_rgba(74,222,128,0.1)]"
                                                                                    : "bg-black/20 text-foreground/80 border-white/5 hover:bg-primary/10 hover:border-primary/30 hover:text-primary hover:shadow-lg"
                                                                            )}
                                                                        >
                                                                            <span className="break-all leading-tight flex-1 min-w-0 text-left">{match.player1?.name || t('admin.default.player1')}</span>
                                                                            {match.winner_id === match.player1_id && (
                                                                                <div className="h-6 w-6 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                                                                                    <Check className="h-4 w-4" />
                                                                                </div>
                                                                            )}
                                                                        </button>

                                                                        <div className="relative h-px bg-white/5 w-full flex items-center justify-center">
                                                                            <span className="bg-background px-2 text-[10px] font-bold text-muted-foreground/50 uppercase">vs</span>
                                                                        </div>

                                                                        <button
                                                                            onClick={() => {
                                                                                confirmUpdateMatch(match.id, "0-1", match.player2_id);
                                                                                setModalConfig(prev => ({ ...prev, isOpen: false }));
                                                                            }}
                                                                            className={cn(
                                                                                "relative w-full p-4 rounded-xl text-sm font-bold transition-all border flex items-center justify-between gap-3 text-left group/btn",
                                                                                match.winner_id === match.player2_id
                                                                                    ? "bg-green-500/10 text-green-400 border-green-500/50 shadow-[inset_0_0_10px_rgba(74,222,128,0.1)]"
                                                                                    : "bg-black/20 text-foreground/80 border-white/5 hover:bg-primary/10 hover:border-primary/30 hover:text-primary hover:shadow-lg"
                                                                            )}
                                                                        >
                                                                            <span className="break-all leading-tight flex-1 min-w-0 text-left">{match.player2?.name || t('admin.default.player2')}</span>
                                                                            {match.winner_id === match.player2_id && (
                                                                                <div className="h-6 w-6 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                                                                                    <Check className="h-4 w-4" />
                                                                                </div>
                                                                            )}
                                                                        </button>
                                                                    </div>
                                                                ),
                                                                type: "custom"
                                                            });
                                                        }}
                                                        className="p-2 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors ml-2"
                                                        title={t('admin.matches.edit_result')}
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </div>
                                        ))
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Tooltip Card Overlay for Player Combo */}
                {hoveredCombo && (
                    <div
                        className="fixed z-50 animate-in fade-in zoom-in-95 duration-100 origin-top-left"
                        style={{
                            left: Math.min(hoveredCombo.x, window.innerWidth - 300), // Prevent overflow right
                            top: hoveredCombo.y
                        }}
                        onClick={(e) => e.stopPropagation()} // Prevent close when clicking inside
                    >
                        <div className="bg-popover/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl p-4 w-[280px] text-popover-foreground">
                            {(() => {
                                // Parse Decks Logic
                                const mainDeck = [hoveredCombo.data.Main_Bey1, hoveredCombo.data.Main_Bey2, hoveredCombo.data.Main_Bey3].filter(Boolean);
                                let reserveDecks: string[][] = [];
                                try {
                                    const parsed = JSON.parse(hoveredCombo.data.Reserve_Data || "[]");
                                    // Handle legacy single-array vs multi-array
                                    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'string') {
                                        reserveDecks = [parsed as unknown as string[]];
                                    } else {
                                        reserveDecks = parsed;
                                    }
                                } catch (e) {
                                    // Ignore parse errors, just show main deck
                                }

                                const allDecks = [mainDeck, ...reserveDecks].filter(d => d && d.length > 0);
                                const currentDeck = allDecks[hoveredCombo.deckIndex] || [];
                                const isMain = hoveredCombo.deckIndex === 0;

                                // Navigation Handlers
                                const handlePrev = (e: React.MouseEvent) => {
                                    e.stopPropagation();
                                    if (hoveredCombo.deckIndex > 0) {
                                        setHoveredCombo(prev => prev ? ({ ...prev, deckIndex: prev.deckIndex - 1 }) : null);
                                    }
                                };

                                const handleNext = (e: React.MouseEvent) => {
                                    e.stopPropagation();
                                    if (hoveredCombo.deckIndex < allDecks.length - 1) {
                                        setHoveredCombo(prev => prev ? ({ ...prev, deckIndex: prev.deckIndex + 1 }) : null);
                                    }
                                };

                                return (
                                    <>
                                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/10">
                                            <h4 className="font-bold text-sm flex items-center gap-2">
                                                <Users className="h-4 w-4 text-primary" />
                                                <div className="flex flex-col">
                                                    <span>{hoveredCombo.data.PlayerName}</span>
                                                    <span className="text-[10px] text-muted-foreground font-normal">
                                                        {isMain ? "Main Deck" : `Reserve Deck ${hoveredCombo.deckIndex}`}
                                                    </span>
                                                </div>
                                            </h4>
                                            <button onClick={() => setHoveredCombo(null)} className="text-muted-foreground hover:text-foreground">
                                                <XCircle className="h-4 w-4" />
                                            </button>
                                        </div>

                                        <div className="space-y-2">
                                            {(() => {
                                                let totalScore = 0;
                                                return (
                                                    <>
                                                        {currentDeck.map((bey, idx) => {
                                                            const point = tournament?.Type === 'U10' ? (() => {
                                                                for (const [pt, names] of Object.entries((gameData as any).points)) {
                                                                    if ((names as string[]).includes(bey)) return parseInt(pt);
                                                                }
                                                                return null;
                                                            })() : null;
                                                            if (point !== null) totalScore += point;

                                                            return (
                                                                <div key={idx} className="flex items-center justify-between text-xs p-2 bg-secondary/50 rounded border border-white/5">
                                                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                                                        {/* Lazy Image */}
                                                                        {(() => {
                                                                            const imgUrl = (imageMap as any)[bey];
                                                                            if (imgUrl) {
                                                                                return <img src={imgUrl} alt={bey} className="w-8 h-8 object-contain" loading="lazy" />;
                                                                            }
                                                                            return null;
                                                                        })()}
                                                                        <span className="font-medium truncate" title={bey}>{bey}</span>
                                                                    </div>
                                                                    {point !== null && (
                                                                        <span className="font-bold text-[10px] bg-yellow-500/10 text-yellow-500 px-1.5 py-0.5 rounded whitespace-nowrap">
                                                                            {point}p
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                        {tournament?.Type === 'U10' && (
                                                            <div className="flex justify-between items-center pt-2 mt-1 border-t border-white/10">
                                                                <span className="text-xs text-muted-foreground font-bold">Total</span>
                                                                <span className={`text-sm font-black ${totalScore > 10 ? 'text-destructive' : 'text-green-400'}`}>
                                                                    {totalScore}/10
                                                                </span>
                                                            </div>
                                                        )}
                                                    </>
                                                );
                                            })()}
                                        </div >

                                        {/* Navigation Controls */}
                                        {
                                            allDecks.length > 1 && (
                                                <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/5">
                                                    <button
                                                        onClick={handlePrev}
                                                        disabled={hoveredCombo.deckIndex === 0}
                                                        className="p-1 rounded hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                                    >
                                                        <ArrowLeft className="h-4 w-4" />
                                                    </button>
                                                    <span className="text-[10px] text-muted-foreground">
                                                        {hoveredCombo.deckIndex + 1} / {allDecks.length}
                                                    </span>
                                                    <button
                                                        onClick={handleNext}
                                                        disabled={hoveredCombo.deckIndex === allDecks.length - 1}
                                                        className="p-1 rounded hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                                    >
                                                        <ArrowLeft className="h-4 w-4 rotate-180" />
                                                    </button>
                                                </div>
                                            )
                                        }
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Rules & Info */}
                    <div className="glass-card p-6 rounded-xl space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-foreground flex items-center gap-2">
                                <AlertCircle className="h-4 w-4 text-primary" />
                                {t('detail.rules_title') === 'detail.rules_title' ? "Tournament Rules" : t('detail.rules_title')}
                            </h3>
                            {tournament?.Type && (
                                <span className={
                                    `px-3 py-1 rounded-lg text-xs font-bold uppercase border ` +
                                    (tournament.Type === 'U10' ? 'border-blue-500/30 text-blue-400 bg-blue-500/10' :
                                        tournament.Type === 'NoMoreMeta' ? 'border-purple-500/30 text-purple-400 bg-purple-500/10' :
                                            'border-white/10 text-muted-foreground bg-secondary')
                                }>
                                    {t(`type.${tournament.Type}` as any)} Format
                                </span>
                            )}
                        </div>

                        <div className="space-y-3">
                            <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                                <span>Banned Parts</span>
                                <span className="text-xs bg-secondary px-2 py-0.5 rounded-full text-foreground">
                                    {tournament?.BanList?.length || 0}
                                </span>
                            </h4>
                            {tournament?.BanList && tournament.BanList.length > 0 ? (
                                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3 max-h-[320px] overflow-y-auto p-1 custom-scrollbar">
                                    {tournament.BanList.map((bey: string, i: number) => {
                                        // @ts-ignore
                                        const hasImg = !!imageMap[bey];
                                        return (
                                            <div key={i} className="group relative flex flex-col items-center gap-2 p-3 bg-secondary/30 rounded-xl border border-white/5 hover:border-destructive/50 transition-colors" title={bey}>
                                                <div className="relative w-full aspect-square">
                                                    {hasImg ? (
                                                        // @ts-ignore
                                                        <img
                                                            src={(imageMap as any)[bey]}
                                                            alt={bey}
                                                            className="w-full h-full object-contain grayscale-[0.5] opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all"
                                                            loading="eager"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground bg-black/20 rounded">IMG</div>
                                                    )}
                                                </div>
                                                <span className="text-[10px] text-muted-foreground font-mono truncate w-full text-center group-hover:text-foreground transition-colors leading-tight">
                                                    {bey}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="p-8 text-center bg-secondary/20 rounded-xl border border-dashed border-white/10 flex flex-col items-center gap-2">
                                    <CheckCircle className="h-8 w-8 text-green-500/50" />
                                    <p className="text-sm text-muted-foreground">No active bans for this tournament.</p>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="glass-card p-6 rounded-xl flex flex-col gap-6 relative overflow-hidden">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <h3 className="font-bold text-foreground flex items-center gap-2">
                                <Share2 className="h-4 w-4 text-primary" />
                                {t('detail.share_link')} & Invite Card
                            </h3>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleGeneratePreview}
                                    disabled={generating}
                                    className="text-xs flex items-center gap-1 bg-gradient-to-r from-primary to-blue-500 text-white px-3 py-1.5 rounded-lg font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {generating ? (
                                        <>
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                            {t('admin.btn.creating_invite')}
                                        </>
                                    ) : (
                                        <>
                                            <ImageIcon className="h-3 w-3" />
                                            {t('admin.btn.invite')}
                                        </>
                                    )}
                                </button>
                                {tournament?.BanList && tournament.BanList.length > 0 && (
                                    <button
                                        onClick={handleExportBanList}
                                        disabled={generatingBanList}
                                        className="text-xs flex items-center gap-1 bg-gradient-to-r from-red-500 to-orange-500 text-white px-3 py-1.5 rounded-lg font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {generatingBanList ? (
                                            <>
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                {t('admin.invite.exporting')}
                                            </>
                                        ) : (
                                            <>
                                                <Download className="h-3 w-3" />
                                                {t('admin.invite.export_ban')}
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Visible QR Info */}
                        <div className="flex items-center gap-6">
                            <div className="bg-white p-2 rounded-lg">
                                <QRCodeSVG value={`${origin || ''}/register/${id}`} size={100} />
                            </div>
                            <div className="space-y-2 flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 p-2 bg-secondary rounded text-xs font-mono text-muted-foreground break-all border border-white/5">
                                        {origin ? `${origin.replace(/^https?:\/\//, '')}/register/${id}` : `.../register/${id}`}
                                    </div>
                                    <button
                                        onClick={() => {
                                            const url = `${origin}/register/${id}`;
                                            navigator.clipboard.writeText(url);
                                            toast.success(t('admin.toast.link_copied'));
                                        }}
                                        className="p-2 bg-secondary hover:bg-secondary/80 rounded transition-colors text-primary"
                                        title="Copy Link"
                                    >
                                        <Copy className="h-4 w-4" />
                                    </button>
                                </div>

                                <div className="flex gap-2">
                                    {tournament?.Type && (
                                        <span className={
                                            `px-2 py-0.5 rounded text-[10px] font-bold uppercase border ` +
                                            (tournament.Type === 'U10' ? 'border-blue-500/30 text-blue-400 bg-blue-500/10' :
                                                tournament.Type === 'NoMoreMeta' ? 'border-purple-500/30 text-purple-400 bg-purple-500/10' :
                                                    'border-white/10 text-muted-foreground bg-secondary')
                                        }>
                                            {t(`type.${tournament.Type}` as any)}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* HIDDEN RENDER CONTAINER FOR INVITE CARD - Unified Layout */}
                        {(generating || generatingBanList) && (
                            <div style={{ position: "fixed", top: 0, left: '-3000px', zIndex: -50, opacity: 1, pointerEvents: "none" }}>
                                <div
                                    ref={cardRef}
                                    style={{ width: 1200, minHeight: 630, height: 'fit-content', backgroundColor: 'black', color: 'white', position: 'relative', display: 'flex' }}
                                >
                                    {/* Dynamic Background */}
                                    <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
                                        <div className="absolute top-0 left-0 w-full h-full" style={{ background: 'radial-gradient(circle at 30% 20%, #222222 0%, #050505 100%)' }} />
                                        <div className="absolute top-[-50%] left-[-20%] w-[1000px] h-[1000px] rounded-full blur-[150px]" style={{ backgroundColor: 'rgba(0, 255, 148, 0.05)' }} />
                                        <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-[#2563eb]/10 rounded-full blur-[120px]" />
                                    </div>

                                    {/* Content Grid */}
                                    {/* Content Grid */}
                                    {tournament?.BanList && tournament.BanList.length > 0 ? (
                                        <div style={{ position: 'relative', zIndex: 10, display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', width: '100%', height: 'auto', alignItems: 'stretch' }}>

                                            {/* Left Side: Tournament Info & Ban List */}
                                            <div style={{ padding: 40, display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(255,255,255,0.1)' }}>
                                                <div style={{ marginBottom: 24 }}>
                                                    <p className="text-xl font-bold tracking-[0.5em] uppercase mb-2" style={{ color: '#00ff94', fontSize: '0.9rem' }}>
                                                        {t('admin.invite.title')}
                                                    </p>
                                                    <h1 style={{ fontSize: '3rem', fontWeight: 900, fontStyle: 'italic', letterSpacing: '-0.02em', lineHeight: 1, background: 'linear-gradient(to bottom, #ffffff, #9ca3af)', WebkitBackgroundClip: 'text', color: 'transparent', marginBottom: 8, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                        {tournament?.Name || "BEYBLADE X"}
                                                    </h1>
                                                    {tournament?.Type && (
                                                        <span style={{
                                                            display: 'inline-block',
                                                            fontSize: '0.8rem',
                                                            fontWeight: 800,
                                                            color: tournament.Type === 'U10' ? '#60a5fa' : tournament.Type === 'NoMoreMeta' ? '#c084fc' : '#9ca3af',
                                                            textTransform: 'uppercase',
                                                            letterSpacing: '0.1em',
                                                            padding: '4px 8px',
                                                            borderRadius: 4,
                                                            backgroundColor: 'rgba(255,255,255,0.05)',
                                                            border: '1px solid rgba(255,255,255,0.1)'
                                                        }}>
                                                            {tournament.Type} FORMAT
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Ban List Mini-Grid */}
                                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, opacity: 0.8 }}>
                                                        <AlertCircle style={{ width: 16, height: 16, color: '#ef4444' }} />
                                                        <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('admin.invite.restricted_parts')} ({tournament?.BanList?.length || 0})</span>
                                                    </div>

                                                    <div style={{
                                                        display: 'grid',
                                                        gridTemplateColumns: `repeat(${tournament.BanList.length > 30 ? 7 : tournament.BanList.length > 20 ? 6 : 5}, 1fr)`,
                                                        gap: 8,
                                                        alignContent: 'start'
                                                    }}>
                                                        {tournament.BanList.map((bey: string, i: number) => {
                                                            // @ts-ignore
                                                            const hasImg = !!imageMap[bey];
                                                            return (
                                                                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                                                    <div style={{
                                                                        width: '100%',
                                                                        aspectRatio: '1/1',
                                                                        backgroundColor: 'rgba(255,255,255,0.05)',
                                                                        borderRadius: 8,
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        padding: 4,
                                                                        border: '1px solid rgba(255,255,255,0.1)'
                                                                    }}>
                                                                        {hasImg ? (
                                                                            // @ts-ignore
                                                                            <img src={imageMap[bey]} alt={bey} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                                                        ) : (
                                                                            <span style={{ fontSize: 8, opacity: 0.5 }}>IMG</span>
                                                                        )}
                                                                    </div>
                                                                    <span style={{ fontSize: 7, textAlign: 'center', opacity: 0.7, width: '100%', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{bey}</span>
                                                                </div>
                                                            );
                                                        })}

                                                    </div>
                                                </div>

                                                {/* Footer */}
                                                <div style={{ marginTop: 'auto', paddingTop: 20, display: 'flex', alignItems: 'center', gap: 8, opacity: 0.5 }}>
                                                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase' }}>{t('admin.invite.powered_by')}</span>
                                                </div>
                                            </div>

                                            {/* Right Side: QR Code */}
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, backgroundColor: 'rgba(0,0,0,0.2)' }}>
                                                <div style={{
                                                    padding: 20,
                                                    backgroundColor: 'white',
                                                    borderRadius: 20,
                                                    boxShadow: '0 0 40px rgba(0,0,0,0.5)',
                                                    marginBottom: 24
                                                }}>
                                                    <QRCodeSVG
                                                        value={`${origin || ''}/register/${id}`}
                                                        size={220}
                                                    />
                                                </div>
                                                <p style={{ fontSize: '1.2rem', color: '#fff', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                                    Scan to Register
                                                </p>
                                                <p style={{ marginTop: 8, fontSize: '0.8rem', color: '#9ca3af', fontFamily: 'monospace' }}>
                                                    {origin ? `${origin.replace(/^https?:\/\//, '')}/register/${id}` : `.../register/${id}`}
                                                </p>
                                            </div>

                                        </div>
                                    ) : (
                                        // NO BAN LIST - CENTERED LAYOUT
                                        <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', gap: 40, padding: 60 }}>
                                            <div style={{ textAlign: 'center' }}>
                                                <p className="text-xl font-bold tracking-[0.5em] uppercase mb-4" style={{ color: '#00ff94', fontSize: '1.2rem' }}>
                                                    Tournament Invite
                                                </p>
                                                <h1 style={{ fontSize: '4rem', fontWeight: 900, fontStyle: 'italic', letterSpacing: '-0.02em', lineHeight: 1.1, background: 'linear-gradient(to bottom, #ffffff, #9ca3af)', WebkitBackgroundClip: 'text', color: 'transparent', marginBottom: 16 }}>
                                                    {tournament?.Name || "BEYBLADE X"}
                                                </h1>
                                                {tournament?.Type && (
                                                    <span style={{
                                                        display: 'inline-block',
                                                        fontSize: '1.2rem',
                                                        fontWeight: 800,
                                                        color: tournament.Type === 'U10' ? '#60a5fa' : tournament.Type === 'NoMoreMeta' ? '#c084fc' : '#9ca3af',
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '0.1em',
                                                        padding: '6px 16px',
                                                        borderRadius: 6,
                                                        backgroundColor: 'rgba(255,255,255,0.05)',
                                                        border: '1px solid rgba(255,255,255,0.1)'
                                                    }}>
                                                        {tournament.Type} FORMAT
                                                    </span>
                                                )}
                                            </div>

                                            <div style={{
                                                padding: 30,
                                                backgroundColor: 'white',
                                                borderRadius: 30,
                                                boxShadow: '0 0 60px rgba(0,0,0,0.5)',
                                            }}>
                                                <QRCodeSVG
                                                    value={`${origin || ''}/register/${id}`}
                                                    size={300}
                                                />
                                            </div>

                                            <div style={{ textAlign: 'center' }}>
                                                <p style={{ fontSize: '1.5rem', color: '#fff', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                                    Scan to Register
                                                </p>
                                                <p style={{ marginTop: 8, fontSize: '1rem', color: '#9ca3af', fontFamily: 'monospace' }}>
                                                    {origin ? `${origin.replace(/^https?:\/\//, '')}/register/${id}` : `.../register/${id}`}
                                                </p>
                                            </div>

                                            <div style={{ position: 'absolute', bottom: 30, opacity: 0.5 }}>
                                                <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase' }}>Powered by สายใต้ยิม</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Separate container for Ban List Export (kept as is) */}
                        {(generatingBanList && tournament?.BanList && tournament.BanList.length > 0) && (
                            <div style={{ position: "fixed", top: 0, left: '-3000px', zIndex: -50, opacity: 1, pointerEvents: "none" }}>
                                <div
                                    ref={banListRef}
                                    style={{ width: 1200, minHeight: 630, height: 'fit-content', backgroundColor: 'black', color: 'white', position: 'relative', padding: 48 }}
                                >
                                    {/* Background */}
                                    <div style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden' }}>
                                        <div className="absolute top-0 left-0 w-full h-full" style={{ background: 'radial-gradient(circle at 30% 20%, #222222 0%, #050505 100%)' }} />
                                        <div className="absolute top-[-50%] left-[-20%] w-[1000px] h-[1000px] rounded-full blur-[150px]" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }} />
                                    </div>

                                    <div style={{ position: 'relative', zIndex: 10 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 16 }}>
                                            <h2 style={{ fontSize: '2rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 12 }}>
                                                <AlertCircle style={{ color: '#ef4444', width: 32, height: 32 }} />
                                                Restricted Parts
                                            </h2>
                                            <span style={{ fontSize: 14, fontFamily: 'monospace', color: '#6b7280' }}>
                                                {tournament.BanList.length} PARTS BANNED
                                            </span>
                                        </div>

                                        <div className={`grid ${gridCols} ${gap}`}>
                                            {tournament.BanList.map((bey: string, i: number) => {
                                                // @ts-ignore
                                                const hasImg = !!imageMap[bey];
                                                return (
                                                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                                                        <div style={{ position: 'relative', width: '100%', aspectRatio: '1/1', borderRadius: 12, overflow: 'hidden', border: '1px solid', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
                                                            {hasImg ? (
                                                                // @ts-ignore
                                                                <img src={imageMap[bey]} alt={bey} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: iconSize === 'p-2' ? 8 : 6, filter: 'grayscale(0.5) opacity(0.9)' }} loading="eager" />
                                                            ) : (
                                                                <span style={{ fontSize: 10, color: '#4b5563', fontFamily: 'monospace' }}>IMG</span>
                                                            )}
                                                            <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.1)', mixBlendMode: 'overlay' }} />
                                                        </div>
                                                        <span style={{ fontSize: fontSize === 'text-xs' ? 12 : fontSize === 'text-[10px]' ? 10 : 9, fontWeight: 700, color: '#d1d5db', textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.25, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                            {bey}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <div style={{ marginTop: 32, paddingTop: 32, borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ opacity: 0.7 }}>
                                                <h3 style={{ fontSize: '1.5rem', fontWeight: 900, fontStyle: 'italic' }}>{tournament?.Name || "BEYBLADE X"}</h3>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: 0.5 }}>
                                                <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase' }}>Powered by สายใต้ยิม</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Bulk Registration (Only for Open/Standard or when explicitly enabled) */}
                {/* Bulk Registration (Only for Open/Standard and when Status is OPEN) */}
                {/* Bulk Registration (Only for Open/Standard and when Status is OPEN) */}
                {(!bracketUrl && tournament?.Status === 'OPEN' && (tournament?.Type === 'Open' || tournament?.Type === 'Standard')) && (
                    <div className="glass-card p-6 rounded-xl space-y-4">
                        <div className="flex items-center gap-2">
                            <Users className="h-5 w-5 text-primary" />
                            <h3 className="font-bold text-foreground">{t('admin.bulk.title')}</h3>
                        </div>
                        <p className="text-xs text-muted-foreground opacity-80">
                            {t('admin.bulk.helper_1')} <br />
                            <span className="text-red-400">{t('admin.bulk.helper_2')}</span>
                        </p>

                        <div className="relative w-full rounded-lg border border-white/10 bg-black/20 overflow-hidden min-h-[128px]">
                            {/* Backdrop for Highlights */}
                            <div className="absolute inset-0 p-3 pointer-events-none whitespace-pre-wrap font-sans text-sm leading-[1.5em]" aria-hidden="true"
                                ref={(el) => {
                                    if (el && document.getElementById('bulk-textarea')) {
                                        const ta = document.getElementById('bulk-textarea');
                                        if (ta) el.scrollTop = ta.scrollTop;
                                    }
                                }}
                            >
                                {bulkPlayers.split('\n').map((line, i) => (
                                    <div key={i} className="relative min-h-[1.5em] w-full break-all">
                                        {highlightedLines.includes(i) && (
                                            <span className="absolute inset-0 bg-red-500/20 w-full -mx-3 px-3 animate-in fade-in"
                                                data-tooltip={dbConflicts.map(d => d.toLowerCase()).includes(line.trim().toLowerCase()) ? t('reg.error.name_exists') : t('admin.bulk.error.internal')}
                                            />
                                        )}
                                        <span className="invisible">{line || ' '}</span>
                                    </div>
                                ))}
                            </div>

                            <textarea
                                id="bulk-textarea"
                                value={bulkPlayers}
                                onChange={(e) => {
                                    setBulkPlayers(e.target.value);
                                    e.target.style.height = 'auto'; // Reset
                                    e.target.style.height = Math.max(128, e.target.scrollHeight) + 'px'; // Auto-grow

                                    // Sync scroll with backdrop
                                    const backdrop = e.target.previousSibling as HTMLElement;
                                    if (backdrop) backdrop.scrollTop = e.target.scrollTop;
                                }}
                                onScroll={(e) => {
                                    const backdrop = (e.target as HTMLElement).previousSibling as HTMLElement;
                                    if (backdrop) backdrop.scrollTop = (e.target as HTMLElement).scrollTop;
                                }}
                                className="relative z-10 w-full h-full min-h-[128px] bg-transparent text-foreground p-3 text-sm focus:outline-none resize-none leading-[1.5em] font-sans"
                                placeholder={t('admin.bulk.placeholder')}
                                spellCheck={false}
                            />
                        </div>

                        {/* Error Summary */}
                        {(internalConflicts.length > 0 || dbConflicts.length > 0) && (
                            <div className="bg-destructive/10 text-destructive text-xs p-3 rounded-lg border border-destructive/20 animate-in slide-in-from-top-2">
                                <p className="font-bold flex items-center gap-2 mb-1">
                                    <AlertCircle className="h-3 w-3" />
                                    Cannot Register:
                                </p>
                                <ul className="list-disc list-inside opacity-80 space-y-0.5">
                                    {internalConflicts.length > 0 && <li>{t('admin.bulk.error.internal')} ({internalConflicts.length})</li>}
                                    {dbConflicts.length > 0 && <li>{t('reg.error.name_exists')} ({dbConflicts.length})</li>}
                                </ul>
                            </div>
                        )}

                        <div className="flex justify-end gap-3 items-center">
                            {highlightedLines.length > 0 && <span className="text-xs text-red-400 font-bold animate-pulse">{t('admin.bulk.error.highlight')}</span>}
                            <button
                                onClick={handleBulkRegister}
                                disabled={isRegistering || !bulkPlayers.trim() || highlightedLines.length > 0}
                                className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-primary to-blue-500 text-white rounded-lg font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isRegistering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
                                {t('admin.bulk.btn')}
                            </button>
                        </div>
                    </div>
                )}

                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" />
                        Registered Players ({data.length})
                    </h3>
                    <div className="flex items-center gap-2">
                        {/* Reset Order (Only visible when shuffled) */}
                        {isListShuffled && (
                            <button
                                onClick={() => {
                                    setIsListShuffled(false);
                                    setShuffledData(null);
                                }}
                                className="text-xs text-muted-foreground hover:text-destructive transition-colors px-2 font-bold"
                            >
                                Reset Order
                            </button>
                        )}

                        <button
                            onClick={handleShufflePlayers}
                            className="flex items-center gap-2 px-3 py-1.5 bg-secondary hover:bg-secondary/80 rounded-lg text-xs font-bold transition-all text-foreground"
                        >
                            <Shuffle className="h-3.5 w-3.5" />
                            Shuffle
                        </button>

                        <button
                            onClick={copyToClipboard}
                            className="flex items-center gap-2 px-3 py-1.5 bg-green-500 text-black rounded-lg text-xs font-bold hover:bg-green-600 transition-colors"
                        >
                            <Copy className="h-3.5 w-3.5" />
                            Copy List
                        </button>
                    </div>
                </div>

                <RegistrationTable
                    data={isListShuffled && shuffledData ? shuffledData : data}
                    loading={loading}
                    searchQuery={searchQuery}
                    onDelete={handleDelete}
                    tournamentType={tournament?.Type}
                />



                <Modal
                    isOpen={modalConfig.isOpen}
                    onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
                    title={modalConfig.title}
                    description={modalConfig.desc}
                    type={modalConfig.type}
                    variant={modalConfig.variant}
                    onConfirm={modalConfig.onConfirm}
                    confirmText={modalConfig.confirmText || (modalConfig.variant === 'destructive' ? t('gen.delete') : 'OK')}
                />

                {/* IMAGE PREVIEW MODAL */}
                <Modal
                    isOpen={!!previewImage}
                    onClose={() => setPreviewImage(null)}
                    title={t('admin.modal.invite_created')}
                    type="custom"
                >
                    <div className="flex flex-col gap-6">
                        <div className="relative w-full aspect-[1.91/1] bg-black/50 rounded-lg overflow-hidden border border-white/10">
                            {previewImage && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={previewImage} alt="Preview" className="w-full h-full object-contain" />
                            )}
                        </div>
                        <p className="text-xs text-center text-muted-foreground">
                            If the image looks correct, click Download below. <br />
                            If images are missing, try closing and generating again.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setPreviewImage(null)}
                                className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/5 transition-colors"
                            >
                                {t('admin.modal.close')}
                            </button>
                            <button
                                onClick={handleSaveImage}
                                className="px-6 py-2 rounded-lg text-sm font-bold text-black bg-primary hover:bg-primary/90 transition-colors shadow-lg shadow-black/20 flex items-center gap-2"
                            >
                                <Download className="h-4 w-4" />
                                {t('admin.modal.download')}
                            </button>
                        </div>
                    </div>
                </Modal>

                {/* BAN LIST PREVIEW MODAL */}
                <Modal
                    isOpen={!!banListImage}
                    onClose={() => setBanListImage(null)}
                    title={t('admin.modal.ban_created')}
                    type="custom"
                >
                    <div className="flex flex-col gap-6">
                        <div className="relative w-full bg-black/50 rounded-lg overflow-hidden border border-white/10">
                            {banListImage && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={banListImage} alt="Ban List Preview" className="w-full h-auto object-contain" />
                            )}
                        </div>
                        <p className="text-xs text-center text-muted-foreground">
                            Ban list image ready for download.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setBanListImage(null)}
                                className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/5 transition-colors"
                            >
                                {t('admin.modal.close')}
                            </button>
                            <button
                                onClick={handleSaveBanList}
                                className="px-6 py-2 rounded-lg text-sm font-bold text-white bg-gradient-to-r from-red-500 to-orange-500 hover:opacity-90 transition-opacity shadow-lg shadow-black/20 flex items-center gap-2"
                            >
                                <Download className="h-4 w-4" />
                                {t('admin.modal.download_ban')}
                            </button>
                        </div>
                    </div>
                </Modal>

                {/* ARENA SELECTION MODAL */}
                <Modal
                    isOpen={!!selectedArenaMatchId}
                    onClose={() => setSelectedArenaMatchId(null)}
                    title="Select Arena"
                    description="Which arena will this match be played on?"
                    type="custom"
                >
                    <div className="grid grid-cols-3 gap-3 p-2 max-h-[60vh] overflow-y-auto">
                        <button
                            onClick={() => {
                                if (selectedArenaMatchId) toggleMatchLock(selectedArenaMatchId); // No arena
                                setSelectedArenaMatchId(null);
                            }}
                            className="bg-secondary hover:bg-white/10 p-3 rounded-lg border border-white/10 text-sm font-medium transition-colors"
                        >
                            No Arena
                        </button>
                        {Array.from({ length: tournament?.ArenaCount || 0 }).map((_, i) => (
                            <button
                                key={i}
                                onClick={() => {
                                    if (selectedArenaMatchId) toggleMatchLock(selectedArenaMatchId, i + 1);
                                    setSelectedArenaMatchId(null);
                                }}
                                className="bg-primary/10 hover:bg-primary/20 p-3 rounded-lg border border-primary/20 text-primary font-bold text-lg transition-colors flex items-center justify-center"
                            >
                                {i + 1}
                            </button>
                        ))}
                    </div>
                </Modal>

                {/* Generic Alert/Confirm Modal */}
                <Modal
                    isOpen={modalConfig.isOpen}
                    onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
                    title={modalConfig.title}
                    description={modalConfig.desc}
                    content={modalConfig.content}
                    type={modalConfig.type}
                    variant={modalConfig.variant}
                    onConfirm={modalConfig.onConfirm}
                    confirmText={modalConfig.confirmText}
                />
            </div>
        </div >
    );
}
