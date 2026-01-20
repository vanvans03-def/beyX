'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            const data = await res.json();

            if (res.ok && data.success) {
                toast.success("Welcome back!");
                router.refresh(); // Update client-side authentication state
                router.push(data.redirectTo);
            } else {
                toast.error(data.error || 'Login failed');
            }
        } catch (error) {
            toast.error("Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#050505] text-white p-4 relative overflow-hidden">
            {/* Dynamic Background */}
            <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] animate-pulse-slow" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[100px] animate-pulse-slow delay-1000" />

            <div className="w-full max-w-md space-y-8 relative z-10">
                <div className="text-center space-y-2">
                    <div className="mx-auto w-16 h-16 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20 mb-6 backdrop-blur-sm">
                        <ShieldCheck className="w-8 h-8 text-primary" />
                    </div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-white">Admin Portal</h1>
                    <p className="text-gray-400">Sign in to manage your tournaments</p>
                </div>

                <div className="glass-card p-8 rounded-2xl border border-white/10 backdrop-blur-xl bg-white/5 shadow-2xl">
                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-300 uppercase tracking-wider">Username</label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-medium"
                                placeholder="Enter username"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-300 uppercase tracking-wider">Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-medium"
                                placeholder="••••••••"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary hover:bg-primary/90 text-black font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 uppercase tracking-wide"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Signing in...
                                </>
                            ) : (
                                "Sign In"
                            )}
                        </button>
                    </form>
                </div>

                <div className="text-center text-xs text-gray-600">
                    &copy; 2024 BeyBlade X Tournament Manager
                </div>
            </div>
        </div>
    );
}
