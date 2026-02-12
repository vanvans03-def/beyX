import { getEvents } from "@/lib/repository";
import { EventsClientView } from "@/components/EventsClientView";
import Link from "next/link";
import { Metadata, ResolvingMetadata } from "next";

//export const dynamic = 'force-dynamic';
export const revalidate = 60;

type Props = {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata(
    { searchParams }: Props,
    parent: ResolvingMetadata
): Promise<Metadata> {
    const sp = await searchParams;
    const id = typeof sp.id === 'string' ? sp.id : undefined;

    if (!id) return {};

    const events = await getEvents();
    const event = events.find(e => e.id === id);

    if (!event) return {};

    return {
        title: `${event.title} - BeyX Events`,
        description: event.description || `Join ${event.title} at ${event.location}`,
        openGraph: {
            title: event.title,
            description: event.description || `Join ${event.title} at ${event.location}`,
            images: [{
                url: `/api/og?id=${event.id}`,
                width: 1200,
                height: 630,
            }],
        },
    };
}

export default async function EventsPage({ searchParams }: Props) {
    const events = await getEvents();
    const sp = await searchParams;
    const initialId = typeof sp.id === 'string' ? sp.id : undefined;

    return (
        <div className="min-h-screen relative overflow-hidden bg-background">
            {/* Background */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-0 left-0 w-full h-full bg-[url('/grid.svg')] opacity-[0.05]" />
                <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px]" />
            </div>

            <main className="relative z-10 max-w-4xl mx-auto p-6 space-y-8" data-aos="fade-in" suppressHydrationWarning>
                <header className="flex items-center justify-between">
                    <div>
                        <h1 className="text-4xl font-black italic uppercase tracking-tighter text-white">
                            Events <span className="text-primary">&</span> News
                        </h1>
                        <p className="text-muted-foreground text-sm uppercase tracking-widest mt-1">Beyblade X Tournament Schedule</p>
                    </div>
                    <Link href="/" className="text-sm text-muted-foreground hover:text-white transition-colors">
                        Back to Home
                    </Link>
                </header>

                <EventsClientView initialEvents={events} initialSelectedId={initialId} />

            </main>
        </div>
    );
}
// Simple Client Component for Calendar (Inline for simplicity, but could be separate file)

