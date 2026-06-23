'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowLeft, Plus, Edit, Trash2, Shield, Search, Upload, Globe, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/useTranslation';

type Beyblade = {
    id: string;
    name: string;
    image_url: string;
    points_standard: number;
    is_banned: boolean;
    type: 'BX' | 'CX' | 'UX' | 'CX_SPECIAL' | 'NORMAL_ATTACHMENT' | 'LOCK_CHIP' | 'ASSIST_BLADE' | 'RACHET' | 'BIT';
};

export default function BeybladesManagementPage() {
    const router = useRouter();
    const { t, lang, toggleLang } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [beyblades, setBeyblades] = useState<Beyblade[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    
    // Tab State
    const [activeTab, setActiveTab] = useState<'beyblades' | 'attachments'>('beyblades');
    const [subFilter, setSubFilter] = useState<string>('All');

    // Form Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBey, setEditingBey] = useState<Beyblade | null>(null);
    const [formLoading, setFormLoading] = useState(false);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState('');

    const [formData, setFormData] = useState({
        name: '',
        points_standard: 0,
        is_banned: false,
        image_url: '',
        type: 'BX'
    });

    useEffect(() => {
        fetchBeyblades();
    }, []);

    const fetchBeyblades = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/beyblades');
            const data = await res.json();
            if (res.ok && data.success) {
                setBeyblades(data.beyblades);
            } else {
                toast.error(data.error || 'Failed to load catalog');
                if (res.status === 403) router.push('/admin');
            }
        } catch (error) {
            toast.error('Network error');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenAdd = () => {
        setEditingBey(null);
        setFormData({
            name: '',
            points_standard: 0,
            is_banned: false,
            image_url: '',
            type: activeTab === 'beyblades' ? 'BX' : 'LOCK_CHIP'
        });
        setImageFile(null);
        setImagePreview('');
        setIsModalOpen(true);
    };

    const handleOpenEdit = (bey: Beyblade) => {
        setEditingBey(bey);
        setFormData({
            name: bey.name,
            points_standard: bey.points_standard,
            is_banned: bey.is_banned,
            image_url: bey.image_url,
            type: bey.type || 'BX'
        });
        setImageFile(null);
        setImagePreview(bey.image_url);
        setIsModalOpen(true);
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) return toast.error('Name is required');

        setFormLoading(true);
        try {
            let finalImageUrl = formData.image_url;

            // 1. Upload new image if selected
            if (imageFile) {
                const uploadRes = await fetch(`/api/upload?filename=${encodeURIComponent(imageFile.name)}`, {
                    method: 'POST',
                    body: imageFile
                });
                if (!uploadRes.ok) throw new Error('Image upload failed');
                const blob = await uploadRes.json();
                finalImageUrl = blob.url;
            }

            if (!finalImageUrl) {
                setFormLoading(false);
                return toast.error('Image is required');
            }

            const payload = {
                name: formData.name.trim(),
                points_standard: Number(formData.points_standard) || 0,
                is_banned: !!formData.is_banned,
                image_url: finalImageUrl,
                type: formData.type
            };

            let res;
            if (editingBey) {
                // Update
                res = await fetch('/api/admin/beyblades', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: editingBey.id, ...payload })
                });
            } else {
                // Create
                res = await fetch('/api/admin/beyblades', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            }

            const data = await res.json();
            if (res.ok && data.success) {
                toast.success(editingBey ? t('admin.beyblades.toast.updated') : t('admin.beyblades.toast.added'));
                setIsModalOpen(false);
                fetchBeyblades();
            } else {
                toast.error(data.error || 'Failed to save item');
            }
        } catch (error: any) {
            toast.error(error.message || 'Something went wrong');
        } finally {
            setFormLoading(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(t('admin.beyblades.toast.delete_confirm', { name }))) return;

        try {
            const res = await fetch(`/api/admin/beyblades?id=${id}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (res.ok && data.success) {
                toast.success(t('admin.beyblades.toast.deleted'));
                fetchBeyblades();
            } else {
                toast.error(data.error || 'Failed to delete');
            }
        } catch (error) {
            toast.error('Network error');
        }
    };

    const filteredItems = beyblades.filter(b => {
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

    return (
        <div className="min-h-screen bg-[#050505] text-white p-6 md:p-8 relative overflow-hidden">
            {/* Background effects */}
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
                                <Shield className="w-8 h-8 text-primary" /> {lang === 'TH' ? 'ระบบจัดการคลังเบย์เบลดและชิ้นส่วนเสริม' : 'Global Catalog Manager'}
                            </h1>
                            <p className="text-gray-400 text-sm">
                                {lang === 'TH' ? 'เพิ่ม แก้ไข หรือลบ แต้มและรูปภาพของชิ้นส่วนทั้งหมด' : 'Add, edit, or delete items, baseline points, and images.'}
                            </p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3 self-start sm:self-center">
                        <button 
                            onClick={toggleLang} 
                            className="p-2.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors flex items-center gap-2 text-xs font-bold cursor-pointer shrink-0"
                        >
                            <Globe className="h-4 w-4 text-primary" />
                            <span>{lang === 'TH' ? 'English' : 'ไทย'}</span>
                        </button>
                        <button
                            onClick={handleOpenAdd}
                            className="bg-primary hover:bg-primary/95 text-black font-bold px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-primary/20 flex items-center gap-2 uppercase text-xs tracking-wide cursor-pointer"
                        >
                            <Plus className="w-4 h-4" /> {activeTab === 'beyblades' ? (lang === 'TH' ? 'เพิ่มเบย์เบลด' : 'Add Beyblade') : (lang === 'TH' ? 'เพิ่มชิ้นส่วนเสริม' : 'Add Attachment')}
                        </button>
                    </div>
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

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Search */}
                    <div className="flex bg-secondary/20 border border-white/10 rounded-xl px-4 py-3 items-center gap-3 w-full max-w-md">
                        <Search className="w-5 h-5 text-gray-500" />
                        <input
                            type="text"
                            placeholder={activeTab === 'beyblades' ? (lang === 'TH' ? 'ค้นหาเบย์เบลด...' : 'Search Beyblades...') : (lang === 'TH' ? 'ค้นหาชิ้นส่วนเสริม...' : 'Search attachments...')}
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="bg-transparent text-white w-full outline-none"
                        />
                    </div>

                    {/* Sub filters */}
                    <div className="flex flex-wrap gap-2">
                        {activeTab === 'beyblades' ? (
                            ['All', 'BX', 'CX', 'UX'].map((cat) => (
                                <button
                                    key={cat}
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
                                    onClick={() => setSubFilter(cat)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${subFilter === cat ? 'bg-primary text-black border-primary' : 'bg-white/5 border-white/10 hover:bg-white/10 text-gray-300'}`}
                                >
                                    {cat === 'All' ? 'All' : cat === 'LOCK_CHIP' ? 'Lock Chip' : cat === 'ASSIST_BLADE' ? 'Assist Blade' : cat === 'RACHET' ? 'Rachet' : 'Bit'}
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                        {filteredItems.map((item) => (
                            <div key={item.id} className="group relative flex flex-col bg-white/5 border border-white/10 rounded-2xl p-4 hover:border-primary/50 hover:shadow-lg transition-all">
                                <div className="relative w-full aspect-square bg-black/40 rounded-xl overflow-hidden mb-3 flex items-center justify-center p-2">
                                    <img
                                        src={item.image_url}
                                        alt={item.name}
                                        className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                                        loading="lazy"
                                    />
                                    {item.is_banned && (
                                        <div className="absolute top-2 right-2 bg-red-500/90 text-white font-bold text-[8px] uppercase px-1.5 py-0.5 rounded shadow">
                                            Banned
                                        </div>
                                    )}
                                    <div className="absolute bottom-2 left-2 bg-black/75 backdrop-blur text-[8px] font-bold px-1.5 py-0.5 rounded border border-white/10">
                                        {item.type}
                                    </div>
                                </div>
                                <h3 className="font-bold text-sm truncate text-center mb-2" title={item.name}>{item.name}</h3>
                                <div className="flex flex-col gap-1 text-[10px] text-gray-400 border-t border-white/5 pt-2 mt-auto">
                                    <div className="flex justify-between">
                                        <span>{lang === 'TH' ? 'แต้มมาตรฐาน:' : 'Standard Points:'}</span>
                                        <span className="font-bold text-primary">{item.points_standard}p</span>
                                    </div>
                                </div>

                                <div className="absolute inset-0 bg-black/80 rounded-2xl opacity-0 group-hover:opacity-100 flex items-center justify-center gap-3 transition-opacity duration-200">
                                    <button
                                        onClick={() => handleOpenEdit(item)}
                                        className="w-10 h-10 bg-white/10 hover:bg-primary hover:text-black rounded-lg flex items-center justify-center transition-all cursor-pointer"
                                        title="Edit"
                                    >
                                        <Edit className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(item.id, item.name)}
                                        className="w-10 h-10 bg-white/10 hover:bg-red-500 text-white hover:text-white rounded-lg flex items-center justify-center transition-all cursor-pointer"
                                        title="Delete"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {filteredItems.length === 0 && (
                            <div className="col-span-full py-12 text-center text-gray-500 text-sm">
                                {lang === 'TH' ? 'ไม่พบข้อมูลที่ตรงกับการค้นหา' : 'No items match your search/filter.'}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Form Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="w-full max-w-lg bg-[#0d0d0d] border border-white/10 rounded-2xl p-6 relative shadow-2xl">
                        <h2 className="text-xl font-bold mb-4">
                            {editingBey 
                                ? (lang === 'TH' ? 'แก้ไขข้อมูล' : 'Edit Item') 
                                : (activeTab === 'beyblades' ? (lang === 'TH' ? 'เพิ่มเบย์เบลดใหม่' : 'Add New Beyblade') : (lang === 'TH' ? 'เพิ่มชิ้นส่วนเสริมใหม่' : 'Add New Attachment'))
                            }
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Image Upload Area */}
                            <div className="flex items-center gap-6">
                                <div className="w-28 h-28 bg-white/5 border border-dashed border-white/20 rounded-2xl flex items-center justify-center overflow-hidden relative group">
                                    {imagePreview ? (
                                        <img src={imagePreview} alt="Preview" className="w-full h-full object-contain" />
                                    ) : (
                                        <Upload className="w-6 h-6 text-gray-500" />
                                    )}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageChange}
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                    />
                                </div>
                                <div className="flex-1 space-y-1">
                                    <label className="text-xs text-gray-400 font-bold uppercase">{t('admin.beyblades.label.image')}</label>
                                    <p className="text-[10px] text-gray-500">{t('admin.beyblades.label.image_desc')}</p>
                                </div>
                            </div>

                            {/* Name Input */}
                            <div className="space-y-2">
                                <label className="text-xs text-gray-400 font-bold uppercase">{lang === 'TH' ? 'ชื่อชิ้นส่วน' : 'Name'}</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-all font-medium"
                                    placeholder={activeTab === 'beyblades' ? "e.g. PhoenixWing" : "e.g. Heavy / Valkyrie"}
                                    required
                                    disabled={editingBey !== null} // Lock name on edit to maintain references
                                />
                                {editingBey && <p className="text-[10px] text-yellow-500/80">Name cannot be changed on edit to preserve deck history references.</p>}
                            </div>

                            {/* Type / Category Select */}
                            <div className="space-y-2">
                                <label className="text-xs text-gray-400 font-bold uppercase">{lang === 'TH' ? 'ประเภท / หมวดหมู่' : 'Type / Category'}</label>
                                <select
                                    value={formData.type}
                                    onChange={e => setFormData({ ...formData, type: e.target.value as any })}
                                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-all font-medium"
                                >
                                    <option value="BX">BX</option>
                                    <option value="CX">CX</option>
                                    <option value="UX">UX</option>
                                    <option value="LOCK_CHIP">Lock Chip (CX only)</option>
                                    <option value="ASSIST_BLADE">Assist Blade (CX only)</option>
                                    <option value="RACHET">Rachet (All types)</option>
                                    <option value="BIT">Bit (All types)</option>
                                </select>
                            </div>

                            {/* Point Config */}
                            <div className="space-y-2">
                                <label className="text-xs text-gray-400 font-bold uppercase">{lang === 'TH' ? 'แต้มมาตรฐาน' : 'Standard Point Modifier'}</label>
                                <input
                                    type="number"
                                    min="0"
                                    max="15"
                                    value={formData.points_standard}
                                    onChange={e => setFormData({ ...formData, points_standard: parseInt(e.target.value) || 0 })}
                                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-all font-medium"
                                    required
                                />
                            </div>

                            {/* Ban Status Toggle */}
                            <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-4">
                                <input
                                    type="checkbox"
                                    id="isBanned"
                                    checked={formData.is_banned}
                                    onChange={e => setFormData({ ...formData, is_banned: e.target.checked })}
                                    className="w-4 h-4 rounded border-white/20 bg-secondary"
                                />
                                <label htmlFor="isBanned" className="text-sm font-bold text-gray-300 cursor-pointer select-none">
                                    {t('admin.beyblades.label.banned')}
                                </label>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 bg-white/5 hover:bg-white/10 text-white font-medium py-3 rounded-xl transition-all border border-white/10 uppercase tracking-wide cursor-pointer"
                                >
                                    {t('admin.beyblades.btn.cancel')}
                                </button>
                                <button
                                    type="submit"
                                    disabled={formLoading}
                                    className="flex-1 bg-primary hover:bg-primary/95 text-black font-bold py-3 rounded-xl transition-all shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2 uppercase tracking-wide cursor-pointer"
                                >
                                    {formLoading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            {t('admin.beyblades.btn.saving')}
                                        </>
                                    ) : (
                                        t('admin.beyblades.btn.save')
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
