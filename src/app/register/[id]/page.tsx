import RegistrationPageLoader from '@/components/registration/RegistrationPageLoader';

export const metadata = {
    title: 'BeyX Tournament Registration',
    description: 'Register for a BeyX tournament',
};

export default async function RegisterPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return <RegistrationPageLoader tournamentId={id} />;
}
