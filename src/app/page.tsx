import type { Metadata } from 'next';
import { HomeContent } from '@/components/HomeContent';
import appConfig from '@/data/app-config.json';

export const metadata: Metadata = {
    title: 'BeyX System | Beyblade X Tournament Manager',
    description: 'BeyX System — Beyblade X Tournament Registration & Management',
};

// Public shell has no server-side data: serve complete HTML, not a streamed
// loading boundary that depends on JavaScript to reveal the main navigation.
export const dynamic = 'force-static';

export default function Home() {
    return <div className="relative flex min-h-screen flex-col items-center justify-center overflow-x-clip bg-background px-4 py-6 sm:px-6 sm:py-10"><div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true"><div className="absolute left-1/2 top-0 h-[600px] w-[min(100vw,800px)] -translate-x-1/2 rounded-full bg-primary/[0.06] blur-[100px]" /><div className="motion-grid absolute inset-0" /></div><HomeContent version={appConfig.version} /></div>;
}
