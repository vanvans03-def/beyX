import PublicTournamentPageLoader from '@/components/public/PublicTournamentPageLoader';
import { shareMetadata } from '@/lib/share-metadata';

export async function generateMetadata({ params }: { params: Promise<{ shopName: string; id: string }> }) {
    const { shopName, id } = await params;
    return shareMetadata(`${shopName.slice(0, 100)} — สายการแข่งขัน`,
        'ติดตามสายการแข่งขัน รายชื่อผู้เล่น และผลการแข่งขัน Beyblade X บน BeyX System',
        `/${encodeURIComponent(shopName)}/${encodeURIComponent(id)}`, true);
}

export default async function PublicTournamentPage({ params }: { params: Promise<{ shopName: string; id: string }> }) {
    const { shopName, id } = await params;
    return <PublicTournamentPageLoader shopName={shopName} tournamentId={id} />;
}
