import TournamentViewerButton from "@/components/TournamentViewerButton";
import RegistrationForm from "@/components/RegistrationForm";
import { getTournament } from "@/lib/repository";
import { Metadata, ResolvingMetadata } from "next";
import StandingsTable from "@/components/StandingsTable";
import { getTournamentStandings } from "@/lib/challonge";
import RealtimeTournamentWrapper from "@/components/RealtimeTournamentWrapper";

export const dynamic = 'force-dynamic';

type Props = {
    params: Promise<{ id: string }>
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
        if (code) {
            standings = await getTournamentStandings(code);
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

