import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Trophy, LockKeyhole, Calendar, MessageCircle } from "lucide-react";

import { getSystemSetting } from "@/lib/repository";
import appConfig from "@/data/app-config.json";

export const dynamic = 'force-dynamic';

export default async function Home() {
  const isEventsActive = await getSystemSetting("event_system_active", true);

  return (
    <div className="min-h-screen relative overflow-hidden bg-background flex flex-col items-center justify-center p-6">
      {/* Background Ambience */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/10 rounded-full blur-[150px]" />
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.05]" />
      </div>

      <main className="relative z-10 flex flex-col items-center text-center space-y-8 max-w-md w-full" data-aos="fade-in" suppressHydrationWarning>
        <div className="space-y-4">
          <h1 className="text-5xl font-black italic tracking-tighter text-white">
            BEYX <span className="text-primary">SYSTEM</span>
          </h1>
          <p className="text-muted-foreground text-lg">
            Tournament Registration & Management Platform
          </p>
        </div>

        <div className="grid w-full gap-4">
          {isEventsActive && (
            <Link href="/events" className="group relative flex items-center justify-between bg-card hover:bg-secondary/80 border border-white/10 p-5 rounded-2xl transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-primary/10 hover:border-primary/50">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-secondary rounded-xl group-hover:bg-background transition-colors">
                  <Calendar className="h-6 w-6 text-primary" />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-foreground">View Events</h3>
                  <p className="text-xs text-muted-foreground">Tournament Schedule</p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </Link>
          )}

          <Link href="/admin" className="group relative flex items-center justify-between bg-card hover:bg-secondary/80 border border-white/10 p-5 rounded-2xl transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-primary/10 hover:border-primary/50">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-secondary rounded-xl group-hover:bg-background transition-colors">
                <Trophy className="h-6 w-6 text-primary" />
              </div>
              <div className="text-left">
                <h3 className="font-bold text-foreground">Organizer</h3>
                <p className="text-xs text-muted-foreground">Login to Manage</p>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </Link>

          <div className="p-6 rounded-2xl border border-white/5 bg-white/5 backdrop-blur-sm text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Have a tournament invite link?
            </p>
            <div className="flex items-center justify-center gap-2 text-xs font-mono bg-black/40 p-2 rounded-lg text-primary/70">
              <LockKeyhole className="h-3 w-3" />
              Use the link provided by your TO
            </div>
          </div>
        </div>
      </main>

      <footer className="absolute bottom-6 flex items-center justify-center gap-4 text-[10px] uppercase tracking-wider text-muted-foreground/40 font-medium">
        <div className="flex items-center gap-2">
          <span>Powered by สายใต้ยิม</span>
          <span className="opacity-30">•</span>
          <span>V{appConfig.version}</span>
        </div>

        <a
          href="https://www.facebook.com/beyx.system"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 hover:text-primary transition-colors pl-4 border-l border-white/10"
          title="Contact Developer"
        >
          <MessageCircle className="h-3 w-3" />
          <span>Contact</span>
        </a>
      </footer>
    </div>
  );
}
