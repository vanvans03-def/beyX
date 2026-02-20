import TournamentViewerButton from "@/components/TournamentViewerButton";
import RegistrationForm from "@/components/RegistrationForm";
import { getTournament, getUserApiKey } from "@/lib/repository";
import type { Metadata, ResolvingMetadata } from "next";
import StandingsTable from "@/components/StandingsTable";
import { getTournamentStandings } from "@/lib/challonge";
import RealtimeTournamentWrapper from "@/components/RealtimeTournamentWrapper";

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

type Props = {
    params: Promise<{ id: string }>
}

export async function generateMetadata(
    { params }: Props,
    parent: ResolvingMetadata
): Promise<Metadata> {
    const { id } = await params;
    const tournament = await getTournament(id);

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
    const tournament = await getTournament(id);

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

