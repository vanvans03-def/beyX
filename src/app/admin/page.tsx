"use client";

import { useEffect, useState, useMemo } from "react";
import { Loader2, Plus, QrCode, Copy, LockKeyhole, ArrowRight, ExternalLink, Clock, UserPlus, Store, Pencil, Check, X, Key } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";
import { toast } from "sonner";
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
    const router = useRouter();
    const { t, lang, toggleLang } = useTranslation();
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [events, setEvents] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'tournaments' | 'events'>('tournaments');
    const [userProfile, setUserProfile] = useState<{ username: string, shop_name: string, challonge_api_key?: string } | null>(null);
    const [isEditingShop, setIsEditingShop] = useState(false);
    const [shopNameInput, setShopNameInput] = useState("");

    // API Key Edit State
    const [isEditingKey, setIsEditingKey] = useState(false);
    const [apiKeyInput, setApiKeyInput] = useState("");

    // Event Form State
    const [newEvent, setNewEvent] = useState({
        title: "",
        date: "",
        time: "",
        location: "Board Game Station @สายใต้ใหม่",
        map_link: "https://share.google/Ss8p82Uk4KHtWc4fe",
        facebook_link: "",
        description: ""
    });
    const [eventImage, setEventImage] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);

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

    // Auth Check - Removed legacy client-side check as Middleware handles it now.
    useEffect(() => {
        fetchTournaments();
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const res = await fetch("/api/admin/profile");
            const json = await res.json();
            if (json.success) {
                setUserProfile(json.user);
                setShopNameInput(json.user.shop_name || json.user.username);
                setApiKeyInput(json.user.challonge_api_key || "");
            }
        } catch (e) {
            console.error("Failed to fetch profile", e);
        }
    };

    const handleUpdateShopName = async () => {
        if (!shopNameInput.trim()) return;
        try {
            const res = await fetch("/api/admin/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ shop_name: shopNameInput })
            });
            if (res.ok) {
                setUserProfile(prev => prev ? { ...prev, shop_name: shopNameInput } : null);
                setIsEditingShop(false);
                toast.success("Shop name updated successfully");
            }
        } catch (e) {
            toast.error("Failed to update shop name");
        }
    };

    const handleUpdateApiKey = async () => {
        if (!apiKeyInput.trim()) return;
        try {
            const res = await fetch("/api/admin/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ challonge_api_key: apiKeyInput })
            });
            if (res.ok) {
                setUserProfile(prev => prev ? { ...prev, challonge_api_key: apiKeyInput } : null);
                setIsEditingKey(false);
                toast.success("API Key updated successfully");
            }
        } catch (e) {
            toast.error("Failed to update API Key");
        }
    };

    const fetchTournaments = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/tournaments");
            const json = await res.json();
            if (json.success) {
                setTournaments(json.data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const fetchEvents = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/events");
            const json = await res.json();
            if (json.success) {
                setEvents(json.data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const [eventSystemActive, setEventSystemActive] = useState(true);

    useEffect(() => {
        // Fetch system status
        fetch("/api/settings?key=event_system_active")
            .then(r => r.json())
            .then(d => {
                if (d.success) setEventSystemActive(d.value);
            })
            .catch(e => console.error("Failed to fetch settings", e));

        if (activeTab === 'tournaments') fetchTournaments();
        else fetchEvents();
    }, [activeTab]);

    const handleToggleEventSystem = async () => {
        const newValue = !eventSystemActive;
        // Optimistic update
        setEventSystemActive(newValue);
        try {
            await fetch("/api/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ key: "event_system_active", value: newValue })
            });
        } catch (e) {
            console.error(e);
            setEventSystemActive(!newValue); // Revert
            alert("Failed to update setting");
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
            } else {
                // Handle specific errors like Challonge Connection
                if (json.error && json.error.includes("Challonge")) {
                    setModalConfig({
                        isOpen: true,
                        title: "Challonge Connection Failed",
                        desc: "Could not create tournament on Challonge. Please check your API Key in the dashboard header.",
                        type: "alert",
                        variant: "destructive"
                    });
                } else {
                    throw new Error(json.error || "Failed");
                }
            }
        } catch (e: any) {
            setModalConfig({
                isOpen: true,
                title: "Error",
                desc: e.message || "Failed to create tournament.",
                type: "alert",
                variant: "destructive"
            });
        } finally {
            setCreating(false);
        }
    };


    // Editing State
    const [editingEventId, setEditingEventId] = useState<string | null>(null);

    const handleEditEvent = (event: any) => {
        setEditingEventId(event.id);
        const d = new Date(event.date);

        // Format date/time for inputs in LOCAL TIME
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const timeStr = `${hours}:${minutes}`;

        setNewEvent({
            title: event.title,
            date: dateStr,
            time: timeStr,
            location: event.location,
            map_link: event.map || "", // Mapped from API 'map'
            facebook_link: event.fb || "", // Mapped from API 'fb'
            description: event.description || ""
        });
        // Note: Image processing for edit is tricky if not changing. 
        // We will only upload if eventImage is not null.
        setActiveTab('events'); // Ensure tab
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const cancelEdit = () => {
        setEditingEventId(null);
        setNewEvent({
            title: "",
            date: "",
            time: "",
            location: "Board Game Station @สายใต้ใหม่",
            map_link: "https://share.google/Ss8p82Uk4KHtWc4fe",
            facebook_link: "",
            description: ""
        });
        setEventImage(null);
    };

    const handleSaveEvent = async (e: React.FormEvent) => {
        e.preventDefault();
        setUploading(true);
        try {
            let imageUrl = undefined; // Undefined means don't update image

            // 1. Upload Image if exists
            if (eventImage) {
                const res = await fetch(`/api/upload?filename=${eventImage.name}`, {
                    method: 'POST',
                    body: eventImage,
                });
                const blob = await res.json();
                imageUrl = blob.url;
            }

            // 2. Create or Update Event
            // Combine date and time
            const eventDate = new Date(`${newEvent.date}T${newEvent.time || '00:00'}`);

            const payload: any = {
                title: newEvent.title,
                description: newEvent.description,
                date: eventDate.toISOString(),
                location: newEvent.location,
                map_link: newEvent.map_link,
                facebook_link: newEvent.facebook_link,
            };

            if (imageUrl) payload.image_url = imageUrl;

            let res;
            if (editingEventId) {
                // Update
                res = await fetch("/api/admin/events", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: editingEventId, ...payload })
                });
            } else {
                // Create
                if (!imageUrl && !editingEventId) {
                    // Start fresh often needs image, but optional? Let's allow optional.
                }
                // If creating and no image uploaded, pass empty string or handled by backend? 
                // Currently backend expects image_url string.
                if (!payload.image_url) payload.image_url = "";

                res = await fetch("/api/admin/events", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
            }

            if (res.ok) {
                // Reset to defaults
                setNewEvent({
                    title: "",
                    date: "",
                    time: "",
                    location: "Board Game Station @สายใต้ใหม่",
                    map_link: "https://share.google/Ss8p82Uk4KHtWc4fe",
                    facebook_link: "",
                    description: ""
                });
                setEditingEventId(null);
                setEventImage(null);
                fetchEvents();
            } else {
                throw new Error("Failed to save event");
            }

        } catch (e: any) {
            setModalConfig({
                isOpen: true,
                title: "Error",
                desc: e.message || "Failed to save event.",
                type: "alert",
                variant: "destructive"
            });
        } finally {
            setUploading(false);
        }
    };

    const handleDeleteEvent = async (id: string) => {
        if (!confirm("Delete this event?")) return;
        try {
            await fetch(`/api/admin/events?id=${id}`, { method: 'DELETE' });
            fetchEvents();
        } catch (e) { alert("Failed"); }
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

    // Removed legacy auth UI block

    return (
        <div className="min-h-screen bg-background relative">
            {/* Dynamic Background */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] animate-pulse-slow" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[100px] animate-pulse-slow delay-1000" />
                <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.05]" />
            </div>

            <div className="relative z-10 p-4 md:p-6">
                <div className="max-w-4xl mx-auto space-y-6 md:space-y-8">
                    <header className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <style dangerouslySetInnerHTML={{
                            __html: `
                        input[type="date"]::-webkit-calendar-picker-indicator,
                        input[type="time"]::-webkit-calendar-picker-indicator {
                            filter: invert(48%) sepia(79%) saturate(2476%) hue-rotate(86deg) brightness(118%) contrast(119%);
                            cursor: pointer;
                        }
                    `}} />
                        <div className="flex items-center gap-4">
                            <div className="flex flex-col">
                                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-blue-500 bg-clip-text text-transparent text-center md:text-left">
                                    {t('admin.title')}
                                </h1>
                                {userProfile && (
                                    <div className="flex flex-col gap-1 mt-1">
                                        {/* Shop Name Edit */}
                                        <div className="flex items-center gap-2 text-sm text-gray-400">
                                            {isEditingShop ? (
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        value={shopNameInput}
                                                        onChange={e => setShopNameInput(e.target.value)}
                                                        className="bg-black/20 border border-white/10 rounded px-2 py-0.5 text-white text-sm outline-none focus:border-primary"
                                                    />
                                                    <button onClick={handleUpdateShopName} className="text-green-400 hover:text-green-300"><Check className="w-4 h-4" /></button>
                                                    <button onClick={() => setIsEditingShop(false)} className="text-red-400 hover:text-red-300"><X className="w-4 h-4" /></button>
                                                </div>
                                            ) : (
                                                <>
                                                    <Store className="w-4 h-4" />
                                                    <span>{userProfile.shop_name}</span>
                                                    <button onClick={() => setIsEditingShop(true)} className="text-gray-500 hover:text-white transition-colors">
                                                        <Pencil className="w-3 h-3" />
                                                    </button>
                                                </>
                                            )}
                                        </div>

                                        {/* API Key Edit */}
                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                            {isEditingKey ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="flex items-center gap-1 bg-black/20 border border-white/10 rounded px-2 py-0.5">
                                                        <Key className="w-3 h-3 text-primary" />
                                                        <input
                                                            value={apiKeyInput}
                                                            onChange={e => setApiKeyInput(e.target.value)}
                                                            className="bg-transparent text-white text-xs outline-none w-[150px]"
                                                            placeholder="Challonge API Key"
                                                        />
                                                    </div>
                                                    <button onClick={handleUpdateApiKey} className="text-green-400 hover:text-green-300"><Check className="w-3 h-3" /></button>
                                                    <button onClick={() => setIsEditingKey(false)} className="text-red-400 hover:text-red-300"><X className="w-3 h-3" /></button>
                                                </div>
                                            ) : (
                                                <>
                                                    <Key className="w-3 h-3" />
                                                    <span>Status: {userProfile.challonge_api_key ? "Key Configured" : "No Key"}</span>
                                                    <button onClick={() => setIsEditingKey(true)} className="text-gray-500 hover:text-white transition-colors underline">
                                                        Edit API Key
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <button onClick={toggleLang} className="p-2 rounded-full hover:bg-secondary/50 transition-colors">
                                <Globe className="h-5 w-5 text-muted-foreground" />
                                <span className="sr-only">Switch Language</span>
                            </button>
                        </div>

                        {/* Tab Navigation */}
                        <div className="flex bg-secondary/30 p-1 rounded-lg">
                            <button
                                onClick={() => setActiveTab('tournaments')}
                                className={cn("px-4 py-1.5 rounded-md text-sm font-medium transition-all", activeTab === 'tournaments' ? "bg-primary text-black shadow-lg" : "text-muted-foreground hover:text-foreground")}
                            >
                                Tournaments
                            </button>
                            <button
                                onClick={() => setActiveTab('events')}
                                className={cn("px-4 py-1.5 rounded-md text-sm font-medium transition-all", activeTab === 'events' ? "bg-primary text-black shadow-lg" : "text-muted-foreground hover:text-foreground")}
                            >
                                Events
                            </button>
                        </div>

                        {/* Global Event Toggle */}
                        {activeTab === 'events' && (
                            <div className="flex items-center gap-2 bg-secondary/20 px-3 py-1.5 rounded-lg border border-white/5">
                                <span className="text-xs font-bold text-muted-foreground uppercase">Event System</span>
                                <button
                                    onClick={handleToggleEventSystem}
                                    className={cn(
                                        "w-10 h-5 rounded-full relative transition-colors duration-300 focus:outline-none",
                                        eventSystemActive ? "bg-green-500" : "bg-gray-600"
                                    )}
                                >
                                    <div className={cn(
                                        "absolute top-1 left-1 bg-white w-3 h-3 rounded-full transition-transform duration-300 shadow",
                                        eventSystemActive ? "translate-x-5" : "translate-x-0"
                                    )} />
                                </button>
                            </div>
                        )}

                        <div className="flex items-center gap-4">
                            <Link
                                href="/admin/users/create"
                                className="flex items-center gap-2 bg-secondary/50 hover:bg-secondary px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors border border-white/5"
                            >
                                <UserPlus className="w-4 h-4" />
                                <span>Add Shop</span>
                            </Link>

                            <button
                                onClick={async () => {
                                    // Logout via API to clear cookie
                                    await fetch('/api/auth/logout', { method: 'POST' });
                                    // Proper logout:
                                    document.cookie = 'session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
                                    router.refresh();
                                    router.push("/");
                                }}
                                className="text-xs text-muted-foreground hover:text-destructive underline"
                            >
                                Logout
                            </button>
                        </div>
                    </header>

                    {activeTab === 'tournaments' ? (
                        <>
                            {/* Create New Tournament */}
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

                                    {/* Custom Ban List Toggle */}
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
                                                        onClose={() => { }}
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

                            {/* Tournament List */}
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
                        </>
                    ) : (
                        // EVENTS TAB
                        <div className="space-y-8">
                            {/* Create Event */}
                            <div className="glass-card p-6 rounded-xl space-y-4">
                                <h2 className="text-lg font-bold">
                                    {editingEventId ? "Edit Event" : "New Announcement / Event"}
                                </h2>
                                <form onSubmit={handleSaveEvent} className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <input
                                            required
                                            placeholder="Event Title"
                                            value={newEvent.title}
                                            onChange={e => setNewEvent({ ...newEvent, title: e.target.value })}
                                            className="bg-secondary border-transparent focus:border-primary rounded-lg px-4 py-2 outline-none border transition-colors"
                                        />
                                        <input
                                            type="date"
                                            required
                                            value={newEvent.date}
                                            onChange={e => setNewEvent({ ...newEvent, date: e.target.value })}
                                            className="bg-secondary border-transparent focus:border-primary rounded-lg px-4 py-2 outline-none border transition-colors"
                                        />
                                        {/* Custom 24h Time Picker */}
                                        <div className="flex gap-2">
                                            <select
                                                value={newEvent.time ? newEvent.time.split(':')[0] : '00'}
                                                onChange={(e) => {
                                                    const h = e.target.value;
                                                    const m = newEvent.time ? newEvent.time.split(':')[1] || '00' : '00';
                                                    setNewEvent({ ...newEvent, time: `${h}:${m}` });
                                                }}
                                                className="bg-secondary border-transparent focus:border-primary rounded-lg px-2 py-2 outline-none border transition-colors flex-1 appearance-none text-center cursor-pointer"
                                            >
                                                {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map(h => (
                                                    <option key={h} value={h}>{h}</option>
                                                ))}
                                            </select>
                                            <span className="flex items-center text-muted-foreground font-bold">:</span>
                                            <select
                                                value={newEvent.time ? newEvent.time.split(':')[1] : '00'}
                                                onChange={(e) => {
                                                    const m = e.target.value;
                                                    const h = newEvent.time ? newEvent.time.split(':')[0] || '00' : '00';
                                                    setNewEvent({ ...newEvent, time: `${h}:${m}` });
                                                }}
                                                className="bg-secondary border-transparent focus:border-primary rounded-lg px-2 py-2 outline-none border transition-colors flex-1 appearance-none text-center cursor-pointer"
                                            >
                                                {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map(m => (
                                                    <option key={m} value={m}>{m}</option>
                                                ))}
                                            </select>
                                            <div className="flex items-center justify-center px-2">
                                                <Clock className="w-5 h-5 text-[#4ade80]" />
                                            </div>
                                        </div>
                                        <input
                                            placeholder="Location"
                                            value={newEvent.location}
                                            onChange={e => setNewEvent({ ...newEvent, location: e.target.value })}
                                            className="bg-secondary border-transparent focus:border-primary rounded-lg px-4 py-2 outline-none border transition-colors"
                                        />
                                        <input
                                            placeholder="Google Map Link"
                                            value={newEvent.map_link}
                                            onChange={e => setNewEvent({ ...newEvent, map_link: e.target.value })}
                                            className="bg-secondary border-transparent focus:border-primary rounded-lg px-4 py-2 outline-none border transition-colors"
                                        />
                                        <input
                                            placeholder="Facebook Post Link"
                                            value={newEvent.facebook_link}
                                            onChange={e => setNewEvent({ ...newEvent, facebook_link: e.target.value })}
                                            className="bg-secondary border-transparent focus:border-primary rounded-lg px-4 py-2 outline-none border transition-colors"
                                        />
                                    </div>
                                    <textarea
                                        placeholder="Description / Details"
                                        value={newEvent.description}
                                        onChange={e => setNewEvent({ ...newEvent, description: e.target.value })}
                                        className="w-full bg-secondary border-transparent focus:border-primary rounded-lg px-4 py-2 outline-none border transition-colors min-h-[100px]"
                                    />
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Banner Image {editingEventId && "(Leave empty to keep existing)"}</label>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={e => setEventImage(e.target.files?.[0] || null)}
                                            className="block w-full text-sm text-muted-foreground bg-secondary rounded-lg cursor-pointer focus:outline-none"
                                        />
                                    </div>

                                    <div className="flex justify-end gap-2">
                                        {editingEventId && (
                                            <button
                                                type="button"
                                                onClick={cancelEdit}
                                                className="bg-secondary text-white font-bold px-6 py-2 rounded-lg hover:bg-secondary/80"
                                            >
                                                Cancel
                                            </button>
                                        )}
                                        <button
                                            disabled={uploading}
                                            type="submit"
                                            className="bg-primary text-black font-bold px-8 py-2 rounded-lg hover:bg-primary/90 flex items-center justify-center gap-2 min-w-[120px]"
                                        >
                                            {uploading ? <Loader2 className="animate-spin h-4 w-4" /> : (editingEventId ? <Copy className="h-4 w-4" /> : <Plus className="h-4 w-4" />)}
                                            {editingEventId ? "Update Event" : "Create Event"}
                                        </button>
                                    </div>
                                </form>
                            </div>

                            {/* List */}
                            <div className="space-y-4">
                                <h2 className="text-lg font-bold">Upcoming Events</h2>
                                {loading ? <Loader2 className="animate-spin mx-auto" /> : (
                                    <div className="grid gap-4" data-aos="fade-up" data-aos-delay="200">
                                        {events.map(e => (
                                            <div key={e.id} className="glass-card p-4 rounded-xl flex gap-4 items-start">
                                                {e.image && <img src={e.image} className="w-24 h-24 object-cover rounded-lg bg-black/50" />}
                                                <div className="flex-1">
                                                    <h3 className="font-bold text-lg">{e.title}</h3>
                                                    <p className="text-sm text-muted-foreground">{new Date(e.date).toLocaleString('en-GB', { hour12: false })} @ {e.location}</p>
                                                    {e.fb && <a href={e.fb} target="_blank" className="text-xs text-primary underline mt-1 block">Facebook</a>}
                                                </div>
                                                <div className="flex flex-col gap-2">
                                                    <button onClick={() => handleEditEvent(e)} className="text-primary p-2 hover:bg-white/5 rounded border border-primary/20">Edit</button>
                                                    <button onClick={() => handleDeleteEvent(e.id)} className="text-red-500 p-2 hover:bg-white/5 rounded border border-red-500/20">Delete</button>
                                                </div>
                                            </div>
                                        ))}
                                        {events.length === 0 && <p className="text-muted-foreground text-center py-8">No events found.</p>}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}


                </div >

            </div>

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
