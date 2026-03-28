import React, { useEffect, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import DashboardLayout from '@/Layouts/DashboardLayout';
import {
    IconArrowLeft,
    IconPencil,
    IconUser,
    IconCar,
    IconTool,
    IconCalendar,
    IconClock,
    IconFileText,
    IconCurrencyDollar,
    IconPrinter,
    IconShieldCheck
} from '@tabler/icons-react';
import { toDisplayDateTime } from '@/Utils/datetime';
import { Skeleton, SkeletonText } from '@/Components/Dashboard/Skeleton';
import toast from 'react-hot-toast';

export default function Show({ order, warrantyRegistrations = {}, permissions = {} }) {
    const [detailsReady, setDetailsReady] = useState(false);

    useEffect(() => {
        const rafId = window.requestAnimationFrame(() => setDetailsReady(true));
        return () => window.cancelAnimationFrame(rafId);
    }, [order?.id]);

    const formatPrice = (price) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
        }).format(price);
    };

    const formatDate = (dateString) => (dateString ? toDisplayDateTime(dateString) : '-');

    const getStatusBadge = (status) => {
        const badges = {
            pending: { color: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-300 dark:border-yellow-800', label: 'Menunggu' },
            in_progress: { color: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:border-blue-800', label: 'Dikerjakan' },
            completed: { color: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900 dark:text-green-300 dark:border-green-800', label: 'Selesai' },
            paid: { color: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900 dark:text-purple-300 dark:border-purple-800', label: 'Sudah Dibayar' },
            cancelled: { color: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900 dark:text-red-300 dark:border-red-800', label: 'Dibatalkan' },
        };
        return badges[status] || badges.pending;
    };

    const statusBadge = getStatusBadge(order.status);
    const totalItems = (order.details || []).reduce((sum, detail) => sum + (Number(detail.qty) || 0), 0);

    const getWarrantyMeta = (detail) => {
        const registration = warrantyRegistrations?.[detail.id];
        if (!registration) {
            return {
                label: 'Tanpa Garansi',
                badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-200',
                canClaim: false,
                periodDays: 0,
                endDate: null,
            };
        }

        const endDate = registration.warranty_end_date ? new Date(registration.warranty_end_date) : null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (endDate) {
            endDate.setHours(0, 0, 0, 0);
        }

        if (registration.claimed_at || registration.status === 'claimed') {
            return {
                label: 'Sudah Diklaim',
                badgeClass: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-100',
                canClaim: false,
                periodDays: registration.warranty_period_days || 0,
                endDate: registration.warranty_end_date,
                isNearExpiry: false,
            };
        }

        if (!endDate || endDate < today) {
            return {
                label: 'Expired',
                badgeClass: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-100',
                canClaim: false,
                periodDays: registration.warranty_period_days || 0,
                endDate: registration.warranty_end_date,
                isNearExpiry: false,
            };
        }

        const warningThreshold = new Date(today);
        warningThreshold.setDate(warningThreshold.getDate() + 7);
        const isNearExpiry = endDate <= warningThreshold;

        return {
            label: 'Aktif',
            badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-100',
            canClaim: true,
            periodDays: registration.warranty_period_days || 0,
            endDate: registration.warranty_end_date,
            isNearExpiry,
        };
    };

    const warrantyActiveCount = (order.details || []).reduce((sum, detail) => {
        const warranty = getWarrantyMeta(detail);
        return warranty.label === 'Aktif' ? sum + 1 : sum;
    }, 0);

    const handleClaimWarranty = (detail) => {
        const notes = window.prompt('Catatan klaim garansi (opsional):') || '';

        router.post(route('service-orders.details.claim-warranty', { id: order.id, detailId: detail.id }), {
            claim_notes: notes,
        }, {
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Klaim garansi berhasil dicatat');
            },
            onError: (errors) => {
                toast.error(errors?.error || 'Gagal mencatat klaim garansi');
            },
        });
    };

    const getMechanicHref = (mechanicId) => {
        if (!mechanicId) return null;

        if (route().has('mechanics.show')) {
            return route('mechanics.show', mechanicId);
        }

        if (route().has('mechanics.performance.show')) {
            return route('mechanics.performance.show', mechanicId);
        }

        if (route().has('mechanics.index')) {
            return route('mechanics.index');
        }

        return null;
    };

    const mechanicHref = getMechanicHref(order.mechanic?.id);

    return (
        <>
            <Head title={`Service Order ${order.order_number}`} />

            <div className="space-y-5">
                {/* Hero Header */}
                <div
                    id="section-overview"
                    className="rounded-3xl border border-gray-200 bg-gradient-to-br from-white via-white to-primary-50/40 p-5 shadow-sm dark:border-gray-800 dark:from-gray-900 dark:via-gray-900 dark:to-primary-900/10 sm:p-6"
                >
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0 space-y-4">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">Service Order</p>
                                <h1 className="mt-2 break-words text-2xl font-bold leading-tight text-gray-900 dark:text-white sm:text-3xl">
                                    Order #{order.order_number}
                                </h1>
                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                    Detail Service Order
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2.5">
                                <span className={`rounded-full border px-4 py-2 text-sm font-semibold ${statusBadge.color}`}>
                                    {statusBadge.label}
                                </span>
                                <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                                    {order.customer?.name || 'Tanpa pelanggan'}
                                </span>
                                <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                                    {order.vehicle?.plate_number || 'Tanpa kendaraan'}
                                </span>
                            </div>
                        </div>

                        <div className="grid w-full gap-2 sm:grid-cols-3 xl:w-auto xl:min-w-[420px]">
                            <Link
                                href={route('service-orders.print', order.id)}
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                            >
                                <IconPrinter size={18} />
                                Cetak Nota
                            </Link>
                            <Link
                                href={route('service-orders.index')}
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                            >
                                <IconArrowLeft size={18} />
                                Kembali
                            </Link>
                            <Link
                                href={route('service-orders.edit', order.id)}
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-600"
                            >
                                <IconPencil size={18} />
                                Edit Order
                            </Link>
                        </div>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800/70">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Total Item</p>
                                <IconTool size={16} className="text-primary-500" />
                            </div>
                            <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{totalItems}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Layanan + sparepart</p>
                        </div>

                        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800/70">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Garansi Aktif</p>
                                <IconShieldCheck size={16} className="text-emerald-500" />
                            </div>
                            <p className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{warrantyActiveCount}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Siap klaim jika diperlukan</p>
                        </div>

                        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800/70">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Dibuat</p>
                                <IconClock size={16} className="text-blue-500" />
                            </div>
                            <p className="mt-2 text-sm font-bold text-gray-900 dark:text-white">{formatDate(order.created_at)}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Waktu order masuk</p>
                        </div>

                        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800/70">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Estimasi Selesai</p>
                                <IconCalendar size={16} className="text-violet-500" />
                            </div>
                            <p className="mt-2 text-sm font-bold text-gray-900 dark:text-white">{formatDate(order.estimated_finish_at)}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Target pengerjaan</p>
                        </div>
                    </div>
                </div>

                {/* Main Info Grid */}
                <div id="section-main-info" className="grid gap-6 md:auto-rows-fr md:grid-cols-2 scroll-mt-24">
                    {/* Customer Info */}
                    <div className="flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <IconUser size={20} className="text-primary-600 dark:text-primary-400" />
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Informasi Pelanggan</h2>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-[11px] font-semibold text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                                    Ref: {order.customer?.id ? `CUST-${String(order.customer.id).padStart(4, '0')}` : '-'}
                                </span>
                            </div>
                        </div>

                        <div className="grid flex-1 gap-3 sm:grid-cols-2">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Nama</p>
                                <p className="mt-1 break-words font-semibold text-gray-900 dark:text-white">{order.customer?.name || '-'}</p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Telepon</p>
                                {order.customer?.phone ? (
                                    <a href={`tel:${order.customer.phone}`} className="mt-1 inline-flex break-all font-semibold text-primary-600 hover:underline dark:text-primary-400">
                                        {order.customer.phone}
                                    </a>
                                ) : (
                                    <p className="mt-1 break-words font-semibold text-gray-900 dark:text-white">-</p>
                                )}
                            </div>
                            <div className="sm:col-span-2">
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Email</p>
                                <p className="mt-1 break-all font-semibold text-gray-900 dark:text-white">{order.customer?.email || '-'}</p>
                            </div>
                        </div>

                        <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50/70 p-3 dark:border-gray-700 dark:bg-gray-800/60">
                            <p className="text-xs text-gray-600 dark:text-gray-300">Referensi pelanggan untuk service order ini</p>
                            <div className="mt-3">
                                {permissions?.can_view_customers && order.customer?.id ? (
                                    <Link
                                        href={route('customers.show', order.customer.id)}
                                        className="inline-flex items-center rounded-lg border border-primary-200 bg-white px-3 py-1.5 text-xs font-semibold text-primary-700 transition hover:bg-primary-50 dark:border-primary-700 dark:bg-gray-900 dark:text-primary-300"
                                    >
                                        Lihat Detail Pelanggan
                                    </Link>
                                ) : (
                                    <span className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
                                        Detail pelanggan tidak tersedia
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Vehicle Info */}
                    <div className="flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <IconCar size={20} className="text-primary-600 dark:text-primary-400" />
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Informasi Kendaraan</h2>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-[11px] font-semibold text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                                    Ref: {order.vehicle?.id ? `VEH-${String(order.vehicle.id).padStart(4, '0')}` : '-'}
                                </span>
                            </div>
                        </div>

                        <div className="grid flex-1 gap-3 sm:grid-cols-2">
                            <div className="sm:col-span-2">
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Merek & Model</p>
                                <p className="mt-1 break-words font-semibold text-gray-900 dark:text-white">{order.vehicle ? `${order.vehicle.brand} ${order.vehicle.model}` : '-'}</p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Plat Nomor</p>
                                <p className="mt-1 break-words font-semibold text-gray-900 dark:text-white">{order.vehicle?.plate_number || '-'}</p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Tahun</p>
                                <p className="mt-1 font-semibold text-gray-900 dark:text-white">{order.vehicle?.year || '-'}</p>
                            </div>
                        </div>

                        <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50/70 p-3 dark:border-gray-700 dark:bg-gray-800/60">
                            <p className="text-xs text-gray-600 dark:text-gray-300">Referensi kendaraan untuk service order ini</p>
                            <div className="mt-3">
                                {permissions?.can_view_vehicles && order.vehicle?.id ? (
                                    <Link
                                        href={route('vehicles.show', order.vehicle.id)}
                                        className="inline-flex items-center rounded-lg border border-primary-200 bg-white px-3 py-1.5 text-xs font-semibold text-primary-700 transition hover:bg-primary-50 dark:border-primary-700 dark:bg-gray-900 dark:text-primary-300"
                                    >
                                        Lihat Detail Kendaraan
                                    </Link>
                                ) : (
                                    <span className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
                                        Detail kendaraan tidak tersedia
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Mechanic Info */}
                    <div className="flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <IconTool size={20} className="text-primary-600 dark:text-primary-400" />
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Mekanik</h2>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-[11px] font-semibold text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                                    Ref: {order.mechanic?.id ? `MEC-${String(order.mechanic.id).padStart(4, '0')}` : '-'}
                                </span>
                            </div>
                        </div>

                        <div className="grid flex-1 gap-3 sm:grid-cols-2">
                            <div className="sm:col-span-2">
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Nama Mekanik</p>
                                <p className="mt-1 break-words font-semibold text-gray-900 dark:text-white">{order.mechanic?.name || 'Belum ditentukan'}</p>
                            </div>
                            <div className="sm:col-span-2">
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Spesialisasi</p>
                                <p className="mt-1 break-words font-semibold text-gray-900 dark:text-white">{order.mechanic?.specialty || '-'}</p>
                            </div>
                            {!order.mechanic?.id && (
                                <div className="sm:col-span-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:border-gray-600 dark:bg-gray-800/70 dark:text-gray-300">
                                    Mekanik belum ditetapkan. Silakan pilih mekanik melalui tombol Edit Order.
                                </div>
                            )}
                        </div>

                        <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50/70 p-3 dark:border-gray-700 dark:bg-gray-800/60">
                            <p className="text-xs text-gray-600 dark:text-gray-300">Referensi mekanik untuk service order ini</p>
                            <div className="mt-3">
                                {permissions?.can_view_mechanics && mechanicHref ? (
                                    <Link
                                        href={mechanicHref}
                                        className="inline-flex items-center rounded-lg border border-primary-200 bg-white px-3 py-1.5 text-xs font-semibold text-primary-700 transition hover:bg-primary-50 dark:border-primary-700 dark:bg-gray-900 dark:text-primary-300"
                                    >
                                        Lihat Detail Mekanik
                                    </Link>
                                ) : (
                                    <span className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
                                        Mekanik belum ditentukan
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Schedule Info */}
                    <div className="flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <IconCalendar size={20} className="text-primary-600 dark:text-primary-400" />
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                    Jadwal
                                </h2>
                            </div>
                            <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-[11px] font-semibold text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                                Timeline
                            </span>
                        </div>

                        <div className="grid flex-1 gap-3 sm:grid-cols-2">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Odometer (Km)</p>
                                <p className="mt-1 font-semibold text-gray-900 dark:text-white tabular-nums">
                                    {order.odometer_km ? `${order.odometer_km.toLocaleString('id-ID')} km` : '-'}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Estimasi Mulai</p>
                                <p className="mt-1 font-semibold text-gray-900 dark:text-white">
                                    {formatDate(order.estimated_start_at)}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Estimasi Selesai</p>
                                <p className="mt-1 font-semibold text-gray-900 dark:text-white">
                                    {formatDate(order.estimated_finish_at)}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Aktual Mulai</p>
                                <p className="mt-1 font-semibold text-blue-600 dark:text-blue-400">
                                    {order.actual_start_at ? formatDate(order.actual_start_at) : '-'}
                                </p>
                            </div>
                            <div className="sm:col-span-2">
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Aktual Selesai</p>
                                <p className="mt-1 font-semibold text-green-600 dark:text-green-400">
                                    {order.actual_finish_at ? formatDate(order.actual_finish_at) : '-'}
                                </p>
                            </div>
                        </div>

                        <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50/70 p-3 dark:border-gray-700 dark:bg-gray-800/60">
                            <p className="text-xs text-gray-600 dark:text-gray-300">Ringkasan timeline pengerjaan service order</p>
                        </div>
                    </div>
                </div>

                {/* Cost Breakdown */}
                <div id="section-cost" className="rounded-2xl border border-gray-200 bg-gradient-to-br from-primary-50 to-white p-6 shadow-sm dark:border-gray-800 dark:from-primary-900/10 dark:to-gray-900 scroll-mt-24">
                    <div className="mb-4 flex items-center gap-2">
                        <IconCurrencyDollar size={20} className="text-primary-600 dark:text-primary-400" />
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Rincian Biaya
                        </h2>
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800">
                            <div className="flex items-start gap-3">
                                <div className="rounded-lg bg-blue-100 p-3 dark:bg-blue-900/30">
                                    <IconTool size={20} className="text-blue-600 dark:text-blue-400" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Biaya Jasa</p>
                                    <p className="break-words text-xl font-bold tabular-nums text-gray-900 dark:text-white">
                                        {formatPrice(order.labor_cost || 0)}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800">
                            <div className="flex items-start gap-3">
                                <div className="rounded-lg bg-amber-100 p-3 dark:bg-amber-900/30">
                                    <IconCar size={20} className="text-amber-600 dark:text-amber-400" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Biaya Part</p>
                                    <p className="break-words text-xl font-bold tabular-nums text-gray-900 dark:text-white">
                                        {formatPrice(order.material_cost || 0)}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="rounded-xl bg-primary-100 p-4 shadow-sm dark:bg-primary-900/30">
                            <div className="flex items-center gap-3">
                                <div className="rounded-lg bg-primary-200 p-3 dark:bg-primary-800">
                                    <IconCurrencyDollar size={20} className="text-primary-700 dark:text-primary-300" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-medium text-primary-700 dark:text-primary-300">Total</p>
                                    {(order.discount_amount > 0 || order.voucher_discount_amount > 0 || order.tax_amount > 0) ? (
                                        <div>
                                            <p className="break-words text-sm line-through tabular-nums text-primary-700 dark:text-primary-400">{formatPrice(order.total || 0)}</p>
                                            <p className="break-words text-xl font-bold tabular-nums text-primary-900 dark:text-primary-100">
                                                {formatPrice(order.grand_total || order.total || 0)}
                                            </p>
                                            {order.discount_amount > 0 && (
                                                <p className="break-words text-xs tabular-nums text-red-600">Diskon: -{formatPrice(order.discount_amount)}</p>
                                            )}
                                            {order.voucher_discount_amount > 0 && (
                                                <p className="break-words text-xs tabular-nums text-violet-600">Voucher {order.voucher_code ? `(${order.voucher_code})` : ''}: -{formatPrice(order.voucher_discount_amount)}</p>
                                            )}
                                            {order.tax_amount > 0 && (
                                                <p className="break-words text-xs tabular-nums text-green-600">Pajak: +{formatPrice(order.tax_amount)}</p>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="break-words text-xl font-bold tabular-nums text-primary-900 dark:text-primary-100">
                                            {formatPrice(order.total || 0)}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Items Detail */}
                <div id="section-items" className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 scroll-mt-24">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Detail Layanan & Sparepart
                        </h2>
                        <span className="inline-flex items-center rounded-full bg-primary-100 px-3 py-1 text-xs font-bold text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
                            {totalItems} item
                        </span>
                    </div>

                    <div className="space-y-3 md:hidden">
                        {!detailsReady ? (
                            Array.from({ length: 3 }).map((_, idx) => (
                                <div key={idx} className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                                    <Skeleton className="h-4 w-2/3 mb-2" />
                                    <Skeleton className="h-3 w-1/3 mb-3" />
                                    <div className="grid grid-cols-3 gap-2">
                                        <Skeleton className="h-12 w-full" />
                                        <Skeleton className="h-12 w-full" />
                                        <Skeleton className="h-12 w-full" />
                                    </div>
                                </div>
                            ))
                        ) : order.details?.map((detail) => {
                            const warranty = getWarrantyMeta(detail);
                            return (
                                <div key={detail.id} className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                                        <div>
                                            <p className="break-words text-sm font-semibold text-gray-900 dark:text-white">
                                                {detail.service?.title || detail.part?.name || '-'}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                {detail.service ? 'Layanan Service' : detail.part ? 'Sparepart' : '-'}
                                            </p>
                                        </div>
                                        <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-bold ${warranty.badgeClass}`}>
                                            <IconShieldCheck size={12} /> {warranty.label}
                                        </span>
                                    </div>
                                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                                        <div className="rounded-lg bg-gray-50 p-2 text-center dark:bg-gray-800">
                                            <p className="text-gray-500 dark:text-gray-400">Qty</p>
                                            <p className="font-semibold text-gray-900 dark:text-white">{detail.qty}</p>
                                        </div>
                                        <div className="rounded-lg bg-gray-50 p-2 text-center dark:bg-gray-800">
                                            <p className="text-gray-500 dark:text-gray-400">Harga</p>
                                            <p className="font-semibold text-gray-900 dark:text-white">{formatPrice(detail.price)}</p>
                                        </div>
                                        <div className="rounded-lg bg-gray-50 p-2 text-center dark:bg-gray-800">
                                            <p className="text-gray-500 dark:text-gray-400">Subtotal</p>
                                            <p className="font-semibold text-gray-900 dark:text-white">{formatPrice(detail.price * detail.qty)}</p>
                                        </div>
                                    </div>
                                    {warranty.periodDays > 0 && (
                                        <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
                                            Garansi {warranty.periodDays} hari • s.d. {warranty.endDate ? formatDate(warranty.endDate) : '-'}
                                        </p>
                                    )}
                                    {warranty.isNearExpiry && (
                                        <p className="mt-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                                            Garansi mendekati expired (≤ 7 hari)
                                        </p>
                                    )}
                                    {warranty.canClaim && (
                                        <button
                                            type="button"
                                            onClick={() => handleClaimWarranty(detail)}
                                            className="mt-3 inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-blue-700"
                                        >
                                            Klaim
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <div className="hidden overflow-x-auto md:block">
                        {!detailsReady ? (
                            <div className="space-y-3">
                                <Skeleton className="h-10 w-full" />
                                <SkeletonText lines={5} />
                            </div>
                        ) : (
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-800">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                                        Item
                                    </th>
                                    <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                                        Qty
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                                        Harga Satuan
                                    </th>
                                    <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                                        Garansi
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                                        Subtotal
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
                                {order.details?.map((detail) => {
                                    const warranty = getWarrantyMeta(detail);

                                    return (<tr key={detail.id}>
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                {detail.service?.title || detail.part?.name || '-'}
                                            </div>
                                            {detail.service && (
                                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                                    Layanan Service
                                                </div>
                                            )}
                                            {detail.part && (
                                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                                    Sparepart
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-center text-sm text-gray-900 dark:text-white">
                                            {detail.qty}
                                        </td>
                                        <td className="px-6 py-4 text-right text-sm text-gray-900 dark:text-white">
                                            {formatPrice(detail.price)}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex flex-col items-center gap-2">
                                                <span className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-bold ${warranty.badgeClass}`}>
                                                    <IconShieldCheck size={13} /> {warranty.label}
                                                </span>
                                                {warranty.periodDays > 0 && (
                                                    <span className="text-[10px] text-gray-500 dark:text-gray-400">
                                                        {warranty.periodDays} hari • s.d. {warranty.endDate ? formatDate(warranty.endDate) : '-'}
                                                    </span>
                                                )}
                                                {warranty.isNearExpiry && (
                                                    <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                                                        Mendekati expired (≤ 7 hari)
                                                    </span>
                                                )}
                                                {warranty.canClaim && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleClaimWarranty(detail)}
                                                        className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-blue-700"
                                                    >
                                                        Klaim
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right text-sm font-medium text-gray-900 dark:text-white">
                                            {formatPrice(detail.price * detail.qty)}
                                        </td>
                                    </tr>);
                                })}
                            </tbody>
                            <tfoot className="bg-gray-50 dark:bg-gray-800">
                                <tr>
                                    <td colSpan="4" className="px-6 py-4 text-right text-sm text-gray-600 dark:text-gray-400">
                                        Subtotal
                                    </td>
                                    <td className="px-6 py-4 text-right text-sm font-medium text-gray-900 dark:text-white">
                                        {formatPrice(order.total || 0)}
                                    </td>
                                </tr>
                                {order.discount_amount > 0 && (
                                    <tr>
                                        <td colSpan="4" className="px-6 py-4 text-right text-sm text-gray-600 dark:text-gray-400">
                                            Diskon {order.discount_type === 'percent' ? `(${order.discount_value}%)` : '(Fixed)'}
                                        </td>
                                        <td className="px-6 py-4 text-right text-sm font-medium text-red-600">
                                            -{formatPrice(order.discount_amount)}
                                        </td>
                                    </tr>
                                )}
                                {order.voucher_discount_amount > 0 && (
                                    <tr>
                                        <td colSpan="4" className="px-6 py-4 text-right text-sm text-gray-600 dark:text-gray-400">
                                            Voucher {order.voucher_code ? `(${order.voucher_code})` : ''}
                                        </td>
                                        <td className="px-6 py-4 text-right text-sm font-medium text-violet-600">
                                            -{formatPrice(order.voucher_discount_amount)}
                                        </td>
                                    </tr>
                                )}
                                {order.tax_amount > 0 && (
                                    <tr>
                                        <td colSpan="4" className="px-6 py-4 text-right text-sm text-gray-600 dark:text-gray-400">
                                            Pajak {order.tax_type === 'percent' ? `(${order.tax_value}%)` : '(Fixed)'}
                                        </td>
                                        <td className="px-6 py-4 text-right text-sm font-medium text-green-600">
                                            +{formatPrice(order.tax_amount)}
                                        </td>
                                    </tr>
                                )}
                                <tr className="border-t-2 border-gray-300 dark:border-gray-600">
                                    <td colSpan="4" className="px-6 py-4 text-right text-sm font-semibold text-gray-900 dark:text-white">
                                        Total Akhir
                                    </td>
                                    <td className="px-6 py-4 text-right text-lg font-bold text-primary-600 dark:text-primary-400">
                                        {formatPrice(order.grand_total || order.total || 0)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                        )}
                    </div>
                </div>

                {/* Notes */}
                {order.notes && (
                    <div id="section-notes" className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 scroll-mt-24">
                        <div className="mb-4 flex items-center gap-2">
                            <IconFileText size={20} className="text-primary-600 dark:text-primary-400" />
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                Catatan
                            </h2>
                        </div>
                        <p className="whitespace-pre-line break-words text-gray-700 dark:text-gray-300">
                            {order.notes}
                        </p>
                    </div>
                )}
            </div>
        </>
    );
}

Show.layout = (page) => <DashboardLayout children={page} />;
