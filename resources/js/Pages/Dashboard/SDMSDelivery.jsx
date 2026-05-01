import React, { useEffect, useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Card, CardBody, CardHeader, CardTitle } from '@/Components/Card';
import axios from 'axios';
import Modal from '@/Components/Dashboard/Modal';

export default function SDMSDelivery({ sdms }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

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

    useEffect(() => {
        let mounted = true;
        if (mounted) fetchDelivery();
        return () => {
            mounted = false;
        };
    }, []);

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
                <div>
                    <h1 className="text-3xl font-bold">List Pemesanan</h1>
                    <p className="text-gray-600">Daftar pemesanan (Delivery Orders) dari SDMS Dealer API.</p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Pemesanan (DeliveryOrder)</CardTitle>
                    </CardHeader>
                    <CardBody>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <button onClick={fetchDelivery} disabled={loading} className="px-3 py-1 bg-blue-600 text-white rounded">
                                    {loading ? 'Loading...' : 'Refresh'}
                                </button>
                            </div>
                        </div>

                        {loading ? (
                            <p className="text-sm text-gray-600">Memuat...</p>
                        ) : error ? (
                            <div className="text-sm text-red-600">{error}</div>
                        ) : items.length === 0 ? (
                            <p className="text-sm text-gray-600">Tidak ada pemesanan ditemukan.</p>
                        ) : (
                            <div className="overflow-auto">
                                <table className="w-full text-sm text-left">
                                    <thead>
                                        <tr className="bg-gray-50">
                                            <th className="px-3 py-2">Nomor INV</th>
                                            <th className="px-3 py-2">Nomor PS</th>
                                            <th className="px-3 py-2">Tanggal</th>
                                            <th className="px-3 py-2">Status</th>
                                            <th className="px-3 py-2">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((it, idx) => {
                                            const inv = it.billingNumber ?? it.BillingNumber ?? it.billingNo ?? it.billing_number ?? it.billNo ?? it.billing ?? '';
                                            const ps = it.documentNumber ?? it.DocumentNumber ?? it.documentNo ?? it.document_number ?? it.document ?? '';
                                            const date = it.dtCreate ?? it.dtcreate ?? it.dt_create ?? it.createdAt ?? it.date ?? '';
                                            const status = it.statusDO ?? it.StatusDO ?? it.status ?? it.descStatus ?? it.DeliveryStatus ?? '';

                                            return (
                                                <tr key={idx} className="border-t">
                                                    <td className="px-3 py-2 align-top break-words">{inv}</td>
                                                    <td className="px-3 py-2 align-top">{ps}</td>
                                                    <td className="px-3 py-2 align-top">{date}</td>
                                                    <td className="px-3 py-2 align-top">{status}</td>
                                                    <td className="px-3 py-2 align-top">
                                                        <button
                                                            onClick={() => {
                                                                setSelected(it);
                                                                setShowDetail(true);
                                                                fetchOrderItems(it);
                                                            }}
                                                            className="px-2 py-1 text-sm bg-gray-200 rounded"
                                                        >
                                                            Detail
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <div className="mt-4">
                            <Link href={route('sdms.dashboard')} className="px-4 py-2 bg-gray-200 rounded-lg">
                                Kembali
                            </Link>
                        </div>

                        {showDetail && (
                            <Modal
                                title={`Pemesanan Detail`}
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
                                <div className="space-y-4">
                                    <div className="text-sm text-gray-700">
                                        <strong>Nomor INV:</strong> {selected?.billingNumber ?? selected?.BillingNumber ?? selected?.billingNo ?? selected?.billNo ?? ''}
                                    </div>
                                    <div className="text-sm text-gray-700">
                                        <strong>Nomor PS:</strong> {selected?.documentNumber ?? selected?.DocumentNumber ?? selected?.documentNo ?? selected?.document ?? ''}
                                    </div>
                                    <div className="text-sm text-gray-700">
                                        <strong>Penerima:</strong> {selected?.customerName ?? (selected?.customer && selected.customer.name) ?? ''}
                                    </div>
                                    <div className="text-sm text-gray-700">
                                        <strong>Tanggal:</strong> {selected?.dtCreate ?? selected?.deliveryDate ?? selected?.createdAt ?? ''}
                                    </div>

                                    <div className="pt-3">
                                        <div className="flex items-center justify-between">
                                            <h3 className="font-semibold">Item DO</h3>
                                            <div className="flex items-center gap-2">
                                                {lastFill && <span className="text-xs text-gray-500">fill: {lastFill}</span>}
                                                <button onClick={() => fetchOrderItems(selected)} className="px-2 py-1 bg-blue-100 text-sm rounded">Reload</button>
                                                <button
                                                    onClick={() => fetchOrderItemsDebug(selected)}
                                                    disabled={debugLoading}
                                                    className="px-2 py-1 text-sm bg-yellow-100 rounded"
                                                >
                                                    {debugLoading ? 'Debugging...' : 'Debug (_proxy_debug)'}
                                                </button>
                                            </div>
                                        </div>

                                        {orderItemsLoading ? (
                                            <p className="text-sm text-gray-600">Memuat item...</p>
                                        ) : orderItemsError ? (
                                            <div className="text-sm text-red-600">{orderItemsError}</div>
                                        ) : orderItems.length === 0 ? (
                                            <p className="text-sm text-gray-600">Tidak ada item DO.</p>
                                        ) : (
                                            <>
                                            <div className="overflow-auto mt-2">
                                                <table className="w-full text-sm text-left">
                                                    <thead>
                                                        <tr className="bg-gray-50">
                                                            <th className="px-3 py-2">Part No</th>
                                                            <th className="px-3 py-2">Nama</th>
                                                            <th className="px-3 py-2">Qty</th>
                                                            <th className="px-3 py-2">Harga</th>
                                                            <th className="px-3 py-2">Disc Satuan</th>
                                                            <th className="px-3 py-2">Subtotal</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {orderItems.map((it, i) => {
                                                            const partNo = it.numberPart ?? it.number_part ?? it.partNo ?? it.partNumber ?? it.part_code ?? it.code ?? it.codePart ?? it.PartNo ?? '';
                                                            const name = it.DescPart ?? it.descPart ?? it.partName ?? it.namaPart ?? it.name ?? it.part_desc ?? it.Description ?? '';
                                                            const qty = it.qty ?? it.quantity ?? it.Qty ?? it.qtyOrdered ?? it.orderQty ?? it.jumlah ?? '';
                                                            const unitAmount = it.amount ?? it.Amount ?? it.unitPrice ?? it.price ?? it.priceUnit ?? it.harga ?? null;
                                                            const discUnit = it.discdtlitemamount ?? it.discDtlItemAmount ?? it.discDtlItemAmount ?? it.disc ?? it.discount ?? null;
                                                            const qn = qty ? Number(qty) : NaN;
                                                            const unitNum = unitAmount != null ? Number(unitAmount) : NaN;
                                                            const discUnitNum = discUnit != null ? Number(discUnit) : NaN;

                                                            // Subtotal = (harga - discSatuan) * qty
                                                            let subtotalNum = NaN;
                                                            if (!Number.isNaN(qn) && !Number.isNaN(unitNum)) {
                                                                const priceMinusDisc = !Number.isNaN(discUnitNum) ? (unitNum - discUnitNum) : unitNum;
                                                                subtotalNum = priceMinusDisc * qn;
                                                            }

                                                            const priceDisplay = !Number.isNaN(unitNum) ? unitNum : (unitAmount ?? '');
                                                            const discDisplay = discUnit ?? '';
                                                            const subtotalDisplay = !Number.isNaN(subtotalNum) ? subtotalNum : (it.total ?? it.totalAmount ?? it.subtotal ?? it.jumlahHarga ?? '');

                                                            return (
                                                                <tr key={i} className="border-t">
                                                                    <td className="px-3 py-2 align-top break-words">{partNo}</td>
                                                                    <td className="px-3 py-2 align-top">{name}</td>
                                                                    <td className="px-3 py-2 align-top">{qty}</td>
                                                                    <td className="px-3 py-2 align-top">{formatMoney(priceDisplay)}</td>
                                                                    <td className="px-3 py-2 align-top">{formatMoney(discDisplay)}</td>
                                                                    <td className="px-3 py-2 align-top">{formatMoney(subtotalDisplay)}</td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                            { (totals?.totalamount || totals?.discount || totals?.grandTotal) && (
                                                <div className="mt-4 flex justify-end text-sm">
                                                    <div className="w-64 space-y-1">
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-600">Total:</span>
                                                            <span className="font-medium">{formatMoney(totals.totalamount)}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-600">Diskon:</span>
                                                            <span className="font-medium">{formatMoney(totals.discount)}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-700">Grand Total:</span>
                                                            <span className="font-semibold">{formatMoney(totals.grandTotal)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </>) }

                                        {debugError && <div className="text-sm text-red-600 mt-2">{debugError}</div>}
                                        {debugData && (
                                            <div className="mt-3">
                                                <h4 className="font-semibold">Proxy Debug</h4>
                                                <details className="mt-2 p-2 bg-gray-50 rounded">
                                                    <summary className="cursor-pointer">Show proxy debug JSON</summary>
                                                    <pre className="text-xs mt-2 overflow-auto">{JSON.stringify(debugData, null, 2)}</pre>
                                                </details>
                                            </div>
                                        )}
                                    </div>

                                    <details className="mt-2 p-2 bg-gray-50 rounded">
                                        <summary className="cursor-pointer">Raw JSON</summary>
                                        <pre className="text-xs mt-2 overflow-auto">{JSON.stringify(selected, null, 2)}</pre>
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
