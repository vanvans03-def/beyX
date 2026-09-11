import PublicTournamentPageLoader from '@/components/public/PublicTournamentPageLoader';

export const metadata = {
    title: 'BeyX Tournament',
    description: 'Tournament bracket, players, and standings',
};

export default async function PublicTournamentPage({ params }: { params: Promise<{ shopName: string; id: string }> }) {
    const { shopName, id } = await params;
    return <PublicTournamentPageLoader shopName={shopName} tournamentId={id} />;
}
