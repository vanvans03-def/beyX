"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw, Copy, CheckCircle, XCircle, AlertCircle, ArrowLeft, Trash2 } from "lucide-react";
import Link from "next/link";
import gameData from "@/data/game-data.json";
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
    const [id, setId] = useState<string>("");

    // Unwrap params
    useEffect(() => {
        params.then(p => setId(p.id));
    }, [params]);

    const [data, setData] = useState<Registration[]>([]);
    const [loading, setLoading] = useState(false);
    const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

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
            const res = await fetch(`/api/admin/registrations?tournamentId=${id}`);
            const json = await res.json();
            if (json.success) {
                const sorted = json.data.sort((a: any, b: any) =>
                    new Date(b.Timestamp).getTime() - new Date(a.Timestamp).getTime()
                );
                setData(sorted);
                setLastRefreshed(new Date());
            }
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
