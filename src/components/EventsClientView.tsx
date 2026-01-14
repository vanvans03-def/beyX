"use client";

import { useState, useEffect } from "react";
import { EventCalendar } from "@/components/EventCalendar";
import { Calendar, MapPin, Facebook, ExternalLink, Clock, Share2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type Event = {
    id: string;
    title: string;
    description: string;
    event_date: Date;
    location: string;
    map_link: string;
    facebook_link: string;
    image_url: string;
    created_at: Date;
};

export function EventsClientView({ initialEvents, initialSelectedId }: { initialEvents: any[], initialSelectedId?: string }) {
    // Hydrate dates since they come as props (serialized)
    const events = initialEvents.map(e => ({
        ...e,
        event_date: new Date(e.event_date),
        created_at: new Date(e.created_at)
    }));

    const now = new Date();

    // Sort logic
    const futureEvents = events.filter(e => e.event_date > now);

    // Determine default event: 
    // 1. If ID passed and exists -> use it
    // 2. Else -> Soonest Future Event
    // 3. Else -> Latest Past Event
    let defaultEvent = null;
    if (initialSelectedId) {
        defaultEvent = events.find(e => e.id === initialSelectedId);
    }

    if (!defaultEvent) {
        defaultEvent = futureEvents.length > 0
            ? futureEvents.sort((a, b) => a.event_date.getTime() - b.event_date.getTime())[0]
            : events.sort((a, b) => b.event_date.getTime() - a.event_date.getTime())[0];
    }

    const [selectedEvent, setSelectedEvent] = useState<Event | null>(defaultEvent || null);
    const [copied, setCopied] = useState(false);

    // Sync URL when selectedEvent changes (optional, but good for "share current view")
    // Only doing this on user interaction/change, not initial load to avoid double history
    const handleSelectEvent = (event: Event) => {
        setSelectedEvent(event);
        const url = new URL(window.location.href);
        url.searchParams.set('id', event.id);
        window.history.replaceState({}, '', url.toString());
        setCopied(false); // Reset copy status
    };

    const handleShare = () => {
        if (!selectedEvent) return;
        const url = new URL(window.location.origin + '/events');
        url.searchParams.set('id', selectedEvent.id);
        navigator.clipboard.writeText(url.toString());
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="space-y-8">
            {/* Featured / Selected Event Card */}
            {selectedEvent ? (
                <div className="glass-card rounded-3xl overflow-hidden border border-primary/20 shadow-2xl shadow-primary/10 relative group min-h-[400px] flex flex-col md:flex-row">

                    {/* Portrait/Banner Friendly Image Section */}
                    <div className="relative w-full md:w-5/12 min-h-[300px] md:min-h-full overflow-hidden bg-black">
                        {/* Blurred Background for Portrait Images */}
                        {selectedEvent.image_url && (
                            <div
                                className="absolute inset-0 bg-cover bg-center opacity-40 blur-xl scale-110"
                                style={{ backgroundImage: `url(${selectedEvent.image_url})` }}
                            />
                        )}

                        {/* Foreground Image - Object Contain to fit portrait wholly */}
                        {selectedEvent.image_url ? (
                            <img
                                src={selectedEvent.image_url}
                                alt={selectedEvent.title}
                                className="absolute inset-0 w-full h-full object-contain z-10 transition-transform hover:scale-105 duration-700"
                            />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center bg-secondary/50">
                                <Calendar className="w-16 h-16 text-muted-foreground/50" />
                            </div>
                        )}

                        {/* Status Badge */}
                        {selectedEvent.event_date < now && (
                            <div className="absolute top-4 right-4 z-20 bg-black/80 text-white text-xs font-bold px-3 py-1 rounded-full border border-white/20">
                                ENDED
                            </div>
                        )}
                        {selectedEvent.event_date > now && (
                            <div className="absolute top-4 left-4 z-20 bg-primary text-black text-xs font-bold px-3 py-1 rounded-full flex items-center gap-2 shadow-lg shadow-primary/20 animate-pulse">
                                <div className="w-2 h-2 rounded-full bg-black" />
                                UPCOMING
                            </div>
                        )}

                        {/* Share Button (Mobile friendly position) */}
                        <button
                            onClick={handleShare}
                            className="absolute top-4 right-4 md:right-auto md:left-auto z-30 bg-black/50 hover:bg-black/80 backdrop-blur text-white p-2 rounded-full border border-white/20 transition-all active:scale-95"
                            title="Copy Link"
                            style={selectedEvent.event_date < now ? { right: 'auto', left: '1rem' } : {}}
                        >
                            {copied ? <Check className="w-5 h-5 text-green-400" /> : <Share2 className="w-5 h-5" />}
                        </button>
                    </div>

                    {/* Content Section */}
                    <div className="flex-1 p-8 md:p-10 flex flex-col justify-end bg-gradient-to-l from-background to-background/90 z-10">
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-3xl md:text-5xl font-black text-white leading-tight uppercase italic drop-shadow-lg">
                                    {selectedEvent.title}
                                </h2>
                                <div className="mt-4 space-y-2 text-lg text-gray-300">
                                    <p className="flex items-center gap-3 font-medium text-primary">
                                        <Calendar className="w-5 h-5" />
                                        {selectedEvent.event_date.toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                    </p>
                                    <p className="flex items-center gap-3 font-medium text-white/80">
                                        <Clock className="w-5 h-5 text-primary" />
                                        {selectedEvent.event_date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false })} น.
                                    </p>
                                    <p className="flex items-center gap-3 text-base text-gray-400">
                                        <MapPin className="w-5 h-5" />
                                        {selectedEvent.location}
                                    </p>
                                </div>
                            </div>

                            <p className="text-sm text-gray-400 leading-relaxed border-l-4 border-primary/30 pl-4">
                                {selectedEvent.description || "No description provided."}
                            </p>

                            <div className="flex flex-wrap gap-3 pt-4">
                                {selectedEvent.map_link && (
                                    <a href={selectedEvent.map_link} target="_blank" className="flex items-center gap-2 bg-secondary/50 hover:bg-white text-white hover:text-black px-6 py-3 rounded-xl font-bold transition-all border border-white/10 hover:border-white">
                                        <MapPin className="w-4 h-4" /> Google Map
                                    </a>
                                )}
                                {selectedEvent.facebook_link && (
                                    <a href={selectedEvent.facebook_link} target="_blank" className="flex items-center gap-2 bg-[#1877F2] hover:bg-[#166fe5] text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-blue-900/20">
                                        <Facebook className="w-4 h-4" /> Facebook
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="p-12 text-center border border-dashed border-white/10 rounded-3xl">
                    <p className="text-muted-foreground">Select an event to view details.</p>
                </div>
            )}

            {/* Calendar / List Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Web Calendar */}
                <div className="md:col-span-2 glass-card p-6 rounded-2xl relative overflow-hidden flex flex-col">
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-primary" /> Tournament Calendar
                    </h3>
                    <div className="flex-1">
                        {/* Calendar interaction could be added here later if needed */}
                        <EventCalendar
                            events={events.map(e => ({ date: e.event_date, title: e.title }))}
                            onDateSelect={(date) => {
                                // Find event on this date
                                const evt = events.find(e =>
                                    e.event_date.getDate() === date.getDate() &&
                                    e.event_date.getMonth() === date.getMonth() &&
                                    e.event_date.getFullYear() === date.getFullYear()
                                );
                                if (evt) handleSelectEvent(evt);
                            }}
                        />
                    </div>
                    <p className="text-xs text-muted-foreground mt-4 text-center">* Dates marked have events.</p>
                </div>

                {/* List of other events */}
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                    <h3 className="text-lg font-bold text-muted-foreground uppercase tracking-wider text-sm sticky top-0 bg-background/95 backdrop-blur z-10 py-2">
                        Event List
                    </h3>
                    <div className="space-y-3">
                        {events.map((e) => {
                            const isPast = new Date() > new Date(e.event_date);
                            const isSelected = selectedEvent?.id === e.id;

                            return (
                                <button
                                    key={e.id}
                                    onClick={() => handleSelectEvent(e)}
                                    className={cn(
                                        "w-full text-left p-4 rounded-xl border transition-all relative overflow-hidden group",
                                        isSelected
                                            ? "bg-primary/20 border-primary shadow-lg shadow-primary/10"
                                            : "bg-secondary/20 hover:bg-secondary/40 border-white/5",
                                        isPast && !isSelected ? "opacity-60 grayscale" : ""
                                    )}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <div className={cn(
                                            "text-xs font-mono font-bold",
                                            isSelected ? "text-primary" : (isPast ? "text-gray-500" : "text-primary")
                                        )}>
                                            {e.event_date.toLocaleDateString()}
                                        </div>
                                        {isPast && (
                                            <span className="text-[10px] font-bold uppercase text-gray-500 bg-gray-800/50 px-1.5 py-0.5 rounded">Ended</span>
                                        )}
                                    </div>
                                    <div className={cn(
                                        "font-bold text-md leading-tight mb-1 transition-colors",
                                        isSelected ? "text-white" : (isPast ? "text-gray-400" : "text-white group-hover:text-primary")
                                    )}>
                                        {e.title}
                                    </div>
                                    <div className="text-xs text-gray-500 truncate flex items-center gap-1">
                                        <MapPin className="w-3 h-3" /> {e.location}
                                    </div>
                                </button>
                            )
                        })}
                        {events.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No events found.</p>}
                    </div>
                </div>
            </div>
        </div>
    );
}
