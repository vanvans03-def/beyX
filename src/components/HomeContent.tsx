'use client';

import Link from 'next/link';
import { ArrowRight, Gamepad2, Globe, LockKeyhole, MessageCircle, Trophy } from 'lucide-react';
import dynamic from 'next/dynamic';
import { RankingsMenuCard } from '@/components/RankingsMenuCard';
import { useTranslation } from '@/hooks/useTranslation';
import { useHydrated } from '@/hooks/useHydrated';

const HomeBeybladePlayground = dynamic(() => import('@/components/HomeBeybladePlayground'), { ssr: false, loading: () => <div className="h-[170px] w-full" /> });

export function HomeContent({ version }: { version: string }) {
    const { t, lang, toggleLang } = useTranslation();
    const hydrated = useHydrated();

    return <>
        <main className="relative z-10 flex w-full max-w-md flex-col items-center space-y-8 text-center" data-aos="fade-in" suppressHydrationWarning>
            <div className="relative w-full space-y-4">
                <button onClick={toggleLang} disabled={!hydrated} className="absolute -top-1 right-0 inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:bg-white/10 hover:text-white" aria-label={t('home.language')}><Globe className="h-3.5 w-3.5" /> {lang === 'TH' ? 'EN' : 'TH'}</button>
                <h1 className="sr-only">BeyX System - Beyblade X Tournament Manager</h1>
                <p aria-hidden="true" className="text-5xl font-black italic tracking-tighter text-white">BEYX <span className="text-primary">SYSTEM</span></p>
                <p className="px-4 text-lg text-muted-foreground">{t('home.description')}</p>
            </div>

            <HomeBeybladePlayground lang={lang} />

            <div className="grid w-full gap-4">
                <Link href="/minigame" className="group relative flex items-center justify-between rounded-2xl border border-primary/30 bg-card p-5 transition-all hover:scale-[1.02] hover:border-primary/60 hover:bg-secondary/80 hover:shadow-xl hover:shadow-primary/10"><div className="flex items-center gap-4"><div className="rounded-xl bg-primary/15 p-3 transition-colors group-hover:bg-primary/25"><Gamepad2 className="h-6 w-6 text-primary" /></div><div className="text-left"><h3 className="font-bold text-foreground">{lang === 'EN' ? 'Mini Game' : 'มินิเกม'}</h3><p className="text-xs text-muted-foreground">{lang === 'EN' ? 'Choose your Beyblade and battle the bot' : 'เลือกลูกข่าง จับจังหวะปล่อย แล้วสู้กับบอท'}</p></div></div><ArrowRight className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary" /></Link>
                <RankingsMenuCard />
                <Link href="/admin" className="group relative flex items-center justify-between rounded-2xl border border-white/10 bg-card p-5 transition-all hover:scale-[1.02] hover:border-primary/50 hover:bg-secondary/80 hover:shadow-xl hover:shadow-primary/10"><div className="flex items-center gap-4"><div className="rounded-xl bg-secondary p-3 transition-colors group-hover:bg-background"><Trophy className="h-6 w-6 text-primary" /></div><div className="text-left"><h3 className="font-bold text-foreground">{t('home.organizer.title')}</h3><p className="text-xs text-muted-foreground">{t('home.organizer.subtitle')}</p></div></div><ArrowRight className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary" /></Link>
                <Link href="/score-board" className="group relative flex items-center justify-between rounded-2xl border border-white/10 bg-card p-5 transition-all hover:scale-[1.02] hover:border-primary/50 hover:bg-secondary/80 hover:shadow-xl hover:shadow-primary/10"><div className="flex items-center gap-4"><div className="rounded-xl bg-secondary p-3 transition-colors group-hover:bg-background"><Trophy className="h-6 w-6 text-primary" /></div><div className="text-left"><h3 className="font-bold text-foreground">{t('home.scoreboard.title')}</h3><p className="text-xs text-muted-foreground">{t('home.scoreboard.subtitle')}</p></div></div><ArrowRight className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary" /></Link>
                <div className="rounded-2xl border border-white/5 bg-white/5 p-6 text-center backdrop-blur-sm"><p className="mb-4 text-sm text-muted-foreground">{t('home.invite.title')}</p><div className="flex items-center justify-center gap-2 rounded-lg bg-black/40 p-2 text-xs font-mono text-primary/70"><LockKeyhole className="h-3 w-3" />{t('home.invite.message')}</div></div>
            </div>
        </main>
        <footer className="relative z-10 mt-10 flex flex-wrap items-center justify-center gap-4 pb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/40"><div className="flex items-center gap-2"><span>{t('home.powered_by')}</span><span className="opacity-30">•</span><span>V{version}</span></div><a href="https://www.facebook.com/beyx.system" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 border-l border-white/10 pl-4 transition-colors hover:text-primary" title={t('home.contact')}><MessageCircle className="h-3 w-3" /><span>{t('home.contact')}</span></a></footer>
    </>;
}
