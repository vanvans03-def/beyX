'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Users, ArrowLeft, UserPlus, Shield, ToggleLeft, ToggleRight, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/useTranslation';

type Organizer = {
    id: string;
    username: string;
    shop_name: string;
    email: string | null;
    role: 'superadmin' | 'user';
    event_mode_enabled: boolean;
    music_enabled: boolean;
    tts_enabled: boolean;
    challonge_enabled: boolean;
    internal_bracket_enabled: boolean;
};

export default function UsersManagementPage() {
    const router = useRouter();
    const { t, lang, toggleLang } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState<Organizer[]>([]);
    const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/users/manage');
            const data = await res.json();
            if (res.ok && data.success) {
                setUsers(data.users);
            } else {
                toast.error(data.error || 'Failed to load users');
                // Redirect if not authorized
                if (res.status === 403) router.push('/admin');
            }
        } catch (error) {
            toast.error('Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = async (userId: string, field: keyof Organizer, currentValue: boolean | string) => {
        setUpdatingUserId(userId);
        const nextValue = typeof currentValue === 'boolean' ? !currentValue : currentValue;
        try {
            const res = await fetch('/api/admin/users/manage', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    [field]: nextValue
                }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setUsers(prev => prev.map(u => u.id === userId ? { ...u, [field]: nextValue } : u));
                toast.success(t('admin.users.toast.updated'));
            } else {
                toast.error(data.error || t('admin.users.toast.failed'));
            }
        } catch (error) {
            toast.error('Network error');
        } finally {
            setUpdatingUserId(null);
        }
    };

    return (
        <div className="min-h-screen bg-[#050505] text-white p-6 md:p-8 relative overflow-hidden">
            {/* Background Gradient */}
            <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

            <div className="w-full max-w-6xl mx-auto space-y-8 relative z-10">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push('/admin')}
                            className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-lg flex items-center justify-center border border-white/10 transition-colors cursor-pointer"
                        >
                            <ArrowLeft className="w-5 h-5 text-gray-400" />
                        </button>
                        <div>
                            <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
                                <Users className="w-8 h-8 text-primary" /> {t('admin.users.title')}
                            </h1>
                            <p className="text-gray-400 text-sm">{t('admin.users.desc')}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 self-start sm:self-center">
                        <button 
                            onClick={toggleLang} 
                            className="p-2.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors flex items-center gap-2 text-xs font-bold cursor-pointer"
                        >
                            <Globe className="h-4 w-4 text-primary" />
                            <span>{lang === 'TH' ? 'English' : 'ไทย'}</span>
                        </button>
                        <button
                            onClick={() => router.push('/admin/users/create')}
                            className="bg-primary hover:bg-primary/95 text-black font-bold px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-primary/20 flex items-center gap-2 uppercase text-xs tracking-wide cursor-pointer animate-pulse-slow"
                        >
                            <UserPlus className="w-4 h-4" /> {t('admin.users.btn.create')}
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>
                ) : (
                    <div className="glass-card rounded-2xl border border-white/10 bg-white/5 overflow-hidden shadow-2xl">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-white/10 bg-white/5 text-gray-400 text-xs font-bold uppercase tracking-wider">
                                        <th className="p-4">{t('admin.users.col.organizer')}</th>
                                        <th className="p-4">{t('admin.users.col.email')}</th>
                                        <th className="p-4 text-center">{t('admin.users.col.role')}</th>
                                        <th className="p-4 text-center">{t('admin.users.col.event_mode')}</th>
                                        <th className="p-4 text-center">{t('admin.users.col.music')}</th>
                                        <th className="p-4 text-center">{t('admin.users.col.tts')}</th>
                                        <th className="p-4 text-center">{t('admin.users.col.challonge')}</th>
                                        <th className="p-4 text-center">{t('admin.users.col.internal')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((user) => (
                                        <tr key={user.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                            <td className="p-4">
                                                <div className="font-semibold text-white">{user.shop_name}</div>
                                                <div className="text-xs text-gray-500 font-mono">@{user.username}</div>
                                            </td>
                                            <td className="p-4 text-sm text-gray-400 font-mono">
                                                {user.email || <span className="text-gray-600 italic">{t('admin.users.not_set')}</span>}
                                            </td>
                                            <td className="p-4 text-center">
                                                <button
                                                    disabled={updatingUserId !== null || user.username === 'admin'}
                                                    onClick={() => handleToggle(user.id, 'role', user.role === 'superadmin' ? 'user' : 'superadmin')}
                                                    className={`px-2 py-1 rounded text-[10px] font-bold uppercase border cursor-pointer ${
                                                        user.role === 'superadmin'
                                                            ? 'bg-red-500/10 border-red-500/30 text-red-400'
                                                            : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                                                    } disabled:opacity-50`}
                                                >
                                                    {user.role}
                                                </button>
                                            </td>
                                            {/* Event Mode */}
                                            <td className="p-4 text-center">
                                                <button
                                                    disabled={updatingUserId !== null}
                                                    onClick={() => handleToggle(user.id, 'event_mode_enabled', user.event_mode_enabled)}
                                                    className="text-primary hover:scale-105 transition-transform disabled:opacity-50 cursor-pointer"
                                                >
                                                    {user.event_mode_enabled ? (
                                                        <ToggleRight className="w-8 h-8 text-green-500" />
                                                    ) : (
                                                        <ToggleLeft className="w-8 h-8 text-gray-600" />
                                                    )}
                                                </button>
                                            </td>
                                            {/* Music */}
                                            <td className="p-4 text-center">
                                                <button
                                                    disabled={updatingUserId !== null}
                                                    onClick={() => handleToggle(user.id, 'music_enabled', user.music_enabled)}
                                                    className="text-primary hover:scale-105 transition-transform disabled:opacity-50 cursor-pointer"
                                                >
                                                    {user.music_enabled ? (
                                                        <ToggleRight className="w-8 h-8 text-green-500" />
                                                    ) : (
                                                        <ToggleLeft className="w-8 h-8 text-gray-600" />
                                                    )}
                                                </button>
                                            </td>
                                            {/* TTS */}
                                            <td className="p-4 text-center">
                                                <button
                                                    disabled={updatingUserId !== null}
                                                    onClick={() => handleToggle(user.id, 'tts_enabled', user.tts_enabled)}
                                                    className="text-primary hover:scale-105 transition-transform disabled:opacity-50 cursor-pointer"
                                                >
                                                    {user.tts_enabled ? (
                                                        <ToggleRight className="w-8 h-8 text-green-500" />
                                                    ) : (
                                                        <ToggleLeft className="w-8 h-8 text-gray-600" />
                                                    )}
                                                </button>
                                            </td>
                                            {/* Challonge */}
                                            <td className="p-4 text-center">
                                                <button
                                                    disabled={updatingUserId !== null}
                                                    onClick={() => handleToggle(user.id, 'challonge_enabled', user.challonge_enabled)}
                                                    className="text-primary hover:scale-105 transition-transform disabled:opacity-50 cursor-pointer"
                                                >
                                                    {user.challonge_enabled ? (
                                                        <ToggleRight className="w-8 h-8 text-green-500" />
                                                    ) : (
                                                        <ToggleLeft className="w-8 h-8 text-gray-600" />
                                                    )}
                                                </button>
                                            </td>
                                            {/* Internal Bracket */}
                                            <td className="p-4 text-center">
                                                <button
                                                    disabled={updatingUserId !== null}
                                                    onClick={() => handleToggle(user.id, 'internal_bracket_enabled', user.internal_bracket_enabled)}
                                                    className="text-primary hover:scale-105 transition-transform disabled:opacity-50 cursor-pointer"
                                                >
                                                    {user.internal_bracket_enabled ? (
                                                        <ToggleRight className="w-8 h-8 text-green-500" />
                                                    ) : (
                                                        <ToggleLeft className="w-8 h-8 text-gray-600" />
                                                    )}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
