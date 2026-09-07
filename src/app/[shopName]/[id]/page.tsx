import { getPublicTournamentPage } from '@/lib/public-tournament-cache';
import { cache } from 'react';
import { notFound } from "next/navigation";
import PublicTournamentView from "@/components/public/PublicTournamentView";

// The page contains no request-specific data. Reuse its rendered output during
// spectator bursts and refresh it frequently enough for tournament state changes.
export const revalidate = 5;
const getPagePayload = cache(getPublicTournamentPage);

export async function generateMetadata({ params }: { params: Promise<{ shopName: string, id: string }> }) {
    const { shopName, id } = await params;
    const payload = await getPagePayload(shopName, id);
    if (!payload) return { title: "Tournament Not Found" };
    const { tournament } = payload;

    return {
        title: `${tournament.name} | ${tournament.organizer_name}`,
        description: `รายชื่อผู้สมัครเข้าร่วมการแข่งขัน ${tournament.name} โดย ${tournament.organizer_name}`,
    };
}

export default async function PublicTournamentPage({ params }: { params: Promise<{ shopName: string, id: string }> }) {
    const { shopName, id } = await params;
    const payload = await getPagePayload(shopName, id);
    if (!payload) {
        notFound();
    }
    const { tournament, registrations } = payload;

    return (
        <PublicTournamentView 
            tournament={tournament} 
            registrations={registrations} 
        />
    );
}
