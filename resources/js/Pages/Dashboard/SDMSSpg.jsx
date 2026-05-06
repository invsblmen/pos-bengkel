import React, { useEffect, useMemo, useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import { IconArrowLeft, IconRefresh, IconSearch, IconTruckDelivery, IconPlus, IconCheck, IconSend } from '@tabler/icons-react';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Card, CardBody, CardHeader, CardTitle } from '@/Components/Card';
import axios from 'axios';
import { toDisplayDateTime } from '@/Utils/datetime';

const normalizeText = (value) => (value ?? '').toString().toLowerCase();

const unwrapList = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== 'object') return [];
    if (Array.isArray(payload.items)) return payload.items;
    if (Array.isArray(payload.Items)) return payload.Items;
    if (Array.isArray(payload.Result)) return payload.Result;
    if (Array.isArray(payload.result)) return payload.result;
    if (Array.isArray(payload.data)) return payload.data;
    if (Array.isArray(payload.Data)) return payload.Data;
    if (payload.Result && Array.isArray(payload.Result.Result)) return payload.Result.Result;
    return [];
};

const firstValue = (source, keys) => {
    if (!source || typeof source !== 'object') return '';

    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== null && source[key] !== undefined && source[key] !== '') {
            return source[key];
        }
    }

    return '';
};

const extractDetailText = (item, keys) => {
    const value = firstValue(item, keys);
    return value === null || value === undefined ? '' : value;
};

const extractShipmentPartNumber = (item) =>
    extractDetailText(item, ['numberPart', 'number_part', 'partNumber', 'part_number', 'partNo', 'part_no', 'PartNo', 'codePart', 'code_part', 'code', 'partCode', 'part_code']);

const extractShipmentPartName = (item) =>
    extractDetailText(item, ['descPart', 'desc_part', 'partName', 'part_name', 'namaPart', 'nama_part', 'name', 'part_desc', 'partDescription', 'Description', 'description']);

const extractShipmentIdProduct = (item) => extractDetailText(item, ['idproduct', 'idProduct', 'id_product', 'productId', 'product_id']);

const extractShipmentQty = (item) => extractDetailText(item, ['qty', 'Qty', 'quantity', 'Quantity', 'jumlah', 'receivedQty', 'received_qty', 'qtyReceived']);

const extractShipmentUnit = (item) => extractDetailText(item, ['satuan', 'unit', 'uom', 'UOM', 'measurement']);

const extractShipmentWarehouse = (item) => extractDetailText(item, ['gudang', 'warehouse', 'warehouseName', 'warehouse_name', 'whName', 'wh_name']);

const extractShipmentRack = (item) => extractDetailText(item, ['rak', 'rack', 'rackName', 'rack_name', 'shelf']);

const extractShipmentHeader = (payload) => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return payload;

    if (payload.Result && typeof payload.Result === 'object' && !Array.isArray(payload.Result)) {
        return payload.Result;
    }

    if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
        return payload.data;
    }

    return payload;
};

const extractShipmentLabel = (item, keys) => {
    const value = extractDetailText(item, keys);
    return value ? value.toString() : '';
};

const extractShipmentVendorId = (item) => extractDetailText(item, ['idVendor', 'idvendor', 'vendorId', 'vendor_id']);
const extractShipmentVendorName = (item) => extractDetailText(item, ['vendorName', 'vendor_name', 'nameVendor', 'vendor']);
const extractShipmentDocumentNumber = (item) => extractDetailText(item, ['documentNumber', 'document_number', 'documentNo', 'document_no']);
const extractShipmentDtStatus = (item) => extractDetailText(item, ['dtStatus', 'dt_status', 'statusDate']);
const extractShipmentContainer = (item) => extractDetailText(item, ['containerName', 'container', 'container_name']);
const extractShipmentIdFacility = (item) => extractDetailText(item, ['idfacility', 'idFacility', 'id_facility']);
const extractShipmentIdContainer = (item) => extractDetailText(item, ['idcontainer', 'idContainer', 'id_container']);
const extractShipmentLocation = (item) => extractDetailText(item, ['location', 'lokasi', 'warehouse_location']);
const extractShipmentSerial = (item) => extractDetailText(item, ['serialnumber', 'serialNumber', 'serial_number']);

const deriveInitialRows = (list) =>
    list.map((item) => ({
        receivedQty: `${extractShipmentQty(item) ?? ''}`,
        damagedQty: '0',
    }));

