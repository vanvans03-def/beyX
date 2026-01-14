"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw, Copy, CheckCircle, XCircle, AlertCircle, ArrowLeft, Trash2, Users } from "lucide-react";
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
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [origin, setOrigin] = useState("");

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setOrigin(window.location.origin);
        }
    }, []);

    const handleGeneratePreview = async () => {
        if (cardRef.current === null) return;
        setGenerating(true);

        // Wait a bit for any layouts to settle
        await new Promise((resolve) => setTimeout(resolve, 500));

        try {
            await document.fonts.ready;

            const imageElements = Array.from(cardRef.current.getElementsByTagName("img"));
            console.log(`Found ${imageElements.length} images`);

            // Wait for all images to load
            await Promise.all(
                imageElements.map((img) => {
                    return new Promise<void>((resolve) => {
                        if (img.complete && img.naturalHeight > 0) {
                            resolve();
                            return;
                        }

                        const timeout = setTimeout(() => resolve(), 5000);

                        img.onload = () => {
                            clearTimeout(timeout);
                            resolve();
                        };

                        img.onerror = () => {
                            clearTimeout(timeout);
                            resolve();
                        };
                    });
                })
            );

            console.log('Images ready, waiting for paint...');
            await new Promise((resolve) => setTimeout(resolve, 1000));

            console.log('Capturing with html-to-image...');

            // Use html-to-image
            const dataUrl = await toPng(cardRef.current, {
                backgroundColor: '#030303',
                pixelRatio: 2, // High quality
                cacheBust: true,
                skipAutoScale: true
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

    // Dynamic Sizing Logic for Ban List
    const banListCount = tournament?.BanList?.length || 0;
    let gridCols = "grid-cols-4";
    let gap = "gap-6";
    let fontSize = "text-xs";
    let iconSize = "p-2";

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
                            <button
                                onClick={handleGeneratePreview}
                                disabled={generating}
                                className="text-xs flex items-center gap-1 bg-gradient-to-r from-primary to-blue-500 text-white px-3 py-1.5 rounded-lg font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {generating ? (
                                    <>
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        Creating...
                                    </>
                                ) : (
                                    <>
                                        <ImageIcon className="h-3 w-3" />
                                        Create Invite Card
                                    </>
                                )}
                            </button>
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

                        {/* HIDDEN RENDER CONTAINER FOR IMAGE GENERATION */}
                        {/* We use opacity: 0 instead of display: none or huge offset to ensure browser renders it for capture */}
                        <div style={{ position: "fixed", top: 0, left: 0, zIndex: -50, opacity: 0, pointerEvents: "none" }}>
                            <div
                                ref={cardRef}
                                style={{ width: 1200, minHeight: 630, height: 'fit-content', backgroundColor: 'black', color: 'white', position: 'relative', display: 'flex' }}
                            >
                                {/* Dynamic Background */}
                                <div style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden' }}>
                                    <div className="absolute top-0 left-0 w-full h-full" style={{ background: 'radial-gradient(circle at 30% 20%, #222222 0%, #050505 100%)' }} />
                                    <div className="absolute top-0 left-0 w-full h-full" style={{ background: 'radial-gradient(circle at 30% 20%, #222222 0%, #050505 100%)' }} />
                                    <div className="absolute top-[-50%] left-[-20%] w-[1000px] h-[1000px] rounded-full blur-[150px]" style={{ backgroundColor: 'rgba(0, 255, 148, 0.1)' }} />
                                    <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-[#2563eb]/20 rounded-full blur-[120px]" />
                                </div>

                                {/* Conditional Layout: Single Column if No Bans, Two Columns if Bans */}
                                {tournament?.BanList && tournament.BanList.length > 0 ? (
                                    <>
                                        {/* Left Side: Info & QR - Sticky to stay visible on tall cards */}
                                        <div style={{ zIndex: 10, width: 450, display: 'flex', flexDirection: 'column', position: 'relative', borderRight: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(0,0,0,0.2)' }}>
                                            {/* Fixed Content Container */}
                                            <div style={{ position: 'sticky', top: 0, height: 630, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 48 }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                                    <p className="text-sm font-bold tracking-[0.3em] uppercase" style={{ color: '#00ff94' }}>
                                                        Tournament Invite
                                                    </p>
                                                    <h1 style={{ fontSize: '3rem', fontWeight: 900, fontStyle: 'italic', letterSpacing: '-0.05em', lineHeight: 0.9 }}>
                                                        {tournament?.Name || "BEYBLADE X"}
                                                    </h1>
                                                    {tournament?.Type && (
                                                        <div style={{ display: 'inline-block', padding: '8px 16px', borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}>
                                                            <span style={{ fontSize: '1.25rem', fontWeight: 700, background: 'linear-gradient(to right, white, #9ca3af)', WebkitBackgroundClip: 'text', color: 'transparent', textTransform: 'uppercase' }}>
                                                                {tournament.Type} FORMAT
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>

                                                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', flex: 1, gap: 24 }}>
                                                    {(() => {
                                                        // Dynamic QR Size based on density
                                                        const count = tournament.BanList.length;
                                                        let qrSize = 200;
                                                        if (count > 28) qrSize = 340; // Fill more space if huge list
                                                        else if (count > 12) qrSize = 260; // Medium fill

                                                        return (
                                                            <div style={{ backgroundColor: 'white', padding: 16, borderRadius: 12, width: 'fit-content', transition: 'all 0.3s', boxShadow: '0 25px 50px -12px rgba(0, 255, 148, 0.2)' }}>
                                                                <QRCodeSVG
                                                                    value={`${origin || ''}/register/${id}`}
                                                                    size={qrSize}
                                                                />
                                                            </div>
                                                        );
                                                    })()}
                                                    <p className="text-sm text-[#9ca3af] font-mono">
                                                        SCAN TO REGISTER
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ flex: 1, padding: 48, zIndex: 10, display: 'flex', flexDirection: 'column', height: '100%' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 16 }}>
                                                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 12 }}>
                                                    <AlertCircle style={{ color: '#ef4444' }} />
                                                    Restricted Parts
                                                </h2>
                                                <span className="text-xs font-mono text-[#6b7280]">
                                                    {tournament.BanList.length} PARTS BANNED
                                                </span>
                                            </div>

                                            <div className={`flex-1 content-start grid ${gridCols} ${gap}`}>
                                                {tournament.BanList.map((bey: string, i: number) => {
                                                    // @ts-ignore
                                                    const hasImg = !!imageMap[bey];
                                                    return (
                                                        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                                                            <div style={{ position: 'relative', width: '100%', aspectRatio: '1/1', borderRadius: 12, overflow: 'hidden', border: '1px solid', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
                                                                {hasImg ? (
                                                                    // @ts-ignore
                                                                    <img src={imageMap[bey]} alt={bey} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: iconSize === 'p-2' ? 8 : 6, filter: 'grayscale(0.5) opacity(0.9)' }} />
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

                                            <div style={{ marginTop: 32, paddingTop: 32, borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'flex-end' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: 0.5 }}>
                                                    <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase' }}>Powered by สายใต้ยิม</span>
                                                </div>
                                            </div>
                                        </div>
                                    </>

                                ) : (
                                    /* Single Column Centered Layout (No Bans) */
                                    <div style={{ flex: 1, zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 48, position: 'relative' }}>
                                        {/* Decorative Element */}
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full z-[-1]" style={{ border: '1px solid rgba(255,255,255,0.05)' }} />
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full z-[-1] opacity-50" style={{ border: '1px solid rgba(255,255,255,0.05)' }} />

                                        <p className="text-lg font-bold tracking-[0.5em] uppercase mb-6" style={{ color: '#00ff94', filter: 'drop-shadow(0 10px 8px rgba(0, 0, 0, 0.04)) drop-shadow(0 4px 3px rgba(0, 0, 0, 0.1))' }}>
                                            Tournament Invite
                                        </p>

                                        <h1 style={{ fontSize: '4.5rem', fontWeight: 900, fontStyle: 'italic', letterSpacing: '-0.05em', marginBottom: 16, lineHeight: 1, background: 'linear-gradient(to bottom, #ffffff, #9ca3af)', WebkitBackgroundClip: 'text', color: 'transparent', padding: '8px 16px', filter: 'drop-shadow(0 25px 25px rgba(0, 0, 0, 0.15))' }}>
                                            {tournament?.Name || "BEYBLADE X"}
                                        </h1>

                                        {
                                            tournament?.Type && (
                                                <div style={{ marginBottom: 48, display: 'inline-block', padding: '12px 32px', borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
                                                    <span style={{ fontSize: '1.875rem', fontWeight: 700, color: 'white', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                                        {tournament.Type} FORMAT
                                                    </span>
                                                </div>
                                            )
                                        }

                                        <div style={{ backgroundColor: 'white', padding: 24, borderRadius: 24, boxShadow: '0 0 50px rgba(0,0,0,0.5)', border: '4px solid rgba(255,255,255,0.2)', marginBottom: 48, transform: 'scale(1.1)' }}>
                                            <QRCodeSVG
                                                value={`${origin || ''}/register/${id}`}
                                                size={280}
                                            />
                                        </div>

                                        <p style={{ fontSize: '1.25rem', color: '#9ca3af', fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 48 }}>
                                            Scan to Register
                                        </p>

                                        <div style={{ position: 'absolute', bottom: 48, right: 48, opacity: 0.5 }}>
                                            <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase' }}>Powered by สายใต้ยิม</span>
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
                                {(() => {
                                    // Pre-calculate device counts
                                    const deviceCounts: Record<string, number> = {};
                                    filteredData.forEach(r => {
                                        deviceCounts[r.DeviceUUID] = (deviceCounts[r.DeviceUUID] || 0) + 1;
                                    });

                                    // Helper for consistent color
                                    const getDeviceColor = (uuid: string) => {
                                        let hash = 0;
                                        for (let i = 0; i < uuid.length; i++) hash = uuid.charCodeAt(i) + ((hash << 5) - hash);
                                        const hue = Math.abs(hash % 360);
                                        return `hsl(${hue}, 70%, 60%)`;
                                    };

                                    return filteredData.map((row, i) => {
                                        const validation = validateRow(row);
                                        const isMulti = (deviceCounts[row.DeviceUUID] || 0) > 1;
                                        const deviceColor = isMulti ? getDeviceColor(row.DeviceUUID) : undefined;

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
                                                <td className="p-4 font-medium text-foreground whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        {row.PlayerName}
                                                        {isMulti && (
                                                            <div
                                                                className="flex items-center justify-center p-1 rounded-full bg-white/10"
                                                                title={`Multi-player Device: ${row.DeviceUUID.substring(0, 4)}...`}
                                                                style={{ color: deviceColor }}
                                                            >
                                                                <Users className="h-3.5 w-3.5" />
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
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
                                    })
                                })()}
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

                {/* IMAGE PREVIEW MODAL */}
                <Modal
                    isOpen={!!previewImage}
                    onClose={() => setPreviewImage(null)}
                    title="Invite Card Created"
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
                                Close
                            </button>
                            <button
                                onClick={handleSaveImage}
                                className="px-6 py-2 rounded-lg text-sm font-bold text-black bg-primary hover:bg-primary/90 transition-colors shadow-lg shadow-black/20 flex items-center gap-2"
                            >
                                <Download className="h-4 w-4" />
                                Download Image
                            </button>
                        </div>
                    </div>
                </Modal>
            </div>
        </div >
    );
}
