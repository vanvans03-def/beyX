'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Lock, ShieldCheck, ArrowLeft, Eye, EyeOff, KeyRound } from 'lucide-react';
import { toast } from 'sonner';

export default function ResetPasswordPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [form, setForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (form.newPassword !== form.confirmPassword) {
            toast.error('New passwords do not match');
            return;
        }

        if (form.newPassword.length < 6) {
            toast.error('New password must be at least 6 characters');
            return;
        }

        if (form.currentPassword === form.newPassword) {
            toast.error('New password must be different from the current password');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/admin/profile/password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    currentPassword: form.currentPassword,
                    newPassword: form.newPassword,
                }),
            });

            const data = await res.json();

            if (res.ok && data.success) {
                toast.success('Password changed successfully!');
                setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
            } else {
                toast.error(data.error || 'Failed to change password');
            }
        } catch {
            toast.error('Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    const strength = (() => {
        const p = form.newPassword;
        if (!p) return null;
        if (p.length < 6) return { label: 'Too short', color: 'bg-red-500', width: 'w-1/4' };
        if (p.length < 8) return { label: 'Weak', color: 'bg-orange-500', width: 'w-2/4' };
        if (p.length < 12 || !/[0-9]/.test(p)) return { label: 'Fair', color: 'bg-yellow-500', width: 'w-3/4' };
        return { label: 'Strong', color: 'bg-green-500', width: 'w-full' };
    })();

    return (
        <div className="min-h-screen bg-[#050505] text-white flex items-start md:items-center justify-center relative overflow-hidden">
            {/* Glow effects */}
            <div className="absolute top-[-10%] left-[40%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[10%] w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" />

            <div className="w-full max-w-lg space-y-6 relative z-10 p-4 sm:p-6 md:p-8 mt-4 md:mt-0">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => router.back()}
                        className="w-10 h-10 sm:w-12 sm:h-12 bg-white/5 hover:bg-white/10 rounded-xl flex items-center justify-center border border-white/10 transition-all hover:border-white/20 shrink-0"
                    >
                        <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                    </button>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
                            <KeyRound className="w-5 h-5 sm:w-7 sm:h-7 text-primary shrink-0" />
                            Change Password
                        </h1>
                        <p className="text-gray-400 mt-0.5 text-xs sm:text-sm">Update your account password</p>
                    </div>
                </div>

                {/* Card */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 sm:p-8 shadow-2xl backdrop-blur-sm space-y-5">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Current Password */}
                        <div className="space-y-2">
                            <label className="text-xs sm:text-sm font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                                <Lock className="w-4 h-4 text-gray-400" />
                                Current Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showCurrent ? 'text' : 'password'}
                                    value={form.currentPassword}
                                    onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
                                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 pr-12 text-white text-base placeholder-gray-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                    placeholder="Enter current password"
                                    required
                                    autoComplete="current-password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowCurrent(!showCurrent)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors p-1"
                                >
                                    {showCurrent ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="border-t border-white/5" />

                        {/* New Password */}
                        <div className="space-y-2">
                            <label className="text-xs sm:text-sm font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                                <ShieldCheck className="w-4 h-4 text-primary" />
                                New Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showNew ? 'text' : 'password'}
                                    value={form.newPassword}
                                    onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
                                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 pr-12 text-white text-base placeholder-gray-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                    placeholder="Enter new password"
                                    required
                                    autoComplete="new-password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowNew(!showNew)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors p-1"
                                >
                                    {showNew ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>

                            {/* Strength indicator */}
                            {strength && (
                                <div className="space-y-1">
                                    <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full transition-all duration-300 ${strength.color} ${strength.width}`} />
                                    </div>
                                    <p className={`text-xs font-medium ${strength.label === 'Strong' ? 'text-green-400' :
                                        strength.label === 'Fair' ? 'text-yellow-400' :
                                            strength.label === 'Weak' ? 'text-orange-400' : 'text-red-400'
                                        }`}>{strength.label}</p>
                                </div>
                            )}
                        </div>

                        {/* Confirm Password */}
                        <div className="space-y-2">
                            <label className="text-xs sm:text-sm font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                                <Lock className="w-4 h-4 text-gray-400" />
                                Confirm New Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showConfirm ? 'text' : 'password'}
                                    value={form.confirmPassword}
                                    onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                                    className={`w-full bg-black/50 border rounded-xl px-4 py-3 pr-12 text-white text-base placeholder-gray-600 focus:outline-none focus:ring-1 transition-all ${form.confirmPassword && form.confirmPassword !== form.newPassword
                                        ? 'border-red-500/60 focus:border-red-500 focus:ring-red-500'
                                        : form.confirmPassword && form.confirmPassword === form.newPassword
                                            ? 'border-green-500/60 focus:border-green-500 focus:ring-green-500'
                                            : 'border-white/10 focus:border-primary focus:ring-primary'
                                        }`}
                                    placeholder="Re-enter new password"
                                    required
                                    autoComplete="new-password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirm(!showConfirm)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors p-1"
                                >
                                    {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                            {form.confirmPassword && form.confirmPassword !== form.newPassword && (
                                <p className="text-xs text-red-400">Passwords do not match</p>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col sm:flex-row gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => router.back()}
                                className="w-full sm:flex-1 bg-white/5 hover:bg-white/10 text-white font-medium py-3.5 rounded-xl transition-all border border-white/10 hover:border-white/20 uppercase tracking-wide text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading || (!!form.confirmPassword && form.confirmPassword !== form.newPassword)}
                                className="w-full sm:flex-1 bg-primary hover:bg-primary/90 text-black font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 uppercase tracking-wide text-sm"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Updating...
                                    </>
                                ) : (
                                    <>
                                        <ShieldCheck className="w-4 h-4" />
                                        Update Password
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>

                {/* Info note */}
                <p className="text-center text-xs text-gray-600 pb-4">
                    After changing your password, you will remain logged in on this device.
                </p>
            </div>
        </div>
    );
}
