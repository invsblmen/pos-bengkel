import React, { useEffect, useMemo, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import { IconFileDescription, IconRefresh, IconSearch, IconTruck } from '@tabler/icons-react';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Card, CardBody, CardHeader, CardTitle } from '@/Components/Card';
import axios from 'axios';
import Modal from '@/Components/Dashboard/Modal';
import { toDisplayDateTime } from '@/Utils/datetime';

const normalizeText = (value) => (value ?? '').toString().toLowerCase();

const extractInvoiceNumber = (item) =>
    item.billingNumber ?? item.BillingNumber ?? item.billingNo ?? item.billing_number ?? item.billNo ?? item.billing ?? item.billingnumber ?? '';

const extractDocumentNumber = (item) =>
    item.documentNumber ?? item.DocumentNumber ?? item.documentNo ?? item.document_number ?? item.document ?? item.documentnumber ?? '';

const extractDeliveryDate = (item) =>
    item.dtCreate ?? item.dtcreate ?? item.dt_create ?? item.dtcreated ?? item.createdAt ?? item.date ?? item.deliveryDate ?? '';

const extractDeliveryStatus = (item) => item.statusDO ?? item.StatusDO ?? item.status ?? item.descStatus ?? item.DeliveryStatus ?? '';

const extractDeliveryCustomer = (item) =>
    item.customerName ?? (item.customer && item.customer.name) ?? item.customer ?? item.name ?? '';

const extractDeliveryVehicle = (item) => item.vehicleNumber ?? item.vehicle_number ?? item.vehicle ?? item.kendaraan ?? item.vehicleNo ?? '';

const getStatusTone = (status) => {
    const text = normalizeText(status);
    if (text.includes('open') || text.includes('waiting') || text.includes('new')) {
        return 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/60';
    }
    if (text.includes('close') || text.includes('done') || text.includes('finish') || text.includes('complete')) {
        return 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700';
    }
    if (text.includes('hold') || text.includes('cancel') || text.includes('reject')) {
        return 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900/60';
    }

    return 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900/60';
};

