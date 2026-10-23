'use client';

import Link from 'next/link';
import { ArrowRight, Gamepad2, Globe, LockKeyhole, MessageCircle, Trophy, Crosshair } from 'lucide-react';
import dynamic from 'next/dynamic';
import { RankingsMenuCard } from '@/components/RankingsMenuCard';
import { useTranslation } from '@/hooks/useTranslation';
import { useHydrated } from '@/hooks/useHydrated';
import { BeybladeModelCredits } from '@/components/BeybladeModelCredits';

const HomeBeybladePlayground = dynamic(() => import('@/components/HomeBeybladePlayground'), { ssr: false, loading: () => <div className="h-[88px] w-full" /> });

export function HomeContent({ version }: { version: string }) {
    const { t, lang, toggleLang } = useTranslation();
    const hydrated = useHydrated();
    const english = lang === 'EN';
    const card = 'motion-card group flex min-h-[88px] items-center justify-between gap-3 rounded-2xl p-4 sm:p-6';

    return <>
        <main className="relative z-10 w-full max-w-5xl" suppressHydrationWarning>
            <nav data-motion="home" className="mb-5 flex items-center justify-between gap-4 border-b border-white/[0.07] pb-3 sm:mb-8" aria-label={english ? 'Language and brand' : 'ภาษาและแบรนด์'}>
                <span className="flex items-center gap-2.5 text-[10px] font-bold tracking-[0.22em] text-primary/80"><Crosshair size={17} aria-hidden="true" /> BEYX / ARENA SYSTEM</span>
                <button onClick={toggleLang} disabled={!hydrated} className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs font-bold text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary" aria-label={t('home.language')}><Globe className="h-3.5 w-3.5" /> {english ? 'TH' : 'EN'}</button>
            </nav>

            <div className="grid items-center gap-4 md:grid-cols-[1fr_1.05fr] md:gap-12 lg:gap-20">
                <section className="min-w-0 text-center md:text-left" aria-label={english ? 'Welcome to BeyX' : 'ยินดีต้อนรับสู่ BeyX'}>
                    <div>
                        <p data-motion="home" className="mb-3 text-[10px] font-bold tracking-[0.3em] text-muted-foreground">PLAY. ORGANIZE. COMPETE.</p>
                        <h1 className="sr-only">BeyX System - Beyblade X Tournament Manager</h1>
                        <p data-motion="home" aria-hidden="true" className="text-[clamp(3.1rem,8vw,5.5rem)] font-black italic leading-[0.95] tracking-tighter text-white">BEYX<br className="hidden md:block" /> <span className="text-primary">SYSTEM<span className="text-primary/30">.</span></span></p>
                        <div data-motion="home" className="mx-auto my-3 h-0.5 w-12 bg-gradient-to-r from-primary to-primary/10 md:mx-0" aria-hidden="true" />
                        <p data-motion="home" className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground md:mx-0 sm:text-base">{t('home.description')}</p>
                    </div>
                    <div className="mt-2" data-testid="home-bey-area">
                        <HomeBeybladePlayground lang={lang} compact />
                    </div>
                </section>

                <section className="grid min-w-0 gap-3" aria-label={english ? 'Explore BeyX' : 'เมนูหลัก BeyX'}>
                    <p data-motion="home" className="mb-1 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">{english ? 'YOUR NEXT MOVE' : 'เลือกสนามของคุณ'}</p>
                    <Link href="/minigame" data-motion="home" data-motion-surface className={card}>
                        <div className="flex min-w-0 items-center gap-4"><div className="motion-icon shrink-0 rounded-xl bg-primary/10 p-3.5"><Gamepad2 className="h-6 w-6 text-primary" /></div><div className="min-w-0"><h2 className="text-base font-bold text-foreground">{english ? 'Mini Game' : 'มินิเกม'}</h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{english ? 'Choose your Beyblade and battle the bot' : 'เลือกลูกข่าง จับจังหวะปล่อย แล้วสู้กับบอท'}</p></div></div><ArrowRight aria-hidden="true" className="motion-arrow h-5 w-5 shrink-0 text-muted-foreground" />
                    </Link>
                    <RankingsMenuCard entrance />
                    <Link href="/admin" data-motion="home" data-motion-surface className={card}>
                        <div className="flex min-w-0 items-center gap-4"><div className="motion-icon shrink-0 rounded-xl bg-primary/10 p-3.5"><Trophy className="h-6 w-6 text-primary" /></div><div className="min-w-0"><h2 className="text-base font-bold text-foreground">{t('home.organizer.title')}</h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t('home.organizer.subtitle')}</p></div></div><ArrowRight aria-hidden="true" className="motion-arrow h-5 w-5 shrink-0 text-muted-foreground" />
                    </Link>
                    <Link href="/score-board" data-motion="home" data-motion-surface className={card}>
                        <div className="flex min-w-0 items-center gap-4"><div className="motion-icon shrink-0 rounded-xl bg-primary/10 p-3.5"><Crosshair className="h-6 w-6 text-primary" /></div><div className="min-w-0"><h2 className="text-base font-bold text-foreground">{t('home.scoreboard.title')}</h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t('home.scoreboard.subtitle')}</p></div></div><ArrowRight aria-hidden="true" className="motion-arrow h-5 w-5 shrink-0 text-muted-foreground" />
                    </Link>
                    <div className="mt-2 flex items-start gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-3 text-xs leading-relaxed text-muted-foreground"><LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/70" /><p><span className="font-medium text-gray-300">{t('home.invite.title')}</span><br />{t('home.invite.message')}</p></div>
                </section>
            </div>
        </main>
        <footer className="relative z-10 mt-8 w-full max-w-5xl border-t border-white/[0.07] pb-2 pt-4 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
            <div className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-2"><span>{t('home.powered_by')}</span><span className="opacity-30">/</span><span>V{version}</span></div><a href="https://www.facebook.com/beyx.system" target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center gap-1.5 transition-colors hover:text-primary" title={t('home.contact')}><MessageCircle className="h-3 w-3" /><span>{t('home.contact')}</span><ArrowRight size={11} aria-hidden="true" /></a></div>
            <BeybladeModelCredits english={english} />
        </footer>
    </>;
}
