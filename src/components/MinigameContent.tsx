'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowLeft, Globe } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

const BeybladeArena = dynamic(() => import('@/components/BeybladeArena'), { ssr: false });

export default function MinigameContent() {
    const { lang, toggleLang } = useTranslation();
    const english = lang === 'EN';
    return <main className="min-h-screen bg-background px-4 py-6 text-white sm:py-10">
        <div className="mx-auto max-w-4xl space-y-5">
            <nav className="flex items-center justify-between">
                <Link href="/" className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-gray-300 transition hover:border-primary/50 hover:text-primary"><ArrowLeft size={16} />{english ? 'Home' : 'กลับหน้าแรก'}</Link>
                <button type="button" onClick={toggleLang} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-gray-300"><Globe size={14} />{english ? 'TH' : 'EN'}</button>
            </nav>
            <div data-motion="reveal"><p className="text-xs font-bold tracking-[0.3em] text-primary">BEYX MINI GAME</p><h1 className="mt-2 text-3xl font-black italic">{english ? 'Ready. Set. Go Shoot!' : 'พร้อมแล้ว… Go Shoot!'}</h1></div>
            <BeybladeArena lang={lang} />
        </div>
    </main>;
}
