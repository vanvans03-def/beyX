import { getUserApiKey } from "@/lib/repository";
import { getPublicRegistrationTournament } from '@/lib/public-tournament-cache';
import { cache } from 'react';
import type { Metadata, ResolvingMetadata } from "next";
import { getTournamentStandings } from "@/lib/challonge";
import RealtimeTournamentWrapper from "@/components/RealtimeTournamentWrapper";

// Registration details are shared by every visitor. A short ISR window prevents
// 100 simultaneous visitors from making the 1-CPU server render the same page.
export const revalidate = 5;
const getPageTournament = cache(getPublicRegistrationTournament);

type Props = {
    params: Promise<{ id: string }>
}

export async function generateMetadata(
    { params }: Props,
    parent: ResolvingMetadata
): Promise<Metadata> {
    const { id } = await params;
    const tournament = await getPageTournament(id);

    // optionally access and extend (rather than replace) parent metadata
    const previousImages = (await parent).openGraph?.images || []

    if (!tournament) {
        return {
            title: "Tournament Not Found",
            description: "The requested tournament does not exist.",
        }
    }

    return {
        title: tournament.name,
        description: `Join the ${tournament.name} tournament! Status: ${tournament.status}`,
        openGraph: {
            title: tournament.name,
            description: `Join the ${tournament.name} tournament! Status: ${tournament.status}`,
            images: [`/register/${id}/opengraph-image`, ...previousImages],
        },
        twitter: {
            card: 'summary_large_image',
            title: tournament.name,
            description: `Join the ${tournament.name} tournament! Status: ${tournament.status}`,
            images: [`/register/${id}/opengraph-image`],
        }
    }
}

export default async function RegisterPage({ params }: Props) {
    const { id } = await params;
    const tournament = await getPageTournament(id);

    if (!tournament) {
        return <div>Tournament not found</div>;
    }

    let standings = null;
    if ((tournament.status === 'COMPLETED' || tournament.status === 'CLOSED') && tournament.challonge_url) {
        const code = tournament.challonge_url.split('/').pop();
        if (code && tournament.user_id) {
            const apiKey = await getUserApiKey(tournament.user_id);
            if (apiKey) {
                standings = await getTournamentStandings(apiKey, code);
            }
        }
    }

    return (
        <RealtimeTournamentWrapper
            initialTournament={tournament}
            tournamentId={id}
            initialStandings={standings}
        />
    );
}

