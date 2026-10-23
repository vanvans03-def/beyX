import RegistrationPageLoader from '@/components/registration/RegistrationPageLoader';
import { shareMetadata } from '@/lib/share-metadata';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return shareMetadata('ลงทะเบียนแข่งขัน Beyblade X', 'ลงทะเบียนผู้เล่นและเตรียมพร้อมเข้าสู่สนามกับ BeyX System', `/register/${encodeURIComponent(id)}`, true);
}

export default async function RegisterPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return <RegistrationPageLoader tournamentId={id} />;
}
