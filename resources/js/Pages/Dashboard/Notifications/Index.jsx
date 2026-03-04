import React from 'react';
import { Head, Link, router } from '@inertiajs/react';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { IconBell, IconCheck, IconTrash, IconInbox } from '@tabler/icons-react';
import Pagination from '@/Components/Dashboard/Pagination';

export default function NotificationsIndex({ notifications, summary, filters }) {
    const list = notifications?.data || [];
    const activeStatus = filters?.status || 'all';
    const activeSource = filters?.source || 'all';

    const getAction = (item) => {
        if (item.purchase_id) {
            return {
                label: 'Lihat Pembelian',
                href: route('part-purchases.show', item.purchase_id),
                className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
            };
        }

        if (item.sale_id) {
            return {
                label: 'Lihat Part Sale',
                href: route('part-sales.show', item.sale_id),
                className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
            };
        }

        if (item.part_id) {
            return {
                label: 'Lihat Sparepart',
                href: route('parts.edit', item.part_id),
                className: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
            };
        }

        return null;
    };

    const applyFilter = (status) => {
        router.get(route('notifications.index'), { status }, {
            preserveScroll: true,
            preserveState: true,
        });
    };

    const markRead = (id, source) => {
        router.post(route('notifications.read'), { id, source }, { preserveScroll: true });
    };

    const markAllRead = () => {
        router.post(route('notifications.read-all'), { source: activeSource }, { preserveScroll: true });
    };

    const deleteNotification = (id, source) => {
        router.post(route('notifications.destroy'), { id, source }, { preserveScroll: true });
    };

    const applySource = (source) => {
        router.get(route('notifications.index'), { ...filters, source }, {
            preserveScroll: true,
            preserveState: true,
        });
    };

    return (
        <DashboardLayout>
            <Head title="Manajemen Notifikasi" />

            <div className="space-y-6">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Manajemen Notifikasi</h1>
                            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Kelola notifikasi pembelian dan sistem Anda.</p>
                        </div>
                        <button
                            type="button"
                            onClick={markAllRead}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700"
                        >
                            <IconCheck size={16} /> Tandai semua dibaca
                        </button>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3 text-sm">
                        <div className="rounded-lg bg-slate-100 px-3 py-2 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            Total: {summary?.total || 0}
                        </div>
                        <div className="rounded-lg bg-amber-100 px-3 py-2 font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                            Belum dibaca: {summary?.unread || 0}
                        </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => applySource('all')}
                            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${activeSource === 'all'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                            }`}
                        >
                            Semua kategori
                        </button>
                        <button
                            type="button"
                            onClick={() => applySource('system')}
                            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${activeSource === 'system'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                            }`}
                        >
                            Sistem
                        </button>
                        <button
                            type="button"
                            onClick={() => applySource('low_stock')}
                            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${activeSource === 'low_stock'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                            }`}
                        >
                            Stok minimal
                        </button>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => applyFilter('all')}
                            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${activeStatus === 'all'
                                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                            }`}
                        >
                            Semua
                        </button>
                        <button
                            type="button"
                            onClick={() => applyFilter('unread')}
                            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${activeStatus === 'unread'
                                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                            }`}
                        >
                            Belum dibaca
                        </button>
                        <button
                            type="button"
                            onClick={() => applyFilter('read')}
                            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${activeStatus === 'read'
                                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                            }`}
                        >
                            Sudah dibaca
                        </button>
                    </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    {list.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-2 p-10 text-slate-500 dark:text-slate-400">
                            <IconInbox size={28} />
                            <p>Tidak ada notifikasi.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-200 dark:divide-slate-800">
                            {list.map((item) => (
                                (() => {
                                    const action = getAction(item);

                                    return (
                                <div key={item.id} className="p-4">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="min-w-0 flex-1">
                                            <div className="mb-1 flex items-center gap-2">
                                                <IconBell size={16} className={item.read_at ? 'text-slate-400' : 'text-primary-500'} />
                                                <h3 className="truncate font-semibold text-slate-900 dark:text-white">{item.title}</h3>
                                                <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                    {item.source === 'low_stock' ? 'stok minimal' : 'sistem'}
                                                </span>
                                                {!item.read_at && (
                                                    <span className="rounded bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
                                                        Baru
                                                    </span>
                                                )}
                                            </div>

                                            <p className="text-sm text-slate-600 dark:text-slate-400">{item.message}</p>

                                            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                                                <span>{item.created_at_human || '-'}</span>
                                                {item.reference && <span>Ref: {item.reference}</span>}
                                            </div>

                                            {action && (
                                                <div className="mt-2">
                                                    <Link
                                                        href={action.href}
                                                        className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold ${action.className}`}
                                                    >
                                                        {action.label}
                                                    </Link>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex shrink-0 items-center gap-2">
                                            {!item.read_at && (
                                                <button
                                                    type="button"
                                                    onClick={() => markRead(item.id, item.source)}
                                                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                                >
                                                    Tandai dibaca
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => deleteNotification(item.id, item.source)}
                                                className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900/40 dark:text-red-400 dark:hover:bg-red-900/20"
                                            >
                                                <IconTrash size={14} /> Hapus
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                    );
                                })()
                            ))}
                        </div>
                    )}
                </div>

                {notifications?.links?.length > 3 && (
                    <Pagination links={notifications.links} />
                )}
            </div>
        </DashboardLayout>
    );
}
