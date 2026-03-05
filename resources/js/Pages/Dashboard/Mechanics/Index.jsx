import React, { useState, useEffect } from 'react';
import { Head, router } from '@inertiajs/react';
import DashboardLayout from '@/Layouts/DashboardLayout';
import Pagination from '@/Components/Dashboard/Pagination';
import Button from '@/Components/Dashboard/Button';
import Search from '@/Components/Dashboard/Search';
import {
    IconDatabaseOff,
    IconCirclePlus,
    IconLayoutGrid,
    IconList,
    IconPencilCog,
    IconTrash,
    IconPhone,
    IconIdBadge
} from '@tabler/icons-react';
import toast from 'react-hot-toast';

function MechanicCard({ mechanic, onQuickEdit }) {
    return (
        <div className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="h-10 w-10 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 flex items-center justify-center font-bold">
                            {mechanic.name?.charAt(0) || 'M'}
                        </span>
                        <div>
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{mechanic.name}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{mechanic.employee_number || 'No. Pegawai belum ada'}</p>
                        </div>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        <IconIdBadge size={14} /> Mekanik
                    </span>
                </div>
            </div>
            <div className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <IconPhone size={16} />
                    <span>{mechanic.phone || '-'}</span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 min-h-[40px]">{mechanic.notes || 'Belum ada catatan'}</p>
                <div className="flex gap-2 pt-2">
                    <button onClick={() => onQuickEdit(mechanic)} className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg bg-warning-100 text-warning-700 hover:bg-warning-200 dark:bg-warning-900/50 dark:text-warning-300 text-sm font-medium transition-colors">
                        <IconPencilCog size={16} /> Edit Cepat
                    </button>
                    <Button type="delete" icon={<IconTrash size={16} />} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-danger-100 text-danger-700 hover:bg-danger-200 dark:bg-danger-900/50 dark:text-danger-300 text-sm font-medium" url={route('mechanics.destroy', mechanic.id)} label="Hapus" />
                </div>
            </div>
        </div>
    );
}

