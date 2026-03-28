import React, { useState, useEffect, useMemo } from 'react';
import { Head, useForm, Link, router } from '@inertiajs/react';
import DashboardLayout from '@/Layouts/DashboardLayout';
import Autocomplete from '@/Components/Dashboard/Autocomplete';
import QuickCreateVehicleModal from '@/Components/Dashboard/QuickCreateVehicleModal';
import QuickCreateServiceModal from '@/Components/Dashboard/QuickCreateServiceModal';
import QuickCreatePartModal from '@/Components/Dashboard/QuickCreatePartModal';
import { IconArrowLeft, IconDeviceFloppy, IconInfoCircle, IconTrash, IconPlus, IconX } from '@tabler/icons-react';
import { toInputValue, extractDateFromISO } from '@/Utils/datetime';
import toast from 'react-hot-toast';

// Use centralized helper to avoid timezone shifts

const formatCurrency = (value) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
};

export default function Edit({ order, customers, mechanics, services, parts, vehicles, tags, availableVouchers = [] }) {
    const { data, setData, put, processing, errors } = useForm({
        customer_id: order.customer_id || '',
        vehicle_id: order.vehicle_id || '',
        mechanic_id: order.mechanic_id || '',
        status: order.status || 'pending',
        odometer_km: order.odometer_km || '',
        estimated_start_at: toInputValue(order.estimated_start_at) || '',
        estimated_finish_at: toInputValue(order.estimated_finish_at) || '',
        notes: order.notes || '',
        voucher_code: order.voucher_code || '',
        maintenance_type: order.maintenance_type || '',
        next_service_km: order.next_service_km || '',
        next_service_date: extractDateFromISO(order.next_service_date) || '',
        tags: order.tags?.map(t => t.id) || [],
        items: order.details.map(detail => ({
            id: detail.id,
            service_id: detail.service_id || '',
            service_discount_type: detail.discount_type || 'none',
            service_discount_value: detail.discount_value || 0,
            parts: detail.part_id ? [{ part_id: detail.part_id, qty: detail.qty, price: detail.price, discount_type: 'none', discount_value: 0 }] : [],
        })),
        discount_type: order.discount_type || 'none',
        discount_value: order.discount_value || 0,
        tax_type: order.tax_type || 'none',
        tax_value: order.tax_value || 0,
    });

    const [selectedCustomer, setSelectedCustomer] = useState(order.customer_id);
    const [customerVehicles, setCustomerVehicles] = useState(order.customer?.vehicles || []);
    const [showVehicleModal, setShowVehicleModal] = useState(false);
    const [vehicleSearchTerm, setVehicleSearchTerm] = useState('');
    const [showServiceModal, setShowServiceModal] = useState(false);
    const [serviceSearchTerm, setServiceSearchTerm] = useState('');
    const [currentItemIndex, setCurrentItemIndex] = useState(null);
    const [showPartModal, setShowPartModal] = useState(false);
    const [partSearchTerm, setPartSearchTerm] = useState('');
    const [currentPartIndex, setCurrentPartIndex] = useState(null);
    const [partDraftByItem, setPartDraftByItem] = useState({});
    const [insights, setInsights] = useState({ last_km: {}, vehicle_km: null, last_order_km: null });
    const [vehicleHistory, setVehicleHistory] = useState({ recent_orders: [] });
    const [vehicleRecommendations, setVehicleRecommendations] = useState({ recommended_parts: [], recommended_services: [] });

    const prevKm = useMemo(() => {
        const vals = [insights.vehicle_km, insights.last_order_km].filter((v) => v !== null && v !== undefined);
        return vals.length ? Math.max(...vals) : null;
    }, [insights]);

    const recommendations = useMemo(() => {
        const km = parseInt(data.odometer_km || 0);
        if (Number.isNaN(km) || km < 0) return { due: [], upcoming: [] };
        const categories = [
            { key: 'oil', title: 'Ganti Oli Mesin', interval: 2500 },
            { key: 'air', title: 'Bersihkan/Ganti Filter Udara', interval: 5000 },
            { key: 'spark', title: 'Periksa/Ganti Busi', interval: 8000 },
            { key: 'brakepad', title: 'Cek Kampas Rem', interval: 5000 },
            { key: 'belt', title: 'Cek/Ganti Belt (CVT/Drive)', interval: 20000 },
        ];
        const all = categories.map((c) => {
            const lastRaw = insights.last_km?.[c.key];
            const last = (lastRaw === null || lastRaw === undefined) ? 0 : lastRaw;
            const since = Math.max(km - last, 0);
            const dueIn = Math.max(c.interval - since, 0);
            const isDue = since >= c.interval;
            return { ...c, last: lastRaw ?? null, since, dueIn, isDue };
        });
        const due = all.filter((c) => c.isDue).sort((a, b) => a.dueIn - b.dueIn);
        const upcoming = all.filter((c) => !c.isDue).sort((a, b) => a.dueIn - b.dueIn);
        return { due, upcoming };
    }, [data.odometer_km, insights]);

    useEffect(() => {
        if (!data.vehicle_id) {
            setInsights({ last_km: {}, vehicle_km: null, last_order_km: null });
            setVehicleHistory({ recent_orders: [] });
            setVehicleRecommendations({ recommended_parts: [], recommended_services: [] });
            return;
        }
        // Fetch insights, history, and recommendations
        Promise.all([
            fetch(route('vehicles.maintenance.insights', data.vehicle_id), {
                headers: { 'Accept': 'application/json' },
            }).then((r) => r.json()),
            fetch(route('vehicles.with-history', data.vehicle_id), {
                headers: { 'Accept': 'application/json' },
            }).then((r) => r.json()),
            fetch(route('vehicles.recommendations', data.vehicle_id), {
                headers: { 'Accept': 'application/json' },
            }).then((r) => r.json()),
        ])
            .then(([insightsData, historyData, recommendationsData]) => {
                setInsights(insightsData);
                setVehicleHistory(historyData);
                setVehicleRecommendations(recommendationsData);
            })
            .catch(() => {
                setInsights({ last_km: {}, vehicle_km: null, last_order_km: null });
                setVehicleHistory({ recent_orders: [] });
                setVehicleRecommendations({ recommended_parts: [], recommended_services: [] });
            });
    }, [data.vehicle_id]);

    // Handle customer change - update available vehicles
    const handleCustomerChange = (customerId) => {
        setData('customer_id', customerId);
        setSelectedCustomer(customerId);

        if (!customerId) {
            setCustomerVehicles([]);
            setData('vehicle_id', '');
            return;
        }

        const customer = customers.find(c => c.id === parseInt(customerId));
        if (customer && customer.vehicles) {
            setCustomerVehicles(customer.vehicles);
        } else {
            setCustomerVehicles([]);
        }
    };

    const handleVehicleChange = (vehicleId) => {
        setData('vehicle_id', vehicleId);

        if (!vehicleId) return;

        // Auto-fill customer dari vehicle jika belum dipilih
        const vehicle = vehicles.find(v => v.id === parseInt(vehicleId));
        if (vehicle && vehicle.customer_id && !data.customer_id) {
            setData('customer_id', vehicle.customer_id);
            setSelectedCustomer(vehicle.customer_id);
            handleCustomerChange(vehicle.customer_id);
            toast.success('Pelanggan otomatis dipilih dari data kendaraan');
        }
    };

    const handleVehicleCreated = (newVehicle) => {
        router.reload({
            only: ['vehicles'],
            onSuccess: () => {
                setData('vehicle_id', newVehicle.id);
                toast.success('Kendaraan berhasil ditambahkan');
            }
        });
    };

    const handleServiceCreated = (newService) => {
        router.reload({
            only: ['services'],
            onSuccess: () => {
                if (currentItemIndex !== null) {
                    handleServiceChange(currentItemIndex, newService.id);
                }
                toast.success('Layanan berhasil ditambahkan');
                setCurrentItemIndex(null);
            }
        });
    };

    const handlePartCreated = (newPart) => {
        router.reload({
            only: ['parts'],
            onSuccess: () => {
                if (currentItemIndex !== null && currentPartIndex === 'draft') {
                    setPartDraftByItem((prev) => ({
                        ...prev,
                        [currentItemIndex]: {
                            ...(prev[currentItemIndex] || { qty: 1, price: 0, discount_type: 'percent', discount_value: 0 }),
                            part_id: newPart.id,
                            price: newPart.sell_price || 0
                        }
                    }));
                } else if (currentItemIndex !== null && currentPartIndex !== null) {
                    handlePartChange(currentItemIndex, currentPartIndex, 'part_id', newPart.id);
                }
                toast.success('Sparepart berhasil ditambahkan');
                setCurrentItemIndex(null);
                setCurrentPartIndex(null);
            }
        });
    };

    const handleAddItem = () => {
        setData('items', [
            ...data.items,
            { id: null, service_id: '', service_discount_type: 'none', service_discount_value: 0, parts: [] }
        ]);
    };

    const handleRemoveItem = (index) => {
        if (data.items.length === 1) {
            toast.error('Minimal harus ada 1 item!');
            return;
        }
        setData('items', data.items.filter((_, i) => i !== index));
    };

    const handleServiceChange = (index, serviceId) => {
        const newItems = [...data.items];
        newItems[index].service_id = serviceId;
        setData('items', newItems);
    };

    const handleAddPart = (index) => {
        const newItems = [...data.items];
        newItems[index].parts.push({ part_id: '', qty: 1, price: 0, discount_type: 'none', discount_value: 0 });
        setData('items', newItems);
    };

    const getPartDraft = (itemIndex) => (
        partDraftByItem[itemIndex] || { part_id: '', qty: 1, price: 0, discount_type: 'percent', discount_value: 0 }
    );

    const updatePartDraft = (itemIndex, patch) => {
        setPartDraftByItem((prev) => ({
            ...prev,
            [itemIndex]: {
                ...getPartDraft(itemIndex),
                ...patch,
            },
        }));
    };

    const handleDraftPartSelect = (itemIndex, partId) => {
        const selectedPart = parts.find((p) => p.id === parseInt(partId));
        if (!selectedPart) return;

        updatePartDraft(itemIndex, {
            part_id: partId,
            price: selectedPart.sell_price || 0,
        });

        setTimeout(() => {
            const qtyInput = document.querySelector(`[data-draft-item-index="${itemIndex}"][data-draft-field="qty"]`);
            if (qtyInput) qtyInput.focus();
        }, 0);
    };

    const handleAddPartFromDraft = (itemIndex) => {
        const draft = getPartDraft(itemIndex);
        if (!draft.part_id) {
            toast.error('Pilih sparepart terlebih dahulu');
            return;
        }

        if ((Number(draft.qty) || 0) < 1) {
            toast.error('Qty minimal 1');
            return;
        }

        const exists = data.items[itemIndex].parts.some((p) => parseInt(p.part_id) === parseInt(draft.part_id));
        if (exists) {
            toast.error('Sparepart sudah ditambahkan');
            return;
        }

        const selectedPart = parts.find((p) => p.id === parseInt(draft.part_id));
        const newItems = [...data.items];
        newItems[itemIndex].parts.push({
            part_id: draft.part_id,
            qty: Number(draft.qty) || 1,
            price: Number(draft.price) || selectedPart?.sell_price || 0,
            discount_type: draft.discount_type || 'percent',
            discount_value: Number(draft.discount_value) || 0,
        });
        setData('items', newItems);

        setPartDraftByItem((prev) => ({
            ...prev,
            [itemIndex]: { part_id: '', qty: 1, price: 0, discount_type: 'percent', discount_value: 0 },
        }));

        setTimeout(() => {
            const qtyInput = document.querySelector(`[data-draft-item-index="${itemIndex}"][data-draft-field="qty"]`);
            if (qtyInput) qtyInput.focus();
        }, 0);
    };

    const handleDraftInputEnter = (e, itemIndex, field) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();

        const focusDraft = (nextField) => {
            const el = document.querySelector(`[data-draft-item-index="${itemIndex}"][data-draft-field="${nextField}"]`);
            if (el) el.focus();
        };

        if (field === 'qty') {
            focusDraft('price');
            return;
        }

        if (field === 'price') {
            focusDraft('discount_value');
            return;
        }

        if (field === 'discount_value') {
            const draft = getPartDraft(itemIndex);
            if (draft.part_id) {
                handleAddPartFromDraft(itemIndex);
            }
        }
    };

    const handleRemovePart = (itemIndex, partIndex) => {
        const newItems = [...data.items];
        newItems[itemIndex].parts = newItems[itemIndex].parts.filter((_, i) => i !== partIndex);
        setData('items', newItems);
    };

    const handlePartChange = (itemIndex, partIndex, field, value) => {
        const newItems = [...data.items];
        newItems[itemIndex].parts[partIndex][field] = value;

        // Auto-fill price from part
        if (field === 'part_id' && value) {
            const part = parts.find(p => p.id === parseInt(value));
            if (part) newItems[itemIndex].parts[partIndex].price = part.sell_price || 0;
        }

        setData('items', newItems);
    };

    const focusPartField = (itemIndex, partIndex, field) => {
        setTimeout(() => {
            const el = document.querySelector(`[data-item-index="${itemIndex}"][data-part-index="${partIndex}"][data-part-field="${field}"]`);
            if (el) el.focus();
        }, 0);
    };

    const handlePartInputEnter = (e, itemIndex, partIndex, field) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();

        if (field === 'qty') {
            focusPartField(itemIndex, partIndex, 'price');
            return;
        }

        if (field === 'price') {
            focusPartField(itemIndex, partIndex, 'discount_value');
            return;
        }

        if (field === 'discount_value') {
            const partsLength = data.items[itemIndex]?.parts?.length || 0;
            const nextPartIndex = partIndex + 1;

            if (nextPartIndex < partsLength) {
                focusPartField(itemIndex, nextPartIndex, 'qty');
                return;
            }

            const draftQty = document.querySelector(`[data-draft-item-index="${itemIndex}"][data-draft-field="qty"]`);
            if (draftQty) draftQty.focus();
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        // Validate items - minimal harus ada service atau part
        const validItems = data.items.filter(item => item.service_id || item.parts.length > 0);
        if (validItems.length === 0) {
            toast.error('Tambahkan minimal 1 layanan atau sparepart!');
            return;
        }

        // If status completed/paid, odometer required
        if ((data.status === 'completed' || data.status === 'paid') && (data.odometer_km === '' || data.odometer_km === null)) {
            toast.error('Odometer (Km) wajib diisi saat status Selesai/Dibayar.');
            return;
        }

        // If provided, cannot be less than previous known km
        if (data.odometer_km !== '' && data.odometer_km !== null && prevKm !== null && parseInt(data.odometer_km) < prevKm) {
            toast.error(`Odometer tidak boleh kurang dari KM sebelumnya (${prevKm.toLocaleString('id-ID')} km).`);
            return;
        }

        put(route('service-orders.update', order.id), {
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Service Order berhasil diperbarui!');
            },
            onError: () => {
                toast.error('Gagal memperbarui service order!');
            },
        });
    };

    const calculateItemTotal = (item) => {
        let total = 0;

        if (item.service_id) {
            const service = services.find((s) => s.id === parseInt(item.service_id));
            const base = service ? Number(service.price) || 0 : 0;
            const discount = calcDiscount(base, item.service_discount_type, item.service_discount_value);
            total += Math.max(0, base - discount);
        }

        item.parts.forEach((part) => {
            const base = (Number(part.price) || 0) * (Number(part.qty) || 0);
            const discount = calcDiscount(base, part.discount_type, part.discount_value);
            total += Math.max(0, base - discount);
        });

        return total;
    };

    const calcDiscount = (amount, type = 'none', value = 0) => {
        const numericValue = Number(value) || 0;
        if (type === 'percent') return amount * (numericValue / 100);
        if (type === 'fixed') return numericValue;
        return 0;
    };

    const itemsSubtotal = data.items.reduce((sum, item) => sum + calculateItemTotal(item), 0);

    const transactionDiscount = (() => {
        const discountValue = Number(data.discount_value) || 0;
        if (data.discount_type === 'percent') {
            return itemsSubtotal * (discountValue / 100);
        } else if (data.discount_type === 'fixed') {
            return discountValue;
        }
        return 0;
    })();

    const afterDiscount = Math.max(0, itemsSubtotal - transactionDiscount);

    const taxAmount = (() => {
        const taxValue = Number(data.tax_value) || 0;
        if (data.tax_type === 'percent') {
            return afterDiscount * (taxValue / 100);
        } else if (data.tax_type === 'fixed') {
            return taxValue;
        }
        return 0;
    })();

    const grandTotal = afterDiscount + taxAmount;

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
        }).format(value);
    };

    return (
        <>
            <Head title="Edit Service Order" />

            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                            Edit Service Order
                        </h1>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            Order #{order.order_number}
                        </p>
                    </div>
                    <Link
                        href={route('service-orders.index')}
                        className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 transition hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700 dark:hover:bg-gray-700"
                    >
                        <IconArrowLeft size={18} />
                        Kembali
                    </Link>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Customer & Vehicle Info */}
                    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
                            Informasi Pelanggan & Kendaraan
                        </h2>
                        <div className="grid gap-6 md:grid-cols-2">
                            <div>
                                <Autocomplete
                                    label="Pelanggan"
                                    value={data.customer_id}
                                    onChange={handleCustomerChange}
                                    options={customers}
                                    displayField={(customer) => `${customer.name} - ${customer.phone}`}
                                    searchFields={['name', 'phone', 'email']}
                                    placeholder="Cari pelanggan..."
                                    errors={errors.customer_id}
                                />
                            </div>

                            <div>
                                <Autocomplete
                                    label="Kendaraan"
                                    value={data.vehicle_id}
                                    onChange={handleVehicleChange}
                                    options={data.customer_id && customerVehicles.length > 0 ? customerVehicles : vehicles}
                                    displayField={(vehicle) => `${vehicle.brand} ${vehicle.model} - ${vehicle.plate_number}`}
                                    searchFields={['plate_number', 'brand', 'model']}
                                    placeholder="Cari kendaraan..."
                                    onCreateNew={(searchTerm) => {
                                        setVehicleSearchTerm(searchTerm);
                                        setShowVehicleModal(true);
                                    }}
                                    createLabel="Tambah Kendaraan"
                                    errors={errors.vehicle_id}
                                />
                            </div>

                            <div>
                                <Autocomplete
                                    label="Mekanik"
                                    value={data.mechanic_id}
                                    onChange={(value) => setData('mechanic_id', value)}
                                    options={mechanics}
                                    displayField={(mechanic) => `${mechanic.name} - ${mechanic.specialty}`}
                                    searchFields={['name', 'specialty']}
                                    placeholder="Cari mekanik..."
                                    errors={errors.mechanic_id}
                                />
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Odometer (Km saat Service)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={data.odometer_km}
                                    onChange={(e) => setData('odometer_km', e.target.value)}
                                    placeholder="contoh: 12500"
                                    className="block w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-gray-900 shadow-sm transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                                />
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{prevKm !== null ? `KM sebelumnya: ${prevKm.toLocaleString('id-ID')} km.` : 'Wajib diisi jika status Selesai atau Sudah Dibayar.'}</p>
                                {errors.odometer_km && (
                                    <p className="mt-1 text-sm text-red-600">{errors.odometer_km}</p>
                                )}
                            </div>
                            <div className="rounded-lg border border-dashed border-gray-300 p-4 dark:border-gray-700">
                                <p className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-200">Rekomendasi Berdasarkan Km</p>
                                {data.odometer_km ? (
                                    recommendations.due.length > 0 ? (
                                        <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                                            {recommendations.due.map((r) => (
                                                <li key={r.key} className="flex items-center justify-between">
                                                    <span>{r.title}</span>
                                                    <span className="text-xs text-gray-500 dark:text-gray-400">{r.dueIn === 0 ? 'Jatuh tempo' : `± ${r.dueIn.toLocaleString('id-ID')} km lagi`}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                                            <p className="text-xs text-gray-500 dark:text-gray-400">Belum ada yang jatuh tempo. Jadwal berikutnya:</p>
                                            <ul className="space-y-2">
                                                {recommendations.upcoming.slice(0, 5).map((r) => (
                                                    <li key={r.key} className="flex items-center justify-between">
                                                        <span>{r.title}</span>
                                                        <span className="text-xs text-gray-500 dark:text-gray-400">± {r.dueIn.toLocaleString('id-ID')} km lagi</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )
                                ) : (
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Masukkan odometer untuk melihat rekomendasi.</p>
                                )}
                            </div>

                            {/* Vehicle History Panel */}
                            {data.vehicle_id && vehicleHistory.recent_orders && vehicleHistory.recent_orders.length > 0 && (
                                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-900/30">
                                    <p className="mb-3 text-sm font-semibold text-blue-900 dark:text-blue-200">Riwayat Layanan Terkini</p>
                                    <div className="space-y-3">
                                        {vehicleHistory.recent_orders.slice(0, 5).map((order) => (
                                            <div key={order.id} className="flex items-center justify-between border-t border-blue-200 pt-3 first:border-t-0 first:pt-0 dark:border-blue-800">
                                                <div className="space-y-1">
                                                    <p className="text-xs font-medium text-blue-900 dark:text-blue-100">
                                                        #{order.order_number}
                                                    </p>
                                                    <p className="text-xs text-blue-700 dark:text-blue-300">
                                                        {new Date(order.created_at).toLocaleDateString('id-ID')}
                                                        {order.odometer_km && ` • ${order.odometer_km.toLocaleString('id-ID')} km`}
                                                    </p>
                                                    {order.mechanic && (
                                                        <p className="text-xs text-blue-600 dark:text-blue-400">
                                                            Mekanik: {order.mechanic.name}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="text-right space-y-1">
                                                    <span className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${
                                                        order.status === 'paid' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                                        order.status === 'completed' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                                                        order.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                                        'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                                                    }`}>
                                                        {order.status === 'paid' ? 'Dibayar' :
                                                         order.status === 'completed' ? 'Selesai' :
                                                         order.status === 'in_progress' ? 'Diproses' :
                                                         'Menunggu'}
                                                    </span>
                                                    {order.total_cost && (
                                                        <p className="text-xs font-semibold text-blue-900 dark:text-blue-100">
                                                            {formatCurrency(order.total_cost)}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Status
                                </label>
                                <select
                                    value={data.status}
                                    onChange={(e) => setData('status', e.target.value)}
                                    className="block w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-gray-900 shadow-sm transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                                >
                                    <option value="pending">Menunggu / Mengantri</option>
                                    <option value="in_progress">Sedang Dikerjakan</option>
                                    <option value="completed">Selesai Dikerjakan</option>
                                    <option value="paid">Sudah Dibayar</option>
                                    <option value="cancelled">Dibatalkan</option>
                                </select>
                                {errors.status && (
                                    <p className="mt-1 text-sm text-red-600">{errors.status}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Estimated Schedule */}
                    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
                            Estimasi Waktu
                        </h2>
                        <div className="grid gap-6 md:grid-cols-2">
                            <div>
                                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Estimasi Mulai
                                </label>
                                <input
                                    type="datetime-local"
                                    value={data.estimated_start_at}
                                    onChange={(e) => setData('estimated_start_at', e.target.value)}
                                    className="block w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-gray-900 shadow-sm transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                                />
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Estimasi Selesai
                                </label>
                                <input
                                    type="datetime-local"
                                    value={data.estimated_finish_at}
                                    onChange={(e) => setData('estimated_finish_at', e.target.value)}
                                    className="block w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-gray-900 shadow-sm transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Service Items - New Structure */}
                    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                Layanan & Sparepart
                            </h2>
                            <button
                                type="button"
                                onClick={handleAddItem}
                                className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-600"
                            >
                                <IconPlus size={16} />
                                Tambah Item
                            </button>
                        </div>

                        <div className="space-y-6">
                            {data.items.map((item, itemIndex) => (
                                <div
                                    key={itemIndex}
                                    className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4 dark:border-gray-700 dark:bg-gray-800/50"
                                >
                                    {/* Service Row */}
                                    <div className="mb-4 grid gap-3 lg:grid-cols-12">
                                        <div className="lg:col-span-11">
                                            <label className="mb-2 block text-xs font-medium text-gray-700 dark:text-gray-300">
                                                Layanan Service (Opsional)
                                            </label>
                                            <Autocomplete
                                                value={item.service_id}
                                                onChange={(serviceId) => handleServiceChange(itemIndex, serviceId)}
                                                options={services}
                                                displayField={(service) => `${service.title} - ${formatCurrency(service.price)}`}
                                                searchFields={['title', 'description']}
                                                placeholder="Cari layanan..."
                                                onCreateNew={(searchTerm) => {
                                                    setServiceSearchTerm(searchTerm);
                                                    setCurrentItemIndex(itemIndex);
                                                    setShowServiceModal(true);
                                                }}
                                                createLabel="Tambah Layanan"
                                            />
                                        </div>
                                        <div className="flex items-end lg:col-span-1">
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveItem(itemIndex)}
                                                className="h-10 w-full rounded-lg bg-red-100 p-2 text-red-700 transition hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
                                                title="Hapus item beserta semua sparepart"
                                            >
                                                <IconTrash size={18} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Service Price Display */}
                                    {item.service_id && (
                                        <div className="mb-4 space-y-3 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-600 dark:bg-gray-700">
                                            <p className="text-sm text-gray-600 dark:text-gray-300">
                                                Biaya Jasa: <span className="font-semibold tabular-nums text-gray-900 dark:text-white">
                                                    {formatCurrency(services.find(s => s.id === parseInt(item.service_id))?.price || 0)}
                                                </span>
                                            </p>
                                            <div className="grid gap-3 md:grid-cols-12">
                                                <div className="md:col-span-4">
                                                    <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
                                                        Diskon Jasa
                                                    </label>
                                                    <select
                                                        value={item.service_discount_type}
                                                        onChange={(e) => {
                                                            const newItems = [...data.items];
                                                            newItems[itemIndex].service_discount_type = e.target.value;
                                                            setData('items', newItems);
                                                        }}
                                                        className="block w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-xs text-gray-900 transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                                                    >
                                                        <option value="none">Tidak Ada</option>
                                                        <option value="percent">Persen (%)</option>
                                                        <option value="fixed">Nilai Tetap</option>
                                                    </select>
                                                </div>
                                                {item.service_discount_type !== 'none' && (
                                                    <div className="md:col-span-4">
                                                        <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
                                                            {item.service_discount_type === 'percent' ? 'Nilai Diskon (%)' : 'Nilai Diskon (Rp)'}
                                                        </label>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={item.service_discount_value}
                                                            onChange={(e) => {
                                                                const newItems = [...data.items];
                                                                newItems[itemIndex].service_discount_value = e.target.value;
                                                                setData('items', newItems);
                                                            }}
                                                            className="block w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-xs text-gray-900 transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Parts Section */}
                                    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-700">
                                        <div className="mb-3 flex items-center justify-between">
                                            <label className="text-xs font-semibold uppercase text-gray-600 dark:text-gray-400">
                                                Sparepart untuk Layanan Ini
                                            </label>
                                        </div>

                                        <div className="mb-3 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-800/40">
                                            <div className="grid items-end gap-2.5 lg:grid-cols-12">
                                                <div className="lg:col-span-5">
                                                    <label className="mb-1 block text-[11px] font-semibold text-gray-700 dark:text-gray-300">Pilih Sparepart</label>
                                                    <Autocomplete
                                                        value={getPartDraft(itemIndex).part_id}
                                                        onChange={(partId) => handleDraftPartSelect(itemIndex, partId)}
                                                        options={parts}
                                                        displayField={(p) => {
                                                            const code = p.part_number || 'Tanpa Kode';
                                                            return `${p.name} (${code}) — ${formatCurrency(p.sell_price)}`;
                                                        }}
                                                        searchFields={['name', 'part_number', 'barcode']}
                                                        placeholder="Cari sparepart..."
                                                        onCreateNew={(searchTerm) => {
                                                            setPartSearchTerm(searchTerm);
                                                            setCurrentItemIndex(itemIndex);
                                                            setCurrentPartIndex('draft');
                                                            setShowPartModal(true);
                                                        }}
                                                        createLabel="Tambah Sparepart"
                                                    />
                                                </div>

                                                <div className="lg:col-span-1">
                                                    <label className="mb-1 block text-[11px] font-semibold text-gray-700 dark:text-gray-300">Qty</label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={getPartDraft(itemIndex).qty}
                                                        onChange={(e) => updatePartDraft(itemIndex, { qty: parseInt(e.target.value) || 1 })}
                                                        onKeyDown={(e) => handleDraftInputEnter(e, itemIndex, 'qty')}
                                                        data-draft-item-index={itemIndex}
                                                        data-draft-field="qty"
                                                        className="block h-9 w-full rounded-lg border border-gray-300 bg-white px-2 text-center text-xs tabular-nums text-gray-900 transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                                                    />
                                                </div>

                                                <div className="lg:col-span-2">
                                                    <label className="mb-1 block text-[11px] font-semibold text-gray-700 dark:text-gray-300">Harga</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={getPartDraft(itemIndex).price}
                                                        onChange={(e) => updatePartDraft(itemIndex, { price: parseFloat(e.target.value) || 0 })}
                                                        onKeyDown={(e) => handleDraftInputEnter(e, itemIndex, 'price')}
                                                        data-draft-item-index={itemIndex}
                                                        data-draft-field="price"
                                                        className="block h-9 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-right text-xs tabular-nums text-gray-900 transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                                                    />
                                                </div>

                                                <div className="lg:col-span-3">
                                                    <label className="mb-1 block text-[11px] font-semibold text-gray-700 dark:text-gray-300">Diskon</label>
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="inline-flex h-9 rounded-lg border-2 border-slate-300 dark:border-slate-700 overflow-hidden">
                                                            <button
                                                                type="button"
                                                                onClick={() => updatePartDraft(itemIndex, { discount_type: 'percent' })}
                                                                className={`px-2 text-[10px] font-bold transition-all ${(getPartDraft(itemIndex).discount_type || 'percent') === 'percent'
                                                                    ? 'bg-purple-600 text-white'
                                                                    : 'bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                                                                }`}
                                                            >
                                                                %
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => updatePartDraft(itemIndex, { discount_type: 'fixed' })}
                                                                className={`px-2 text-[10px] font-bold transition-all ${(getPartDraft(itemIndex).discount_type || 'percent') === 'fixed'
                                                                    ? 'bg-emerald-600 text-white'
                                                                    : 'bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                                                                }`}
                                                            >
                                                                Rp
                                                            </button>
                                                        </div>
                                                        <div className="relative flex-1">
                                                            {(getPartDraft(itemIndex).discount_type || 'percent') === 'fixed' && (
                                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500">Rp</span>
                                                            )}
                                                            {(getPartDraft(itemIndex).discount_type || 'percent') !== 'fixed' && (
                                                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500">%</span>
                                                            )}
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={getPartDraft(itemIndex).discount_value}
                                                                onChange={(e) => updatePartDraft(itemIndex, { discount_value: parseFloat(e.target.value) || 0 })}
                                                                onKeyDown={(e) => handleDraftInputEnter(e, itemIndex, 'discount_value')}
                                                                data-draft-item-index={itemIndex}
                                                                data-draft-field="discount_value"
                                                                className={`w-full h-9 rounded-lg border-2 border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-right ${(getPartDraft(itemIndex).discount_type || 'percent') === 'fixed' ? 'pl-6 pr-2' : 'px-2 pr-6'}`}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="lg:col-span-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleAddPartFromDraft(itemIndex)}
                                                        disabled={!getPartDraft(itemIndex).part_id}
                                                        className="inline-flex h-9 w-full items-center justify-center gap-1 rounded-lg bg-primary-600 px-2.5 text-xs font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
                                                    >
                                                        <IconPlus size={14} />
                                                        Tambah
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {item.parts.length > 0 ? (
                                            <>
                                                <div className="hidden lg:block overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-600 dark:bg-gray-700">
                                                    <table className="w-full table-fixed text-sm border-separate border-spacing-y-1.5 px-1">
                                                        <thead>
                                                            <tr className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                                                <th className="px-2.5 py-2 text-left font-semibold w-[32%]">Sparepart</th>
                                                                <th className="px-1.5 py-2 text-center font-semibold w-[9%]">Qty</th>
                                                                <th className="px-1.5 py-2 text-right font-semibold w-[16%]">Harga</th>
                                                                <th className="px-1.5 py-2 text-left font-semibold w-[25%]">Diskon</th>
                                                                <th className="px-1.5 py-2 text-right font-semibold w-[12%]">Total</th>
                                                                <th className="px-1.5 py-2 text-center font-semibold w-[6%]">Aksi</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {item.parts.map((part, partIndex) => {
                                                                const selectedPart = parts.find((p) => p.id === parseInt(part.part_id));
                                                                const stock = selectedPart?.stock ?? selectedPart?.qty ?? null;
                                                                const base = (Number(part.price) || 0) * (Number(part.qty) || 0);
                                                                const discount = calcDiscount(base, part.discount_type, part.discount_value);
                                                                const total = Math.max(0, base - discount);

                                                                return (
                                                                    <tr key={partIndex} className="bg-gray-50 align-middle shadow-sm ring-1 ring-gray-200/70 dark:bg-gray-800/40 dark:ring-gray-600/70">
                                                                        <td className="px-2.5 py-2 rounded-l-lg">
                                                                            <div className="flex items-center gap-1.5">
                                                                                <div className="flex h-9 items-center rounded-lg border border-gray-300 bg-gray-50 px-2.5 text-xs font-semibold text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 truncate" title={selectedPart?.name || `Part #${part.part_id}`}>
                                                                                    {selectedPart?.name || `Part #${part.part_id}`}
                                                                                </div>
                                                                                {stock !== null && (
                                                                                    <span
                                                                                        className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                                                                                        title={`Stok tersedia: ${stock}`}
                                                                                    >
                                                                                        <IconInfoCircle size={12} />
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-1.5 py-2">
                                                                            <input
                                                                                type="number"
                                                                                min="1"
                                                                                value={part.qty}
                                                                                onChange={(e) => handlePartChange(itemIndex, partIndex, 'qty', e.target.value)}
                                                                                onKeyDown={(e) => handlePartInputEnter(e, itemIndex, partIndex, 'qty')}
                                                                                data-item-index={itemIndex}
                                                                                data-part-index={partIndex}
                                                                                data-part-field="qty"
                                                                                className="block h-9 w-full rounded-lg border border-gray-300 bg-white px-2 text-center text-xs tabular-nums text-gray-900 transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                                                                            />
                                                                        </td>
                                                                        <td className="px-1.5 py-2">
                                                                            <input
                                                                                type="number"
                                                                                value={part.price}
                                                                                onChange={(e) => handlePartChange(itemIndex, partIndex, 'price', e.target.value)}
                                                                                onKeyDown={(e) => handlePartInputEnter(e, itemIndex, partIndex, 'price')}
                                                                                data-item-index={itemIndex}
                                                                                data-part-index={partIndex}
                                                                                data-part-field="price"
                                                                                className="block h-9 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-right text-xs tabular-nums text-gray-900 transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                                                                            />
                                                                        </td>
                                                                        <td className="px-1.5 py-2 align-middle">
                                                                            <div className="flex items-center gap-1.5">
                                                                                <div className="inline-flex h-9 rounded-lg border-2 border-slate-300 dark:border-slate-700 overflow-hidden">
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => handlePartChange(itemIndex, partIndex, 'discount_type', 'percent')}
                                                                                        className={`px-2 text-[10px] font-bold transition-all ${(part.discount_type || 'percent') === 'percent' ? 'bg-primary-600 text-white' : 'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}
                                                                                    >
                                                                                        %
                                                                                    </button>
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => handlePartChange(itemIndex, partIndex, 'discount_type', 'fixed')}
                                                                                        className={`px-2 text-[10px] font-bold transition-all ${(part.discount_type || 'percent') === 'fixed' ? 'bg-emerald-600 text-white' : 'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}
                                                                                    >
                                                                                        Rp
                                                                                    </button>
                                                                                </div>
                                                                                <input
                                                                                    type="number"
                                                                                    min="0"
                                                                                    value={part.discount_value || 0}
                                                                                    onChange={(e) => handlePartChange(itemIndex, partIndex, 'discount_value', e.target.value)}
                                                                                    onKeyDown={(e) => handlePartInputEnter(e, itemIndex, partIndex, 'discount_value')}
                                                                                    data-item-index={itemIndex}
                                                                                    data-part-index={partIndex}
                                                                                    data-part-field="discount_value"
                                                                                    className="w-full h-9 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-right px-2.5"
                                                                                />
                                                                            </div>
                                                                            <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-300">
                                                                                Subtotal: <span className="font-semibold tabular-nums">{formatCurrency(base)}</span>
                                                                                {discount > 0 && (
                                                                                    <span className="ml-2 text-red-600">Diskon: -<span className="tabular-nums">{formatCurrency(discount)}</span></span>
                                                                                )}
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-1.5 py-2 text-right align-middle">
                                                                            <div className="inline-flex h-9 min-w-[94px] items-center justify-end rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-xs font-bold tabular-nums text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300">
                                                                                {formatCurrency(total)}
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-1.5 py-2 text-center align-middle rounded-r-lg">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleRemovePart(itemIndex, partIndex)}
                                                                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-700 transition hover:bg-red-100 dark:border-red-900/50 dark:bg-red-900/10 dark:text-red-400 dark:hover:bg-red-900/20"
                                                                                title="Hapus sparepart"
                                                                            >
                                                                                <IconX size={13} />
                                                                            </button>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>

                                                <div className="space-y-3 lg:hidden">
                                                    {item.parts.map((part, partIndex) => {
                                                        const selectedPart = parts.find((p) => p.id === parseInt(part.part_id));
                                                        const stock = selectedPart?.stock ?? selectedPart?.qty ?? null;
                                                        const base = (Number(part.price) || 0) * (Number(part.qty) || 0);
                                                        const discount = calcDiscount(base, part.discount_type, part.discount_value);
                                                        const total = Math.max(0, base - discount);

                                                        return (
                                                            <div key={partIndex} className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-500/60 dark:bg-gray-600">
                                                                <div>
                                                                    <label className="mb-1 block text-[11px] font-semibold text-gray-700 dark:text-gray-300">Sparepart</label>
                                                                    <div className="flex items-center gap-1.5">
                                                                        <div className="flex h-9 items-center rounded-lg border border-gray-300 bg-white px-2.5 text-xs font-semibold text-gray-700 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200">
                                                                            {selectedPart?.name || `Part #${part.part_id}`}
                                                                        </div>
                                                                        {stock !== null && (
                                                                            <span
                                                                                className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                                                                                title={`Stok tersedia: ${stock}`}
                                                                            >
                                                                                <IconInfoCircle size={12} />
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                <div className="grid grid-cols-2 gap-2">
                                                                    <div>
                                                                        <label className="mb-1 block text-[11px] font-semibold text-gray-700 dark:text-gray-300">Qty</label>
                                                                        <input
                                                                            type="number"
                                                                            min="1"
                                                                            value={part.qty}
                                                                            onChange={(e) => handlePartChange(itemIndex, partIndex, 'qty', e.target.value)}
                                                                            onKeyDown={(e) => handlePartInputEnter(e, itemIndex, partIndex, 'qty')}
                                                                            data-item-index={itemIndex}
                                                                            data-part-index={partIndex}
                                                                            data-part-field="qty"
                                                                            className="block h-9 w-full rounded-lg border border-gray-300 bg-white px-2 text-center text-xs tabular-nums text-gray-900 transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="mb-1 block text-[11px] font-semibold text-gray-700 dark:text-gray-300">Harga</label>
                                                                        <input
                                                                            type="number"
                                                                            value={part.price}
                                                                            onChange={(e) => handlePartChange(itemIndex, partIndex, 'price', e.target.value)}
                                                                            onKeyDown={(e) => handlePartInputEnter(e, itemIndex, partIndex, 'price')}
                                                                            data-item-index={itemIndex}
                                                                            data-part-index={partIndex}
                                                                            data-part-field="price"
                                                                            className="block h-9 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-right text-xs tabular-nums text-gray-900 transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                                                                        />
                                                                    </div>
                                                                </div>

                                                                <div>
                                                                    <label className="mb-1 block text-[11px] font-semibold text-gray-700 dark:text-gray-300">Diskon</label>
                                                                    <div className="flex items-center gap-1.5">
                                                                        <div className="inline-flex h-9 rounded-lg border-2 border-slate-300 dark:border-slate-700 overflow-hidden">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handlePartChange(itemIndex, partIndex, 'discount_type', 'percent')}
                                                                                className={`px-2 text-[10px] font-bold transition-all ${(part.discount_type || 'percent') === 'percent' ? 'bg-primary-600 text-white' : 'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}
                                                                            >
                                                                                %
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handlePartChange(itemIndex, partIndex, 'discount_type', 'fixed')}
                                                                                className={`px-2 text-[10px] font-bold transition-all ${(part.discount_type || 'percent') === 'fixed' ? 'bg-emerald-600 text-white' : 'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}
                                                                            >
                                                                                Rp
                                                                            </button>
                                                                        </div>
                                                                        <input
                                                                            type="number"
                                                                            min="0"
                                                                            value={part.discount_value || 0}
                                                                            onChange={(e) => handlePartChange(itemIndex, partIndex, 'discount_value', e.target.value)}
                                                                            onKeyDown={(e) => handlePartInputEnter(e, itemIndex, partIndex, 'discount_value')}
                                                                            data-item-index={itemIndex}
                                                                            data-part-index={partIndex}
                                                                            data-part-field="discount_value"
                                                                            className="w-full h-9 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-right px-2.5"
                                                                        />
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-center justify-between gap-2 text-[11px] text-gray-500 dark:text-gray-300">
                                                                    <span />
                                                                    <span>Subtotal: <span className="font-semibold tabular-nums">{formatCurrency(base)}</span></span>
                                                                </div>

                                                                <div className="flex items-center justify-between">
                                                                    <div className="text-xs text-gray-600 dark:text-gray-300">
                                                                        {discount > 0 && (
                                                                            <span className="text-red-600">Diskon: -<span className="tabular-nums">{formatCurrency(discount)}</span></span>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-bold tabular-nums text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300">
                                                                            {formatCurrency(total)}
                                                                        </div>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleRemovePart(itemIndex, partIndex)}
                                                                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-700 transition hover:bg-red-100 dark:border-red-900/50 dark:bg-red-900/10 dark:text-red-400 dark:hover:bg-red-900/20"
                                                                            title="Hapus sparepart"
                                                                        >
                                                                            <IconX size={13} />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </>
                                        ) : (
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                Belum ada sparepart. Gunakan form input di atas untuk menambahkan.
                                            </p>
                                        )}
                                    </div>

                                    {/* Item Total */}
                                    {(item.service_id || item.parts.length > 0) && (
                                        <div className="mt-4 rounded-lg bg-primary-50 p-3 dark:bg-primary-900/30">
                                            <p className="text-sm font-semibold text-primary-900 dark:text-primary-200">
                                                Subtotal Item: {formatCurrency(calculateItemTotal(item))}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {errors.items && (
                            <p className="mt-2 text-sm text-red-600">{errors.items}</p>
                        )}
                    </div>

                    {/* Total & Summary with Discount/Tax */}
                    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 space-y-6">
                        {/* Transaction Summary with Discount/Tax */}
                        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 space-y-4">
                            <h3 className="font-semibold text-slate-900 dark:text-white">Ringkasan Transaksi</h3>

                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-600 dark:text-slate-400">Subtotal Items:</span>
                                    <span className="font-medium">{formatCurrency(itemsSubtotal)}</span>
                                </div>

                                {/* Transaction Discount */}
                                <div className="border-t border-slate-200 dark:border-slate-700 pt-2">
                                    <div className="grid grid-cols-12 gap-3 items-end mb-2">
                                        <div className="col-span-4">
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Diskon Transaksi</label>
                                            <select value={data.discount_type} onChange={(e) => setData('discount_type', e.target.value)} className="w-full h-11 rounded-xl border px-3 text-sm">
                                                <option value="none">Tidak Ada</option>
                                                <option value="percent">Persen (%)</option>
                                                <option value="fixed">Nilai Tetap</option>
                                            </select>
                                        </div>
                                        {data.discount_type !== 'none' && (
                                            <div className="col-span-4">
                                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                                    {data.discount_type === 'percent' ? 'Nilai Diskon (%)' : 'Nilai Diskon (Rp)'}
                                                </label>
                                                <input
                                                    type="number"
                                                    value={data.discount_value}
                                                    onChange={(e) => setData('discount_value', e.target.value)}
                                                    placeholder={data.discount_type === 'percent' ? '0-100' : '0'}
                                                    className="w-full h-11 px-3 rounded-xl border"
                                                />
                                            </div>
                                        )}
                                        <div className={`${data.discount_type !== 'none' ? 'col-span-4' : 'col-span-8'} text-right`}>
                                            {transactionDiscount > 0 && (
                                                <span className="text-sm text-red-600 font-medium">-{formatCurrency(transactionDiscount)}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-600 dark:text-slate-400">Setelah Diskon:</span>
                                    <span className="font-medium">{formatCurrency(afterDiscount)}</span>
                                </div>

                                <div className="border-t border-slate-200 dark:border-slate-700 pt-2">
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Kode Voucher</label>
                                    <input
                                        type="text"
                                        value={data.voucher_code || ''}
                                        onChange={(e) => setData('voucher_code', e.target.value.toUpperCase())}
                                        placeholder="Contoh: SERVICEHEMAT"
                                        list="service-order-edit-voucher-options"
                                        className="w-full h-11 px-3 rounded-xl border text-sm"
                                    />
                                    <datalist id="service-order-edit-voucher-options">
                                        {availableVouchers.map((voucher) => (
                                            <option key={voucher.id} value={voucher.code}>{voucher.name}</option>
                                        ))}
                                    </datalist>
                                    {errors.voucher_code && <p className="mt-1 text-xs text-red-600">{errors.voucher_code}</p>}
                                </div>

                                {/* Tax */}
                                <div className="border-t border-slate-200 dark:border-slate-700 pt-2">
                                    <div className="grid grid-cols-12 gap-3 items-end mb-2">
                                        <div className="col-span-4">
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Pajak</label>
                                            <select value={data.tax_type} onChange={(e) => setData('tax_type', e.target.value)} className="w-full h-11 rounded-xl border px-3 text-sm">
                                                <option value="none">Tidak Ada</option>
                                                <option value="percent">Persen (%)</option>
                                                <option value="fixed">Nilai Tetap</option>
                                            </select>
                                        </div>
                                        {data.tax_type !== 'none' && (
                                            <div className="col-span-4">
                                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                                    {data.tax_type === 'percent' ? 'Nilai Pajak (%)' : 'Nilai Pajak (Rp)'}
                                                </label>
                                                <input
                                                    type="number"
                                                    value={data.tax_value}
                                                    onChange={(e) => setData('tax_value', e.target.value)}
                                                    placeholder={data.tax_type === 'percent' ? '0-100' : '0'}
                                                    className="w-full h-11 px-3 rounded-xl border"
                                                />
                                            </div>
                                        )}
                                        <div className={`${data.tax_type !== 'none' ? 'col-span-4' : 'col-span-8'} text-right`}>
                                            {taxAmount > 0 && (
                                                <span className="text-sm text-green-600 font-medium">+{formatCurrency(taxAmount)}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-between text-base font-bold text-slate-900 dark:text-slate-100 pt-3 border-t border-slate-200 dark:border-slate-700">
                                    <span>Grand Total:</span>
                                    <span>{formatCurrency(grandTotal)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
                            Catatan
                        </h2>
                        <textarea
                            value={data.notes}
                            onChange={(e) => setData('notes', e.target.value)}
                            rows={4}
                            placeholder="Catatan tambahan untuk service order..."
                            className="block w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-gray-900 shadow-sm transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        />
                    </div>

                    {/* Tags & Maintenance Scheduling */}
                    <div className="grid gap-6 md:grid-cols-2">
                        {/* Tags */}
                        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                            <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
                                Tag Order
                            </h3>
                            <div className="space-y-2">
                                {tags && tags.map((tag) => (
                                    <label key={tag.id} className="flex items-center gap-3 cursor-pointer rounded-lg border border-gray-200 p-3 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
                                        <input
                                            type="checkbox"
                                            checked={data.tags.includes(tag.id)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setData('tags', [...data.tags, tag.id]);
                                                } else {
                                                    setData('tags', data.tags.filter(t => t !== tag.id));
                                                }
                                            }}
                                            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-${tag.color}-100 text-${tag.color}-700 dark:bg-${tag.color}-900/30 dark:text-${tag.color}-300`}>
                                            {tag.name}
                                        </span>
                                        {tag.description && (
                                            <span className="text-xs text-gray-500 dark:text-gray-400">{tag.description}</span>
                                        )}
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Maintenance Scheduling */}
                        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                            <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
                                Jadwal Service Berikutnya
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Tipe Maintenance
                                    </label>
                                    <select
                                        value={data.maintenance_type}
                                        onChange={(e) => setData('maintenance_type', e.target.value)}
                                        className="block w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                                    >
                                        <option value="">Pilih tipe...</option>
                                        <option value="routine">Rutin</option>
                                        <option value="emergency">Darurat</option>
                                        <option value="warranty">Garansi</option>
                                        <option value="recall">Recall</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Service Berikutnya (Km)
                                    </label>
                                    <input
                                        type="number"
                                        value={data.next_service_km}
                                        onChange={(e) => setData('next_service_km', e.target.value)}
                                        placeholder="contoh: 15000"
                                        className="block w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                                    />
                                </div>
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Service Berikutnya (Tanggal)
                                    </label>
                                    <input
                                        type="date"
                                        value={data.next_service_date}
                                        onChange={(e) => setData('next_service_date', e.target.value)}
                                        className="block w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Recommendations Panel */}
                    {data.vehicle_id && vehicleRecommendations && vehicleRecommendations.recommended_parts && vehicleRecommendations.recommended_services && (vehicleRecommendations.recommended_parts.length > 0 || vehicleRecommendations.recommended_services.length > 0) && (
                        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6 dark:border-blue-900 dark:bg-blue-950/30">
                            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-blue-900 dark:text-blue-300">
                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Rekomendasi Berdasarkan Riwayat
                            </h3>
                            <div className="grid gap-4 md:grid-cols-2">
                                {vehicleRecommendations.recommended_services && vehicleRecommendations.recommended_services.length > 0 && (
                                    <div>
                                        <h4 className="mb-2 text-sm font-semibold text-blue-800 dark:text-blue-400">Layanan yang Sering Digunakan</h4>
                                        <ul className="space-y-2">
                                            {vehicleRecommendations.recommended_services.map((service) => (
                                                <li key={service.id} className="flex items-center justify-between text-sm text-blue-900 dark:text-blue-200">
                                                    <span>{service.name}</span>
                                                    <span className="text-xs text-blue-700 dark:text-blue-400">{formatCurrency(service.price)}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {vehicleRecommendations.recommended_parts && vehicleRecommendations.recommended_parts.length > 0 && (
                                    <div>
                                        <h4 className="mb-2 text-sm font-semibold text-blue-800 dark:text-blue-400">Sparepart yang Sering Diganti</h4>
                                        <ul className="space-y-2">
                                            {vehicleRecommendations.recommended_parts.map((part) => (
                                                <li key={part.id} className="flex items-center justify-between text-sm text-blue-900 dark:text-blue-200">
                                                    <span>{part.name}</span>
                                                    <span className="text-xs text-blue-700 dark:text-blue-400">{formatCurrency(part.price)}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Total & Actions */}
                    <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Total Biaya</p>
                            <p className="text-3xl font-bold text-gray-900 dark:text-white">
                                {formatCurrency(grandTotal)}
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <Link
                                href={route('service-orders.index')}
                                className="rounded-xl border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                            >
                                Batal
                            </Link>
                            <button
                                type="submit"
                                disabled={processing}
                                className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-primary-600 disabled:opacity-50"
                            >
                                <IconDeviceFloppy size={18} />
                                {processing ? 'Menyimpan...' : 'Simpan Perubahan'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>

            {/* Quick Create Vehicle Modal */}
            <QuickCreateVehicleModal
                isOpen={showVehicleModal}
                onClose={() => setShowVehicleModal(false)}
                initialPlateNumber={vehicleSearchTerm}
                initialCustomerId={data.customer_id}
                customers={customers}
                onSuccess={handleVehicleCreated}
            />

            {/* Quick Create Service Modal */}
            <QuickCreateServiceModal
                isOpen={showServiceModal}
                onClose={() => {
                    setShowServiceModal(false);
                    setCurrentItemIndex(null);
                }}
                initialTitle={serviceSearchTerm}
                onSuccess={handleServiceCreated}
            />

            {/* Quick Create Part Modal */}
            <QuickCreatePartModal
                isOpen={showPartModal}
                onClose={() => {
                    setShowPartModal(false);
                    setCurrentItemIndex(null);
                    setCurrentPartIndex(null);
                }}
                initialName={partSearchTerm}
                onSuccess={handlePartCreated}
            />
        </>
    );
}

Edit.layout = (page) => <DashboardLayout children={page} />;
