import React from 'react';
import InternalBracket from './InternalBracket';

interface TournamentBracketProps {
    url: string;
    provider?: 'CHALLONGE' | 'INTERNAL';
    matches?: any[];
    onMatchClick?: (match: any) => void;
    onReportWin?: (match: any, winnerId: string, winnerName: string, scores: string) => void;
}

const TournamentBracket: React.FC<TournamentBracketProps> = ({ url, provider = 'CHALLONGE', matches = [], onMatchClick, onReportWin }) => {
    if (provider === 'INTERNAL') {
        return (
            <div className="space-y-4">
                <div className="flex justify-between items-center bg-black/20 p-3 rounded-lg border border-white/5">
                    <span className="text-sm font-bold text-primary">BeyX Internal Bracket</span>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-[10px] text-muted-foreground uppercase">Real-time Connected</span>
                    </div>
                </div>
                <InternalBracket matches={matches} onMatchClick={onMatchClick} onReportWin={onReportWin} />
            </div>
        );
    }

    // --- CHALLONGE LOGIC ---
    const cleanUrl = url.replace(/\/$/, "");
    const embedUrl = `${cleanUrl}/module?theme=2&multiplier=1.0&match_width_multiplier=1.0&show_final_results=1`;

    return (
        <div className="w-full overflow-hidden rounded-lg shadow-lg bg-white/5 border border-white/10">
            <div className="p-2 flex justify-between items-center bg-black/20 px-4">
                <span className="text-sm text-gray-400">Tournament Bracket (Challonge)</span>
                <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded transition-colors"
                >
                    Open in Challonge
                </a>
            </div>
            <iframe
                src={embedUrl}
                width="100%"
                height="600"
                frameBorder="0"
                scrolling="auto"
                // @ts-ignore
                allowtransparency="true"
                sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                className="w-full h-[600px] md:h-[800px]"
                title="Tournament Bracket"
            />
        </div>
    );
};

export default React.memo(TournamentBracket);
