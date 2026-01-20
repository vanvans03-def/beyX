'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, UserPlus, Key, Lock, User, Store } from 'lucide-react';
import { toast } from 'sonner';

export default function CreateUserPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        challongeApiKey: '',
        shopName: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            const data = await res.json();

            if (res.ok && data.success) {
                toast.success(`User ${formData.username} created successfully!`);
                router.push('/admin'); // Redirect to dashboard
            } else {
                toast.error(data.error || 'Failed to create user');
            }
        } catch (error) {
            toast.error("Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#050505] text-white p-6 md:p-8 flex items-center justify-center relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

            <div className="w-full max-w-2xl space-y-8 relative z-10">
                <div className="flex items-center gap-6">
                    <button
                        onClick={() => router.back()}
                        className="w-12 h-12 bg-white/5 hover:bg-white/10 rounded-xl flex items-center justify-center border border-white/10 transition-colors"
                    >
                        <UserPlus className="w-6 h-6 text-gray-400" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-extrabold tracking-tight text-white">Add New Shop</h1>
                        <p className="text-gray-400">Create a new admin account for a tournament organizer</p>
                    </div>
                </div>

                <div className="glass-card p-8 rounded-2xl border border-white/10 bg-white/5 shadow-2xl">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                                    <User className="w-4 h-4 text-primary" /> Username
                                </label>
                                <input
                                    type="text"
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                    placeholder="e.g. mbk_shop"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                                    <Store className="w-4 h-4 text-primary" /> Shop Name
                                </label>
                                <input
                                    type="text"
                                    value={formData.shopName}
                                    onChange={(e) => setFormData({ ...formData, shopName: e.target.value })}
                                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                    placeholder="e.g. MBK Center Shop"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                                <Lock className="w-4 h-4 text-primary" /> Password
                            </label>
                            <input
                                type="password"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                placeholder="••••••••"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                                <Key className="w-4 h-4 text-primary" /> Challonge API Key
                            </label>
                            <input
                                type="text"
                                value={formData.challongeApiKey}
                                onChange={(e) => setFormData({ ...formData, challongeApiKey: e.target.value })}
                                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-mono text-sm"
                                placeholder="Enter Challonge API Key"
                                required
                            />
                            <p className="text-xs text-gray-500">
                                Found in Challonge Settings &gt; Developer API
                            </p>
                        </div>

                        <div className="pt-6 flex gap-4">
                            <button
                                type="button"
                                onClick={() => router.back()}
                                className="flex-1 bg-white/5 hover:bg-white/10 text-white font-medium py-3 rounded-xl transition-all border border-white/10 uppercase tracking-wide"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex-1 bg-primary hover:bg-primary/90 text-black font-bold py-3 rounded-xl transition-all shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2 uppercase tracking-wide"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Creating...
                                    </>
                                ) : (
                                    "Create Account"
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
