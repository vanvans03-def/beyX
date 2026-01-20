"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import gameData from "@/data/game-data.json";
import { QRCodeSVG } from "qrcode.react";
import { toPng } from "html-to-image";
import { useRef } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { Loader2, RefreshCw, Copy, CheckCircle, XCircle, AlertCircle, ArrowLeft, Trash2, Users, Trophy, Clock, Edit, Search, Download, Share2, ImageIcon, ArrowUp, ArrowDown } from "lucide-react";
import imageMap from "@/data/image-map.json";
import Image from "next/image";
import { Modal } from "@/components/ui/Modal";
import TournamentBracket from "@/components/TournamentBracket";
import { toast } from "sonner";
import StandingsTable from "@/components/StandingsTable";
import RegistrationTable from "@/components/RegistrationTable";
import { supabase } from "@/lib/supabase";

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
    const [loading, setLoading] = useState(false);
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
    const [historyOpen, setHistoryOpen] = useState(false); // History Modal State
    const [editingMatchId, setEditingMatchId] = useState<number | null>(null); // Track which match in history is being edited

    // Config for Scoring
    const [scoreInputs, setScoreInputs] = useState<Record<number, { p1: string, p2: string }>>({});

    const [origin, setOrigin] = useState("");

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setOrigin(window.location.origin);
        }
    }, []);

    // Helper to clean URL for component prop if needed, though current component handles suffix
    const removeModuleSuffix = (url: string) => url.replace(/\/module$/, '');

    const handleGeneratePreview = async () => {
        if (cardRef.current === null) return;
        setGenerating(true);

        // Wait a bit for any layouts to settle
        await new Promise((resolve) => setTimeout(resolve, 500));

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
                pixelRatio: 2,
                cacheBust: true
            });

            console.log('✓ Image generated successfully');
            setPreviewImage(dataUrl);

        } catch (err) {
            console.error('Image generation error:', err);
            setModalConfig({
                isOpen: true,
                title: "Error",
                desc: "Failed to generate image. Please try again.",
                type: "alert",
                variant: "destructive"
            });
        } finally {
            setGenerating(false);
        }
    };

    const handleExportBanList = async () => {
        if (banListRef.current === null) return;
        setGeneratingBanList(true);

        await new Promise((resolve) => setTimeout(resolve, 500));

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
                pixelRatio: 2,
                cacheBust: true
            });

            console.log('✓ Ban list image generated successfully');
            setBanListImage(dataUrl);

        } catch (err) {
            console.error('Ban list generation error:', err);
            setModalConfig({
                isOpen: true,
                title: "Error",
                desc: "Failed to generate ban list image. Please try again.",
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
                    title: 'Tournament Invite',
                    text: `Join ${tournament?.Name || 'our tournament'}!`
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
                    title: 'Tournament Ban List',
                    text: `Ban list for ${tournament?.Name || 'our tournament'}`
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

        // Optimistic Update
        setMatches(prev => prev.map(m => {
            if (m.id === matchId) {
                return {
                    ...m,
                    state: 'complete', // Mark as complete visually
                    winner_id: winnerId,
                    scores_csv: scores
                };
            }
            return m;
        }));

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

            // Silent refresh to sync data without flicker
            fetchMatches(bracketUrl, true);
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
                title: "Confirm Winner",
                desc: `Are you sure you want to declare ${playerName} as the winner with score ${scores}?`,
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
                    tournamentId: id // Send ID to save URL
                })
            });

            const json = await res.json();

            if (!res.ok) {
                throw new Error(json.error || 'Failed to generate bracket');
            }

            setBracketUrl(json.url);
            fetchMatches(json.url); // Load matches immediately

            toast.success("Tournament bracket created successfully!");

        } catch (error: any) {
            console.error('Bracket generation failed:', error);

            const errorMessage = error.message;

            // Check if it's an API Key related error
            if (errorMessage && (errorMessage.includes("API Key") || errorMessage.includes("401"))) {
                setModalConfig({
                    isOpen: true,
                    title: "Challonge Authorization Failed",
                    desc: "Unable to connect to Challonge. Please check that your API Key is correct in the Admin Dashboard settings.",
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
            title: "End Tournament?",
            desc: "This will close the tournament and mark it as completed.",
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
            title: "Reset Tournament?",
            desc: "WARNING: This will delete the current bracket link and reset the status to OPEN. This allows you to regenerate the bracket or add more players.",
            type: "confirm",
            variant: "destructive",
            confirmText: "Reset & Delete Bracket Link",
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
                    toast.success("Reset Complete: Tournament has been reset to OPEN.");
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

    // Modal State
    const [modalConfig, setModalConfig] = useState<{
        isOpen: boolean;
        title: string;
        desc?: string;
        type: "alert" | "confirm";
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
    }, [fetchData]);

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
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [id, fetchData, bracketUrl]);

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
        });
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
                                Tournament Details
                            </h1>
                            <p className="text-xs text-muted-foreground break-all">ID: {id}</p>
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
                        <button
                            onClick={copyToClipboard}
                            className="flex items-center gap-2 px-4 py-2 bg-primary text-black rounded-lg hover:bg-primary/90 text-sm font-medium transition-colors"
                        >
                            <Copy className="h-4 w-4" />
                            <span className="hidden md:inline">Copy List</span>
                        </button>
                    </div>
                </header>

                {/* Sharing & Info Section */}
                {/* Bracket Section - If URL exists */}
                {bracketUrl && (
                    <TournamentBracket challongeUrl={bracketUrl} />
                )}

                {/* Standings Section */}
                {standings.length > 0 && (
                    <div className="bg-secondary/20 border border-white/10 rounded-xl p-4 mt-6">
                        <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                            <Trophy className="h-5 w-5 text-yellow-500" />
                            Final Standings
                        </h3>
                        <StandingsTable standings={standings} />
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
                                    onClick={() => setHistoryOpen(true)}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-lg text-xs font-bold transition-all border border-transparent hover:border-white/10 whitespace-nowrap"
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
                                {activeMatches.map((match) => (
                                    <div key={match.id} className="bg-background/50 border border-white/20 hover:border-primary/30 p-4 rounded-xl flex flex-col gap-3 transition-colors shadow-sm">
                                        <div className="text-xs text-muted-foreground font-bold uppercase tracking-wider text-center flex items-center justify-center gap-2">
                                            <span className="w-8 h-[1px] bg-white/10"></span>
                                            <span>{t('admin.matches.round').replace('{n}', match.round.toString())}</span>
                                            {match.suggested_play_order && (
                                                <>
                                                    <span className="text-white/20">•</span>
                                                    <span className="text-primary/80">Match {match.suggested_play_order}</span>
                                                </>
                                            )}
                                            <span className="w-8 h-[1px] bg-white/10"></span>
                                        </div>

                                        <div className="flex items-center justify-between gap-2">
                                            {/* Player 1 */}
                                            <button
                                                className={`flex-1 text-center p-3 rounded-lg relative group transition-all flex flex-col items-center gap-1
                                                    ${match.winner_id === match.player1_id
                                                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                                        : 'bg-secondary/40 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300 border border-transparent hover:border-blue-500/30 cursor-pointer'
                                                    }`}
                                                onClick={() => {
                                                    handleUpdateMatch(match.id, "1-0", match.player1_id, match.player1?.name || "Player 1");
                                                }}
                                            >
                                                <div className="font-bold text-sm truncate w-full">{match.player1?.name || "???"}</div>
                                                <span className="text-[10px] opacity-0 group-hover:opacity-60 transition-opacity font-normal">Click to Win</span>
                                            </button>

                                            <div className="text-xs font-bold text-muted-foreground px-1">VS</div>

                                            {/* Player 2 */}
                                            <button
                                                className={`flex-1 text-center p-3 rounded-lg relative group transition-all flex flex-col items-center gap-1
                                                    ${match.winner_id === match.player2_id
                                                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                                        : 'bg-secondary/40 text-red-400 hover:bg-red-500/10 hover:text-red-300 border border-transparent hover:border-red-500/30 cursor-pointer'
                                                    }`}
                                                onClick={() => {
                                                    handleUpdateMatch(match.id, "0-1", match.player2_id, match.player2?.name || "Player 2");
                                                }}
                                            >
                                                <div className="font-bold text-sm truncate w-full">{match.player2?.name || "???"}</div>
                                                <span className="text-[10px] opacity-0 group-hover:opacity-60 transition-opacity font-normal">Click to Win</span>
                                            </button>
                                        </div>
                                    </div>
                                ))}
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
                                        <option value="round robin">Round Robin</option>
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

                {/* History Modal */}
                {historyOpen && (
                    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 p-4 pt-20 overflow-y-auto">
                        <div className="bg-background border border-white/10 rounded-xl p-6 w-full max-w-2xl space-y-4 relative max-h-[80vh] flex flex-col mb-20">
                            <button
                                onClick={() => {
                                    setHistoryOpen(false);
                                    setEditingMatchId(null);
                                }}
                                className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
                            >
                                <XCircle className="h-5 w-5" />
                            </button>

                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <Clock className="h-5 w-5 text-primary" />
                                Match History
                            </h2>

                            <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                {historyMatches.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">No completed matches yet.</div>
                                ) : (
                                    historyMatches.map(match => (
                                        <div key={match.id} className="bg-secondary/30 p-3 rounded flex items-center justify-between border border-white/5">
                                            <div className="flex flex-col gap-1 text-sm flex-1">
                                                <div className="text-xs text-muted-foreground uppercase">Round {match.round}</div>
                                                <div className="flex items-center gap-2">
                                                    <span className={match.winner_id === match.player1_id ? "font-bold text-green-400" : ""}>{match.player1?.name}</span>
                                                    <span className="text-muted-foreground">vs</span>
                                                    <span className={match.winner_id === match.player2_id ? "font-bold text-green-400" : ""}>{match.player2?.name}</span>
                                                </div>
                                                <div className="text-xs text-muted-foreground">Score: {match.scores_csv}</div>
                                            </div>

                                            {editingMatchId === match.id ? (
                                                <div className="flex items-center gap-2 animate-in fade-in zoom-in">
                                                    <input
                                                        type="number"
                                                        className="w-10 bg-black/40 border border-white/10 rounded text-center text-sm p-1"
                                                        placeholder="0"
                                                        value={scoreInputs[match.id]?.p1 || match.scores_csv.split('-')[0] || '0'}
                                                        onChange={(e) => setScoreInputs(prev => ({
                                                            ...prev, [match.id]: { ...prev[match.id], p1: e.target.value }
                                                        }))}
                                                    />
                                                    <span>-</span>
                                                    <input
                                                        type="number"
                                                        className="w-10 bg-black/40 border border-white/10 rounded text-center text-sm p-1"
                                                        placeholder="0"
                                                        value={scoreInputs[match.id]?.p2 || match.scores_csv.split('-')[1] || '0'}
                                                        onChange={(e) => setScoreInputs(prev => ({
                                                            ...prev, [match.id]: { ...prev[match.id], p2: e.target.value }
                                                        }))}
                                                    />
                                                    <div className="flex flex-col gap-1">
                                                        <button
                                                            onClick={() => {
                                                                const s = scoreInputs[match.id];
                                                                const currentP1 = s?.p1 ?? match.scores_csv.split('-')[0] ?? '0';
                                                                const currentP2 = s?.p2 ?? match.scores_csv.split('-')[1] ?? '0';
                                                                const scoreStr = `${currentP1}-${currentP2}`;

                                                                confirmUpdateMatch(match.id, scoreStr, match.player1_id);
                                                                setEditingMatchId(null);
                                                            }}
                                                            className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded hover:bg-green-500/30 w-24 flex justify-center items-center"
                                                            title={match.player1?.name || "Player 1"}
                                                        >
                                                            <span className="truncate max-w-[80px]">{match.player1?.name || "Player 1"}</span>
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                const s = scoreInputs[match.id];
                                                                const currentP1 = s?.p1 ?? match.scores_csv.split('-')[0] ?? '0';
                                                                const currentP2 = s?.p2 ?? match.scores_csv.split('-')[1] ?? '0';
                                                                const scoreStr = `${currentP1}-${currentP2}`;

                                                                confirmUpdateMatch(match.id, scoreStr, match.player2_id);
                                                                setEditingMatchId(null);
                                                            }}
                                                            className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded hover:bg-green-500/30 w-24 flex justify-center items-center"
                                                            title={match.player2?.name || "Player 2"}
                                                        >
                                                            <span className="truncate max-w-[80px]">{match.player2?.name || "Player 2"}</span>
                                                        </button>
                                                    </div>
                                                    <button
                                                        onClick={() => setEditingMatchId(null)}
                                                        className="text-muted-foreground hover:text-foreground"
                                                    >
                                                        <XCircle className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            ) : (tournament?.Status !== 'COMPLETED' && tournament?.Status !== 'CLOSED') && (
                                                <button
                                                    onClick={() => {
                                                        const parts = match.scores_csv.split('-');
                                                        setScoreInputs(prev => ({
                                                            ...prev,
                                                            [match.id]: { p1: parts[0] || '0', p2: parts[1] || '0' }
                                                        }));
                                                        setEditingMatchId(match.id);
                                                    }}
                                                    className="p-2 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
                                                    title="Edit Result"
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
                                                Exporting...
                                            </>
                                        ) : (
                                            <>
                                                <Download className="h-3 w-3" />
                                                Export Ban List
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
                                            alert("Link copied!");
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
                                    <div style={{ position: 'relative', zIndex: 10, display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', width: '100%', height: 'auto', alignItems: 'stretch' }}>

                                        {/* Left Side: Tournament Info & Ban List */}
                                        <div style={{ padding: 40, display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(255,255,255,0.1)' }}>
                                            <div style={{ marginBottom: 24 }}>
                                                <p className="text-xl font-bold tracking-[0.5em] uppercase mb-2" style={{ color: '#00ff94', fontSize: '0.9rem' }}>
                                                    Tournament Invite
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
                                                    <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Restricted Parts ({tournament?.BanList?.length || 0})</span>
                                                </div>

                                                {tournament?.BanList && tournament.BanList.length > 0 ? (
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
                                                ) : (
                                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed rgba(255,255,255,0.1)', borderRadius: 12 }}>
                                                        <span style={{ color: '#4b5563', fontSize: '0.9rem' }}>No Banned Parts</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Footer */}
                                            <div style={{ marginTop: 'auto', paddingTop: 20, display: 'flex', alignItems: 'center', gap: 8, opacity: 0.5 }}>
                                                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase' }}>Powered by สายใต้ยิม</span>
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

                <RegistrationTable
                    data={data}
                    loading={loading}
                    searchQuery={searchQuery}
                    onDelete={handleDelete}
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

                {/* Generic Alert/Confirm Modal */}
                <Modal
                    isOpen={modalConfig.isOpen}
                    onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
                    title={modalConfig.title}
                    description={modalConfig.desc}
                    type={modalConfig.type}
                    variant={modalConfig.variant}
                    onConfirm={modalConfig.onConfirm}
                />
            </div>
        </div >
    );
}
