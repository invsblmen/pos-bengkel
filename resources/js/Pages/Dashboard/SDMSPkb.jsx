import React, { useEffect, useMemo, useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import { IconFileDescription, IconRefresh, IconSearch, IconTruck } from '@tabler/icons-react';
import { Card, CardBody, CardHeader, CardTitle } from '@/Components/Card';
import axios from 'axios';
import Modal from '@/Components/Dashboard/Modal';
import SDMSAuthModal from '@/Components/Dashboard/SDMSAuthModal';
import { toDisplayDate } from '@/Utils/datetime';

const normalizeText = (value) => (value ?? '').toString().toLowerCase();

const extractPkbNo = (item) => item.NoPkb ?? item.NoPKB ?? item.No ?? item.noPkb ?? item.no_pkb ?? '';

const extractCustomerName = (item) =>
    [item.fname ?? item.FName ?? item.customerName ?? item.customer_name ?? item.customer ?? '', item.lname ?? item.Lname ?? '']
        .filter(Boolean)
        .join(' ')
        .trim();

const extractVehicle = (item) => item.vehicleNumber ?? item.vehicle_number ?? item.vehicle ?? item.kendaraan ?? '';

const extractStatus = (item) => item.DescStatusPkb ?? item.descStatusPkb ?? item.status ?? '';

const extractDate = (item) => item.PkbDate ?? item.pkbDate ?? item.pkb_date ?? item.date ?? item.createdAt ?? '';

const getStatusTone = (status) => {
    const text = normalizeText(status);
    if (text.includes('open') || text.includes('waiting') || text.includes('new')) {
        return 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/60';
    }
    if (text.includes('close') || text.includes('done') || text.includes('finish') || text.includes('complete')) {
        return 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700';
    }
    if (text.includes('hold') || text.includes('pending')) {
        return 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/60';
    }

    return 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900/60';
};

export default function SDMSPkb({ sdms }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [query, setQuery] = useState('');
    const [showDetail, setShowDetail] = useState(false);
    const [selected, setSelected] = useState(null);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
    const isAuthenticated = Boolean(sdms && (sdms.access_token || sdms.id_token));

    const fetchPkb = async () => {
        if (!isAuthenticated) {
            setShowLoginModal(true);
            return;
        }

        setLoading(true);
        try {
            const res = await axios.get('/api/reception/Pkb');
            const d = res.data;
            let list = [];
            if (Array.isArray(d)) {
                list = d;
            } else if (d && Array.isArray(d.Result)) {
                list = d.Result;
            } else if (d && Array.isArray(d.result)) {
                list = d.result;
            } else if (d && Array.isArray(d.data)) {
                list = d.data;
            } else if (d && Array.isArray(d.Data)) {
                list = d.Data;
            } else if (d && d.Result && Array.isArray(d.Result.Result)) {
                list = d.Result.Result;
            }

            setItems(list || []);
            setError(null);
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Failed to fetch');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isAuthenticated) {
            fetchPkb();
            return;
        }

        setLoading(false);
        setItems([]);
        setError(null);
    }, [isAuthenticated]);

    const filteredItems = useMemo(() => {
        const keyword = query.trim().toLowerCase();
        if (!keyword) return items;

        return items.filter((item) => {
            const searchable = [
                extractPkbNo(item),
                extractCustomerName(item),
                extractVehicle(item),
                extractStatus(item),
                extractDate(item),
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();

            return searchable.includes(keyword);
        });
    }, [items, query]);

    const openCount = useMemo(
        () => items.filter((item) => normalizeText(extractStatus(item)).includes('open')).length,
        [items]
    );

    const latestLabel = filteredItems.length > 0 ? extractPkbNo(filteredItems[0]) : '-';

    return (
        <>
            <Head title="List PKB" />

            <div className="space-y-6">
                <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-emerald-50 p-6 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900/70">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                        <div className="max-w-2xl space-y-2">
                            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                                <IconFileDescription size={14} /> SDMS Reception
                            </div>
                            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">List PKB</h1>
                            <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">
                                Ringkasan PKB dari SDMS dengan pencarian cepat dan tampilan yang mudah dibaca.
                            </p>
                            <div className="flex flex-wrap items-center gap-2 pt-1 text-sm text-slate-600 dark:text-slate-400">
                                <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${isAuthenticated ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200'}`}>
                                    {isAuthenticated ? 'Sesi SDMS aktif' : 'Sesi SDMS belum aktif'}
                                </span>
                                {isAuthenticated ? (
                                    <span>
                                        Login sebagai <span className="font-semibold text-slate-900 dark:text-white">{sdms?.username || '-'}</span>
                                        {sdms?.idInternal ? ` • ${sdms.idInternal}` : ''}
                                    </span>
                                ) : (
                                    <span>Login diperlukan untuk memuat daftar PKB.</span>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:min-w-[420px] lg:justify-end">
                            {!isAuthenticated && (
                                <button
                                    type="button"
                                    onClick={() => setShowLoginModal(true)}
                                    className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-600/20 transition hover:from-cyan-500 hover:to-blue-500"
                                >
                                    Login SDMS
                                </button>
                            )}
                            <div className="grid gap-3 sm:grid-cols-3">
                                <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/60">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Total PKB</p>
                                    <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{items.length}</p>
                                </div>
                                <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/60">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Open</p>
                                    <p className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{openCount}</p>
                                </div>
                                <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/60">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Tercari</p>
                                    <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{filteredItems.length}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <CardTitle>PKB</CardTitle>
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                <div className="relative min-w-0 sm:w-[320px]">
                                    <IconSearch size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        placeholder="Cari nomor, customer, kendaraan, status..."
                                        className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-emerald-900/40"
                                    />
                                </div>
                                <button
                                    onClick={fetchPkb}
                                    disabled={loading}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                                >
                                    <IconRefresh size={16} className={loading ? 'animate-spin' : ''} />
                                    {loading ? 'Memuat...' : 'Refresh'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowTechnicalDetails((current) => !current)}
                                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                                >
                                    {showTechnicalDetails ? 'Sembunyikan Detail Teknis' : 'Tampilkan Detail Teknis'}
                                </button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardBody>
                        {loading ? (
                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                {[...Array(6)].map((_, index) => (
                                    <div key={index} className="h-20 animate-pulse rounded-2xl border border-slate-200 bg-slate-100/80 dark:border-slate-800 dark:bg-slate-900" />
                                ))}
                            </div>
                        ) : error ? (
                            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
                                {error}
                            </div>
                        ) : filteredItems.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-400">
                                <p className="font-semibold text-slate-900 dark:text-white">Tidak ada PKB ditemukan.</p>
                                <p className="mt-1">Coba ubah kata kunci pencarian atau refresh data dari SDMS.</p>
                            </div>
                        ) : (
                            <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                                            <tr>
                                                <th className="px-4 py-3">No PKB</th>
                                                <th className="px-4 py-3">Customer / Vehicle</th>
                                                <th className="px-4 py-3">Tanggal</th>
                                                <th className="px-4 py-3">Status</th>
                                                <th className="px-4 py-3 text-right">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-950">
                                            {filteredItems.map((it, idx) => {
                                                const no = extractPkbNo(it);
                                                const customer = extractCustomerName(it);
                                                const vehicle = extractVehicle(it);
                                                const status = extractStatus(it);
                                                const date = extractDate(it);

                                                return (
                                                    <tr key={idx} className="transition hover:bg-emerald-50/60 dark:hover:bg-emerald-950/20">
                                                        <td className="px-4 py-3 align-top">
                                                            <div className="font-semibold text-slate-900 dark:text-white">{no || '-'}</div>
                                                            <div className="mt-1 text-xs text-slate-500">{date ? toDisplayDate(date) : '-'}</div>
                                                        </td>
                                                        <td className="px-4 py-3 align-top">
                                                            <div className="font-medium text-slate-900 dark:text-slate-100">{customer || '-'}</div>
                                                            <div className="mt-1 text-xs text-slate-500">{vehicle || '-'}</div>
                                                        </td>
                                                        <td className="px-4 py-3 align-top text-slate-600 dark:text-slate-300">{date ? toDisplayDate(date) : '-'}</td>
                                                        <td className="px-4 py-3 align-top">
                                                            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${getStatusTone(status)}`}>
                                                                {status || 'N/A'}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 align-top text-right">
                                                            <button
                                                                onClick={() => {
                                                                    setSelected(it);
                                                                    setShowDetail(true);
                                                                }}
                                                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-emerald-300 hover:text-emerald-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
                                                            >
                                                                Detail
                                                                <IconFileDescription size={16} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        <div className="mt-4 flex flex-wrap gap-3">
                            <Link href={route('sdms.dashboard')} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
                                Kembali
                            </Link>
                        </div>
                        {showDetail && (
                            <Modal title="PKB Detail" show={showDetail} onClose={() => setShowDetail(false)} maxWidth="3xl">
                                <div className="space-y-5">
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/70">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">No PKB</p>
                                            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{extractPkbNo(selected) || '-'}</p>
                                        </div>
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/70">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
                                            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{extractStatus(selected) || '-'}</p>
                                        </div>
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/70">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Customer</p>
                                            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{extractCustomerName(selected) || '-'}</p>
                                        </div>
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/70">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vehicle</p>
                                            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{extractVehicle(selected) || '-'}</p>
                                        </div>
                                    </div>

                                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-200">
                                        <div className="flex items-center gap-2 font-semibold">
                                            <IconTruck size={16} />
                                            Ringkasan PKB
                                        </div>
                                        <p className="mt-2 leading-6">
                                            Data ini diambil langsung dari SDMS dan bisa dipakai untuk melihat status pekerjaan, kendaraan, serta customer.
                                        </p>
                                    </div>

                                    {showTechnicalDetails ? (
                                        <details className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                                            <summary className="cursor-pointer text-sm font-semibold text-slate-700 dark:text-slate-200">Raw JSON</summary>
                                            <pre className="mt-3 overflow-auto text-xs leading-6 text-slate-700 dark:text-slate-300">{JSON.stringify(selected, null, 2)}</pre>
                                        </details>
                                    ) : (
                                        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-400">
                                            Detail teknis disembunyikan. Aktifkan tombol detail teknis jika perlu melihat data mentah.
                                        </div>
                                    )}
                                </div>
                            </Modal>
                        )}
                    </CardBody>
                </Card>
            </div>

            <SDMSAuthModal show={showLoginModal} onClose={() => setShowLoginModal(false)} sdms={sdms} />
        </>
    );
}
