import { ImageResponse } from 'next/og';
import { getTournaments } from '@/lib/repository';

export const runtime = 'edge';

// Image metadata
export const alt = 'BeyX Tournament Info';
export const size = {
    width: 1200,
    height: 630,
};

export const contentType = 'image/png';

export default async function Image({ params }: { params: { id: string } }) {
    const { id } = await params;

    // Fetch tournament data
    // Note: getTournaments might need to be adapted for edge if it uses node-specifics, 
    // but usually fetch works. If repository uses fs, we might need a direct fetch 
    // or assume it's data-compatible. 
    // SAFEST BET: Fallback strings if fetch fails or use basic styles first.
    let tournamentName = 'BEYBLADE X TOURNAMENT';
    let status = 'OPEN';

    try {
        // We can't easily use the node-based repository in edge runtime if it uses 'fs' or 'pg' directly 
        // without edge formatting. However, assuming API/Supabase calls are HTTP based or using
        // standard fetch, it might pass.
        // If 'getTournaments' is pure supabase-js, it likely works.
        const tournaments = await getTournaments();
        const t = tournaments.find(x => x.id === id);
        if (t) {
            tournamentName = t.name;
            status = t.status || 'OPEN';
        }
    } catch (e) {
        console.error("OG Image Error:", e);
    }

    return new ImageResponse(
        (
            <div
                style={{
                    height: '100%',
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#050505',
                    backgroundImage: 'radial-gradient(circle at 25% 25%, #1a1a1a 0%, #000 50%)',
                    fontFamily: 'sans-serif',
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                {/* Geometric Accents */}
                <div style={{
                    position: 'absolute',
                    top: '-50px',
                    right: '-50px',
                    width: '300px',
                    height: '300px',
                    background: 'linear-gradient(135deg, transparent 40%, #4ade80 40%, #4ade80 60%, transparent 60%)',
                    opacity: 0.1,
                    transform: 'rotate(45deg)'
                }} />
                <div style={{
                    position: 'absolute',
                    bottom: '-100px',
                    left: '-100px',
                    width: '400px',
                    height: '400px',
                    borderRadius: '50%',
                    border: '1px solid #4ade80',
                    opacity: 0.2,
                }} />

                {/* Main Content Container */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid #333',
                    padding: '40px 60px',
                    borderRadius: '20px',
                    backgroundColor: 'rgba(20,20,20,0.8)',
                    boxShadow: '0 0 50px rgba(0,0,0,0.8)',
                    maxWidth: '80%',
                    textAlign: 'center',
                }}>
                    <div style={{
                        color: '#4ade80',
                        fontSize: 24,
                        fontWeight: 900,
                        letterSpacing: '4px',
                        marginBottom: 20,
                        textTransform: 'uppercase',
                    }}>
                        BeyX System
                    </div>

                    <div style={{
                        fontSize: 60,
                        fontWeight: 900,
                        lineHeight: 1.1,
                        marginBottom: 30,
                        textShadow: '0 0 20px rgba(255,255,255,0.2)',
                        background: 'linear-gradient(to bottom, #fff, #aaa)',
                        backgroundClip: 'text',
                        color: 'transparent',
                    }}>
                        {tournamentName}
                    </div>

                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '10px 30px',
                        background: status === 'OPEN' ? '#4ade80' : '#ef4444',
                        borderRadius: '50px',
                        color: 'black',
                        fontSize: 24,
                        fontWeight: 'bold',
                        letterSpacing: '2px',
                    }}>
                        {status === 'OPEN' ? 'REGISTRATION OPEN' : 'REGISTRATION CLOSED'}
                    </div>
                </div>

                {/* Footer Deco */}
                <div style={{
                    position: 'absolute',
                    bottom: 30,
                    color: '#666',
                    fontSize: 16,
                    letterSpacing: '2px',
                }}>
                    POWERED BY BEYX
                </div>
            </div>
        ),
        {
            ...size,
        }
    );
}
