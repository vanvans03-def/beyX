import type { Metadata } from 'next';
import { HomeContent } from '@/components/HomeContent';
import appConfig from '@/data/app-config.json';
import { getSystemSetting } from '@/lib/repository';

export const metadata: Metadata = {
    title: 'BeyX System | Beyblade X Tournament Manager',
    description: 'BeyX System — Beyblade X Tournament Registration & Management',
};

export const revalidate = 60;

export default async function Home() {
    const isEventsActive = await getSystemSetting('event_system_active', true);
    return <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background p-6"><div className="pointer-events-none fixed inset-0 z-0"><div className="absolute left-1/2 top-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[150px]" /><div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.05]" /></div><HomeContent isEventsActive={isEventsActive} version={appConfig.version} /></div>;
}
