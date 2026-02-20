'use client';

import { useState } from 'react';
import { Loader2, Lock, ShieldCheck, Eye, EyeOff, KeyRound, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

type Step = 'form' | 'success';

export default function MigratePasswordPage() {
    const [step, setStep] = useState<Step>('form');
    const [loading, setLoading] = useState(false);
    const [show, setShow] = useState({ current: false, new: false, confirm: false });
    const [form, setForm] = useState({
        username: '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });

    const strength = (() => {
        const p = form.newPassword;
        if (!p) return null;
        if (p.length < 6) return { label: 'Too short', color: 'bg-red-500', width: 'w-1/4', text: 'text-red-400' };
        if (p.length < 8) return { label: 'Weak', color: 'bg-orange-500', width: 'w-2/4', text: 'text-orange-400' };
        if (p.length < 12 || !/[0-9]/.test(p)) return { label: 'Fair', color: 'bg-yellow-500', width: 'w-3/4', text: 'text-yellow-400' };
        return { label: 'Strong', color: 'bg-green-500', width: 'w-full', text: 'text-green-400' };
    })();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (form.newPassword !== form.confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }
        if (form.newPassword.length < 6) {
            toast.error('Password must be at least 6 characters');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/migrate-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: form.username,
                    currentPassword: form.currentPassword,
                    newPassword: form.newPassword,
                }),
            });

            const data = await res.json();

            if (res.ok && data.success) {
                setStep('success');
            } else {
                toast.error(data.error || 'Something went wrong');
            }
        } catch {
            toast.error('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background glows */}
            <div className="absolute top-[-10%] left-[30%] w-[600px] h-[600px] bg-primary/10 rounded-full blur-[140px] pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-blue-600/5 rounded-full blur-[100px] pointer-events-none" />

            <div className="w-full max-w-md relative z-10">
                {step === 'success' ? (
                    /* ── Success State ── */
                    <div className="text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="w-20 h-20 bg-green-500/10 border border-green-500/30 rounded-full flex items-center justify-center mx-auto">
                            <CheckCircle2 className="w-10 h-10 text-green-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white">Password Updated!</h1>
                            <p className="text-gray-400 mt-2 text-sm">
                                Your password has been migrated successfully.<br />
                                You can now login with your new password.
                            </p>
                        </div>
                        <a
                            href="/login"
                            className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-black font-bold px-8 py-3 rounded-xl transition-all shadow-lg shadow-primary/20 uppercase tracking-wide text-sm"
                        >
                            Go to Login
                        </a>
                    </div>
                ) : (
                    /* ── Form State ── */
                    <div className="space-y-6">
                        {/* Header */}
                        <div className="text-center space-y-2">
                            <div className="w-16 h-16 bg-primary/10 border border-primary/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <KeyRound className="w-8 h-8 text-primary" />
                            </div>
                            <h1 className="text-2xl font-extrabold tracking-tight">Set New Password</h1>
                            <p className="text-gray-400 text-sm leading-relaxed">
                                Enter your current password and choose a new one
                            </p>
                        </div>

                        {/* Card */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 shadow-2xl backdrop-blur-sm">
                            <form onSubmit={handleSubmit} className="space-y-4">
                                {/* Username */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                                        Username
                                    </label>
                                    <input
                                        type="text"
                                        value={form.username}
                                        onChange={(e) => setForm({ ...form, username: e.target.value })}
                                        className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                        placeholder="Your username"
                                        required
                                        autoComplete="username"
                                    />
                                </div>

                                {/* Current Password */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                                        Current Password
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={show.current ? 'text' : 'password'}
                                            value={form.currentPassword}
                                            onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
                                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 pr-12 text-white placeholder-gray-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                            placeholder="Your old password"
                                            required
                                            autoComplete="current-password"
                                        />
                                        <button type="button" onClick={() => setShow(s => ({ ...s, current: !s.current }))}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                                            {show.current ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </div>

                                <div className="border-t border-white/5 my-2" />

                                {/* New Password */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                                        <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                                        New Password
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={show.new ? 'text' : 'password'}
                                            value={form.newPassword}
                                            onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
                                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 pr-12 text-white placeholder-gray-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                            placeholder="Min. 6 characters"
                                            required
                                            autoComplete="new-password"
                                        />
                                        <button type="button" onClick={() => setShow(s => ({ ...s, new: !s.new }))}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                                            {show.new ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                        </button>
                                    </div>
                                    {strength && (
                                        <div className="space-y-1">
                                            <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                                                <div className={`h-full rounded-full transition-all duration-300 ${strength.color} ${strength.width}`} />
                                            </div>
                                            <p className={`text-xs font-medium ${strength.text}`}>{strength.label}</p>
                                        </div>
                                    )}
                                </div>

                                {/* Confirm Password */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                                        Confirm New Password
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={show.confirm ? 'text' : 'password'}
                                            value={form.confirmPassword}
                                            onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                                            className={`w-full bg-black/50 border rounded-xl px-4 py-3 pr-12 text-white placeholder-gray-600 focus:outline-none focus:ring-1 transition-all ${form.confirmPassword && form.confirmPassword !== form.newPassword
                                                    ? 'border-red-500/60 focus:border-red-500 focus:ring-red-500'
                                                    : form.confirmPassword && form.confirmPassword === form.newPassword
                                                        ? 'border-green-500/60 focus:border-green-500 focus:ring-green-500'
                                                        : 'border-white/10 focus:border-primary focus:ring-primary'
                                                }`}
                                            placeholder="Re-enter new password"
                                            required
                                            autoComplete="new-password"
                                        />
                                        <button type="button" onClick={() => setShow(s => ({ ...s, confirm: !s.confirm }))}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                                            {show.confirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                        </button>
                                    </div>
                                    {form.confirmPassword && form.confirmPassword !== form.newPassword && (
                                        <p className="text-xs text-red-400">Passwords do not match</p>
                                    )}
                                </div>

                                {/* Submit */}
                                <button
                                    type="submit"
                                    disabled={loading || (!!form.confirmPassword && form.confirmPassword !== form.newPassword)}
                                    className="w-full bg-primary hover:bg-primary/90 text-black font-bold py-3 rounded-xl transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 uppercase tracking-wide text-sm mt-2"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Updating...
                                        </>
                                    ) : (
                                        <>
                                            <Lock className="w-4 h-4" />
                                            Update Password
                                        </>
                                    )}
                                </button>
                            </form>
                        </div>

                        <p className="text-center text-xs text-gray-600">
                            Already updated?{' '}
                            <a href="/login" className="text-primary hover:underline">Go to Login</a>
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
