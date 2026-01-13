"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw, Copy, CheckCircle, XCircle, AlertCircle, ArrowLeft, Trash2 } from "lucide-react";
import Link from "next/link";
import gameData from "@/data/game-data.json";
import { QRCodeSVG } from "qrcode.react";
import { toPng } from "html-to-image";
import { useRef } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { Download, Share2, ImageIcon } from "lucide-react";
import imageMap from "@/data/image-map.json";
import Image from "next/image";
import { Modal } from "@/components/ui/Modal";

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

    const cardRef = useRef<HTMLDivElement>(null);

    const [generating, setGenerating] = useState(false);

    const handleDownloadCard = async () => {
        if (cardRef.current === null) return;
        setGenerating(true);
        try {
            await document.fonts.ready; // Ensure fonts load

            // Wait for all images to load
            const images = Array.from(cardRef.current.getElementsByTagName("img"));
            await Promise.all(
                images.map((img) => {
                    if (img.complete) return Promise.resolve();
                    return new Promise((resolve) => {
                        img.onload = resolve;
                        img.onerror = resolve; // Resolve even on error to prevent hanging
                    });
                })
            );

            // Small delay to ensure rendering is stable after load
            await new Promise((resolve) => setTimeout(resolve, 500));

            const dataUrl = await toPng(cardRef.current, {
                cacheBust: true,
                backgroundColor: '#030303',
                pixelRatio: 2 // High quality
            });
            const link = document.createElement('a');
            link.download = `invite-${tournament?.Name || 'tournament'}.png`;
            link.href = dataUrl;
            link.click();
        } catch (err) {
            console.error(err);
            alert("Failed to generate image");
        } finally {
            setGenerating(false);
        }
    };

    // Modal State
    const [modalConfig, setModalConfig] = useState<{
        isOpen: boolean;
        title: string;
        desc?: string;
        type: "alert" | "confirm";
        variant?: "default" | "destructive";
        onConfirm?: () => void;
    }>({
        isOpen: false,
        title: "",
        type: "alert"
    });

    const fetchData = async () => {
        if (!id) return;
        setLoading(true);
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
            }

            setLastRefreshed(new Date());
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
            setLoading(false);
        }
    };

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

    const handleDelete = (row: Registration) => {
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
    };

    const validateRow = (row: Registration) => {
        const mainBeys = [row.Main_Bey1, row.Main_Bey2, row.Main_Bey3];
        // Parse reserves
        let reserveDecks: string[][] = [];
        try {
            reserveDecks = JSON.parse(row.Reserve_Data);
            // Handle legacy format (single array of strings) if any
            if (reserveDecks.length > 0 && typeof reserveDecks[0] === 'string') {
                // @ts-ignore
                reserveDecks = [reserveDecks];
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
        if (!mainVal.valid) return { status: "fail", msg: `Main: ${mainVal.msg}` };

        // Check Reserves
        for (let i = 0; i < reserveDecks.length; i++) {
            const deck = reserveDecks[i];
            // Skip empty decks if any (shouldn't happen with proper validation)
            if (!deck || deck.length === 0) continue;

            // Adjust for legacy (if deck is not array of strings? handled above)
            const resVal = checkDeck(deck);
            if (!resVal.valid) return { status: "fail", msg: `Res ${i + 1}: ${resVal.msg}` };
        }

        return { status: "pass", msg: "OK" };
    };

    const filteredData = data.filter(r =>
        r.PlayerName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-background p-4 md:p-6">
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
                            onClick={fetchData}
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
                                                        <Image src={imageMap[bey]} alt={bey} width={100} height={100} className="w-full h-full object-contain grayscale-[0.5] opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all" />
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
                            <button
                                onClick={handleDownloadCard}
                                disabled={generating}
                                className="text-xs flex items-center gap-1 bg-gradient-to-r from-primary to-blue-500 text-white px-3 py-1.5 rounded-lg font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {generating ? (
                                    <>
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <Download className="h-3 w-3" />
                                        Download Invite Card
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Visible QR Info */}
                        <div className="flex items-center gap-6">
                            <div className="bg-white p-2 rounded-lg">
                                <QRCodeSVG value={`${typeof window !== 'undefined' ? window.location.origin : ''}/register/${id}`} size={100} />
                            </div>
                            <div className="space-y-2 flex-1 min-w-0">
                                <div className="p-2 bg-secondary rounded text-xs font-mono text-muted-foreground break-all border border-white/5">
                                    {typeof window !== 'undefined' ? `${window.location.host}/register/${id}` : `.../register/${id}`}
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

                        {/* HIDDEN RENDER CONTAINER FOR IMAGE GENERATION */}
                        <div style={{ position: "absolute", top: "-9999px", left: "-9999px" }}>
                            <div
                                ref={cardRef}
                                className="w-[1200px] min-h-[630px] h-fit bg-black text-white relative flex"
                            >
                                {/* Dynamic Background */}
                                <div className="absolute inset-0 z-0 overflow-hidden">
                                    <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_30%_20%,_#222_0%,_#050505_100%)]" />
                                    <div className="absolute top-[-50%] left-[-20%] w-[1000px] h-[1000px] bg-primary/10 rounded-full blur-[150px]" />
                                    <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[120px]" />
                                </div>

                                {/* Conditional Layout: Single Column if No Bans, Two Columns if Bans */}
                                {tournament?.BanList && tournament.BanList.length > 0 ? (
                                    <>
                                        {/* Left Side: Info & QR - Sticky to stay visible on tall cards */}
                                        <div className="z-10 w-[450px] flex flex-col border-r border-white/10 bg-black/20 backdrop-blur-sm relative">
                                            {/* Fixed Content Container */}
                                            <div className="sticky top-0 h-[630px] flex flex-col justify-between p-12">
                                                <div className="space-y-4">
                                                    <p className="text-sm font-bold tracking-[0.3em] text-primary uppercase">
                                                        Tournament Invite
                                                    </p>
                                                    <h1 className="text-5xl font-black italic tracking-tighter leading-[0.9]">
                                                        {tournament?.Name || "BEYBLADE X"}
                                                    </h1>
                                                    {tournament?.Type && (
                                                        <div className="inline-block px-4 py-2 rounded-lg bg-white/10 border border-white/20 backdrop-blur-md">
                                                            <span className="text-xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent uppercase">
                                                                {tournament.Type} FORMAT
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="space-y-6 flex flex-col justify-end flex-1">
                                                    {(() => {
                                                        // Dynamic QR Size based on density
                                                        const count = tournament.BanList.length;
                                                        let qrSize = 200;
                                                        if (count > 28) qrSize = 340; // Fill more space if huge list
                                                        else if (count > 12) qrSize = 260; // Medium fill

                                                        return (
                                                            <div className="bg-white p-4 rounded-xl w-fit shadow-2xl shadow-primary/20 transition-all duration-300">
                                                                <QRCodeSVG
                                                                    value={`${typeof window !== 'undefined' ? window.location.origin : ''}/register/${id}`}
                                                                    size={qrSize}
                                                                />
                                                            </div>
                                                        );
                                                    })()}
                                                    <p className="text-sm text-gray-400 font-mono">
                                                        SCAN TO REGISTER
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right Side: Ban List Grid - Grows naturally */}
                                        <div className="flex-1 p-12 z-10 flex flex-col h-full">
                                            <div className="flex items-center justify-between mb-8 border-b border-white/10 pb-4">
                                                <h2 className="text-2xl font-bold uppercase tracking-widest flex items-center gap-3">
                                                    <AlertCircle className="text-destructive" />
                                                    Restricted Parts
                                                </h2>
                                                <span className="text-xs font-mono text-gray-500">
                                                    {tournament.BanList.length} PARTS BANNED
                                                </span>
                                            </div>

                                            {(() => {
                                                const count = tournament.BanList.length;
                                                // Dynamic Sizing Logic for Readability
                                                // We no longer limit items, but we adjust size for better packing
                                                let gridCols = "grid-cols-4";
                                                let gap = "gap-6";
                                                let fontSize = "text-xs";
                                                let iconSize = "p-2";

                                                if (count > 20) {
                                                    gridCols = "grid-cols-6";
                                                    gap = "gap-3";
                                                    fontSize = "text-[9px]";
                                                    iconSize = "p-1.5";
                                                } else if (count > 12) {
                                                    gridCols = "grid-cols-5";
                                                    gap = "gap-4";
                                                    fontSize = "text-[10px]";
                                                    iconSize = "p-2";
                                                }

                                                return (
                                                    <div className={`flex-1 content-start grid ${gridCols} ${gap}`}>
                                                        {tournament.BanList.map((bey: string, i: number) => {
                                                            // @ts-ignore
                                                            const hasImg = !!imageMap[bey];
                                                            return (
                                                                <div key={i} className="flex flex-col items-center gap-1.5 group">
                                                                    <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-white/5 border border-white/10 shadow-lg flex items-center justify-center">
                                                                        {hasImg ? (
                                                                            // @ts-ignore
                                                                            <img src={imageMap[bey]} alt={bey} className={`w-full h-full object-contain ${iconSize} grayscale-[0.5] opacity-90`} />
                                                                        ) : (
                                                                            <span className="text-[10px] text-gray-600 font-mono">IMG</span>
                                                                        )}
                                                                        <div className="absolute inset-0 bg-black/10 mix-blend-overlay" />
                                                                    </div>
                                                                    <span className={`${fontSize} font-bold text-gray-300 uppercase text-center leading-tight line-clamp-2`}>
                                                                        {bey}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                );
                                            })()}

                                            <div className="mt-8 pt-8 border-t border-white/10 flex justify-end">
                                                <div className="flex items-center gap-2 opacity-50">
                                                    <span className="text-xs font-bold tracking-[0.2em] uppercase">Powered by สายใต้ยิม</span>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    /* Single Column Centered Layout (No Bans) */
                                    <div className="flex-1 z-10 flex flex-col items-center justify-center text-center p-12 relative">

                                        {/* Decorative Element */}
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] border border-white/5 rounded-full z-[-1]" />
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] border border-white/5 rounded-full z-[-1] opacity-50" />

                                        <p className="text-lg font-bold tracking-[0.5em] text-primary uppercase mb-6 drop-shadow-lg">
                                            Tournament Invite
                                        </p>

                                        <h1 className="text-7xl font-black italic tracking-tighter mb-4 leading-none bg-gradient-to-b from-white to-gray-400 bg-clip-text text-transparent drop-shadow-2xl px-4 py-2">
                                            {tournament?.Name || "BEYBLADE X"}
                                        </h1>

                                        {tournament?.Type && (
                                            <div className="mb-12 inline-block px-8 py-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl shadow-xl">
                                                <span className="text-3xl font-bold text-white uppercase tracking-widest">
                                                    {tournament.Type} FORMAT
                                                </span>
                                            </div>
                                        )}

                                        <div className="bg-white p-6 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] border-4 border-white/20 mb-12 transform scale-110">
                                            <QRCodeSVG
                                                value={`${typeof window !== 'undefined' ? window.location.origin : ''}/register/${id}`}
                                                size={280}
                                            />
                                        </div>

                                        <p className="text-xl text-gray-400 font-mono tracking-widest uppercase mb-12">
                                            Scan to Register
                                        </p>

                                        <div className="absolute bottom-12 right-12 opacity-50">
                                            <span className="text-sm font-bold tracking-[0.3em] uppercase">Powered by สายใต้ยิม</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center min-h-[400px] glass-card rounded-xl">
                        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
                        <h3 className="text-xl font-bold italic tracking-tighter text-white animate-pulse">
                            FETCHING <span className="text-primary">DATA</span>
                        </h3>
                    </div>
                ) : (
                    <div className="glass-card rounded-xl overflow-hidden overflow-x-auto">
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
                                {filteredData.map((row, i) => {
                                    const validation = validateRow(row);
                                    let reserveDecks: string[][] = [];
                                    try {
                                        const parsed = JSON.parse(row.Reserve_Data);
                                        if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'string') {
                                            // Legacy single deck
                                            reserveDecks = [parsed as string[]];
                                        } else {
                                            reserveDecks = parsed;
                                        }
                                    } catch (e) { }

                                    return (
                                        <tr key={i} className="hover:bg-accent/5 transition-colors group">
                                            <td className="p-4 whitespace-nowrap text-muted-foreground">
                                                {new Date(row.Timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td className="p-4 font-medium text-foreground whitespace-nowrap">{row.PlayerName}</td>
                                            <td className="p-4 whitespace-nowrap">
                                                <span className={`px-2 py-1 rounded text-[10px] font-bold ${row.Mode === "Under10" ? "bg-blue-500/20 text-blue-400" : "bg-purple-500/20 text-purple-400"}`}>
                                                    {row.Mode === "Under10" ? "U10" : "NMM"}
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
                                                {reserveDecks.map((deck, idx) => (
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
                                                        {validation.status === "pass" && <CheckCircle className="h-4 w-4 text-green-500" />}
                                                        {validation.status === "fail" && <XCircle className="h-4 w-4 text-red-500" />}
                                                        <span className={`font-bold ${validation.status === "pass" ? "text-green-500" :
                                                            validation.status === "fail" ? "text-red-500" : "text-yellow-500"
                                                            }`}>
                                                            {validation.msg}
                                                        </span>
                                                    </div>
                                                    <button
                                                        onClick={() => handleDelete(row)}
                                                        className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-2 text-muted-foreground hover:text-red-500 transition-all"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filteredData.length === 0 && !loading && (
                                    <tr>
                                        <td colSpan={6} className="p-8 text-center text-muted-foreground">
                                            No matching registrations found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                )}

                <Modal
                    isOpen={modalConfig.isOpen}
                    onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
                    title={modalConfig.title}
                    description={modalConfig.desc}
                    type={modalConfig.type}
                    variant={modalConfig.variant}
                    onConfirm={modalConfig.onConfirm}
                    confirmText={modalConfig.variant === 'destructive' ? 'Delete' : 'OK'}
                />
            </div>
        </div >
    );
}