export default function SDMSDelivery({ sdms, defaultSupplierId = '', defaultSupplierName = 'MPM Surabaya' }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [query, setQuery] = useState('');
    const [appliedQuery, setAppliedQuery] = useState('');


    const [showDetail, setShowDetail] = useState(false);
    const [selected, setSelected] = useState(null);

    const [orderItems, setOrderItems] = useState([]);
    const [orderItemsLoading, setOrderItemsLoading] = useState(false);
    const [orderItemsError, setOrderItemsError] = useState(null);
    const [lastFill, setLastFill] = useState(null);

    const [debugData, setDebugData] = useState(null);
    const [debugLoading, setDebugLoading] = useState(false);
    const [debugError, setDebugError] = useState(null);
    const [totals, setTotals] = useState({ totalamount: null, discount: null, grandTotal: null });

    const formatMoney = (val) => {
        if (val === null || val === undefined || val === '') return '';
        const n = Number(val);
        if (Number.isNaN(n)) return val;
        try {
            return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
        } catch (e) {
            return n.toString();
        }
    };

    const fetchDelivery = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/api/part/DeliveryOrder', { params: { page: 1, size: 100, sort: ',asc' } });
            const d = res.data;
            let list = [];
            if (Array.isArray(d)) list = d;
            else if (d && Array.isArray(d.Items)) list = d.Items;
            else if (d && Array.isArray(d.Result)) list = d.Result;
            else if (d && Array.isArray(d.result)) list = d.result;
            else if (d && Array.isArray(d.data)) list = d.data;
            else if (d && Array.isArray(d.Data)) list = d.Data;
            else if (d && d.Result && Array.isArray(d.Result.Result)) list = d.Result.Result;

            setItems(list || []);
            setError(null);
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Failed to fetch');
        } finally {
            setLoading(false);
        }
    };

    const handleShipmentSearch = async (searchTerm) => {
        if (!searchTerm || String(searchTerm).trim() === '') return;
        setAppliedQuery(String(searchTerm).trim());
        setLoading(true);
        try {
            const filter = { jurnal: String(searchTerm).trim() };
            const res = await axios.get('/api/part/Shipment', {
                params: {
                    size: 20,
                    filterData: JSON.stringify(filter),
                    page: 0,
                },
            });

            let d = res.data;
            // some proxy wrappers may exist
            if (d && d.body && d.target) {
                let inner = d.body;
                if (typeof inner === 'string') {
                    try {
                        inner = JSON.parse(inner);
                    } catch (e) {
                        // leave as-is
                    }
                }
                d = inner;
            }

            if (d && Array.isArray(d.Result)) {
                setItems(d.Result || []);
                setError(null);
            } else if (Array.isArray(d)) {
                setItems(d);
                setError(null);
            } else {
                setItems([]);
                setError('Tidak ada hasil dari pencarian Shipment');
            }
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Gagal mencari Shipment');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        let mounted = true;
        if (mounted) fetchDelivery();
        return () => {
            mounted = false;
        };
    }, []);

    const filteredItems = useMemo(() => {
        const keyword = appliedQuery.trim().toLowerCase();
        if (!keyword) return items;

        return items.filter((item) => {
            const searchable = [
                extractInvoiceNumber(item),
                extractDocumentNumber(item),
                extractDeliveryDate(item),
                extractDeliveryStatus(item),
                extractDeliveryCustomer(item),
                extractDeliveryVehicle(item),
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();

            return searchable.includes(keyword);
        });
    }, [items, query]);

    const openCount = useMemo(
        () => items.filter((item) => normalizeText(extractDeliveryStatus(item)).includes('open')).length,
        [items]
    );



    const handleOpenSpg = (item) => {
        const fill = locateFillValue(item);
        const supplierId = defaultSupplierId || '';

        if (!supplierId) {
            alert('Supplier default belum disiapkan.');
            return;
        }

        router.visit(route('sdms.spg.index', { idbilling: fill, supplier_id: supplierId }));
    };

    const completeCount = useMemo(
        () => items.filter((item) => normalizeText(extractDeliveryStatus(item)).includes('close') || normalizeText(extractDeliveryStatus(item)).includes('done')).length,
        [items]
    );

    // Recursively try to find an idBilling-like value inside an object
    const locateFillValue = (obj) => {
        if (!obj || typeof obj !== 'object') return null;

        const simpleCandidates = ['idBilling', 'id_billing', 'billingId', 'billing_id', 'billing', 'IdBilling', 'idbilling'];
        for (const key of simpleCandidates) {
            if (Object.prototype.hasOwnProperty.call(obj, key) && obj[key]) return obj[key];
        }

        const normalize = (k) => k.replace(/[^a-z0-9]/gi, '').toLowerCase();
        const matchKey = (k) => /idbilling|billingid/.test(normalize(k));

        const visited = new WeakSet();
        let found = null;
        const dfs = (o) => {
            if (!o || typeof o !== 'object' || visited.has(o)) return false;
            visited.add(o);
            for (const k of Object.keys(o)) {
                try {
                    const v = o[k];
                    if (k && matchKey(k) && v) {
                        found = v;
                        return true;
                    }
                    if (v && typeof v === 'object') {
                        if (dfs(v)) return true;
                    }
                } catch (e) {
                    // ignore
                }
            }
            return false;
        };

        dfs(obj);
        if (found) return found;

        // fallback: first UUID-like string
        const uuidRe = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
        const visited2 = new WeakSet();
        let uid = null;
        const dfsUuid = (o) => {
            if (!o || typeof o !== 'object' || visited2.has(o)) return false;
            visited2.add(o);
            for (const k of Object.keys(o)) {
                const v = o[k];
                if (typeof v === 'string' && uuidRe.test(v)) {
                    uid = v;
                    return true;
                }
                if (v && typeof v === 'object') {
                    if (dfsUuid(v)) return true;
                }
            }
            return false;
        };
        dfsUuid(obj);
        return uid;
    };

    const fetchOrderItems = async (sel) => {
        setOrderItems([]);
        setOrderItemsError(null);

        let fill = sel?.idBilling ?? sel?.id_billing ?? sel?.billingId ?? sel?.billing_id ?? sel?.billing ?? sel?.IdBilling ?? sel?.id ?? null;
        if (!fill) fill = locateFillValue(sel);

        if (!fill) {
            setOrderItemsError('idBilling tidak ditemukan pada item yang dipilih (cek Raw JSON)');
            setLastFill(null);
            return;
        }

        setLastFill(fill);
        setOrderItemsLoading(true);
        setDebugData(null);
        try {
            const res = await axios.get('/api/part/orderitemdo', { params: { fill } });
            let d = res.data;

            // unwrap proxy debug wrapper if present
            if (d && d.target && Object.prototype.hasOwnProperty.call(d, 'body')) {
                setDebugData(d);
                let inner = d.body;
                if (typeof inner === 'string') {
                    try {
                        inner = JSON.parse(inner);
                    } catch (e) {
                        // leave string
                    }
                }
                d = inner;
            }

            let list = [];
            if (Array.isArray(d)) list = d;
            else if (d && Array.isArray(d.Items)) list = d.Items;
            else if (d && Array.isArray(d.Result)) list = d.Result;
            else if (d && Array.isArray(d.result)) list = d.result;
            else if (d && Array.isArray(d.data)) list = d.data;
            else if (d && Array.isArray(d.Data)) list = d.Data;
            else if (d && d.Result && Array.isArray(d.Result.Result)) list = d.Result.Result;

            // extract totals if present
            setTotals({
                totalamount: d?.totalamount ?? d?.totalAmount ?? d?.total ?? null,
                discount: d?.discount ?? d?.Discount ?? d?.discountAmount ?? d?.discount_amount ?? null,
                grandTotal: d?.grandTotal ?? d?.grand_total ?? d?.GrandTotal ?? d?.grandtotal ?? null,
            });

            setOrderItems(list || []);
            if ((!list || list.length === 0) && d && Object.keys(d).length > 0) {
                setOrderItemsError('Tidak ada item DO untuk fill yang diberikan — respons upstream berisi data tetapi tidak ditemukan array item. Cek Proxy Debug.');
            }
        } catch (err) {
            setOrderItemsError(err.response?.data?.message || err.message || 'Gagal memuat item DO');
        } finally {
            setOrderItemsLoading(false);
        }
    };

    const fetchOrderItemsDebug = async (sel) => {
        setDebugData(null);
        setDebugError(null);

        let fill = sel?.idBilling ?? sel?.id_billing ?? sel?.billingId ?? sel?.billing_id ?? sel?.billing ?? sel?.IdBilling ?? sel?.id ?? null;
        if (!fill) fill = locateFillValue(sel) ?? lastFill;

        if (!fill) {
            setDebugError('idBilling tidak ditemukan untuk debug (cek Raw JSON)');
            return;
        }

        setDebugLoading(true);
        try {
            const res = await axios.get('/api/part/orderitemdo', { params: { fill, _proxy_debug: 1 } });
            setDebugData(res.data);
        } catch (err) {
            setDebugError(err.response?.data?.message || err.message || 'Gagal memanggil _proxy_debug');
        } finally {
            setDebugLoading(false);
        }
    };

    return (
        <DashboardLayout>
            <Head title="List Pemesanan" />

            <div className="space-y-6">
                <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-cyan-50 p-6 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900/70">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                        <div className="max-w-2xl space-y-2">
                            <div className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300">
                                <IconTruck size={14} /> SDMS Part
                            </div>
                            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">List Pemesanan</h1>
                            <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">
                                Delivery Order ditampilkan dengan pencarian cepat, status badge, dan detail item yang menampilkan harga, diskon, serta subtotal.
                            </p>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[420px]">
                            <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/60">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Total DO</p>
                                <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{items.length}</p>
                            </div>
                            <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/60">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Open</p>
                                <p className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{openCount}</p>
                            </div>
                            <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/60">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Closed</p>
                                <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{completeCount}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <CardTitle>Pemesanan (DeliveryOrder)</CardTitle>
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                <div className="relative min-w-0 sm:w-[340px]">
                                    <IconSearch size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                   setAppliedQuery(query); handleShipmentSearch(query);
                                            }
                                        }}
                                        placeholder="Cari nomor INV (tekan Enter atau klik Search)..."
                                        className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-cyan-900/40"
                                    />
                                </div>
                                <button
                                        onClick={() => { setAppliedQuery(query); handleShipmentSearch(query); }}
                                    disabled={loading}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-70"
                                >
                                    <IconSearch size={16} />
                                    {loading ? 'Mencari...' : 'Cari'}
                                </button>
                                <button
                                    onClick={fetchDelivery}
                                    disabled={loading}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-70"
                                >
                                    <IconRefresh size={16} className={loading ? 'animate-spin' : ''} />
                                    {loading ? 'Memuat...' : 'Refresh'}
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
                                <p className="font-semibold text-slate-900 dark:text-white">Tidak ada pemesanan ditemukan.</p>
                                <p className="mt-1">Coba ubah kata kunci pencarian atau refresh data dari SDMS.</p>
                            </div>
                        ) : (
                            <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                                            <tr>
                                                <th className="px-4 py-3">Nomor INV</th>
                                                <th className="px-4 py-3">Nomor PS</th>
                                                <th className="px-4 py-3">Tanggal</th>
                                                <th className="px-4 py-3">Status</th>
                                                <th className="px-4 py-3 text-right">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-950">
                                            {filteredItems.map((it, idx) => {
                                                const inv = extractInvoiceNumber(it);
                                                const ps = extractDocumentNumber(it);
                                                const date = extractDeliveryDate(it);
                                                const status = extractDeliveryStatus(it);
                                                const customer = extractDeliveryCustomer(it);
                                                const vehicle = extractDeliveryVehicle(it);
                                                const fill = locateFillValue(it) || `${idx}`;

                                                return (
                                                    <tr key={idx} className="transition hover:bg-cyan-50/60 dark:hover:bg-cyan-950/20">
                                                        <td className="px-4 py-3 align-top">
                                                            <div className="font-semibold text-slate-900 dark:text-white">{inv || '-'}</div>
                                                            <div className="mt-1 text-xs text-slate-500">{customer || '-'}</div>
                                                        </td>
                                                        <td className="px-4 py-3 align-top">
                                                            <div className="font-medium text-slate-900 dark:text-slate-100">{ps || '-'}</div>
                                                            <div className="mt-1 text-xs text-slate-500">{vehicle || '-'}</div>
                                                        </td>
                                                        <td className="px-4 py-3 align-top text-slate-600 dark:text-slate-300">{date ? toDisplayDateTime(date) : '-'}</td>
                                                        <td className="px-4 py-3 align-top">
                                                            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${getStatusTone(status)}`}>
                                                                {status || 'N/A'}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 align-top text-right">
                                                            <div className="inline-flex min-w-[220px] flex-col gap-2 text-left">
                                                                        <div className="inline-flex flex-wrap justify-end gap-2">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleOpenSpg(it)}
                                                                        className="inline-flex items-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-semibold text-cyan-700 transition hover:border-cyan-300 hover:bg-cyan-100 dark:border-cyan-900/40 dark:bg-cyan-950/30 dark:text-cyan-200"
                                                                    >
                                                                        SPG
                                                                    </button>
                                                                        <button
                                                                            onClick={() => {
                                                                                setSelected(it);
                                                                                setShowDetail(true);
                                                                                fetchOrderItems(it);
                                                                            }}
                                                                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-cyan-300 hover:text-cyan-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
                                                                        >
                                                                            Detail
                                                                            <IconFileDescription size={16} />
                                                                        </button>
                                                                    </div>
                                                                </div>
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
                            <Modal
                                title="Pemesanan Detail"
                                show={showDetail}
                                onClose={() => {
                                    setShowDetail(false);
                                    setSelected(null);
                                    setOrderItems([]);
                                    setOrderItemsError(null);
                                    setDebugData(null);
                                    setDebugError(null);
                                }}
                                maxWidth="3xl"
                            >
                                <div className="space-y-5">
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/70">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nomor INV</p>
                                            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{extractInvoiceNumber(selected) || '-'}</p>
                                        </div>
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/70">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nomor PS</p>
                                            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{extractDocumentNumber(selected) || '-'}</p>
                                        </div>
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/70">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Penerima</p>
                                            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{extractDeliveryCustomer(selected) || '-'}</p>
                                        </div>
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/70">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tanggal</p>
                                            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{extractDeliveryDate(selected) ? toDisplayDateTime(extractDeliveryDate(selected)) : '-'}</p>
                                        </div>
                                    </div>

                                    <div className="rounded-2xl border border-cyan-200 bg-cyan-50/70 p-4 text-sm text-cyan-900 dark:border-cyan-900/40 dark:bg-cyan-950/20 dark:text-cyan-200">
                                        <div className="flex items-center gap-2 font-semibold">
                                            <IconTruck size={16} />
                                            Ringkasan Delivery Order
                                        </div>
                                        <div className="mt-3 grid gap-3 sm:grid-cols-3">
                                            <div>
                                                <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-700/80 dark:text-cyan-300/80">Status</p>
                                                <p className="mt-1 font-semibold">{extractDeliveryStatus(selected) || '-'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-700/80 dark:text-cyan-300/80">fill / idBilling</p>
                                                <p className="mt-1 font-semibold">{lastFill || '-'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-700/80 dark:text-cyan-300/80">Item</p>
                                                <p className="mt-1 font-semibold">{orderItems.length}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-2">
                                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Item DO</h3>
                                            <div className="flex flex-wrap items-center gap-2">
                                                {lastFill && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">fill: {lastFill}</span>}
                                                <button
                                                    onClick={() => fetchOrderItems(selected)}
                                                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-cyan-300 hover:text-cyan-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
                                                >
                                                    <IconRefresh size={16} /> Reload
                                                </button>
                                                <button
                                                    onClick={() => fetchOrderItemsDebug(selected)}
                                                    disabled={debugLoading}
                                                    className="inline-flex items-center gap-2 rounded-xl bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-amber-950/40 dark:text-amber-200"
                                                >
                                                    <IconSearch size={16} />
                                                    {debugLoading ? 'Debugging...' : 'Debug (_proxy_debug)'}
                                                </button>
                                            </div>
                                        </div>

                                        {orderItemsLoading ? (
                                            <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">Memuat item...</p>
                                        ) : orderItemsError ? (
                                            <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
                                                {orderItemsError}
                                            </div>
                                        ) : orderItems.length === 0 ? (
                                            <div className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-400">
                                                Tidak ada item DO.
                                            </div>
                                        ) : (
                                            <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-left text-sm">
                                                        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                                                            <tr>
                                                                <th className="px-4 py-3">Part No</th>
                                                                <th className="px-4 py-3">Nama</th>
                                                                <th className="px-4 py-3 text-right">Qty</th>
                                                                <th className="px-4 py-3 text-right">Harga</th>
                                                                <th className="px-4 py-3 text-right">Disc Satuan</th>
                                                                <th className="px-4 py-3 text-right">Subtotal</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-950">
                                                            {orderItems.map((it, i) => {
                                                                const partNo = it.numberPart ?? it.number_part ?? it.partNo ?? it.partNumber ?? it.part_code ?? it.code ?? it.codePart ?? it.PartNo ?? '';
                                                                const name = it.DescPart ?? it.descPart ?? it.partName ?? it.namaPart ?? it.name ?? it.part_desc ?? it.Description ?? '';
                                                                const qty = it.qty ?? it.quantity ?? it.Qty ?? it.qtyOrdered ?? it.orderQty ?? it.jumlah ?? '';
                                                                const unitAmount = it.amount ?? it.Amount ?? it.unitPrice ?? it.price ?? it.priceUnit ?? it.harga ?? null;
                                                                const discUnit = it.discdtlitemamount ?? it.discDtlItemAmount ?? it.discDtlItemAmount ?? it.disc ?? it.discount ?? null;
                                                                const qn = qty ? Number(qty) : NaN;
                                                                const unitNum = unitAmount != null ? Number(unitAmount) : NaN;
                                                                const discUnitNum = discUnit != null ? Number(discUnit) : NaN;

                                                                let subtotalNum = NaN;
                                                                if (!Number.isNaN(qn) && !Number.isNaN(unitNum)) {
                                                                    const priceMinusDisc = !Number.isNaN(discUnitNum) ? unitNum - discUnitNum : unitNum;
                                                                    subtotalNum = priceMinusDisc * qn;
                                                                }

                                                                const priceDisplay = !Number.isNaN(unitNum) ? unitNum : unitAmount ?? '';
                                                                const discDisplay = discUnit ?? '';
                                                                const subtotalDisplay = !Number.isNaN(subtotalNum) ? subtotalNum : it.total ?? it.totalAmount ?? it.subtotal ?? it.jumlahHarga ?? '';

                                                                return (
                                                                    <tr key={i} className="transition hover:bg-cyan-50/60 dark:hover:bg-cyan-950/20">
                                                                        <td className="px-4 py-3 align-top font-medium text-slate-900 dark:text-white">{partNo || '-'}</td>
                                                                        <td className="px-4 py-3 align-top text-slate-600 dark:text-slate-300">{name || '-'}</td>
                                                                        <td className="px-4 py-3 align-top text-right text-slate-600 dark:text-slate-300">{qty || '-'}</td>
                                                                        <td className="px-4 py-3 align-top text-right font-medium text-slate-900 dark:text-white">{formatMoney(priceDisplay)}</td>
                                                                        <td className="px-4 py-3 align-top text-right text-slate-600 dark:text-slate-300">{formatMoney(discDisplay)}</td>
                                                                        <td className="px-4 py-3 align-top text-right font-semibold text-slate-900 dark:text-white">{formatMoney(subtotalDisplay)}</td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}

                                        {(totals?.totalamount || totals?.discount || totals?.grandTotal) && (
                                            <div className="mt-4 flex justify-end">
                                                <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-800 dark:bg-slate-900/70">
                                                    <div className="flex justify-between gap-3">
                                                        <span className="text-slate-600 dark:text-slate-400">Total</span>
                                                        <span className="font-medium text-slate-900 dark:text-white">{formatMoney(totals.totalamount)}</span>
                                                    </div>
                                                    <div className="mt-2 flex justify-between gap-3">
                                                        <span className="text-slate-600 dark:text-slate-400">Diskon</span>
                                                        <span className="font-medium text-slate-900 dark:text-white">{formatMoney(totals.discount)}</span>
                                                    </div>
                                                    <div className="mt-2 flex justify-between gap-3 border-t border-slate-200 pt-2 text-base dark:border-slate-800">
                                                        <span className="font-semibold text-slate-700 dark:text-slate-200">Grand Total</span>
                                                        <span className="font-bold text-slate-900 dark:text-white">{formatMoney(totals.grandTotal)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {debugError && <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">{debugError}</div>}
                                        {debugData && (
                                            <div className="mt-4">
                                                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Proxy Debug</h4>
                                                <details className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                                                    <summary className="cursor-pointer text-sm font-semibold text-slate-700 dark:text-slate-200">Show proxy debug JSON</summary>
                                                    <pre className="mt-3 overflow-auto text-xs leading-6 text-slate-700 dark:text-slate-300">{JSON.stringify(debugData, null, 2)}</pre>
                                                </details>
                                            </div>
                                        )}
                                    </div>

                                    <details className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                                        <summary className="cursor-pointer text-sm font-semibold text-slate-700 dark:text-slate-200">Raw JSON</summary>
                                        <pre className="mt-3 overflow-auto text-xs leading-6 text-slate-700 dark:text-slate-300">{JSON.stringify(selected, null, 2)}</pre>
                                    </details>
                                </div>
                            </Modal>
                        )}
                    </CardBody>
                </Card>
            </div>
        </DashboardLayout>
    );
}
