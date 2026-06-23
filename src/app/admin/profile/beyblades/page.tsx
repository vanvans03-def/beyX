'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowLeft, Award, Search, Save, RotateCcw, AlertTriangle, CheckCircle, Globe, Grid, List, Shield, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/useTranslation';

type Beyblade = {
    id: string;
    name: string;
    image_url: string;
    points_standard: number;
    is_banned: boolean;
    custom_points_standard: number | null;
    custom_is_banned: boolean | null;
    type: 'BX' | 'CX' | 'UX' | 'CX_SPECIAL' | 'NORMAL_ATTACHMENT' | 'LOCK_CHIP' | 'ASSIST_BLADE' | 'RACHET' | 'BIT';
};

export default function CustomScoringPage() {
    const router = useRouter();
    const { t, lang, toggleLang } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [beyblades, setBeyblades] = useState<Beyblade[]>([]);
    const [originalBeyblades, setOriginalBeyblades] = useState<Beyblade[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [saving, setSaving] = useState(false);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
    const [showGuide, setShowGuide] = useState(true);
    const [cxEnabled, setCxEnabled] = useState(true);
    const [originalCxEnabled, setOriginalCxEnabled] = useState(true);

    // Tab State
    const [activeTab, setActiveTab] = useState<'beyblades' | 'attachments'>('beyblades');
    const [subFilter, setSubFilter] = useState<string>('All');

    useEffect(() => {
        const savedMode = localStorage.getItem('custom_scoring_view_mode') as 'grid' | 'list';
        if (savedMode) {
            setViewMode(savedMode);
        } else if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
            setViewMode('grid');
        }

        const hideGuide = localStorage.getItem('custom_scoring_hide_guide');
        if (hideGuide === 'true') {
            setShowGuide(false);
        }
    }, []);

    const handleHideGuide = () => {
        setShowGuide(false);
        localStorage.setItem('custom_scoring_hide_guide', 'true');
    };

    const handleToggleViewMode = (mode: 'grid' | 'list') => {
        setViewMode(mode);
        localStorage.setItem('custom_scoring_view_mode', mode);
    };

    useEffect(() => {
        fetchCustomScoring();
    }, []);

    const fetchCustomScoring = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/profile/beyblades');
            const data = await res.json();
            if (res.ok && data.success) {
                // Copy the array to prevent reference sharing
                const loaded = data.beyblades.map((b: any) => ({
                    id: b.id,
                    name: b.name,
                    image_url: b.image_url,
                    points_standard: b.points_standard,
                    is_banned: b.is_banned,
                    custom_points_standard: b.custom_points_standard,
                    custom_is_banned: b.custom_is_banned,
                    type: b.type
                }));
                setBeyblades(loaded);
                setOriginalBeyblades(loaded.map((b: any) => ({ ...b })));
                if (data.cx_enabled !== undefined) {
                    setCxEnabled(data.cx_enabled);
                    setOriginalCxEnabled(data.cx_enabled);
                }
            } else {
                toast.error(data.error || 'Failed to load custom scoring');
                if (res.status === 401) router.push('/login');
            }
        } catch (error) {
            toast.error('Network error loading data');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdatePoints = (id: string, value: string) => {
        setBeyblades(prev => prev.map(b => {
            if (b.id !== id) return b;
            const parsed = value === '' ? null : Number(value);
            return {
                ...b,
                custom_points_standard: parsed !== null && isNaN(parsed) ? b.custom_points_standard : parsed
            };
        }));
    };

    const handleUpdateBanStatus = (id: string, value: boolean | null) => {
        setBeyblades(prev => prev.map(b => {
            if (b.id !== id) return b;
            return {
                ...b,
                custom_is_banned: value
            };
        }));
    };

    const handleReset = () => {
        setBeyblades(originalBeyblades.map(b => ({ ...b })));
        setCxEnabled(originalCxEnabled);
        toast.info(lang === 'TH' ? 'ย้อนคืนค่าที่บันทึกล่าสุดแล้ว' : 'Changes reset to last saved state');
    };

    const handleSaveAll = async () => {
        // Find modified ones
        const updates = beyblades.filter((b, idx) => {
            const orig = originalBeyblades[idx];
            if (!orig) return false;
            return (
                b.custom_points_standard !== orig.custom_points_standard ||
                b.custom_is_banned !== orig.custom_is_banned
            );
        }).map(b => ({
            beyblade_id: b.id,
            points_standard: b.custom_points_standard,
            is_banned: b.custom_is_banned
        }));

        setSaving(true);
        try {
            const res = await fetch('/api/admin/profile/beyblades', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    updates,
                    cx_enabled: cxEnabled
                })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                toast.success(t('custom_scoring.saved_success'));
                // Update original reference state
                setOriginalBeyblades(beyblades.map(b => ({ ...b })));
                setOriginalCxEnabled(cxEnabled);
            } else {
                toast.error(data.error || 'Failed to save changes');
            }
        } catch (error) {
            toast.error('Network error during save');
        } finally {
            setSaving(false);
        }
    };

    const filteredBeys = beyblades.filter(b => {
        // 1. Search filter
        const matchesSearch = b.name.toLowerCase().includes(searchQuery.toLowerCase());
        if (!matchesSearch) return false;

        // 2. Tab and Sub-filter
        const isAttachment = ['CX_SPECIAL', 'NORMAL_ATTACHMENT', 'LOCK_CHIP', 'ASSIST_BLADE', 'RACHET', 'BIT'].includes(b.type);
        if (activeTab === 'beyblades') {
            if (isAttachment) return false;
            if (subFilter !== 'All' && b.type !== subFilter) return false;
        } else {
            if (!isAttachment) return false;
            if (subFilter !== 'All' && b.type !== subFilter) return false;
        }

        return true;
    });

    // Calculate changes count
    const hasUnsavedChanges = cxEnabled !== originalCxEnabled || beyblades.some((b, idx) => {
        const orig = originalBeyblades[idx];
        if (!orig) return false;
        return (
            b.custom_points_standard !== orig.custom_points_standard ||
            b.custom_is_banned !== orig.custom_is_banned
        );
    });

    const changedCount = (cxEnabled !== originalCxEnabled ? 1 : 0) + beyblades.filter((b, idx) => {
        const orig = originalBeyblades[idx];
        if (!orig) return false;
        return (
            b.custom_points_standard !== orig.custom_points_standard ||
            b.custom_is_banned !== orig.custom_is_banned
        );
    }).length;

    return (
        <div className="min-h-screen bg-[#050505] text-white p-3 sm:p-4 md:p-8 relative overflow-hidden pb-32">
            {/* Background decorative gradient */}
            <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[100px] pointer-events-none" />

            <div className="w-full max-w-6xl mx-auto space-y-4 md:space-y-6 relative z-10">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.push('/admin')}
                            className="w-9 h-9 sm:w-10 sm:h-10 bg-white/5 hover:bg-white/10 rounded-lg flex items-center justify-center border border-white/10 transition-colors cursor-pointer"
                        >
                            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                        </button>
                        <div>
                            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2 sm:gap-3">
                                <Award className="w-6 h-6 sm:w-8 h-8 text-primary" /> {t('custom_scoring.title')}
                            </h1>
                            <p className="text-gray-400 text-[11px] sm:text-xs md:text-sm">{t('custom_scoring.desc')}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 self-end md:self-center">
                        <button 
                            onClick={toggleLang} 
                            className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors flex items-center gap-1.5 text-[11px] sm:text-xs font-bold cursor-pointer"
                        >
                            <Globe className="h-3.5 w-3.5 text-primary" />
                            <span>{lang === 'TH' ? 'English' : 'ไทย'}</span>
                        </button>
                    </div>
                </div>

                {/* Info Card */}
                {showGuide && (
                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-3 sm:p-4 flex gap-3 text-xs sm:text-sm text-yellow-500/90 max-w-2xl relative group">
                        <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 mt-0.5" />
                        <div className="pr-6">
                            <span className="font-bold">{t('custom_scoring.how_works')}</span>
                            <p className="text-gray-300 mt-1 leading-relaxed text-[11px] sm:text-xs">{t('custom_scoring.how_works_desc')}</p>
                        </div>
                        <button
                            onClick={handleHideGuide}
                            className="absolute top-2.5 right-2.5 text-gray-400 hover:text-yellow-500 p-1 rounded-md transition-colors cursor-pointer"
                            title="Dismiss guide"
                        >
                            <span className="text-[10px] font-bold">✕</span>
                        </button>
                    </div>
                )}

                {/* Rules Settings Card */}
                <div className="bg-[#111111]/40 border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
                            {lang === 'TH' ? 'ตั้งค่ากติกาส่วนเสริม (CX Attachments)' : 'CX Attachments Scoring Rules'}
                        </h3>
                        <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                            {lang === 'TH' 
                                ? 'เปิด/ปิดการบวกคะแนนเพิ่ม 1 คะแนนสำหรับชิ้นส่วนเสริมพิเศษ (Heavy, Wheel) ในระบบลงทะเบียนและแสดงผล' 
                                : 'Enable or disable the +1 point multiplier for special CX line attachments (Heavy, Wheel) during deck validation and matching.'}
                        </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none self-start sm:self-center">
                        <input 
                            type="checkbox" 
                            checked={cxEnabled} 
                            onChange={(e) => setCxEnabled(e.target.checked)}
                            className="sr-only peer" 
                        />
                        <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-gray-300 after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary peer-checked:after:bg-black peer-checked:after:border-primary"></div>
                        <span className="ms-3 text-xs font-bold text-gray-300 peer-checked:text-primary">
                            {cxEnabled 
                                ? (lang === 'TH' ? 'เปิดใช้งาน (+1 คะแนน)' : 'Enabled (+1 pt)') 
                                : (lang === 'TH' ? 'ปิดใช้งาน (ไม่คิดคะแนนพิเศษ)' : 'Disabled')}
                        </span>
                    </label>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-white/10">
                    <button
                        onClick={() => { setActiveTab('beyblades'); setSubFilter('All'); }}
                        className={`flex items-center gap-2 px-6 py-3 font-bold text-sm border-b-2 transition-all cursor-pointer ${activeTab === 'beyblades' ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-white'}`}
                    >
                        <Shield className="w-4 h-4" />
                        {lang === 'TH' ? 'เบย์เบลด' : 'Beyblades'}
                    </button>
                    <button
                        onClick={() => { setActiveTab('attachments'); setSubFilter('All'); }}
                        className={`flex items-center gap-2 px-6 py-3 font-bold text-sm border-b-2 transition-all cursor-pointer ${activeTab === 'attachments' ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-white'}`}
                    >
                        <Wrench className="w-4 h-4" />
                        {lang === 'TH' ? 'ชิ้นส่วนเสริม' : 'Attachments'}
                    </button>
                </div>

                <div className="flex flex-row items-center gap-2 sm:gap-4 w-full">
                    {/* Filter and Search */}
                    <div className="flex bg-[#111111] border border-white/10 rounded-xl px-3 py-2 items-center gap-2 w-full max-w-md">
                        <Search className="w-4 h-4 text-gray-500 shrink-0" />
                        <input
                            type="text"
                            placeholder={activeTab === 'beyblades' ? (lang === 'TH' ? 'ค้นหาเบย์เบลด...' : 'Search Beyblades...') : (lang === 'TH' ? 'ค้นหาชิ้นส่วนเสริม...' : 'Search attachments...')}
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="bg-transparent text-white w-full outline-none text-xs sm:text-sm"
                        />
                    </div>

                    {/* Sub filters */}
                    <div className="flex flex-wrap gap-2">
                        {activeTab === 'beyblades' ? (
                            ['All', 'BX', 'CX', 'UX'].map((cat) => (
                                <button
                                    key={cat}
                                    type="button"
                                    onClick={() => setSubFilter(cat)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${subFilter === cat ? 'bg-primary text-black border-primary' : 'bg-white/5 border-white/10 hover:bg-white/10 text-gray-300'}`}
                                >
                                    {cat}
                                </button>
                            ))
                        ) : (
                            ['All', 'LOCK_CHIP', 'ASSIST_BLADE', 'RACHET', 'BIT'].map((cat) => (
                                <button
                                    key={cat}
                                    type="button"
                                    onClick={() => setSubFilter(cat)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${subFilter === cat ? 'bg-primary text-black border-primary' : 'bg-white/5 border-white/10 hover:bg-white/10 text-gray-300'}`}
                                >
                                    {cat === 'All' ? 'All' : cat === 'LOCK_CHIP' ? 'Lock Chip' : cat === 'ASSIST_BLADE' ? 'Assist Blade' : cat === 'RACHET' ? 'Rachet' : 'Bit'}
                                </button>
                            ))
                        )}
                    </div>

                    {/* View Toggle */}
                    <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-0.5 sm:p-1 gap-0.5 sm:gap-1 shrink-0 ml-auto">
                        <button
                            type="button"
                            onClick={() => handleToggleViewMode('list')}
                            className={`p-1.5 sm:p-2 rounded-lg transition-all flex items-center gap-1.5 text-xs font-bold cursor-pointer ${
                                viewMode === 'list' ? 'bg-primary text-black' : 'text-gray-400 hover:text-white'
                            }`}
                            title="List View"
                        >
                            <List className="w-4 h-4" />
                            <span className="hidden sm:inline">List</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => handleToggleViewMode('grid')}
                            className={`p-1.5 sm:p-2 rounded-lg transition-all flex items-center gap-1.5 text-xs font-bold cursor-pointer ${
                                viewMode === 'grid' ? 'bg-primary text-black' : 'text-gray-400 hover:text-white'
                            }`}
                            title="Grid View"
                        >
                            <Grid className="w-4 h-4" />
                            <span className="hidden sm:inline">Grid</span>
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center p-12">
                        <Loader2 className="animate-spin text-primary w-8 h-8" />
                    </div>
                ) : (
                    viewMode === 'list' ? (
                        /* Compact List Layout */
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                            {filteredBeys.map((bey) => {
                                const orig = originalBeyblades.find(o => o.id === bey.id);
                                const isModified = orig ? (
                                    bey.custom_points_standard !== orig.custom_points_standard ||
                                    bey.custom_is_banned !== orig.custom_is_banned
                                ) : false;

                                const actualStandardPoints = bey.custom_points_standard !== null ? bey.custom_points_standard : bey.points_standard;
                                const actualBanned = bey.custom_is_banned !== null ? bey.custom_is_banned : bey.is_banned;

                                return (
                                    <div
                                        key={bey.id}
                                        className={`group flex items-center justify-between bg-[#111111]/60 hover:bg-[#161616]/80 border rounded-xl p-2 sm:p-2.5 transition-all duration-200 gap-2 sm:gap-3 ${
                                            isModified
                                                ? 'border-primary shadow-lg shadow-primary/5'
                                                : 'border-white/10 hover:border-white/20'
                                        }`}
                                    >
                                        {/* Left: Image & Name */}
                                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                            <div className="relative w-10 h-10 sm:w-11 sm:h-11 bg-black/60 rounded-lg overflow-hidden shrink-0 flex items-center justify-center p-0.5 border border-white/5">
                                                <img
                                                    src={bey.image_url}
                                                    alt={bey.name}
                                                    className="w-full h-full object-contain"
                                                    loading="lazy"
                                                />
                                                <div className="absolute top-0.5 right-0.5">
                                                    {actualBanned && (
                                                        <span className="bg-red-500/90 text-white font-bold text-[6px] px-1 rounded shadow uppercase tracking-wide">
                                                            {t('custom_scoring.banned')}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="font-bold text-xs sm:text-sm truncate text-white max-w-[120px] xs:max-w-[150px] sm:max-w-none" title={bey.name}>
                                                    {bey.name}
                                                </h3>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <span className="text-[9px] text-gray-500 font-bold uppercase">
                                                        {t('custom_scoring.standard_point')}: {bey.points_standard}p
                                                    </span>
                                                    {isModified && (
                                                        <span className="bg-primary text-black font-black text-[7px] px-1 rounded tracking-wide uppercase">
                                                            Mod
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right: Inputs */}
                                        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 flex-nowrap justify-end">
                                            {/* Custom Points */}
                                            <div className="flex items-center gap-1">
                                                <span className="text-[8px] text-gray-500 font-bold uppercase hidden md:inline">{t('custom_scoring.custom_point')}:</span>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="15"
                                                    placeholder={`${bey.points_standard}`}
                                                    value={bey.custom_points_standard === null ? '' : bey.custom_points_standard}
                                                    onChange={e => handleUpdatePoints(bey.id, e.target.value)}
                                                    className={`w-11 sm:w-12 text-center bg-black/60 border rounded-lg px-1 py-1 text-xs focus:outline-none focus:border-primary font-bold ${
                                                        bey.custom_points_standard !== null ? 'text-primary border-primary/50' : 'text-gray-400 border-white/10'
                                                    }`}
                                                />
                                            </div>

                                            {/* Ban Override */}
                                            <div className="grid grid-cols-2 gap-0.5 bg-black/40 border border-white/5 rounded-lg p-0.5 text-[7.5px] sm:text-[8.5px] font-bold tracking-tighter w-20 sm:w-24">
                                                <button
                                                    type="button"
                                                    onClick={() => handleUpdateBanStatus(bey.id, null)}
                                                    className={`py-0.5 sm:py-1 rounded transition-colors cursor-pointer ${
                                                        bey.custom_is_banned === null || bey.custom_is_banned === false
                                                            ? 'bg-white/10 text-white'
                                                            : 'text-gray-500 hover:text-gray-300'
                                                    }`}
                                                >
                                                    {t('custom_scoring.ban_default')}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleUpdateBanStatus(bey.id, bey.custom_is_banned === true ? null : true)}
                                                    className={`py-0.5 sm:py-1 rounded transition-colors cursor-pointer ${
                                                        bey.custom_is_banned === true
                                                            ? 'bg-red-500/80 text-white font-black'
                                                            : 'text-gray-500 hover:text-gray-300'
                                                    }`}
                                                >
                                                    {t('custom_scoring.ban_ban')}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            {filteredBeys.length === 0 && (
                                <div className="col-span-full py-12 text-center text-gray-500 text-sm">
                                    {lang === 'TH' ? 'ไม่พบข้อมูลที่ตรงกับการค้นหา' : 'No items match your search/filter.'}
                                </div>
                            )}
                        </div>
                    ) : (
                        /* Compact Grid Layout */
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-3">
                            {filteredBeys.map((bey) => {
                                const orig = originalBeyblades.find(o => o.id === bey.id);
                                const isModified = orig ? (
                                    bey.custom_points_standard !== orig.custom_points_standard ||
                                    bey.custom_is_banned !== orig.custom_is_banned
                                ) : false;

                                const actualStandardPoints = bey.custom_points_standard !== null ? bey.custom_points_standard : bey.points_standard;
                                const actualBanned = bey.custom_is_banned !== null ? bey.custom_is_banned : bey.is_banned;

                                return (
                                    <div
                                        key={bey.id}
                                        className={`group flex flex-col bg-[#111111]/60 hover:bg-[#161616]/80 border rounded-xl p-2.5 transition-all duration-200 ${
                                            isModified
                                                ? 'border-primary shadow-lg shadow-primary/10'
                                                : 'border-white/10 hover:border-white/20'
                                        }`}
                                    >
                                        {/* Shorter Image Container */}
                                        <div className="relative w-full h-20 sm:h-24 md:h-28 bg-black/40 rounded-lg overflow-hidden mb-2 flex items-center justify-center p-1.5 border border-white/5">
                                            <img
                                                src={bey.image_url}
                                                alt={bey.name}
                                                className="w-full h-full object-contain"
                                                loading="lazy"
                                            />
                                            <div className="absolute top-1 right-1 flex flex-col gap-1 items-end">
                                                {isModified && (
                                                    <span className="bg-primary text-black font-black text-[6.5px] px-1 rounded shadow tracking-wide uppercase">
                                                        Mod
                                                    </span>
                                                )}
                                                {actualBanned && (
                                                    <span className="bg-red-500/90 text-white font-bold text-[6.5px] px-1 rounded shadow tracking-wide uppercase">
                                                        {t('custom_scoring.banned')}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Name */}
                                        <h3 className="font-bold text-xs sm:text-sm truncate text-center mb-2 text-white px-0.5" title={bey.name}>
                                            {bey.name}
                                        </h3>

                                        {/* Override Inputs */}
                                        <div className="space-y-1.5 border-t border-white/5 pt-2 mt-auto">
                                            {/* Standard Points */}
                                            <div className="flex items-center justify-between gap-1 text-[9px]">
                                                <span className="text-[8px] text-gray-500 font-bold uppercase">{t('custom_scoring.standard_point')}</span>
                                                <span className="w-11 text-center text-gray-400 font-extrabold py-0.5 bg-white/5 rounded border border-white/5">
                                                    {bey.points_standard}p
                                                </span>
                                            </div>

                                            {/* Custom Points */}
                                            <div className="flex items-center justify-between gap-1">
                                                <span className="text-[8px] text-gray-300 font-bold uppercase">{t('custom_scoring.custom_point')}</span>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="15"
                                                    placeholder={`${bey.points_standard}`}
                                                    value={bey.custom_points_standard === null ? '' : bey.custom_points_standard}
                                                    onChange={e => handleUpdatePoints(bey.id, e.target.value)}
                                                    className={`w-11 text-center bg-black/50 border rounded px-1 py-0.5 text-xs focus:outline-none focus:border-primary font-bold ${
                                                        bey.custom_points_standard !== null ? 'text-primary border-primary/50' : 'text-gray-400 border-white/10'
                                                    }`}
                                                />
                                            </div>

                                            {/* Ban Override */}
                                            <div className="flex flex-col gap-1 pt-0.5">
                                                <div className="grid grid-cols-2 gap-0.5 bg-black/40 border border-white/5 rounded p-0.5 text-[7.5px] font-bold tracking-tighter">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleUpdateBanStatus(bey.id, null)}
                                                        className={`py-0.5 rounded transition-colors cursor-pointer ${
                                                            bey.custom_is_banned === null || bey.custom_is_banned === false
                                                                ? 'bg-white/10 text-white'
                                                                : 'text-gray-500 hover:text-gray-300'
                                                        }`}
                                                    >
                                                        {t('custom_scoring.ban_default')}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleUpdateBanStatus(bey.id, bey.custom_is_banned === true ? null : true)}
                                                        className={`py-0.5 rounded transition-colors cursor-pointer ${
                                                            bey.custom_is_banned === true
                                                                ? 'bg-red-500/80 text-white font-black'
                                                                : 'text-gray-500 hover:text-gray-300'
                                                        }`}
                                                    >
                                                        {t('custom_scoring.ban_ban')}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            {filteredBeys.length === 0 && (
                                <div className="col-span-full py-12 text-center text-gray-500 text-sm">
                                    {lang === 'TH' ? 'ไม่พบข้อมูลที่ตรงกับการค้นหา' : 'No items match your search/filter.'}
                                </div>
                            )}
                        </div>
                    )
                )}
            </div>

            {/* Unsaved Changes Floating Bar */}
            {hasUnsavedChanges && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#0d0d0d] border border-primary/30 rounded-2xl shadow-2xl p-3 sm:p-4 flex items-center gap-3 sm:gap-6 z-50 max-w-md w-[calc(100%-2rem)]">
                    <div className="flex-1">
                        <p className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-primary animate-ping" />
                            {t('custom_scoring.unsaved')}
                        </p>
                        <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5">{changedCount} item(s) modified</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={handleReset}
                            disabled={saving}
                            className="bg-white/5 hover:bg-white/10 border border-white/10 font-bold px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl text-[10px] sm:text-xs uppercase tracking-wide transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                            <RotateCcw className="w-3.5 h-3.5" /> {t('custom_scoring.revert')}
                        </button>
                        <button
                            type="button"
                            onClick={handleSaveAll}
                            disabled={saving}
                            className="bg-primary hover:bg-primary/95 text-black font-extrabold px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-[10px] sm:text-xs uppercase tracking-wide transition-all shadow-lg shadow-primary/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="w-3.5 h-3.5" /> {t('custom_scoring.save')}
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
