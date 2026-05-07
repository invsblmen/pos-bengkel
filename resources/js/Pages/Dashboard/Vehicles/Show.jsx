import React, { useMemo, useState, useEffect } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import {
    IconArrowLeft,
    IconPencil,
    IconCar,
    IconUser,
    IconTool,
    IconCalendar,
    IconClock,
    IconCurrencyDollar,
    IconHistory,
    IconCircleCheck,
    IconCircle,
    IconAlertCircle,
    IconFileText,
} from '@tabler/icons-react';
import { toDisplayDate, toDisplayDateTime } from '@/Utils/datetime';

export default function Show({ vehicle, service_orders }) {
    const [liveVehicle, setLiveVehicle] = useState(vehicle);
    const [statusFilter, setStatusFilter] = useState('all');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [mechanicFilter, setMechanicFilter] = useState('all');

    useEffect(() => {
        setLiveVehicle(vehicle);
    }, [vehicle]);
    const currentData = liveVehicle || vehicle;

    const formatPrice = (price) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
        }).format(price || 0);
    };

    const formatDate = (dateString) => (dateString ? toDisplayDate(dateString) : '-');
    const formatDateTime = (dateString) => (dateString ? toDisplayDateTime(dateString) : '-');

    const statusBadge = (status) => {
        const map = {
            pending: { label: 'Menunggu', color: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900 dark:text-amber-200 dark:border-amber-800' },
            in_progress: { label: 'Dikerjakan', color: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-800' },
            completed: { label: 'Selesai', color: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900 dark:text-emerald-200 dark:border-emerald-800' },
            paid: { label: 'Sudah Dibayar', color: 'bg-primary-100 text-primary-700 border-primary-200 dark:bg-primary-900 dark:text-primary-200 dark:border-primary-800' },
            cancelled: { label: 'Dibatalkan', color: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900 dark:text-rose-200 dark:border-rose-800' },
        };
        return map[status] || map.pending;
    };

    const totalSpent = service_orders?.reduce((sum, order) => sum + (order.total || 0), 0) || 0;

    // Get unique mechanics for filter dropdown
    const uniqueMechanics = useMemo(() => {
        if (!service_orders) return [];
        const mechanics = service_orders
            .filter(order => order.mechanic)
            .map(order => order.mechanic)
            .filter((mechanic, index, self) =>
                index === self.findIndex(m => m.id === mechanic.id)
            );
        return mechanics;
    }, [service_orders]);

    const filteredOrders = useMemo(() => {
        if (!service_orders) return [];

        let filtered = service_orders;

        // Filter by status
        if (statusFilter !== 'all') {
            filtered = filtered.filter(order => order.status === statusFilter);
        }

        // Filter by mechanic
        if (mechanicFilter !== 'all') {
            filtered = filtered.filter(order => order.mechanic?.id === parseInt(mechanicFilter));
        }

        // Filter by date range
        if (dateFrom) {
            filtered = filtered.filter(order => {
                const orderDate = new Date(order.created_at);
                const filterDate = new Date(dateFrom);
                return orderDate >= filterDate;
            });
        }

        if (dateTo) {
            filtered = filtered.filter(order => {
                const orderDate = new Date(order.created_at);
                const filterDate = new Date(dateTo);
                filterDate.setDate(filterDate.getDate() + 1); // Include the entire end date
                return orderDate < filterDate;
            });
        }

        return filtered;
    }, [service_orders, statusFilter, mechanicFilter, dateFrom, dateTo]);

    return (
        <>
            <Head title={`Kendaraan ${currentData.plate_number}`} />

            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <p className="text-sm uppercase tracking-wide text-gray-500 dark:text-gray-400">Kendaraan</p>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                            {currentData.brand} {currentData.model}
                        </h1>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 font-medium text-blue-700 ring-1 ring-blue-100 dark:bg-blue-900/30 dark:text-blue-200 dark:ring-blue-800">
                                <IconCar size={16} /> {currentData.plate_number}
                            </span>
                            {currentData.year && <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-200">Tahun {currentData.year}</span>}
                            {currentData.color && <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-200">{currentData.color}</span>}
                            {currentData.km && <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-200">{currentData.km.toLocaleString('id-ID')} km</span>}
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <Link
                            href={route('vehicles.index')}
                            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 transition hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700 dark:hover:bg-gray-700"
                        >
                            <IconArrowLeft size={18} />
                            Kembali
                        </Link>
                        <Link
                            href={route('vehicles.edit', vehicle.id)}
                            className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-primary-600"
                        >
                            <IconPencil size={18} />
                            Edit Kendaraan
                        </Link>
                        <Link
                            href={`${route('service-orders.create')}?vehicle_id=${vehicle.id}`}
                            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700"
                        >
                            <IconTool size={18} />
                            Buat Service Order
                        </Link>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid gap-4 md:grid-cols-4">
                    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Service</p>
                            <IconHistory size={18} className="text-primary-500" />
                        </div>
                        <p className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">{service_orders?.length || 0}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Riwayat order yang tercatat</p>
                    </div>
                    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Pengeluaran</p>
                            <IconCurrencyDollar size={18} className="text-primary-500" />
                        </div>
                        <p className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">{formatPrice(totalSpent)}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Akumulasi biaya jasa & part</p>
                    </div>
                    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Service Terakhir</p>
                            <IconCalendar size={18} className="text-primary-500" />
                        </div>
                        <p className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">{formatDate(vehicle.last_service_date)}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Tanggal terakhir tercatat</p>
                    </div>
                    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Service Berikutnya</p>
                            <IconClock size={18} className="text-primary-500" />
                        </div>
                        <p className="mt-3 text-2xl font-bold text-emerald-600 dark:text-emerald-300">{formatDate(vehicle.next_service_date)}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Pengingat terjadwal</p>
                    </div>
                </div>

                {/* Info Grid */}
                <div className="grid gap-6 lg:grid-cols-3">
                    {/* Owner */}
                    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <div className="mb-4 flex items-center gap-2">
                            <IconUser size={20} className="text-primary-600 dark:text-primary-400" />
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Pemilik</h2>
                        </div>
                        <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
                            <div>
                                <p className="text-gray-500 dark:text-gray-400">Nama</p>
                                <p className="font-semibold text-gray-900 dark:text-white">{vehicle.customer?.name || '-'}</p>
                            </div>
                            <div>
                                <p className="text-gray-500 dark:text-gray-400">Telepon</p>
                                <p className="font-semibold text-gray-900 dark:text-white">{vehicle.customer?.phone || '-'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Specs */}
                    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <div className="mb-4 flex items-center gap-2">
                            <IconCar size={20} className="text-primary-600 dark:text-primary-400" />
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Spesifikasi</h2>
                        </div>
                        <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
                            <div className="flex items-center justify-between">
                                <span className="text-gray-500 dark:text-gray-400">Tipe Mesin</span>
                                <span className="font-semibold text-gray-900 dark:text-white">{vehicle.engine_type || '-'}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-gray-500 dark:text-gray-400">Transmisi</span>
                                <span className="font-semibold capitalize text-gray-900 dark:text-white">{vehicle.transmission_type || '-'}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-gray-500 dark:text-gray-400">Kapasitas Mesin</span>
                                <span className="font-semibold text-gray-900 dark:text-white">{vehicle.cylinder_volume ? `${vehicle.cylinder_volume} cc` : '-'}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-gray-500 dark:text-gray-400">Kilometer</span>
                                <span className="font-semibold text-gray-900 dark:text-white">{vehicle.km ? `${vehicle.km.toLocaleString('id-ID')} km` : '-'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Features & Notes */}
                    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <div className="mb-4 flex items-center gap-2">
                            <IconAlertCircle size={20} className="text-primary-600 dark:text-primary-400" />
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Catatan</h2>
                        </div>
                        <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
                            {vehicle.features?.length ? (
                                <div>
                                    <p className="text-gray-500 dark:text-gray-400">Fitur / Kondisi</p>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {vehicle.features.map((feature, idx) => (
                                            <span
                                                key={idx}
                                                className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700 ring-1 ring-primary-100 dark:bg-primary-900/30 dark:text-primary-200 dark:ring-primary-800"
                                            >
                                                {feature}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ) : null}
                            <div>
                                <p className="text-gray-500 dark:text-gray-400">Catatan Tambahan</p>
                                <p className="mt-1 whitespace-pre-line text-gray-900 dark:text-gray-200">{vehicle.notes || 'Tidak ada catatan'}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Service History */}
                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <div className="mb-6 flex flex-col gap-4">
                        {/* Header */}
                        <div className="flex items-center gap-2">
                            <IconHistory size={20} className="text-primary-600 dark:text-primary-400" />
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Riwayat Service</h2>
                        </div>

                        {/* Status Filter Pills */}
                        <div className="flex flex-wrap gap-2">
                            {[{ key: 'all', label: 'Semua' }, { key: 'pending', label: 'Menunggu' }, { key: 'in_progress', label: 'Dikerjakan' }, { key: 'completed', label: 'Selesai' }, { key: 'paid', label: 'Sudah Dibayar' }, { key: 'cancelled', label: 'Dibatalkan' }].map((item) => {
                                const active = statusFilter === item.key;
                                return (
                                    <button
                                        key={item.key}
                                        onClick={() => setStatusFilter(item.key)}
                                        className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 transition ${
                                            active
                                                ? 'bg-primary-600 text-white ring-primary-600'
                                                : 'bg-white text-gray-700 ring-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:ring-gray-700 dark:hover:bg-gray-700'
                                        }`}
                                    >
                                        {item.label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Advanced Filters */}
                        <div className="grid gap-4 md:grid-cols-3">
                            {/* Date From Filter */}
                            <div>
                                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Dari Tanggal
                                </label>
                                <input
                                    type="date"
                                    value={dateFrom}
                                    onChange={(e) => setDateFrom(e.target.value)}
                                    className="block w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                                />
                            </div>

                            {/* Date To Filter */}
                            <div>
                                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Sampai Tanggal
                                </label>
                                <input
                                    type="date"
                                    value={dateTo}
                                    onChange={(e) => setDateTo(e.target.value)}
                                    className="block w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                                />
                            </div>

                            {/* Mechanic Filter */}
                            <div>
                                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Filter Mekanik
                                </label>
                                <select
                                    value={mechanicFilter}
                                    onChange={(e) => setMechanicFilter(e.target.value)}
                                    className="block w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                                >
                                    <option value="all">Semua Mekanik</option>
                                    {uniqueMechanics.map((mechanic) => (
                                        <option key={mechanic.id} value={mechanic.id}>
                                            {mechanic.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Clear Filters Button */}
                        {(dateFrom || dateTo || mechanicFilter !== 'all' || statusFilter !== 'all') && (
                            <button
                                onClick={() => {
                                    setStatusFilter('all');
                                    setDateFrom('');
                                    setDateTo('');
                                    setMechanicFilter('all');
                                }}
                                className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                            >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                Reset Filter
                            </button>
                        )}
                    </div>

                    {filteredOrders && filteredOrders.length ? (
                        <div className="relative space-y-6">
                            <div className="absolute left-[13px] top-3 bottom-3 w-[2px] bg-gray-200 dark:bg-gray-800" />
                            {filteredOrders.map((order) => {
                                const badge = statusBadge(order.status);
                                return (
                                    <div key={order.id} className="relative rounded-xl border border-gray-100 bg-gray-50 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
                                        <div className="absolute -left-[7px] top-5 flex h-4 w-4 items-center justify-center rounded-full bg-white ring-2 ring-primary-500 dark:bg-gray-900" />
                                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-200">
                                                    <IconTool size={20} />
                                                </div>
                                                <div>
                                                    <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Order #{order.order_number}</p>
                                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatDateTime(order.created_at)}</p>
                                                    {order.mechanic && (
                                                        <p className="text-xs text-gray-500 dark:text-gray-400">Mekanik: {order.mechanic.name}</p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${badge.color}`}>
                                                    {badge.label}
                                                </span>
                                                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-800 ring-1 ring-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:ring-gray-700">
                                                    Total {formatPrice(order.total)}
                                                </span>
                                                {order.odometer_km !== null && (
                                                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-100 dark:bg-blue-900/30 dark:text-blue-200 dark:ring-blue-800">
                                                        {order.odometer_km.toLocaleString('id-ID')} km
                                                    </span>
                                                )}
                                                <Link
                                                    href={route('service-orders.show', order.id)}
                                                    className="inline-flex items-center gap-1 rounded-full bg-primary-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-primary-700"
                                                >
                                                    <IconFileText size={14} />
                                                    Detail Order
                                                </Link>
                                            </div>
                                        </div>

                                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                                            <div className="rounded-lg border border-gray-100 bg-white p-3 dark:border-gray-800 dark:bg-gray-950">
                                                <p className="text-xs text-gray-500 dark:text-gray-400">Estimasi Selesai</p>
                                                <p className="font-semibold text-gray-900 dark:text-white">{formatDateTime(order.estimated_finish_at)}</p>
                                                {order.actual_finish_at && (
                                                    <p className="text-xs text-emerald-600 dark:text-emerald-300">Aktual: {formatDateTime(order.actual_finish_at)}</p>
                                                )}
                                            </div>
                                            <div className="rounded-lg border border-gray-100 bg-white p-3 dark:border-gray-800 dark:bg-gray-950">
                                                <p className="text-xs text-gray-500 dark:text-gray-400">Biaya Jasa</p>
                                                <p className="font-semibold text-gray-900 dark:text-white">{formatPrice(order.labor_cost)}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">Biaya Part: {formatPrice(order.material_cost)}</p>
                                            </div>
                                            <div className="rounded-lg border border-gray-100 bg-white p-3 dark:border-gray-800 dark:bg-gray-950">
                                                <p className="text-xs text-gray-500 dark:text-gray-400">Rincian Item</p>
                                                {order.details?.length ? (
                                                    <div className="mt-2 space-y-1">
                                                        {order.details.map((detail) => (
                                                            <div key={detail.id} className="flex items-center justify-between text-xs">
                                                                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
                                                                    {detail.service ? (
                                                                        <IconCircleCheck size={14} className="text-emerald-500" />
                                                                    ) : (
                                                                        <IconCircle size={14} className="text-amber-500" />
                                                                    )}
                                                                    <span>{detail.service?.title || detail.part?.name || '-'}</span>
                                                                </div>
                                                                <span className="text-gray-500 dark:text-gray-400">{detail.qty}x</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-gray-400">Tidak ada detail</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 px-6 py-10 text-center dark:border-gray-800 dark:bg-gray-900">
                            <IconHistory size={32} className="text-gray-400 dark:text-gray-500" />
                            <p className="mt-3 text-sm font-semibold text-gray-900 dark:text-white">Belum ada riwayat service</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Mulai catat dengan membuat service order pertama.</p>
                            <Link
                                href={`${route('service-orders.create')}?vehicle_id=${vehicle.id}`}
                                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-700"
                            >
                                <IconTool size={16} />
                                Buat Service Order
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
