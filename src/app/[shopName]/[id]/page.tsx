import { getTournamentByShortId, getRegistrations } from "@/lib/repository";
import { notFound } from "next/navigation";
import { Users, Trophy, Clock, ChevronLeft, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import PublicTournamentView from "@/components/public/PublicTournamentView";

export async function generateMetadata({ params }: { params: Promise<{ shopName: string, id: string }> }) {
    const { shopName, id } = await params;
    const tournament = await getTournamentByShortId(shopName, id);
    if (!tournament) return { title: "Tournament Not Found" };

    return {
        title: `${tournament.name} | ${tournament.organizer_name}`,
        description: `รายชื่อผู้สมัครเข้าร่วมการแข่งขัน ${tournament.name} โดย ${tournament.organizer_name}`,
    };
}

export default async function PublicTournamentPage({ params }: { params: Promise<{ shopName: string, id: string }> }) {
    const { shopName, id } = await params;
    const tournament = await getTournamentByShortId(shopName, id);

    if (!tournament) {
        notFound();
    }

    const registrations = await getRegistrations(tournament.id);

    return (
        <PublicTournamentView 
            tournament={tournament} 
            registrations={registrations} 
        />
    );
}