const extractCompareItems = (response) => {
    if (!response || typeof response !== 'object') return { partDalamPS: [], partDiluarPS: [] };

    const partDalamPS = Array.isArray(response.partDalamPS) ? response.partDalamPS : [];
    const partDiluarPS = Array.isArray(response.partDiluarPS) ? response.partDiluarPS : [];

    return { partDalamPS, partDiluarPS };
};

const getCompareItemValue = (item, keys) => {
    if (!item || typeof item !== 'object') return '';
    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(item, key) && item[key] !== null && item[key] !== undefined && item[key] !== '') {
            return item[key];
        }
    }
    return '';
};

const getCompareItemQtyInvoice = (item) => parseFloat(getCompareItemValue(item, ['qtyInvoice', 'qty_invoice', 'invoiceQty', 'expectedQty']) || 0);
const getCompareItemQtyReceive = (item) => parseFloat(getCompareItemValue(item, ['qtyReceive', 'qty_receive', 'actualQty', 'qty_actual']) || 0);
const getCompareItemQtyRejected = (item) => parseFloat(getCompareItemValue(item, ['qtyRejected', 'qty_rejected', 'rejectedQty', 'damagedQty']) || 0);
const getCompareItemDelta = (item) => parseFloat(getCompareItemValue(item, ['delta', 'selisih', 'difference', 'variance']) || 0);
const getCompareItemPartNumber = (item) => getCompareItemValue(item, ['numberPart', 'number_part', 'partNumber', 'part_number', 'idproduct', 'product_id']);
const getCompareItemPartName = (item) => getCompareItemValue(item, ['name', 'partName', 'part_name', 'description', 'desc']);
const getCompareItemDescription = (item) => getCompareItemValue(item, ['description', 'status', 'mismatchStatus', 'result']);

