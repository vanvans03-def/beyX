"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function EventCalendar({ events, onDateSelect }: { events: { date: Date; title: string }[], onDateSelect?: (date: Date) => void }) {
    const [currentDate, setCurrentDate] = useState(new Date());

    const daysInMonth = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        return new Date(year, month + 1, 0).getDate();
    }, [currentDate]);

    const firstDayOfMonth = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        return new Date(year, month, 1).getDay();
    }, [currentDate]);

    const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

    const changeMonth = (offset: number) => {
        const newDate = new Date(currentDate);
        newDate.setMonth(newDate.getMonth() + offset);
        setCurrentDate(newDate);
    };

    const isToday = (day: number) => {
        const today = new Date();
        return day === today.getDate() &&
            currentDate.getMonth() === today.getMonth() &&
            currentDate.getFullYear() === today.getFullYear();
    };

    const getEvent = (day: number) => {
        return events.find(e =>
            e.date.getDate() === day &&
            e.date.getMonth() === currentDate.getMonth() &&
            e.date.getFullYear() === currentDate.getFullYear()
        );
    };

    const handleDateClick = (day: number) => {
        if (onDateSelect) {
            const selectedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
            onDateSelect(selectedDate);
        }
    };

    const renderDays = () => {
        const days = [];
        const now = new Date();
        now.setHours(0, 0, 0, 0); // Normalize today for comparison

        // Empty slots
        for (let i = 0; i < firstDayOfMonth; i++) {
            days.push(<div key={`empty-${i}`} className="h-10 md:h-14" />);
        }
        // Days
        for (let i = 1; i <= daysInMonth; i++) {
            const event = getEvent(i);
            const today = isToday(i);

            // Check past
            const currentDayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), i);
            const isPast = event && currentDayDate < now;

            days.push(
                <button
                    key={i}
                    onClick={() => handleDateClick(i)}
                    className={cn(
                        "h-10 md:h-14 flex items-center justify-center rounded-lg relative group transition-all w-full",
                        today ? "bg-primary text-black font-bold shadow-lg shadow-primary/20" : "hover:bg-white/10",
                        // Future Event Style
                        event && !today && !isPast ? "bg-white/10 text-primary font-bold border border-primary/30" : "",
                        // Past Event Style
                        event && !today && isPast ? "bg-white/5 text-muted-foreground border border-white/5 opacity-50 grayscale" : "",
                        // No Event Style
                        !event && !today ? "text-muted-foreground" : "",
                        "cursor-pointer"
                    )}>
                    {i}
                    {event && (
                        <div className={cn(
                            "absolute bottom-1 md:bottom-2 w-1 h-1 md:w-1.5 md:h-1.5 rounded-full",
                            isPast ? "bg-muted-foreground" : "bg-primary"
                        )} />
                    )}
                </button>
            );
        }
        return days;
    };

    return (
        <div className="w-full">
            <div className="flex items-center justify-between mb-6">
                <h4 className="text-lg font-bold text-white capitalize">{monthName}</h4>
                <div className="flex gap-2">
                    <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><ChevronLeft className="w-5 h-5" /></button>
                    <button onClick={() => changeMonth(1)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><ChevronRight className="w-5 h-5" /></button>
                </div>
            </div>

            <div className="grid grid-cols-7 gap-1 md:gap-2 mb-2 text-center">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                    <div key={d} className="text-xs font-bold text-muted-foreground uppercase opacity-50 mb-2">{d}</div>
                ))}
            </div>

            <div className="grid grid-cols-7 gap-1 md:gap-2 text-sm">
                {renderDays()}
            </div>

            <div className="mt-8 flex gap-4 text-xs text-muted-foreground justify-center">
                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-primary" /> Today</div>
                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-white/10 border border-primary/30" /> Event Day</div>
            </div>
        </div>
    );
}
