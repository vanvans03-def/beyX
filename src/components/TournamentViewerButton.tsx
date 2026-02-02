"use client";

import { Trophy, ExternalLink } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import Link from "next/link";

export default function TournamentViewerButton({ url, tournamentId }: { url: string, tournamentId?: string }) {
    const { t } = useTranslation();

    if (!url) return null;

    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-400 to-red-500 text-white rounded-full font-bold shadow-lg shadow-orange-500/20 hover:scale-105 transition-transform animate-pulse"
        >
            <Trophy className="h-4 w-4" />
            <span>{t('reg.btn.view_bracket')}</span>
            <ExternalLink className="h-3 w-3 opacity-70" />
        </a>
    );
}
