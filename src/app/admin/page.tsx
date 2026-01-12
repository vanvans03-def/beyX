"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, QrCode, Copy, LockKeyhole, ArrowRight, ExternalLink } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Tournament = {
    TournamentID: string;
    Name: string;
    Status: string;
    CreatedAt: string;
};

export default function AdminPage() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [passwordInput, setPasswordInput] = useState("");
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [newTournamentName, setNewTournamentName] = useState("");
    const [createError, setCreateError] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);

    // Auth Check
    useEffect(() => {
        const saved = sessionStorage.getItem("admin_auth");
        if (saved === "CYEAH") {
            setIsAuthenticated(true);
            fetchTournaments();
        }
    }, []);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (passwordInput === "CYEAH") {
            setIsAuthenticated(true);
            sessionStorage.setItem("admin_auth", "CYEAH");
            fetchTournaments();
        } else {
            alert("Access Denied");
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
        try {
            const res = await fetch("/api/admin/tournaments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newTournamentName })
            });
            const json = await res.json();
            if (json.success) {
                setNewTournamentName("");
                fetchTournaments();
            }
        } catch (e) {
            alert("Failed to create");
        } finally {
            setCreating(false);
        }
    };

    const filteredTournaments = tournaments.filter(t =>
        t.Name.toLowerCase().includes(searchQuery.toLowerCase())
    );

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
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background p-6">
            <div className="max-w-4xl mx-auto space-y-8">
                <header className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-blue-500 bg-clip-text text-transparent">
                        Tournament Manager
                    </h1>
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
                    <h2 className="text-lg font-bold">Create New Tournament</h2>
                    <form onSubmit={handleCreate} className="space-y-2">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Tournament Name (e.g. Jan Weekly #1)"
                                value={newTournamentName}
                                onChange={(e) => {
                                    setNewTournamentName(e.target.value);
                                    if (e.target.value.trim()) setCreateError("");
                                }}
                                className={cn(
                                    "flex-1 bg-secondary border-transparent focus:border-primary rounded-lg px-4 py-2 outline-none transition-colors border",
                                    createError ? "border-red-500/50 focus:border-red-500" : "border-transparent"
                                )}
                            />
                            <button
                                disabled={creating}
                                type="submit"
                                className="bg-primary text-black font-bold px-6 py-2 rounded-lg hover:bg-primary/90 flex items-center gap-2"
                            >
                                {creating ? <Loader2 className="animate-spin h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                Create
                            </button>
                        </div>
                        {createError && <p className="text-sm text-red-500 font-bold px-1">{createError}</p>}
                    </form>
                </div>

                {/* List */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold">Active Tournaments</h2>
                        <input
                            type="text"
                            placeholder="Search tournaments..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-secondary/50 border border-transparent focus:border-primary/50 rounded-lg px-3 py-1.5 text-sm outline-none w-64 transition-colors"
                        />
                    </div>
                    {loading ? (
                        <div className="flex justify-center p-8"><Loader2 className="animate-spin text-muted-foreground" /></div>
                    ) : (
                        <div className="grid gap-4">
                            {filteredTournaments.map((t) => (
                                <div key={t.TournamentID} className="glass-card p-5 rounded-xl flex items-center justify-between group hover:border-primary/50 transition-colors">
                                    <div>
                                        <h3 className="font-bold text-lg">{t.Name}</h3>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                            <span className={cn(
                                                "px-1.5 py-0.5 rounded font-bold uppercase",
                                                t.Status === "OPEN" ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500"
                                            )}>{t.Status}</span>
                                            <span>• Created {new Date(t.CreatedAt).toLocaleDateString()}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-1">
                                            <Link
                                                href={`/register/${t.TournamentID}`}
                                                target="_blank"
                                                className="p-2 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                                                title="Open Registration Link"
                                            >
                                                <ExternalLink className="h-5 w-5" />
                                            </Link>

                                            {t.Status === "OPEN" && (
                                                <button
                                                    onClick={async () => {
                                                        if (confirm(`End tournament "${t.Name}"? This will disable new registrations.`)) {
                                                            try {
                                                                const res = await fetch("/api/admin/tournaments", {
                                                                    method: "PATCH",
                                                                    headers: { "Content-Type": "application/json" },
                                                                    body: JSON.stringify({ tournamentId: t.TournamentID, status: "CLOSED" })
                                                                });
                                                                if (res.ok) fetchTournaments();
                                                            } catch (e) { alert("Failed to update"); }
                                                        }
                                                    }}
                                                    className="p-2 hover:bg-red-500/10 text-red-500 rounded-lg transition-colors"
                                                    title="End Tournament"
                                                >
                                                    <LockKeyhole className="h-5 w-5" />
                                                </button>
                                            )}
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
                            {filteredTournaments.length === 0 && (
                                <div className="text-center p-8 text-muted-foreground bg-secondary/20 rounded-xl border-dashed border border-border">
                                    No tournaments found.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
