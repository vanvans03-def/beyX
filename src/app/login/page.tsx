'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
    const googleAuthEnabled = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === 'true';
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [formError, setFormError] = useState('');
    const passwordInput = useRef<HTMLInputElement>(null);
    const router = useRouter();

    const handleGoogleLogin = () => {
        window.location.assign('/api/auth/google');
    };

    const errorShown = useRef(false);

    useEffect(() => {
        if (!errorShown.current) {
            errorShown.current = true;
            const params = new URLSearchParams(window.location.search);
            const error = params.get('error');
            if (error === 'no_email') {
                toast.error("บัญชี Google นี้ไม่มีอีเมลเชื่อมต่อ");
            } else if (error === 'oauth_failed') {
                toast.error("เข้าสู่ระบบผ่าน Google ล้มเหลว กรุณาลองใหม่อีกครั้ง");
            } else if (error === 'oauth_unavailable') {
                toast.error("Google Login ยังไม่ได้ตั้งค่า");
            }
        }
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (loading) return;
        setFormError('');
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
                setFormError(data.error || 'Login failed. Please check your username and password.');
                passwordInput.current?.focus();
            }
        } catch {
            setFormError('Connection failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-svh flex flex-col bg-[#050505] text-white p-4 sm:p-6 relative overflow-hidden">
            {/* Dynamic Background */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,#063324_0%,transparent_65%)]" />

            <div className="relative z-10 mx-auto w-full min-w-0 max-w-md space-y-5 py-2 sm:my-auto sm:py-8">
                <Link
                    href="/"
                    data-motion="enter"
                    className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-gray-300 transition-colors hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
                >
                    <ArrowLeft className="h-4 w-4" />
                    กลับหน้าแรก / Home
                </Link>

                <div className="text-center space-y-2 pt-2">
                    <div data-motion="enter" className="mx-auto w-14 h-14 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center mb-3">
                        <ShieldCheck className="w-8 h-8 text-primary" />
                    </div>
                    <h1 data-motion="enter" className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">Admin Portal</h1>
                    <p data-motion="enter" className="text-sm text-gray-400">Sign in to manage your tournaments</p>
                </div>

                <div className="motion-panel glass-card p-5 sm:p-7 rounded-2xl border border-white/10 bg-white/[0.03]">
                    <form onSubmit={handleLogin} aria-busy={loading} className="space-y-5">
                        <div data-motion="enter" className="space-y-2">
                            <label htmlFor="login-username" className="text-sm font-bold text-gray-300 uppercase tracking-wider">Username</label>
                            <input
                                type="text"
                                id="login-username"
                                autoComplete="username"
                                autoCapitalize="none"
                                spellCheck={false}
                                aria-invalid={!!formError}
                                aria-describedby={formError ? 'login-error' : undefined}
                                value={username}
                                onChange={(e) => { setUsername(e.target.value); setFormError(''); }}
                                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-medium"
                                placeholder="Enter username"
                                required
                            />
                        </div>

                        <div data-motion="enter" className="space-y-2">
                            <label htmlFor="login-password" className="text-sm font-bold text-gray-300 uppercase tracking-wider">Password</label>
                            <div className="relative"><input
                                ref={passwordInput}
                                type={showPassword ? 'text' : 'password'}
                                id="login-password"
                                autoComplete="current-password"
                                aria-invalid={!!formError}
                                aria-describedby={formError ? 'login-error' : undefined}
                                value={password}
                                onChange={(e) => { setPassword(e.target.value); setFormError(''); }}
                                className="w-full bg-black/50 border border-white/10 rounded-xl pl-4 pr-14 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors font-medium"
                                placeholder="••••••••"
                                required
                            /><button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 hover:text-primary">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
                        </div>

                        {formError && <p id="login-error" data-motion="feedback" role="alert" className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm leading-relaxed text-red-200">{formError}</p>}

                        <button
                            type="submit"
                            data-motion="enter"
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

                        {googleAuthEnabled && <>
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
                        </>}
                    </form>
                </div>

                <div className="text-center text-[11px] text-gray-500">
                    &copy; 2026 BeyBlade X Tournament Manager
                </div>
            </div>
        </div>
    );
}
