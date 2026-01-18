import React from 'react';

interface TournamentBracketProps {
    challongeUrl: string;
    variant?: 'default' | 'minimal';
    className?: string;
}

const TournamentBracket: React.FC<TournamentBracketProps> = ({
    challongeUrl,
    variant = 'default',
    className = ''
}) => {
    if (!challongeUrl) return null;

    // Convert normal URL to module URL for embedding
    // Normal: https://challonge.com/bb_12345
    // Embed: https://challonge.com/bb_12345/module
    const embedUrl = `${challongeUrl}/module`;

    const isMinimal = variant === 'minimal';

    return (
        <div className={`w-full ${isMinimal ? 'h-full flex flex-col' : 'border-2 border-gray-200 rounded-lg overflow-hidden mb-6 mt-2'} ${className}`}>
            {!isMinimal && (
                <h2 className="text-xl font-bold p-4 bg-gray-800 text-white">
                    Tournament Bracket
                </h2>
            )}

            <iframe
                src={embedUrl}
                width="100%"
                height={isMinimal ? "100%" : "600"}
                frameBorder="0"
                scrolling="auto"
                loading="eager"
                // @ts-ignore
                allowtransparency="true"
                sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                style={{
                    minHeight: isMinimal ? 'auto' : '500px',
                    filter: 'none',
                    transform: 'translateZ(0)',
                    backfaceVisibility: 'hidden',
                    flex: isMinimal ? 1 : undefined
                }}
                className={isMinimal ? "flex-1" : ""}
                title="Tournament Bracket"
            ></iframe>

            <div className={`text-center text-sm text-gray-500 ${isMinimal ? 'py-1 bg-black/80' : 'mt-2 p-2'}`}>
                <a href={challongeUrl} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 underline">
                    View full bracket on Challonge.com
                </a>
            </div>
        </div>
    );
};

export default TournamentBracket;
