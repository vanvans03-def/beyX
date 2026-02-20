import { ImageResponse } from 'next/og';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return new ImageResponse(<>No Event ID</>, { width: 1200, height: 630 });
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        const { data: event } = await supabase
            .from('events')
            .select('*')
            .eq('id', id)
            .single();

        if (!event) {
            return new ImageResponse(<>Event Not Found</>, { width: 1200, height: 630 });
        }

        const eventDate = new Date(event.event_date);
        const dateStr = eventDate.toLocaleDateString('th-TH', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
        const timeStr = eventDate.toLocaleTimeString('th-TH', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });

        return new ImageResponse(
            (
                <div
                    style={{
                        height: '100%',
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'row',
                        backgroundColor: '#050505',
                        fontFamily: 'sans-serif',
                    }}
                >
                    {/* Left Side: Event Image (Portrait Handling) */}
                    <div style={{
                        width: '45%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: '#111111',
                        position: 'relative',
                        overflow: 'hidden',
                        borderRight: '4px solid #4ade80',
                    }}>
                        {/* Blurred Background */}
                        {event.image_url && (
                            <img
                                src={event.image_url}
                                style={{
                                    position: 'absolute',
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                    filter: 'blur(20px)',
                                    opacity: 0.6,
                                }}
                            />
                        )}
                        {/* Main Image */}
                        {event.image_url ? (
                            <img
                                src={event.image_url}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'contain',
                                    zIndex: 10,
                                }}
                            />
                        ) : (
                            <div style={{ color: '#333', fontSize: 24 }}>No Image</div>
                        )}
                    </div>

                    {/* Right Side: Details */}
                    <div style={{
                        width: '55%',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        padding: '40px',
                        backgroundColor: '#1A1A1A',
                        backgroundImage: 'radial-gradient(circle at 80% 20%, #222 0%, #111 70%)',
                        color: 'white',
                    }}>
                        <div style={{
                            color: '#4ade80',
                            fontSize: 20,
                            fontWeight: 900,
                            letterSpacing: '2px',
                            marginBottom: 10,
                            textTransform: 'uppercase',
                        }}>
                            UPCOMING EVENT
                        </div>

                        <div style={{
                            fontSize: 48,
                            fontWeight: 900,
                            lineHeight: 1.1,
                            marginBottom: 20,
                            textOverflow: 'ellipsis',
                            overflow: 'hidden',
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                            background: 'linear-gradient(to right, #fff, #ccc)',
                            backgroundClip: 'text',
                            color: 'transparent',
                        }}>
                            {event.title}
                        </div>

                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px',
                            marginTop: '20px',
                            fontSize: 24,
                            color: '#ddd',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <span style={{ color: '#4ade80' }}>🗓</span> {dateStr}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <span style={{ color: '#4ade80' }}>🕒</span> {timeStr} น.
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <span style={{ color: '#4ade80' }}>📍</span> {event.location}
                            </div>
                        </div>

                        {/* Footer */}
                        <div style={{
                            marginTop: 'auto',
                            paddingTop: '30px',
                            borderTop: '1px solid #333',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            width: '100%',
                        }}>
                            <div style={{ fontSize: 16, color: '#666' }}>
                                https://beybladex.vercel.app
                            </div>
                            <div style={{ fontSize: 16, color: '#4ade80', fontWeight: 'bold' }}>
                                POWERED BY สายใต้ยิม
                            </div>
                        </div>
                    </div>
                </div>
            ),
            {
                width: 1200,
                height: 630,
            }
        );
    } catch (e: any) {
        console.log(`${e.message}`);
        return new ImageResponse(<>Failed to load image</>, { width: 1200, height: 630 });
    }
}
