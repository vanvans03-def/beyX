'use client';

import Link from 'next/link';
import { ArrowRight, Trophy } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

export function RankingsMenuCard() {
    const { t } = useTranslation();
    return <Link href="/rankings" className="group relative flex items-center justify-between rounded-2xl border border-primary/30 bg-card p-5 transition-all hover:scale-[1.02] hover:border-primary/60 hover:bg-secondary/80 hover:shadow-xl hover:shadow-primary/10">
        <div className="flex items-center gap-4">
            <div className="rounded-xl bg-primary/15 p-3 transition-colors group-hover:bg-primary/25"><Trophy className="h-6 w-6 text-primary" /></div>
            <div className="text-left"><h3 className="font-bold text-foreground">{t('rankings.menu.title')}</h3><p className="text-xs text-muted-foreground">{t('rankings.menu.subtitle')}</p></div>
        </div>
        <ArrowRight className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary" />
    </Link>;
}
