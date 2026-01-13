"use client";

import { useEffect, useState, useMemo } from "react";
import { Loader2, Plus, QrCode, Copy, LockKeyhole, ArrowRight, ExternalLink } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";
import { useTranslation } from "@/hooks/useTranslation";
import { Globe } from "lucide-react";
import gameData from "@/data/game-data.json";
import { MultiVisualSelector } from "@/components/ui/MultiVisualSelector";

type Tournament = {
    TournamentID: string;
    Name: string;
    Status: string;
    CreatedAt: string;
    Type?: string;
    BanList?: string[];
};

export default function AdminPage() {
    const { t, lang, toggleLang } = useTranslation();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isCheckingAuth, setIsCheckingAuth] = useState(true); // Prevent flash
    const [passwordInput, setPasswordInput] = useState("");
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [newTournamentName, setNewTournamentName] = useState("");

    // New Creation State
    const [newType, setNewType] = useState<"U10" | "NoMoreMeta" | "Open">("U10");
    const [isCustomBanList, setIsCustomBanList] = useState(false);

    // Default ban list checks
    const defaultBanList = gameData.banList;
    const [customBanListInput, setCustomBanListInput] = useState(defaultBanList.join(", "));

    // Derive all beys for selector
    const allBeys = useMemo(() => Object.entries(gameData.points).flatMap(([point, names]) =>
        names.map(name => ({ name, point: Number(point) }))
    ), []);

    const [createError, setCreateError] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);

    // Modal State
    const [modalConfig, setModalConfig] = useState<{
        isOpen: boolean;
        title: string;
        desc?: string;
        type: "alert" | "confirm";
        onConfirm?: () => void;
        variant?: "default" | "destructive";
        confirmText?: string;
    }>({
        isOpen: false,
        title: "",
        type: "alert"
    });

    // Auth Check
    useEffect(() => {
        const saved = sessionStorage.getItem("admin_auth");
        if (saved === "CYEAH") {
            setIsAuthenticated(true);
            fetchTournaments();
        }
        setIsCheckingAuth(false);
    }, []);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (passwordInput === "CYEAH") {
            setIsAuthenticated(true);
            sessionStorage.setItem("admin_auth", "CYEAH");
            fetchTournaments();
        } else {
            setModalConfig({
                isOpen: true,
                title: "Access Denied",
                desc: "Incorrect password. Please try again.",
                type: "alert"
            });
            setPasswordInput("");
        }
    };

    const fetchTournaments = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/tournaments");
            const json = await res.json();
            if (json.success) {
                setTournaments(json.data.reverse()); // Newest first
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTournamentName.trim()) {
            setCreateError("Please enter a tournament name.");
            return;
        }
        setCreateError("");
        setCreating(true);

        const banListToSend = isCustomBanList
            ? customBanListInput.split(",").map(s => s.trim()).filter(Boolean)
            : (newType === 'NoMoreMeta' ? defaultBanList : []);
        // If U10, technically ban list shouldn't matter as logic is point based, but let's keep empty.
        // If NMM, use default unless custom.
        // If Open, use empty unless custom.

        try {
            const res = await fetch("/api/admin/tournaments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: newTournamentName,
                    type: newType,
                    ban_list: banListToSend
                })
            });
            const json = await res.json();
            if (json.success) {
                setNewTournamentName("");
                setCustomBanListInput(defaultBanList.join(", ")); // Reset
                fetchTournaments();
            }
        } catch (e) {
            setModalConfig({
                isOpen: true,
                title: "Error",
                desc: "Failed to create tournament.",
                type: "alert",
                variant: "destructive"
            });
        } finally {
            setCreating(false);
        }
    };

    const handleEndTournament = (t: Tournament) => {
        setModalConfig({
            isOpen: true,
            title: "End Tournament?",
            desc: `Are you sure you want to end "${t.Name}"? This will disable new registrations immediately.`,
            type: "confirm",
            variant: "destructive",
            confirmText: "End Tournament",
            onConfirm: async () => {
                setModalConfig(prev => ({ ...prev, isOpen: false }));
                try {
                    const res = await fetch("/api/admin/tournaments", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ tournamentId: t.TournamentID, status: "CLOSED" })
                    });
                    if (res.ok) fetchTournaments();
                } catch (e) {
                    alert("Failed to update");
                }
            }
        });
    };

    const filteredTournaments = tournaments.filter(t =>
        t.Name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (isCheckingAuth) {
        return null; // or a simple spinner, but null is fine to prevent flash
    }

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background p-4">
                <form onSubmit={handleLogin} className="w-full max-w-sm glass-card p-8 rounded-2xl space-y-6 text-center">
                    <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                        <LockKeyhole className="h-8 w-8 text-primary" />
                    </div>
                    <h1 className="text-xl font-bold">Admin Access</h1>
                    <input
                        type="password"
                        placeholder="Enter Password"
                        value={passwordInput}
                        onChange={e => setPasswordInput(e.target.value)}
                        className="w-full bg-secondary/50 border border-input rounded-lg px-4 py-3 text-center outline-none focus:border-primary transition-colors"
                    />
                    <button type="submit" className="w-full bg-primary text-black font-bold py-3 rounded-lg hover:bg-primary/90">
                        Login
                    </button>
                </form>
                {/* Auth Modal */}
                <Modal
                    isOpen={modalConfig.isOpen}
                    onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
                    title={modalConfig.title}
                    description={modalConfig.desc}
                    type={modalConfig.type}
                    variant={modalConfig.variant}
                />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background p-4 md:p-6">
            <div className="max-w-4xl mx-auto space-y-6 md:space-y-8">
                <header className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-blue-500 bg-clip-text text-transparent text-center md:text-left">
                            {t('admin.title')}
                        </h1>
                        <button onClick={toggleLang} className="p-2 rounded-full hover:bg-secondary/50 transition-colors">
                            <Globe className="h-5 w-5 text-muted-foreground" />
                            <span className="sr-only">Switch Language</span>
                        </button>
                    </div>
                    <button
                        onClick={() => {
                            sessionStorage.removeItem("admin_auth");
                            setIsAuthenticated(false);
                            setTournaments([]);
                        }}
                        className="text-xs text-muted-foreground hover:text-destructive underline"
                    >
                        Logout
                    </button>
                </header>

                {/* Create New */}
                <div className="glass-card p-6 rounded-xl space-y-4">
                    <h2 className="text-lg font-bold">{t('admin.create.title')}</h2>
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Name Input */}
                            <input
                                type="text"
                                placeholder={t('admin.create.placeholder')}
                                value={newTournamentName}
                                onChange={(e) => {
                                    setNewTournamentName(e.target.value);
                                    if (e.target.value.trim()) setCreateError("");
                                }}
                                className={cn(
                                    "w-full bg-secondary border-transparent focus:border-primary rounded-lg px-4 py-2 outline-none transition-colors border",
                                    createError ? "border-red-500/50 focus:border-red-500" : "border-transparent"
                                )}
                            />

                            {/* Type Selection */}
                            <select
                                value={newType}
                                onChange={(e) => setNewType(e.target.value as any)}
                                className="w-full bg-secondary border-transparent focus:border-primary rounded-lg px-4 py-2 outline-none transition-colors border appearance-none"
                            >
                                <option value="U10">{t('type.U10')}</option>
                                <option value="NoMoreMeta">{t('type.NoMoreMeta')}</option>
                                <option value="Open">{t('type.Open')}</option>
                            </select>
                        </div>

                        {/* Custom Ban List Toggle - Only for NMM or Open */}
                        {(newType === 'NoMoreMeta' || newType === 'Open') && (
                            <div className="space-y-2 p-3 bg-secondary/30 rounded-lg border border-white/5">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="customBan"
                                        checked={isCustomBanList}
                                        onChange={(e) => setIsCustomBanList(e.target.checked)}
                                        className="rounded border-white/20 bg-secondary"
                                    />
                                    <label htmlFor="customBan" className="text-sm font-bold text-muted-foreground cursor-pointer select-none">
                                        Custom Ban List
                                    </label>
                                </div>

                                {isCustomBanList && (
                                    <div>
                                        <MultiVisualSelector
                                            label="Select Banned Beyblades"
                                            initialSelected={customBanListInput.split(',').map(s => s.trim()).filter(Boolean)}
                                            options={allBeys}
                                            onConfirm={(selected) => setCustomBanListInput(selected.join(', '))}
                                            onClose={() => { }} // Not used in inline
                                            variant="inline"
                                            className="mt-2"
                                        />
                                        <p className="text-[10px] text-muted-foreground mt-1 text-right">
                                            {customBanListInput.split(',').filter(s => s.trim()).length} Items Selected
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex justify-end">
                            <button
                                disabled={creating}
                                type="submit"
                                className="bg-primary text-black font-bold px-8 py-2 rounded-lg hover:bg-primary/90 flex items-center justify-center gap-2 min-w-[120px]"
                            >
                                {creating ? <Loader2 className="animate-spin h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                {t('admin.create.btn')}
                            </button>
                        </div>

                        {createError && <p className="text-sm text-red-500 font-bold px-1 text-center md:text-right">{createError}</p>}
                    </form>
                </div>

                {/* List */}
                <div className="space-y-4">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <h2 className="text-lg font-bold">Tournaments</h2>
                        <input
                            type="text"
                            placeholder="Search tournaments..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-secondary/50 border border-transparent focus:border-primary/50 rounded-lg px-3 py-1.5 text-sm outline-none w-full md:w-64 transition-colors"
                        />
                    </div>
                    {loading ? (
                        <div className="flex justify-center p-8"><Loader2 className="animate-spin text-muted-foreground" /></div>
                    ) : (
                        <div className="space-y-8">
                            {/* Active Tournaments */}
                            <div className="space-y-4">
                                <h2 className="text-lg font-bold flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                    {t('admin.list.active')}
                                </h2>
                                <div className="grid gap-4">
                                    {filteredTournaments.filter(t => t.Status === 'OPEN').map((t) => (
                                        <div key={t.TournamentID} className="glass-card p-5 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 group hover:border-primary/50 transition-colors bg-gradient-to-r from-transparent to-primary/5">
                                            <div>
                                                <h3 className="font-bold text-lg text-white">{t.Name}</h3>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                                    <span className="px-1.5 py-0.5 rounded font-bold uppercase bg-green-500/20 text-green-500">
                                                        {t.Status}
                                                    </span>
                                                    <span>• Created {new Date(t.CreatedAt).toLocaleDateString()}</span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                                                <div className="flex items-center gap-1">
                                                    <Link
                                                        href={`/register/${t.TournamentID}`}
                                                        target="_blank"
                                                        className="p-2 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                                                        title="Open Registration Link"
                                                    >
                                                        <ExternalLink className="h-5 w-5" />
                                                    </Link>

                                                    <button
                                                        onClick={() => handleEndTournament(t)}
                                                        className="p-2 hover:bg-red-500/10 text-red-500 rounded-lg transition-colors"
                                                        title="End Tournament"
                                                    >
                                                        <LockKeyhole className="h-5 w-5" />
                                                    </button>
                                                </div>
                                                <Link
                                                    href={`/admin/tournament/${t.TournamentID}`}
                                                    className="bg-secondary hover:bg-primary hover:text-black text-foreground px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2"
                                                >
                                                    Manage <ArrowRight className="h-4 w-4" />
                                                </Link>
                                            </div>
                                        </div>
                                    ))}
                                    {filteredTournaments.filter(t => t.Status === 'OPEN').length === 0 && (
                                        <div className="text-center p-8 text-muted-foreground bg-secondary/10 rounded-xl border border-white/5 font-mono text-sm">
                                            No active tournaments.
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Past Tournaments */}
                            {filteredTournaments.filter(t => t.Status !== 'OPEN').length > 0 && (
                                <div className="space-y-4 pt-4 border-t border-white/5">
                                    <h2 className="text-lg font-bold text-muted-foreground flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-gray-600" />
                                        {t('admin.list.past')}
                                    </h2>
                                    <div className="grid gap-4">
                                        {filteredTournaments.filter(t => t.Status !== 'OPEN').map((t) => (
                                            <div key={t.TournamentID} className="glass-card p-5 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 opacity-60 hover:opacity-100 transition-opacity grayscale hover:grayscale-0">
                                                <div>
                                                    <h3 className="font-bold text-lg">{t.Name}</h3>
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                                        <span className="px-1.5 py-0.5 rounded font-bold uppercase bg-secondary text-muted-foreground">
                                                            {t.Status}
                                                        </span>
                                                        <span>• Ended {new Date(t.CreatedAt).toLocaleDateString()}</span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                                                    <Link
                                                        href={`/admin/tournament/${t.TournamentID}`}
                                                        className="bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2"
                                                    >
                                                        View History <ArrowRight className="h-4 w-4" />
                                                    </Link>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div >

            <Modal
                isOpen={modalConfig.isOpen}
                onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
                title={modalConfig.title}
                description={modalConfig.desc}
                type={modalConfig.type}
                variant={modalConfig.variant}
                onConfirm={modalConfig.onConfirm}
                confirmText={modalConfig.confirmText || (modalConfig.type === 'confirm' ? (modalConfig.variant === 'destructive' ? 'Confirm End' : 'Confirm') : 'OK')}
            />


        </div >
    );
}
