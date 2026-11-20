import React, { useEffect, useMemo, useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import { IconArrowLeft, IconRefresh, IconSearch, IconPlus, IconCheck, IconSend } from '@tabler/icons-react';
import { Card, CardBody, CardHeader, CardTitle } from '@/Components/Card';
import axios from 'axios';
import SDMSAuthModal from '@/Components/Dashboard/SDMSAuthModal';
import SDMSSessionStatus from '@/Components/Dashboard/SDMSSessionStatus';
import { toDisplayDateTime } from '@/Utils/datetime';

const normalizeText = (value) => (value ?? '').toString().toLowerCase();

const isDuplicateInvoiceResponse = (response) => {
    const data = response?.data ?? response;
    const message = [
        data?.message,
        data?.error,
        data?.title,
        data?.detail,
        ...(Array.isArray(data?.errors) ? data.errors : []),
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

    return response?.status === 409
        || data?.code === 'DUPLICATE_INVOICE'
        || data?.code === 'INVOICE_ALREADY_EXISTS'
        || /duplicate|already exists|already submitted|sudah ada|sudah pernah|nomor invoice.*(sama|ada)/i.test(message);
};

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

const findDeepDetailText = (source, keys) => {
    if (!source || typeof source !== 'object') return '';

    const visited = new WeakSet();
    const walk = (node) => {
        if (!node || typeof node !== 'object' || visited.has(node)) return '';
        visited.add(node);

        const direct = extractDetailText(node, keys);
        if (direct) return direct;

        for (const key of Object.keys(node)) {
            const child = node[key];
            if (child && typeof child === 'object') {
                const nested = walk(child);
                if (nested) return nested;
            }
        }

        return '';
    };

    return walk(source);
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
const getCompareItemUnitPrice = (item) => parseInt(getCompareItemValue(item, ['unitPrice', 'unit_price', 'price', 'costPrice', 'cost_price', 'purchasePrice', 'purchase_price', 'buyPrice', 'buy_price']) || 0, 10);
const getCompareItemDiscountType = (item) => getCompareItemValue(item, ['discountType', 'discount_type', 'itemDiscountType', 'item_discount_type']) || 'none';
const getCompareItemDiscountValue = (item) => parseFloat(getCompareItemValue(item, ['discountValue', 'discount_value', 'discount', 'discountAmount', 'discount_amount']) || 0);
const getComparePurchaseDiscountType = (source) => getCompareItemValue(source, ['discountType', 'discount_type', 'transactionDiscountType', 'transaction_discount_type', 'overallDiscountType', 'overall_discount_type']) || 'none';
const getComparePurchaseDiscountValue = (source) => parseFloat(getCompareItemValue(source, ['discountValue', 'discount_value', 'transactionDiscountValue', 'transaction_discount_value', 'overallDiscountValue', 'overall_discount_value']) || 0);
const getCompareItemDescription = (item) => getCompareItemValue(item, ['description', 'status', 'mismatchStatus', 'result']);
const getOrderItemPartNumber = (item) => findDeepDetailText(item, ['numberPart', 'number_part', 'partNumber', 'part_number']);
const getOrderItemQty = (item) => parseFloat(findDeepDetailText(item, ['qty', 'quantity']) || 0);
const getOrderItemLineTotal = (item) => {
    const qty = getOrderItemQty(item) || 0;
    const rawAmount = parseInt(findDeepDetailText(item, ['amount', 'totalamount', 'total_amount', 'grandTotal', 'grand_total', 'lineTotal', 'line_total', 'subtotal', 'final_amount']) || 0, 10);

    // If `amount` appears to be a per-unit price (common in SDMS responses), compute line total
    if (qty > 0 && Object.prototype.hasOwnProperty.call(item, 'amount')) {
        const perItemDiscount = parseInt(findDeepDetailText(item, ['discdtlitemamount', 'discdtllineamount']) || 0, 10);
        // If discdtlitemamount is a per-item discount, use it; if only line discount present, divide by qty
        let perItemDisc = 0;
        if (Object.prototype.hasOwnProperty.call(item, 'discdtlitemamount')) {
            perItemDisc = parseInt(findDeepDetailText(item, ['discdtlitemamount']) || 0, 10);
        } else if (Object.prototype.hasOwnProperty.call(item, 'discdtllineamount')) {
            const lineDisc = parseInt(findDeepDetailText(item, ['discdtllineamount']) || 0, 10);
            perItemDisc = qty ? Math.round(lineDisc / qty) : 0;
        }

        return Math.round((rawAmount - perItemDisc) * qty);
    }

    return parseInt(rawAmount || 0, 10);
};

const getOrderItemUnitPrice = (item) => {
    // Prefer explicit unit price fields, then fall back to `amount` which in SDMS is often per-unit
    const explicitUnitPrice = parseInt(findDeepDetailText(item, ['unitPrice', 'unit_price', 'price', 'costPrice', 'cost_price', 'purchasePrice', 'purchase_price', 'buyPrice', 'buy_price']) || 0, 10);
    if (explicitUnitPrice > 0) return explicitUnitPrice;

    const amount = parseInt(findDeepDetailText(item, ['amount']) || 0, 10);
    if (amount > 0) return amount;

    const qty = getOrderItemQty(item) || 0;
    const lineTotal = parseInt(findDeepDetailText(item, ['totalamount', 'total_amount', 'subtotal', 'lineTotal', 'line_total', 'final_amount']) || 0, 10);
    if (qty > 0 && lineTotal > 0) return Math.round(lineTotal / qty);

    return 0;
};

const getOrderItemLineDiscount = (item) => {
    const qty = getOrderItemQty(item) || 0;
    const lineDisc = parseInt(findDeepDetailText(item, ['discdtllineamount', 'discountlinetotal', 'discountLineAmount', 'discount_line_amount']) || 0, 10);
    const itemDisc = parseInt(findDeepDetailText(item, ['discdtlitemamount', 'cashdiscamount']) || 0, 10);

    if (lineDisc > 0) return lineDisc;
    if (itemDisc > 0 && qty > 0) return Math.round(itemDisc * qty);
    return 0;
};
const getOrderItemOverallDiscount = (source) => {
    const candidates = [
        source,
        source?.items,
        source?.Items,
        source?.Result,
        source?.Result?.items,
        source?.Result?.Items,
        source?.data,
        source?.data?.items,
        source?.Data,
        source?.Data?.Items,
    ];

    for (const candidate of candidates) {
        if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue;

        const directDiscount = parseInt(extractDetailText(candidate, ['discount', 'Discount', 'discountAmount', 'discount_amount']) || 0, 10);
        if (directDiscount > 0) return directDiscount;
    }

    return parseInt(findDeepDetailText(source, ['discount', 'Discount', 'discountAmount', 'discount_amount']) || 0, 10);
};
const getOrderItemUnitDiscount = (item) => parseInt(findDeepDetailText(item, ['discdtlitemamount', 'cashdiscamount']) || 0, 10);
const getOrderItemTotalDiscount = (item) => parseInt(findDeepDetailText(item, ['discdtllineamount', 'discountlinetotal', 'discountLineAmount', 'discount_line_amount']) || 0, 10);
const extractDeliveryReference = (payload) => {
    const list = unwrapList(payload);
    const first = Array.isArray(list) && list.length > 0 ? list[0] : null;
    const source = (payload && typeof payload === 'object' && !Array.isArray(payload))
        ? (payload.Result && typeof payload.Result === 'object' && !Array.isArray(payload.Result)
            ? payload.Result
            : payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)
                ? payload.data
                : payload)
        : {};

    return {
        billingNumber: findDeepDetailText(source, ['billingnumber', 'billingNumber', 'billing_number', 'billingNo', 'billing_no']) || findDeepDetailText(first, ['billingnumber', 'billingNumber', 'billing_number', 'billingNo', 'billing_no']),
        psNumber: findDeepDetailText(source, ['psnumber', 'psNumber', 'ps_number']) || findDeepDetailText(first, ['psnumber', 'psNumber', 'ps_number']),
    };
};

const normalizePartNumber = (value) => (value ?? '').toString().trim();

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
    const [purchaseItems, setPurchaseItems] = useState([]);
    const [purchaseResponse, setPurchaseResponse] = useState(null);
    const [purchaseReference, setPurchaseReference] = useState({ billingNumber: '', psNumber: '' });
    const [createdPurchase, setCreatedPurchase] = useState(null);
    const [existingParts, setExistingParts] = useState({});
    const isAuthenticated = Boolean(sdms && (sdms.access_token || sdms.id_token));

    const normalizeIdBilling = (value) => (value ?? '').toString().trim();

    const loadSpg = async (nextIdBilling = idBilling) => {
        if (!isAuthenticated) {
            setShowLoginModal(true);
            return;
        }

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
        setAddedParts({});
        setExistingParts({});
        setReceivedParts([]);
        setShowReceivedList(false);
        setCreatedPurchase(null);

        try {
            const headers = sdms
                ? {
                      Authorization: `Bearer ${sdms.access_token ?? sdms.id_token}`,
                      username: sdms.username,
                      idInternal: sdms.idInternal,
                  }
                : {};

            const [detailResult, itemsResult, orderResult, deliveryResult] = await Promise.allSettled([
                axios.get('/api/part/ShipmentPackageNonMulia', { params: { idbilling: billingId }, headers }),
                axios.get('/api/part/goodPartDetail/getpartspg', { params: { idbilling: billingId }, headers }),
                axios.get('/api/part/orderitemdo', { params: { fill: billingId }, headers }),
                axios.get('/api/part/deliveryorderitem', { params: { page: 1, size: 1000, filterData: JSON.stringify({ idbilling: billingId }) }, headers }),
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

            if (orderResult.status === 'fulfilled') {
                const orderPayload = orderResult.value.data;
                const list = unwrapList(orderPayload);
                setPurchaseItems(list);
                setPurchaseResponse(orderPayload || null);
            } else {
                setPurchaseItems([]);
                setPurchaseResponse(null);
            }

            if (deliveryResult.status === 'fulfilled') {
                setPurchaseReference(extractDeliveryReference(deliveryResult.value.data));
            } else {
                setPurchaseReference({ billingNumber: '', psNumber: '' });
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isAuthenticated && normalizeIdBilling(initialIdBilling)) {
            loadSpg(initialIdBilling);
            return;
        }

        if (!isAuthenticated) {
            setLoading(false);
            setDetail(null);
            setItems([]);
            setDraftRows([]);
            setDetailError(null);
            setItemsError(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialIdBilling, isAuthenticated]);

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
    const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

    // local sparepart add modal state
    const [showAddModal, setShowAddModal] = useState(false);
    const [modalPart, setModalPart] = useState({ numberPart: '', name: '' });
    const [addedParts, setAddedParts] = useState({});
    const [createSpareLoading, setCreateSpareLoading] = useState(false);
    const [createPurchaseLoading, setCreatePurchaseLoading] = useState(false);
    const [showLoginModal, setShowLoginModal] = useState(false);

    const handleOpenAddModal = (numberPart, name) => {
        setModalPart({ numberPart, name });
        setShowAddModal(true);
    };

    const loadExistingSpareparts = async (parts = []) => {
        const partNumbers = parts
            .map((part) => normalizePartNumber(getCompareItemPartNumber(part)))
            .filter(Boolean);

        if (partNumbers.length === 0) {
            setExistingParts({});
            return;
        }

        try {
            const response = await axios.post('/api/spg/existing-parts', { part_numbers: partNumbers });
            const matchedPartNumbers = Array.isArray(response.data?.part_numbers) ? response.data.part_numbers : [];

            setExistingParts(
                matchedPartNumbers.reduce((accumulator, partNumber) => {
                    const key = normalizePartNumber(partNumber);
                    if (key) {
                        accumulator[key] = true;
                    }
                    return accumulator;
                }, {})
            );
        } catch (err) {
            console.error(err);
            setExistingParts({});
        }
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
            const normalizedPartNumber = normalizePartNumber(modalPart.numberPart);
            setAddedParts((prev) => ({ ...prev, [normalizedPartNumber]: true }));
            setExistingParts((prev) => ({ ...prev, [normalizedPartNumber]: true }));
            setShowAddModal(false);
            setModalPart({ numberPart: '', name: '' });
            alert('Sparepart berhasil ditambahkan!');
        } catch (err) {
            console.error(err);
            const normalizedPartNumber = normalizePartNumber(modalPart.numberPart);
            const errorMessage = err?.response?.data?.message || err.message || 'Unknown';

            if (String(errorMessage).toLowerCase().includes('unique') || String(errorMessage).toLowerCase().includes('already')) {
                setAddedParts((prev) => ({ ...prev, [normalizedPartNumber]: true }));
                setExistingParts((prev) => ({ ...prev, [normalizedPartNumber]: true }));
                setShowAddModal(false);
                setModalPart({ numberPart: '', name: '' });
                alert('Sparepart sudah ada di data sparepart. Item ini ditandai sebagai sudah tersedia.');
                return;
            }

            alert('Gagal menambah sparepart: ' + errorMessage);
        } finally {
            setCreateSpareLoading(false);
        }
    };

    const purchaseSourceItems = purchaseItems;
    const isPartCovered = (part) => {
        const partNumber = normalizePartNumber(getCompareItemPartNumber(part) || getOrderItemPartNumber(part));

        if (!partNumber) {
            return false;
        }

        return Boolean(addedParts[partNumber] || existingParts[partNumber]);
    };

    const allPartsAdded = purchaseSourceItems.length > 0 && purchaseSourceItems.every((part) => isPartCovered(part));

    const handleLanjutKePembelian = async () => {
        if (!purchaseItems.length) {
            alert('Data harga pembelian belum dimuat dari orderitemdo. Muat SPG ulang terlebih dahulu.');
            return;
        }

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

            // Map order item detail response to purchase items
            const items = purchaseSourceItems.map((part) => {
                const partNumber = getOrderItemPartNumber(part) || getCompareItemPartNumber(part) || part.part_id || '';
                const qty = Number(getOrderItemQty(part) || getCompareItemQtyReceive(part) || 1);
                const lineDiscount = getOrderItemLineDiscount(part);
                const sdmsUnitDiscount = getOrderItemUnitDiscount(part);
                const sdmsLineDiscount = getOrderItemTotalDiscount(part);
                const unitPrice = getOrderItemUnitPrice(part) || getCompareItemUnitPrice(part) || 0;
                const lineTotal = getOrderItemLineTotal(part) || (unitPrice * qty);

                return {
                    part_id: part.part_id || partNumber,
                    quantity: qty,
                    unit_price: unitPrice,
                    subtotal: lineTotal,
                    line_total: lineTotal,
                    discdtlitemamount: sdmsUnitDiscount,
                    discdtllineamount: sdmsLineDiscount,
                    discount_type: lineDiscount > 0 ? 'fixed' : getCompareItemDiscountType(part),
                    discount_value: lineDiscount > 0 ? lineDiscount : getCompareItemDiscountValue(part),
                    margin_type: 'percent',
                    margin_value: 0,
                    promo_discount_type: 'none',
                    promo_discount_value: 0,
                };
            });

            const invalidPriceItems = items.filter((item) => Number(item.unit_price || 0) <= 0);
            if (invalidPriceItems.length > 0) {
                const invalidLabels = invalidPriceItems.map((item) => item.part_id).filter(Boolean).join(', ');
                alert(`Masih ada harga 0 pada item berikut: ${invalidLabels || 'beberapa item'}. Cek respons orderitemdo.`);
                return;
            }

            const sourceForTransactionDiscount = purchaseResponse || compareResult || submitResult || detail || {};
            const orderDiscountValue = getOrderItemOverallDiscount(sourceForTransactionDiscount);
            const purchaseNotes = [
                `SPG ${idBilling}`,
                `Billing ${purchaseReference.billingNumber || idBilling}`,
                purchaseReference.psNumber ? `PS ${purchaseReference.psNumber}` : null,
                suratJalan ? `Surat Jalan ${suratJalan}` : null,
            ].filter(Boolean).join(' | ');

            // Call create purchase endpoint
            const headers = sdms
                ? {
                      Authorization: `Bearer ${sdms.access_token ?? sdms.id_token}`,
                      username: sdms.username,
                      idInternal: sdms.idInternal,
                  }
                : {};

            const response = await axios.post('/api/spg/part-purchase', {
                supplier_id: vendorId,
                items: items,
                discount_type: orderDiscountValue > 0 ? 'fixed' : getComparePurchaseDiscountType(sourceForTransactionDiscount),
                discount_value: orderDiscountValue > 0 ? orderDiscountValue : getComparePurchaseDiscountValue(sourceForTransactionDiscount),
                notes: purchaseNotes,
            }, { headers });

            if (response.data && response.data.success) {
                const purchase = response.data.purchase || null;
                setCreatedPurchase(purchase);
                // Optionally redirect atau navigate ke purchase page
                // Untuk sekarang, reset state except keep createdPurchase for display
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

        payload.documentNumber = String(payload.documentNumber ?? '').trim();
        if (!payload.documentNumber) {
            alert('Nomor invoice/surat jalan wajib diisi sebelum submit SPG.');
            setSubmitLoading(false);
            return;
        }

        try {
            const response = await axios.post('/api/part/ShipmentReceipt', payload);

            if (isDuplicateInvoiceResponse(response)) {
                alert(`Nomor invoice ${payload.documentNumber} sudah pernah disubmit.`);
                setSubmitResult(response.data || null);
                return;
            }

            setSubmitResult(response.data || null);
            const received = (response.data && Array.isArray(response.data.partDalamPS)) ? response.data.partDalamPS : (itemsToSend || []);
            setReceivedParts(received);
            await loadExistingSpareparts(received);
            setShowReceivedList(true);
            alert('Submit SPG berhasil. Received list ditampilkan.');
        } catch (err) {
            console.error(err);
            const errorResponse = err?.response;
            if (isDuplicateInvoiceResponse(errorResponse)) {
                alert(`Nomor invoice ${payload.documentNumber} sudah pernah disubmit.`);
            } else {
                alert('Gagal submit SPG: ' + (err?.response?.data?.message || err.message || 'Unknown'));
            }
            setSubmitResult(errorResponse?.data || null);
        } finally {
            setSubmitLoading(false);
        }
    };

    return (
        <>
            <Head title="SPG" />

            <div className="space-y-6">
                <SDMSSessionStatus sdms={sdms} />

                {!isAuthenticated && (
                    <div className="rounded-3xl border border-cyan-200 bg-gradient-to-r from-cyan-50 via-white to-blue-50 p-5 shadow-sm dark:border-cyan-900/40 dark:from-cyan-950/30 dark:via-slate-950 dark:to-blue-950/30">
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <div className="space-y-1">
                                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-700 dark:text-cyan-300">SDMS Session Required</p>
                                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Login SDMS untuk memuat detail SPG</h2>
                                <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">Buka popup login untuk menyimpan sesi tanpa berpindah halaman.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowLoginModal(true)}
                                className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-600/20 transition hover:from-cyan-500 hover:to-blue-500"
                            >
                                Login SDMS
                            </button>
                        </div>
                    </div>
                )}

                <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-emerald-50 p-6 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900/70">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                        <div className="max-w-2xl space-y-2">
                            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M3 17h13V6H3v11Z" />
                                    <path d="M16 10h3l2 3v4h-5v-7Z" />
                                    <circle cx="7" cy="18" r="2" />
                                    <circle cx="18" cy="18" r="2" />
                                </svg>
                                SPG
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
                                <button
                                    type="button"
                                    onClick={() => setShowTechnicalDetails((current) => !current)}
                                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                                >
                                    {showTechnicalDetails ? 'Sembunyikan Detail Teknis' : 'Tampilkan Detail Teknis'}
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
                                            {receivedParts.filter((part) => isPartCovered(part)).length}/{receivedParts.length}
                                        </div>
                                        <div className="text-[10px] text-slate-500">Covered</div>
                                    </div>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-950">
                                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Billing Number</div>
                                        <div className="mt-1 break-all font-semibold text-slate-900 dark:text-white">
                                            {purchaseReference.billingNumber || extractShipmentLabel(detail, ['billingnumber', 'billingNumber', 'billing_number']) || '-'}
                                        </div>
                                    </div>
                                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-950">
                                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">PS Number</div>
                                        <div className="mt-1 break-all font-semibold text-slate-900 dark:text-white">
                                            {purchaseReference.psNumber || extractShipmentLabel(detail, ['psnumber', 'psNumber', 'ps_number']) || '-'}
                                        </div>
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
                                                    const normalizedPartNumber = normalizePartNumber(partNum);
                                                    const isAdded = Boolean(addedParts[normalizedPartNumber] || existingParts[normalizedPartNumber]);

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
                                                                        Sudah Ada
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

                        {createdPurchase && (
                            <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Purchase Order Created</p>
                                <div className="mt-2 text-sm text-slate-900 dark:text-slate-200">
                                    <div><strong>Number:</strong> {createdPurchase.purchase_number || createdPurchase.purchase_number}</div>
                                    <div className="mt-1"><strong>Notes:</strong> {createdPurchase.notes || '-'}</div>
                                </div>
                                {createdPurchase.id && (
                                    <Link
                                        href={route('part-purchases.show', createdPurchase.id)}
                                        className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
                                    >
                                        Lihat Detail Pembelian
                                    </Link>
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


                        {showTechnicalDetails ? (
                            <>
                                <details className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                                    <summary className="cursor-pointer text-sm font-semibold text-slate-700 dark:text-slate-200">Raw JSON Item</summary>
                                    <pre className="mt-3 overflow-auto text-xs leading-6 text-slate-700 dark:text-slate-300">{JSON.stringify(items, null, 2)}</pre>
                                </details>

                                <details className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                                    <summary className="cursor-pointer text-sm font-semibold text-slate-700 dark:text-slate-200">State Draft</summary>
                                    <pre className="mt-3 overflow-auto text-xs leading-6 text-slate-700 dark:text-slate-300">{JSON.stringify({ suratJalan, draftRows }, null, 2)}</pre>
                                </details>

                                {(compareResult || compareError) && (
                                    <details className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                                        <summary className="cursor-pointer text-sm font-semibold text-slate-700 dark:text-slate-200">Raw JSON Hasil Bandingkan</summary>
                                        <pre className="mt-3 overflow-auto text-xs leading-6 text-slate-700 dark:text-slate-300">
                                            {JSON.stringify(compareResult || (compareError?.response?.data || { message: compareError?.message }), null, 2)}
                                        </pre>
                                    </details>
                                )}
                            </>
                        ) : (
                            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-400">
                                Detail teknis disembunyikan. Aktifkan tombol detail teknis bila perlu melihat raw JSON, state draft, atau hasil banding mentah.
                            </div>
                        )}
                    </CardBody>
                </Card>
            </div>

            <SDMSAuthModal show={showLoginModal} onClose={() => setShowLoginModal(false)} sdms={sdms} />
        </>
    );
}
