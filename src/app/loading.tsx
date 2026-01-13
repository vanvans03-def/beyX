import { Loader2 } from "lucide-react";

export default function Loading() {
    return (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm transition-all duration-500">
            <div className="relative">
                {/* Outer Ring */}
                <div className="absolute inset-0 rounded-full border-4 border-primary/20 animate-[spin_3s_linear_infinite]" />
                <div className="absolute inset-0 rounded-full border-t-4 border-primary animate-[spin_2s_linear_infinite]" />

                {/* Inner Icon */}
                <div className="relative flex items-center justify-center w-24 h-24 bg-card rounded-full border border-white/10 shadow-[0_0_40px_-10px] shadow-primary/30">
                    <Loader2 className="w-10 h-10 text-primary animate-spin duration-1000" />
                </div>
            </div>

            <div className="mt-8 space-y-2 text-center">
                <h2 className="text-xl font-black italic tracking-tighter text-white animate-pulse">
                    LOADING <span className="text-primary">SYSTEM</span>
                </h2>
                <p className="text-xs text-muted-foreground tracking-[0.3em] font-medium uppercase">
                    Please Wait
                </p>
            </div>
        </div>
    );
}
