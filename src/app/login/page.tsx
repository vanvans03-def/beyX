'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/utils/supabase/client';

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleGoogleLogin = async () => {
        try {
            const supabase = createClient();
            const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || window.location.origin).replace(/\/$/, '');
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${baseUrl}/api/auth/callback?next=/admin`,
                },
            });
            if (error) throw error;
        } catch (error: any) {
            toast.error(error.message || "Failed to sign in with Google");
        }
    };

    const [errorShown, setErrorShown] = useState(false);

    useEffect(() => {
        if (typeof window !== 'undefined' && !errorShown) {
            const params = new URLSearchParams(window.location.search);
            const error = params.get('error');
            if (error === 'no_email') {
                toast.error("บัญชี Google นี้ไม่มีอีเมลเชื่อมต่อ");
                setErrorShown(true);
            } else if (error === 'oauth_failed') {
                toast.error("เข้าสู่ระบบผ่าน Google ล้มเหลว กรุณาลองใหม่อีกครั้ง");
                setErrorShown(true);
            }
        }
    }, [errorShown]);

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
                            className="w-full bg-primary hover:bg-primary/90 text-black font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 uppercase tracking-wide cursor-pointer"
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

                        <div className="relative flex items-center justify-center my-4">
                            <span className="absolute inset-x-0 h-px bg-white/10"></span>
                            <span className="relative bg-[#0b0b0b] px-3 text-[10px] uppercase tracking-wider text-gray-500 font-bold">
                                Or continue with
                            </span>
                        </div>

                        <button
                            type="button"
                            onClick={handleGoogleLogin}
                            className="w-full bg-white/5 hover:bg-white/10 text-white border border-white/10 hover:border-white/20 font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-3 uppercase tracking-wide cursor-pointer text-sm shadow-md"
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24">
                                <path
                                    fill="currentColor"
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                />
                                <path
                                    fill="currentColor"
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                />
                                <path
                                    fill="currentColor"
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                                />
                                <path
                                    fill="currentColor"
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                                />
                            </svg>
                            Gmail / Google
                        </button>
                    </form>
                </div>

                <div className="text-center text-xs text-gray-600">
                    &copy; 2026 BeyBlade X Tournament Manager
                </div>
            </div>
        </div>
    );
}