export default function SDMSSpg({ initialIdBilling, initialSupplierId, sdms }) {
    const [idBilling, setIdBilling] = useState(initialIdBilling ?? '');
    const [selectedSupplierId, setSelectedSupplierId] = useState(initialSupplierId ?? '');
    const [detail, setDetail] = useState(null);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [detailError, setDetailError] = useState(null);
    const [itemsError, setItemsError] = useState(null);
    const [suratJalan, setSuratJalan] = useState('');
    const [draftRows, setDraftRows] = useState([]);
    const [query, setQuery] = useState('');

    const normalizeIdBilling = (value) => (value ?? '').toString().trim();

    const loadSpg = async (nextIdBilling = idBilling) => {
        const billingId = normalizeIdBilling(nextIdBilling);

        if (!billingId) {
            setDetailError('idBilling belum diisi.');
            setItemsError('idBilling belum diisi.');
            return;
        }

        setIdBilling(billingId);
        setLoading(true);
        setDetailError(null);
        setItemsError(null);

        try {
            const [detailResult, itemsResult] = await Promise.allSettled([
                axios.get('/api/part/ShipmentPackageNonMulia', { params: { idbilling: billingId } }),
                axios.get('/api/part/goodPartDetail/getpartspg', { params: { idbilling: billingId } }),
            ]);

            if (detailResult.status === 'fulfilled') {
                const detailPayload = extractShipmentHeader(detailResult.value.data);
                setDetail(detailPayload);
                setSuratJalan(
                    extractShipmentLabel(detailPayload, ['suratJalan', 'surat_jalan', 'noSuratJalan', 'no_surat_jalan', 'deliveryNote', 'delivery_note'])
                );
            } else {
                setDetail(null);
                setDetailError(detailResult.reason?.response?.data?.message || detailResult.reason?.message || 'Gagal memuat detail SPG.');
            }

            if (itemsResult.status === 'fulfilled') {
                const itemPayload = itemsResult.value.data;
                const list = unwrapList(itemPayload);
                setItems(list);
                setDraftRows(deriveInitialRows(list));
                if (list.length === 0) {
                    setItemsError('Item SPG kosong.');
                }
            } else {
                setItems([]);
                setDraftRows([]);
                setItemsError(itemsResult.reason?.response?.data?.message || itemsResult.reason?.message || 'Gagal memuat item SPG.');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (normalizeIdBilling(initialIdBilling)) {
            loadSpg(initialIdBilling);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialIdBilling]);

    const filteredItems = useMemo(() => {
        const keyword = query.trim().toLowerCase();
        if (!keyword) return items;

        return items.filter((item) => {
            const searchable = [
                extractShipmentPartNumber(item),
                extractShipmentPartName(item),
                extractShipmentQty(item),
                extractShipmentUnit(item),
                extractShipmentWarehouse(item),
                extractShipmentRack(item),
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();

            return searchable.includes(keyword);
        });
    }, [items, query]);

    const updateDraftRow = (index, field, value) => {
        setDraftRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row)));
    };

    const [compareLoading, setCompareLoading] = useState(false);
    const [compareResult, setCompareResult] = useState(null);
    const [compareError, setCompareError] = useState(null);
    const [submitLoading, setSubmitLoading] = useState(false);
    const [submitResult, setSubmitResult] = useState(null);
    const [receivedParts, setReceivedParts] = useState([]);
    const [showReceivedList, setShowReceivedList] = useState(false);

    // local sparepart add modal state
    const [showAddModal, setShowAddModal] = useState(false);
    const [modalPart, setModalPart] = useState({ numberPart: '', name: '' });
    const [addedParts, setAddedParts] = useState({});
    const [createSpareLoading, setCreateSpareLoading] = useState(false);
    const [createPurchaseLoading, setCreatePurchaseLoading] = useState(false);

    const handleOpenAddModal = (numberPart, name) => {
        setModalPart({ numberPart, name });
        setShowAddModal(true);
    };

    const handleAddPartLocal = async () => {
        setCreateSpareLoading(true);
        try {
            const vendorId = Number(selectedSupplierId || extractShipmentVendorId(detail)) || null;

            if (!vendorId) {
                alert('Supplier pembelian belum dipilih. Kembali ke list pemesanan untuk memilih supplier.');
                return;
            }

            // Create sparepart via API
            await axios.post('/api/spg/sparepart', {
                part_number: modalPart.numberPart,
                name: modalPart.name,
                supplier_id: vendorId,
                buy_price: 0,
                sell_price: 0,
                status: 'active',
            });
            // Mark part as added in local state
            setAddedParts((prev) => ({ ...prev, [modalPart.numberPart]: true }));
            setShowAddModal(false);
            setModalPart({ numberPart: '', name: '' });
            alert('Sparepart berhasil ditambahkan!');
        } catch (err) {
            console.error(err);
            alert('Gagal menambah sparepart: ' + (err?.response?.data?.message || err.message || 'Unknown'));
        } finally {
            setCreateSpareLoading(false);
        }
    };

    const allPartsAdded = receivedParts.length > 0 && receivedParts.every((part) => addedParts[getCompareItemPartNumber(part)]);

    const handleLanjutKePembelian = async () => {
        if (!allPartsAdded) {
            alert('Semua sparepart harus ditambahkan terlebih dahulu.');
            return;
        }

        setCreatePurchaseLoading(true);
        try {
            const vendorId = Number(selectedSupplierId || extractShipmentVendorId(detail)) || null;
            if (!vendorId) {
                alert('Supplier pembelian belum dipilih.');
                return;
            }

            // Map receivedParts to purchase items
            const items = receivedParts.map((part) => ({
                part_id: part.part_id || getCompareItemPartNumber(part), // will need part lookup
                quantity: parseInt(getCompareItemQtyReceive(part)) || 1,
                unit_price: 0, // default 0, can be updated later
            }));

            // Call create purchase endpoint
            const response = await axios.post('/api/spg/part-purchase', {
                supplier_id: vendorId,
                items: items,
                notes: `SPG ${idBilling} - Surat Jalan ${suratJalan}`,
            });

            if (response.data && response.data.success) {
                alert(`Purchase Order berhasil dibuat: ${response.data.purchase_number}`);
                // Optionally redirect atau navigate ke purchase page
                // Untuk sekarang, reset state
                setShowReceivedList(false);
                setReceivedParts([]);
                setAddedParts({});
            }
        } catch (err) {
            console.error(err);
            alert('Gagal membuat purchase order: ' + (err?.response?.data?.message || err.message || 'Unknown'));
        } finally {
            setCreatePurchaseLoading(false);
        }
    };


    const handleCompare = async () => {
        if (!detail) {
            alert('Detail SPG belum dimuat.');
            return;
        }

        setCompareResult(null);
        setCompareError(null);

        const nomorPsFromDetail = extractShipmentLabel(detail, ['nomorPs', 'noPs', 'nomor_ps', 'noPs', 'purchaseNumber', 'documentNumber']);
        const documentNumberFromDetail = extractShipmentDocumentNumber(detail);

        const payload = {
            idBilling: idBilling,
            nomorPs: nomorPsFromDetail || documentNumberFromDetail || '',
            idVendor: extractShipmentVendorId(detail) || '',
            dtCreated: extractShipmentLabel(detail, ['dtCreated', 'dtcreate', 'dt_create', 'createdAt', 'created_at', 'date', 'shipmentDate']) || '',
            vendorName: extractShipmentVendorName(detail) || '',
            documentNumber: suratJalan || '',
            checkboxDocumentNumber: false,
            dtStatus: extractShipmentDtStatus(detail) || '',
            items: (items || []).map((item, idx) => {
                const row = draftRows[idx] ?? { receivedQty: `${extractShipmentQty(item) ?? ''}`, damagedQty: '0' };

                return {
                    numberPart: extractShipmentPartNumber(item) || extractShipmentIdProduct(item) || '',
                    name: extractShipmentPartName(item) || '',
                    qtyReceive: parseInt(row.receivedQty || extractShipmentQty(item) || 0, 10) || 0,
                    qtyRejected: parseInt(row.damagedQty || 0, 10) || 0,
                    itemdescription: extractShipmentUnit(item) || '',
                    containerName: extractShipmentContainer(item) || '',
                    idfacility: extractShipmentIdFacility(item) || '',
                    idcontainer: extractShipmentIdContainer(item) || '',
                    location: extractShipmentLocation(item) || extractShipmentWarehouse(item) || '',
                    serialnumber: extractShipmentSerial(item) || null,
                };
            }),
        };

        try {
            setCompareLoading(true);
            const response = await axios.put('/api/part/ComparePartReceive', payload);
            setCompareResult(response.data || null);
            setCompareError(null);
        } catch (err) {
            console.error(err);
            setCompareError(err);
            setCompareResult(err?.response?.data || null);
        } finally {
            setCompareLoading(false);
        }
    };

    const handleSubmitSPG = async () => {
        if (!detail) {
            alert('Detail SPG belum dimuat.');
            return;
        }

        setSubmitResult(null);
        setSubmitLoading(true);

        // prefer items from compareResult.partDalamPS when available
        const compareItemsObj = compareResult ? extractCompareItems(compareResult) : null;
        const itemsToSend = compareItemsObj && Array.isArray(compareItemsObj.partDalamPS) && compareItemsObj.partDalamPS.length > 0
            ? compareItemsObj.partDalamPS
            : [];

        if (itemsToSend.length === 0) {
            if (!confirm('Tidak ada item dari hasil banding (partDalamPS). Tetap submit dengan item saat ini?')) {
                setSubmitLoading(false);
                return;
            }
        }

        const payload = {
            idBilling: idBilling,
            nomorPs: extractShipmentLabel(detail, ['nomorPs', 'noPs', 'nomor_ps', 'purchaseNumber', 'documentNumber']) || '',
            idVendor: extractShipmentVendorId(detail) || '',
            dtCreated: extractShipmentLabel(detail, ['dtCreated', 'dtcreate', 'dt_create', 'createdAt', 'created_at', 'date', 'shipmentDate']) || '',
            vendorName: extractShipmentVendorName(detail) || '',
            documentNumber: suratJalan || extractShipmentDocumentNumber(detail) || '',
            checkboxDocumentNumber: false,
            dtStatus: extractShipmentDtStatus(detail) || '',
            items: itemsToSend,
        };

        try {
            const response = await axios.post('/api/part/ShipmentReceipt', payload);
            setSubmitResult(response.data || null);
            const received = (response.data && Array.isArray(response.data.partDalamPS)) ? response.data.partDalamPS : (itemsToSend || []);
            setReceivedParts(received);
            setShowReceivedList(true);
            alert('Submit SPG berhasil. Received list ditampilkan.');
        } catch (err) {
            console.error(err);
            alert('Gagal submit SPG: ' + (err?.response?.data?.message || err.message || 'Unknown'));
            setSubmitResult(err?.response?.data || null);
        } finally {
            setSubmitLoading(false);
        }
    };

    return (
        <DashboardLayout>
            <Head title="SPG" />

            <div className="space-y-6">
                <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-emerald-50 p-6 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900/70">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                        <div className="max-w-2xl space-y-2">
                            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                                <IconTruckDelivery size={14} /> SPG
                            </div>
                            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Detail Shipment Package</h1>
                            <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">
                                Halaman ini memuat detail SPG dari SDMS, field surat jalan, dan daftar item yang bisa diedit untuk nomor part serta jumlah rusak.
                            </p>
                        </div>

                                <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[420px]">
                            <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/60">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">idBilling</p>
                                <p className="mt-2 break-all text-sm font-semibold text-slate-900 dark:text-white">{idBilling || '-'}</p>
                            </div>
                            <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/60">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Item</p>
                                <p className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{items.length}</p>
                            </div>
                            <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/60">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Surat Jalan</p>
                                <p className="mt-2 break-all text-sm font-semibold text-slate-900 dark:text-white">{suratJalan || '-'}</p>
                            </div>
                        </div>
                    </div>
                </div>

                        <div className="mt-4 rounded-2xl border border-cyan-200 bg-cyan-50/70 p-4 dark:border-cyan-900/40 dark:bg-cyan-950/20">
                            <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold uppercase tracking-wide text-cyan-800 dark:text-cyan-300">Supplier Pembelian</label>
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                        <input
                                            value={selectedSupplierId}
                                            onChange={(event) => setSelectedSupplierId(event.target.value)}
                                            placeholder="Isi dari list pemesanan atau ubah manual jika perlu"
                                            className="w-full rounded-xl border border-cyan-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 dark:border-cyan-900/40 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-cyan-900/30"
                                        />
                                        <div className="rounded-xl bg-cyan-100 px-3 py-2 text-xs font-semibold text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-200">
                                            Vendor aktif untuk pembelian ini
                                        </div>
                                    </div>
                                </div>
                                <div className="text-xs text-cyan-900 dark:text-cyan-200">
                                    Supplier ini dipakai saat menambahkan part ke pembelian dan saat membuat purchase order.
                                </div>
                            </div>
                        </div>

                <Card>
                    <CardHeader>
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <CardTitle>Form SPG</CardTitle>
                            <div className="flex flex-wrap gap-2">
                                <Link
                                    href={route('sdms.delivery.index')}
                                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
                                >
                                    <IconArrowLeft size={16} />
                                    Kembali
                                </Link>
                                <button
                                    onClick={() => loadSpg(idBilling)}
                                    disabled={loading}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                                >
                                    <IconRefresh size={16} className={loading ? 'animate-spin' : ''} />
                                    {loading ? 'Memuat...' : 'Muat SPG'}
                                </button>
                                <button
                                    onClick={handleCompare}
                                    disabled={compareLoading || !detail}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-600 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-600 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {compareLoading ? 'Membandingkan...' : 'Bandingkan'}
                                </button>
                                <button
                                    onClick={handleSubmitSPG}
                                    disabled={submitLoading || !detail || !compareResult}
                                    title={!compareResult ? 'Lakukan Bandingkan terlebih dahulu untuk melihat perbandingan' : ''}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <IconSend size={16} />
                                    {submitLoading ? 'Mengirim...' : 'Submit SPG'}
                                </button>
                            </div>
                            {!compareResult && (
                                <div className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                                    💡 <span className="font-semibold">Submit SPG</span> memerlukan hasil <span className="font-semibold">Bandingkan</span> untuk memvalidasi kesesuaian item.
                                </div>
                            )}
                        </div>
                    </CardHeader>
                    <CardBody>
                        <div className="grid gap-4 lg:grid-cols-3">
                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">idBilling</label>
                                <p className="mt-2 break-all text-sm font-semibold text-slate-900 dark:text-white">{idBilling || '-'}</p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Surat Jalan</label>
                                <input
                                    value={suratJalan}
                                    onChange={(event) => setSuratJalan(event.target.value)}
                                    placeholder="Nomor surat jalan"
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-emerald-900/40"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tanggal</label>
                                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                                    {detail
                                        ? (extractShipmentLabel(detail, ['dtCreate', 'dtcreate', 'dt_create', 'createdAt', 'created_at', 'date', 'shipmentDate'])
                                            ? toDisplayDateTime(
                                                extractShipmentLabel(detail, ['dtCreate', 'dtcreate', 'dt_create', 'createdAt', 'created_at', 'date', 'shipmentDate'])
                                              )
                                            : '-')
                                        : '-'}
                                </p>
                            </div>
                        </div>

                        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div className="relative min-w-0 lg:w-[360px]">
                                <IconSearch size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                    placeholder="Cari part, gudang, rak..."
                                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-emerald-900/40"
                                />
                            </div>

                            <div className="text-sm text-slate-600 dark:text-slate-400">
                                {filteredItems.length} dari {items.length} item ditampilkan
                            </div>
                        </div>

                        {(detailError || itemsError) && (
                            <div className="mt-4 grid gap-3">
                                {detailError && (
                                    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">{detailError}</div>
                                )}
                                {itemsError && (
                                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">{itemsError}</div>
                                )}
                            </div>
                        )}

                        {detail && (
                            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/70">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Shipment No</p>
                                    <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                                        {extractShipmentLabel(detail, ['shipmentNumber', 'shipmentNo', 'shipment_no', 'packageNumber', 'packageNo', 'package_no', 'documentNumber', 'document_number']) || '-'}
                                    </p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/70">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vendor</p>
                                    <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                                        {extractShipmentVendorName(detail) || extractShipmentLabel(detail, ['vendorName', 'vendor', 'supplier']) || '-'}
                                    </p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/70">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tanggal</p>
                                    <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                                        {extractShipmentLabel(detail, ['dtCreate', 'dtcreate', 'dt_create', 'createdAt', 'created_at', 'date', 'shipmentDate'])
                                            ? toDisplayDateTime(extractShipmentLabel(detail, ['dtCreate', 'dtcreate', 'dt_create', 'createdAt', 'created_at', 'date', 'shipmentDate']))
                                            : '-'}
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                                        <tr>
                                            <th className="px-4 py-3">Nomor Part</th>
                                            <th className="px-4 py-3">Nama Part</th>
                                            <th className="px-4 py-3 text-right">Jumlah Diterima</th>
                                            <th className="px-4 py-3 text-right">Jumlah Rusak</th>
                                            <th className="px-4 py-3">Satuan</th>
                                            <th className="px-4 py-3">Gudang</th>
                                            <th className="px-4 py-3">Rak</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-950">
                                        {filteredItems.map((item, index) => {
                                            const rowIndex = items.indexOf(item);
                                            const row = draftRows[rowIndex] ?? { receivedQty: `${extractShipmentQty(item) ?? ''}`, damagedQty: '0' };

                                            return (
                                                <tr key={rowIndex} className="transition hover:bg-emerald-50/60 dark:hover:bg-emerald-950/20">
                                                    <td className="px-4 py-3 align-top text-slate-600 dark:text-slate-300">{extractShipmentIdProduct(item) || '-'}</td>
                                                    <td className="px-4 py-3 align-top font-medium text-slate-900 dark:text-white">{extractShipmentPartName(item) || '-'}</td>
                                                    <td className="px-4 py-3 align-top text-right">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={row.receivedQty}
                                                            onChange={(event) => updateDraftRow(rowIndex, 'receivedQty', event.target.value)}
                                                            className="w-full min-w-[110px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-right text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-emerald-900/40"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3 align-top text-right">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={row.damagedQty}
                                                            onChange={(event) => updateDraftRow(rowIndex, 'damagedQty', event.target.value)}
                                                            className="w-full min-w-[110px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-right text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-emerald-900/40"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3 align-top text-slate-600 dark:text-slate-300">{extractShipmentUnit(item) || '-'}</td>
                                                    <td className="px-4 py-3 align-top text-slate-600 dark:text-slate-300">{extractShipmentWarehouse(item) || '-'}</td>
                                                    <td className="px-4 py-3 align-top text-slate-600 dark:text-slate-300">{extractShipmentRack(item) || '-'}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {filteredItems.length === 0 && !loading && !detailError && !itemsError && (
                            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-400">
                                Tidak ada item yang cocok dengan pencarian saat ini.
                            </div>
                        )}

                        {(compareResult || compareError) && (
                            <div className="mt-4 grid gap-3">
                                <div className={`rounded-2xl border p-4 ${compareError ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300'}`}>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-semibold">{compareError ? 'Kesalahan Bandingkan' : 'Hasil Bandingkan'}</p>
                                            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{compareError ? (compareError?.response?.data?.message || compareError?.message) : (compareResult?.message || 'Berhasil menerima respons dari SDMS')}</p>
                                        </div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400">{compareResult ? `Status: ${compareResult?.status || 'OK'}` : ''}</div>
                                    </div>
                                </div>

                                {!compareError && compareResult && (
                                    <div className="space-y-4">
                                        {extractCompareItems(compareResult).partDalamPS.length > 0 && (
                                            <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
                                                <div className="bg-slate-50 px-4 py-3 dark:bg-slate-900">
                                                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Part Dalam PS</p>
                                                </div>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-left text-sm">
                                                        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                                                            <tr>
                                                                <th className="px-4 py-3">Nomor Part</th>
                                                                <th className="px-4 py-3">Nama Part</th>
                                                                <th className="px-4 py-3 text-right">Qty Invoice</th>
                                                                <th className="px-4 py-3 text-right">Qty Terima</th>
                                                                <th className="px-4 py-3 text-right">Qty Ditolak</th>
                                                                <th className="px-4 py-3 text-right">Selisih</th>
                                                                <th className="px-4 py-3">Keterangan</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-950">
                                                            {extractCompareItems(compareResult).partDalamPS.map((item, idx) => {
                                                                const partNum = getCompareItemPartNumber(item);
                                                                const partName = getCompareItemPartName(item);
                                                                const qtyInvoice = getCompareItemQtyInvoice(item);
                                                                const qtyReceive = getCompareItemQtyReceive(item);
                                                                const qtyRejected = getCompareItemQtyRejected(item);
                                                                const delta = getCompareItemDelta(item);
                                                                const description = getCompareItemDescription(item);
                                                                const isMatched = delta === 0 && description === 'Matched';

                                                                return (
                                                                    <tr
                                                                        key={idx}
                                                                        className={`transition ${isMatched ? 'hover:bg-emerald-50/60 dark:hover:bg-emerald-950/20' : 'bg-amber-50/60 hover:bg-amber-50 dark:bg-amber-950/20 dark:hover:bg-amber-950/30'}`}
                                                                    >
                                                                        <td className="px-4 py-3 align-top text-slate-600 dark:text-slate-300">{partNum || '-'}</td>
                                                                        <td className="px-4 py-3 align-top font-medium text-slate-900 dark:text-white">{partName || '-'}</td>
                                                                        <td className="px-4 py-3 align-top text-right text-slate-900 dark:text-white">{qtyInvoice}</td>
                                                                        <td className="px-4 py-3 align-top text-right text-slate-900 dark:text-white">{qtyReceive}</td>
                                                                        <td className="px-4 py-3 align-top text-right text-slate-900 dark:text-white">{qtyRejected}</td>
                                                                        <td className={`px-4 py-3 align-top text-right font-semibold ${delta === 0 ? 'text-emerald-600 dark:text-emerald-400' : delta > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
                                                                            {delta > 0 ? '+' : ''}{delta}
                                                                        </td>
                                                                        <td className="px-4 py-3 align-top">
                                                                            <span
                                                                                className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${
                                                                                    isMatched
                                                                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                                                                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                                                                                }`}
                                                                            >
                                                                                {description || '-'}
                                                                            </span>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}

                                        {extractCompareItems(compareResult).partDiluarPS.length > 0 && (
                                            <div className="overflow-hidden rounded-2xl border border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20">
                                                <div className="bg-red-100 px-4 py-3 dark:bg-red-900/40">
                                                    <p className="text-sm font-semibold text-red-900 dark:text-red-300">⚠️ Part Di Luar PS (Unexpected Items)</p>
                                                </div>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-left text-sm">
                                                        <thead className="bg-red-50 text-xs uppercase tracking-wide text-red-700 dark:bg-red-950/30 dark:text-red-300">
                                                            <tr>
                                                                <th className="px-4 py-3">Nomor Part</th>
                                                                <th className="px-4 py-3">Nama Part</th>
                                                                <th className="px-4 py-3 text-right">Qty Terima</th>
                                                                <th className="px-4 py-3 text-right">Qty Ditolak</th>
                                                                <th className="px-4 py-3">Keterangan</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-red-200 bg-white dark:divide-red-900/40 dark:bg-slate-950">
                                                            {extractCompareItems(compareResult).partDiluarPS.map((item, idx) => {
                                                                const partNum = getCompareItemPartNumber(item);
                                                                const partName = getCompareItemPartName(item);
                                                                const qtyReceive = getCompareItemQtyReceive(item);
                                                                const qtyRejected = getCompareItemQtyRejected(item);
                                                                const description = getCompareItemDescription(item);

                                                                return (
                                                                    <tr key={idx} className="bg-red-50/30 hover:bg-red-50/60 dark:bg-red-950/10 dark:hover:bg-red-950/20">
                                                                        <td className="px-4 py-3 align-top text-slate-600 dark:text-slate-300">{partNum || '-'}</td>
                                                                        <td className="px-4 py-3 align-top font-medium text-slate-900 dark:text-white">{partName || '-'}</td>
                                                                        <td className="px-4 py-3 align-top text-right text-slate-900 dark:text-white">{qtyReceive}</td>
                                                                        <td className="px-4 py-3 align-top text-right text-slate-900 dark:text-white">{qtyRejected}</td>
                                                                        <td className="px-4 py-3 align-top">
                                                                            <span className="inline-block rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300">
                                                                                {description || 'Not in PO'}
                                                                            </span>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <pre className="mt-3 overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs leading-6 text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">{JSON.stringify(compareResult || (compareError?.response?.data || { message: compareError?.message }), null, 2)}</pre>
                            </div>
                        )}

                        {showReceivedList && receivedParts.length > 0 && (
                            <div className="mt-6 space-y-4 rounded-2xl border border-sky-200 bg-sky-50/50 p-4 dark:border-sky-900/40 dark:bg-sky-950/20">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900 dark:text-white">📦 Daftar Sparepart Diterima</p>
                                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Tambahkan data sparepart yang belum ada di sistem, kemudian lanjut ke pembelian</p>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                                            {Object.keys(addedParts).length}/{receivedParts.length}
                                        </div>
                                        <div className="text-[10px] text-slate-500">Added</div>
                                    </div>
                                </div>

                                <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                                                <tr>
                                                    <th className="px-4 py-3">Nomor Part</th>
                                                    <th className="px-4 py-3">Nama Part</th>
                                                    <th className="px-4 py-3 text-right">Qty Terima</th>
                                                    <th className="px-4 py-3 text-right">Qty Ditolak</th>
                                                    <th className="px-4 py-3">Aksi</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-950">
                                                {receivedParts.map((part, idx) => {
                                                    const partNum = getCompareItemPartNumber(part);
                                                    const partName = getCompareItemPartName(part);
                                                    const qtyReceive = getCompareItemQtyReceive(part);
                                                    const qtyRejected = getCompareItemQtyRejected(part);
                                                    const isAdded = addedParts[partNum];

                                                    return (
                                                        <tr key={idx} className="transition hover:bg-slate-50 dark:hover:bg-slate-900">
                                                            <td className="px-4 py-3 align-top text-slate-600 dark:text-slate-300">{partNum || '-'}</td>
                                                            <td className="px-4 py-3 align-top font-medium text-slate-900 dark:text-white">{partName || '-'}</td>
                                                            <td className="px-4 py-3 align-top text-right text-slate-900 dark:text-white">{qtyReceive}</td>
                                                            <td className="px-4 py-3 align-top text-right text-slate-900 dark:text-white">{qtyRejected}</td>
                                                            <td className="px-4 py-3 align-top">
                                                                {isAdded ? (
                                                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                                                                        <IconCheck size={14} />
                                                                        Added
                                                                    </span>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => handleOpenAddModal(partNum, partName)}
                                                                        className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-950/50"
                                                                    >
                                                                        <IconPlus size={14} />
                                                                        Add
                                                                    </button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {allPartsAdded && (
                                    <button
                                        onClick={handleLanjutKePembelian}
                                        disabled={createPurchaseLoading}
                                        className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {createPurchaseLoading ? 'Membuat Purchase Order...' : '✓ Lanjut Ke Pembelian Sparepart'}
                                    </button>
                                )}
                            </div>
                        )}

                        {showAddModal && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70">
                                <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-lg dark:border-slate-800 dark:bg-slate-950">
                                    <div className="mb-4">
                                        <p className="text-lg font-semibold text-slate-900 dark:text-white">Tambah Data Sparepart</p>
                                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Lengkapi data sparepart yang belum ada di sistem</p>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nomor Part (Kode Part)</label>
                                            <input
                                                type="text"
                                                readOnly
                                                value={modalPart.numberPart}
                                                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                                            />
                                        </div>

                                        <div>
                                            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nama Part</label>
                                            <input
                                                type="text"
                                                readOnly
                                                value={modalPart.name}
                                                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                                            />
                                        </div>

                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/50">
                                            <p className="text-xs text-slate-600 dark:text-slate-400">
                                                ℹ️ Data lengkap sparepart akan disimpan. Anda dapat mengisi detail tambahan di halaman master sparepart kemudian.
                                            </p>
                                        </div>

                                        <div className="flex gap-2 pt-2">
                                            <button
                                                onClick={() => setShowAddModal(false)}
                                                disabled={createSpareLoading}
                                                className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                            >
                                                Batal
                                            </button>
                                            <button
                                                onClick={handleAddPartLocal}
                                                disabled={createSpareLoading}
                                                className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                                {createSpareLoading ? 'Menambah...' : 'Tambah Sparepart'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}


                        <details className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                            <summary className="cursor-pointer text-sm font-semibold text-slate-700 dark:text-slate-200">Raw JSON Item</summary>
                            <pre className="mt-3 overflow-auto text-xs leading-6 text-slate-700 dark:text-slate-300">{JSON.stringify(items, null, 2)}</pre>
                        </details>

                        <details className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                            <summary className="cursor-pointer text-sm font-semibold text-slate-700 dark:text-slate-200">State Draft</summary>
                            <pre className="mt-3 overflow-auto text-xs leading-6 text-slate-700 dark:text-slate-300">{JSON.stringify({ suratJalan, draftRows }, null, 2)}</pre>
                        </details>
                    </CardBody>
                </Card>
            </div>
        </DashboardLayout>
    );
}
