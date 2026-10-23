'use client';

import Link from 'next/link';
import { ArrowRight, Trophy } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

export function RankingsMenuCard({ entrance = false }: { entrance?: boolean }) {
    const { t } = useTranslation();
    return <Link href="/rankings" data-motion={entrance ? 'home' : 'reveal'} data-motion-surface className="motion-card group flex min-h-[88px] min-w-0 items-center justify-between gap-3 rounded-2xl p-4 sm:p-6">
        <div className="flex items-center gap-4">
            <div className="motion-icon shrink-0 rounded-xl bg-primary/10 p-3.5"><Trophy className="h-6 w-6 text-primary" /></div>
            <div className="min-w-0 text-left"><h2 className="text-base font-bold text-foreground">{t('rankings.menu.title')}</h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t('rankings.menu.subtitle')}</p></div>
        </div>
        <ArrowRight aria-hidden="true" className="motion-arrow h-5 w-5 shrink-0 text-muted-foreground" />
    </Link>;
}
