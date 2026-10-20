import type { Metadata } from 'next';
import MinigameContent from '@/components/MinigameContent';

export const metadata: Metadata = {
    title: 'Mini Game | BeyX System',
    description: 'Choose your Beyblade, time your launch and battle the bot.',
};

export default function MinigamePage() {
    return <MinigameContent />;
}
