import { ImageResponse } from 'next/og';

export const runtime = 'edge';

// Image metadata
export const alt = 'BeyX System';
export const size = {
    width: 1200,
    height: 630,
};

export const contentType = 'image/png';

export default async function Image() {
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
                    padding: '40px 80px',
                    borderRadius: '20px',
                    backgroundColor: 'rgba(20,20,20,0.8)',
                    boxShadow: '0 0 50px rgba(0,0,0,0.8)',
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
                        THAILAND
                    </div>

                    <div style={{
                        fontSize: 80,
                        fontWeight: 900,
                        lineHeight: 1.1,
                        marginBottom: 30,
                        textShadow: '0 0 20px rgba(255,255,255,0.2)',
                        background: 'linear-gradient(to bottom, #fff, #aaa)',
                        backgroundClip: 'text',
                        color: 'transparent',
                    }}>
                        BEYX SYSTEM
                    </div>

                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '10px 30px',
                        background: '#4ade80',
                        borderRadius: '50px',
                        color: 'black',
                        fontSize: 24,
                        fontWeight: 'bold',
                        letterSpacing: '2px',
                    }}>
                        TOURNAMENT PLATFORM
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