export default function Index({ mechanics, filters }) {
    // edit modal state
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editId, setEditId] = useState(null);
    const [editForm, setEditForm] = useState({ name: '', phone: '', employee_number: '', notes: '', hourly_rate: '', commission_percentage: '' });
    const [editing, setEditing] = useState(false);

    const [viewMode, setViewMode] = useState('grid');
    const [liveItems, setLiveItems] = useState(mechanics?.data || []);
    const initialSearch = filters?.q || '';
    const totalMechanics = liveItems.length;

    // Real-time Echo listeners
    useEffect(() => {
        if (!window.Echo) return;
        const channel = window.Echo.channel('workshop.mechanics');
        
        channel.listen('.mechanic.created', (event) => {
            const incoming = event?.mechanic;
            if (!incoming?.id) return;
            setLiveItems(prev => {
                if (prev.some(i => i.id === incoming.id)) return prev;
                return [incoming, ...prev];
            });
        });
        
        channel.listen('.mechanic.updated', (event) => {
            const updated = event?.mechanic;
            if (!updated?.id) return;
            setLiveItems(prev => {
                const index = prev.findIndex(i => i.id === updated.id);
                if (index === -1) return prev;
                const newArr = [...prev];
                newArr[index] = updated;
                return newArr;
            });
        });
        
        channel.listen('.mechanic.deleted', (event) => {
            const id = event?.mechanicId;
            if (!id) return;
            setLiveItems(prev => prev.filter(i => i.id !== id));
        });
        
        return () => window.Echo.leaveChannel('workshop.mechanics');
    }, []);

    const openEdit = (m) => {
        setEditId(m.id);
        setEditForm({
            name: m.name || '',
            phone: m.phone || '',
            employee_number: m.employee_number || '',
            notes: m.notes || '',
            hourly_rate: m.hourly_rate || '',
            commission_percentage: m.commission_percentage || '',
        });
        setEditModalOpen(true);
    };

    const submitEdit = () => {
        if (!editForm.name) return toast.error('Nama mekanik diperlukan');
        setEditing(true);

        router.patch(route('mechanics.update', editId), editForm, {
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Mekanik diperbarui');
                setEditModalOpen(false);
                setEditForm({ name: '', phone: '', employee_number: '', notes: '', hourly_rate: '', commission_percentage: '' });
            },
            onError: () => {
                toast.error('Gagal memperbarui mekanik');
            },
            onFinish: () => setEditing(false),
        });
    };

    return (
        <>
            <Head title="Mekanik" />

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Mekanik</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{totalMechanics} mekanik terdaftar</p>
                </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-primary-500 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                title="Grid View"
                            >
                                <IconLayoutGrid size={18} />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-primary-500 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                title="List View"
                            >
                                <IconList size={18} />
                            </button>
                        </div>
                        <div className="w-full sm:w-64">
                            <Search route={route('mechanics.index')} placeholder="Cari mekanik..." initialValue={initialSearch} />
                        </div>
                        <Button type="link" href={route('mechanics.create')} icon={<IconCirclePlus size={18} />} label="Tambah Mekanik" />
                    </div>
                </div>

                {liveItems && liveItems.length > 0 ? (
                    <>
                        {viewMode === 'grid' ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {liveItems.map((m) => (
                                    <MechanicCard key={m.id} mechanic={m} onQuickEdit={openEdit} />
                                ))}
                            </div>
                        ) : (
                            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                                                <th className="px-4 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">No</th>
                                                <th className="px-4 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Nama</th>
                                                <th className="px-4 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Kontak</th>
                                                <th className="px-4 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">No. Pegawai</th>
                                                <th className="px-4 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tarif/Jam</th>
                                                <th className="px-4 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Komisi</th>
                                                <th className="px-4 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Catatan</th>
                                                <th className="px-4 py-4 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {liveItems.map((m, idx) => (
                                                <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                    <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-400">{idx + 1 + ((mechanics.current_page || 1) - 1) * (mechanics.per_page || mechanics.data.length)}</td>
                                                    <td className="px-4 py-4 text-sm font-semibold text-slate-900 dark:text-white">{m.name}</td>
                                                    <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-400">{m.phone || '-'}</td>
                                                    <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-400">{m.employee_number || '-'}</td>
                                                    <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-400">Rp {(m.hourly_rate || 0).toLocaleString('id-ID')}</td>
                                                    <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-400">{Number(m.commission_percentage || 0).toLocaleString('id-ID')}%</td>
                                                    <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-400">{m.notes || '-'}</td>
                                                    <td className="px-4 py-4 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button onClick={() => openEdit(m)} className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 dark:bg-primary-900/30 dark:text-primary-200 dark:hover:bg-primary-900/50 transition-colors">
                                                                <IconPencilCog size={14} className="mr-1" /> Edit
                                                            </button>
                                                            <Button type="delete" icon={<IconTrash size={14} />} className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-medium text-danger-700 bg-danger-50 hover:bg-danger-100 dark:bg-danger-900/30 dark:text-danger-300 dark:hover:bg-danger-900/50" url={route('mechanics.destroy', m.id)} label="Hapus" />
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                        <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                            <IconDatabaseOff size={32} className="text-slate-400" strokeWidth={1.5} />
                        </div>
                        <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-1">Belum Ada Mekanik</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Mekanik akan muncul di sini setelah dibuat.</p>
                        <Button type="link" href={route('mechanics.create')} icon={<IconCirclePlus size={18} />} label="Tambah Mekanik Pertama" />
                    </div>
                )}

                {mechanics.last_page > 1 && <Pagination links={mechanics.links} />}



            {editModalOpen && (
                <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60" onClick={() => setEditModalOpen(false)} />
                    <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-6 max-w-md w-full">
                        <h3 className="text-lg font-bold mb-3">Edit Mekanik</h3>
                        <div className="space-y-3">
                            <input placeholder="Nama" value={editForm.name} onChange={(e) => setEditForm({...editForm, name: e.target.value})} className="w-full h-10 rounded-xl border px-3" />
                            <input placeholder="Phone" value={editForm.phone} onChange={(e) => setEditForm({...editForm, phone: e.target.value})} className="w-full h-10 rounded-xl border px-3" />
                            <input placeholder="Employee Number" value={editForm.employee_number} onChange={(e) => setEditForm({...editForm, employee_number: e.target.value})} className="w-full h-10 rounded-xl border px-3" />
                            <input type="number" min="0" placeholder="Tarif per Jam (Rp)" value={editForm.hourly_rate} onChange={(e) => setEditForm({...editForm, hourly_rate: e.target.value})} className="w-full h-10 rounded-xl border px-3" />
                            <input type="number" min="0" max="100" step="0.01" placeholder="Komisi Default (%)" value={editForm.commission_percentage} onChange={(e) => setEditForm({...editForm, commission_percentage: e.target.value})} className="w-full h-10 rounded-xl border px-3" />
                            <textarea placeholder="Notes" value={editForm.notes} onChange={(e) => setEditForm({...editForm, notes: e.target.value})} className="w-full rounded-xl border px-3 py-2" rows={3} />

                            <div className="flex justify-end gap-2">
                                <button onClick={() => setEditModalOpen(false)} className="px-4 py-2 rounded-xl border">Batal</button>
                                <button onClick={submitEdit} disabled={editing} className="px-4 py-2 rounded-xl bg-primary-500 text-white">{editing ? 'Menyimpan...' : 'Simpan Perubahan'}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

Index.layout = (page) => <DashboardLayout children={page} />;
