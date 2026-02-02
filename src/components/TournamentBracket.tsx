import React from 'react';

interface TournamentBracketProps {
    url: string;
}

const TournamentBracket: React.FC<TournamentBracketProps> = ({ url }) => {
    // Extract the identifier from the full URL if necessary, or assume url is the full "https://challonge.com/..."
    // The module view is usually at /module
    // If url is "https://challonge.com/my_tournament", embedUrl should be "https://challonge.com/my_tournament/module?..."

    // Basic validation to ensure we don't double slash
    const cleanUrl = url.replace(/\/$/, "");

    // Theme and options as requested
    const embedUrl = `${cleanUrl}/module?theme=2&multiplier=1.0&match_width_multiplier=1.0&show_final_results=1`;

    return (
        <div className="w-full overflow-hidden rounded-lg shadow-lg bg-white/5 border border-white/10">
            <iframe
                src={embedUrl}
                width="100%"
                height="600"
                frameBorder="0"
                scrolling="auto"
                allowTransparency={true}
                sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                className="w-full h-[600px] md:h-[800px]"
                title="Tournament Bracket"
            />
        </div>
    );
};

export default TournamentBracket;
