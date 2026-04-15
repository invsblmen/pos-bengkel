import React, { useEffect, useMemo, useState } from 'react';
import { Head, useForm, router } from '@inertiajs/react';
import ServiceOrderLayout from '@/Layouts/ServiceOrderLayout';
import ServiceGrid from '@/Components/ServiceOrder/ServiceGrid';
import DiscountModeToggle from '@/Components/ServiceOrder/DiscountModeToggle';
import VehicleSelect from '@/Components/ServiceOrder/VehicleSelect';
import CustomerSelect from '@/Components/ServiceOrder/CustomerSelect';
import OdometerCheckInModal from '@/Components/ServiceOrder/OdometerCheckInModal';
import Autocomplete from '@/Components/Dashboard/Autocomplete';
import QuickCreateVehicleModal from '@/Components/Dashboard/QuickCreateVehicleModal';
import QuickCreatePartModal from '@/Components/Dashboard/QuickCreatePartModal';
import VehicleHistoryModal from '@/Components/ServiceOrder/VehicleHistoryModal';
import { useRealtimeEvents } from '@/Hooks/useRealtimeEvents';
import {
    IconDeviceFloppy,
    IconTrash,
    IconPlus,
    IconShoppingCart,
    IconClipboardList,
    IconReceipt,
    IconEdit,
} from '@tabler/icons-react';
import toast from 'react-hot-toast';
import { nowLocalDateTime } from '@/Utils/datetime';

const generateSubmissionToken = () => {
    if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
        return window.crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const formatCurrency = (value) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
};

export default function Create({ customers, mechanics, services, parts, vehicles, tags, activeServiceOrders, availableVouchers = [] }) {
    const { data, setData, post, processing, errors } = useForm({
        submission_token: generateSubmissionToken(),
        customer_id: '',
        vehicle_id: '',
        mechanic_id: '',
        status: 'pending',
        odometer_km: '',
        estimated_start_at: nowLocalDateTime(),
        estimated_finish_at: nowLocalDateTime(),
        notes: '',
        voucher_code: '',
        maintenance_type: '',
        next_service_km: '',
        next_service_date: '',
        tags: [],
        items: [],
        discount_type: 'none',
        discount_value: 0,
        tax_type: 'none',
        tax_value: 0,
    });

    const [customerVehicles, setCustomerVehicles] = useState([]);
    const [liveCustomers, setLiveCustomers] = useState(customers || []);
    const [liveVehicles, setLiveVehicles] = useState(vehicles || []);
    const [showVehicleModal, setShowVehicleModal] = useState(false);
    const [vehicleSearchTerm, setVehicleSearchTerm] = useState('');
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [vehicleHistory, setVehicleHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    const [showPartModal, setShowPartModal] = useState(false);
    const [partSearchTerm, setPartSearchTerm] = useState('');
    const [currentPartIndex, setCurrentPartIndex] = useState(null);
    const [showCheckIn, setShowCheckIn] = useState(false);
    const [checkIn, setCheckIn] = useState({ odometer_km: '', notes: '' });
    const [insights, setInsights] = useState({ last_km: {}, vehicle_km: null, last_order_km: null });
    const [mobileView, setMobileView] = useState('services'); // 'services' | 'summary'
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Discount & Tax Modes
    const [discountMode, setDiscountMode] = useState('nominal'); // 'nominal' or 'percent'
    const [taxMode, setTaxMode] = useState('nominal'); // 'nominal' or 'percent'

    // Edit Mode
    const [editingItemIndex, setEditingItemIndex] = useState(null);

    useEffect(() => {
        setLiveCustomers(customers || []);
    }, [customers]);

    useEffect(() => {
        setLiveVehicles(vehicles || []);
    }, [vehicles]);

    useRealtimeEvents({
        enabled: true,
        domains: ['customers', 'vehicles'],
        onEvent: (payload) => {
            const domain = payload?.domain;
            const action = payload?.action || '';
            const incoming = payload?.data || {};

            if (domain === 'customers' && action === 'created' && incoming?.id) {
                setLiveCustomers((prev) => {
                    if (prev.some((customer) => Number(customer.id) === Number(incoming.id))) {
                        return prev;
                    }
                    return [...prev, { ...incoming, vehicles: incoming.vehicles || [] }];
                });
            }

            if (domain === 'vehicles' && action === 'created' && incoming?.id) {
                setLiveVehicles((prev) => {
                    if (prev.some((vehicle) => Number(vehicle.id) === Number(incoming.id))) {
                        return prev;
                    }
                    return [...prev, incoming];
                });

                setCustomerVehicles((prev) => {
                    if (Number(incoming.customer_id) !== Number(data.customer_id)) {
                        return prev;
                    }
                    if (prev.some((vehicle) => Number(vehicle.id) === Number(incoming.id))) {
                        return prev;
                    }
                    return [...prev, incoming];
                });
            }
        },
    });

    // Filter vehicles that are currently in active service orders
    const vehiclesInService = useMemo(() => {
        if (!activeServiceOrders || !Array.isArray(activeServiceOrders)) return [];
        return activeServiceOrders
            .filter(order => ['pending', 'in_progress'].includes(order.status))
            .map(order => order.vehicle_id);
    }, [activeServiceOrders]);

    // Check if vehicle is currently in service
    const isVehicleInService = (vehicleId) => {
        return vehiclesInService.includes(parseInt(vehicleId));
    };

    // Get available vehicles (not in active service)
    const availableVehicles = useMemo(() => {
        return liveVehicles.filter(v => !isVehicleInService(v.id));
    }, [liveVehicles, vehiclesInService]);

    // Get vehicle service status info
    const getVehicleServiceStatus = (vehicleId) => {
        if (!activeServiceOrders || !Array.isArray(activeServiceOrders)) return null;
        const order = activeServiceOrders.find(o => o.vehicle_id === parseInt(vehicleId));
        if (!order) return null;

        return {
            status: order.status,
            orderNumber: order.order_number,
            statusText: order.status === 'pending' ? 'Menunggu' : 'Dikerjakan'
        };
    };

    // Calculate prev KM
    const prevKm = useMemo(() => {
        const vals = [insights.vehicle_km, insights.last_order_km].filter((v) => v !== null && v !== undefined);
        return vals.length ? Math.max(...vals) : null;
    }, [insights]);

    // Fetch vehicle data
    useEffect(() => {
        if (!data.vehicle_id) {
            setInsights({ last_km: {}, vehicle_km: null, last_order_km: null });
            setVehicleHistory([]);
            return;
        }
        Promise.all([
            fetch(route('vehicles.maintenance.insights', data.vehicle_id), {
                headers: { 'Accept': 'application/json' },
            }).then((r) => r.json()),
            fetch(route('vehicles.with-history', data.vehicle_id), {
                headers: { 'Accept': 'application/json' },
            }).then((r) => r.json()),
        ])
            .then(([insightsData, historyData]) => {
                setInsights(insightsData);
                setVehicleHistory(historyData.recent_orders || []);
            })
            .catch(() => {
                setInsights({ last_km: {}, vehicle_km: null, last_order_km: null });
                setVehicleHistory([]);
            });
    }, [data.vehicle_id]);

    // Calculate totals
    const itemsSubtotal = useMemo(() => {
        return data.items.reduce((sum, item) => {
            const service = services.find(s => s.id === parseInt(item.service_id));
            const servicePrice = service ? service.price : 0;
            const serviceDiscount = item.service_discount_type === 'percent'
                ? servicePrice * (item.service_discount_value / 100)
                : item.service_discount_type === 'fixed'
                    ? item.service_discount_value
                    : 0;
            const serviceSubtotal = servicePrice - serviceDiscount;
            const partsTotal = item.parts.reduce((ps, p) => ps + (p.price * p.qty), 0);
            return sum + serviceSubtotal + partsTotal;
        }, 0);
    }, [data.items, services]);

    const transactionDiscount = discountMode === 'percent'
        ? itemsSubtotal * (data.discount_value / 100)
        : data.discount_value;

    const afterDiscount = Math.max(0, itemsSubtotal - transactionDiscount);
    const taxAmount = (() => {
        const taxValue = Number(data.tax_value) || 0;
        if (taxMode === 'percent') {
            return afterDiscount * (taxValue / 100);
        } else {
            return taxValue;
        }
    })();
    const grandTotal = afterDiscount + taxAmount;

    useEffect(() => {
        if (!data.customer_id) {
            setCustomerVehicles([]);
            return;
        }

        const customer = liveCustomers.find((item) => Number(item.id) === Number(data.customer_id));
        setCustomerVehicles(customer?.vehicles || []);
    }, [data.customer_id, liveCustomers]);

    // Handlers
    const handleCustomerChange = (customerOrId) => {
        // Handle both customer object and customer ID
        const customerId = typeof customerOrId === 'object' ? customerOrId?.id : customerOrId;

        setData('customer_id', customerId);
        if (!customerId) {
            setCustomerVehicles([]);
            setData('vehicle_id', '');
            return;
        }
        const customer = liveCustomers.find(c => c.id === parseInt(customerId));
        if (customer && customer.vehicles) {
            setCustomerVehicles(customer.vehicles);
        } else {
            setCustomerVehicles([]);
        }
    };

    const handleVehicleChange = (vehicleId) => {
        // Check if vehicle is in active service
        if (isVehicleInService(vehicleId)) {
            toast.error('Kendaraan ini sedang dalam proses service. Silakan pilih kendaraan lain.');
            return;
        }

        setData('vehicle_id', vehicleId);
        if (!vehicleId) return;
        const vehicle = liveVehicles.find(v => v.id === parseInt(vehicleId));
        if (vehicle && vehicle.customer_id && !data.customer_id) {
            setData('customer_id', vehicle.customer_id);
            // Find customer object to update vehicles list
            const customer = liveCustomers.find(c => c.id === parseInt(vehicle.customer_id));
            if (customer && customer.vehicles) {
                setCustomerVehicles(customer.vehicles);
            }
            toast.success('Pelanggan otomatis dipilih');
        }
    };

    const handleVehicleCreated = (newVehicle) => {
        setLiveVehicles((prev) => {
            if (prev.some((vehicle) => vehicle.id === newVehicle.id)) {
                return prev;
            }

            return [...prev, newVehicle];
        });

        setCustomerVehicles((prev) => {
            if (Number(newVehicle.customer_id) !== Number(data.customer_id)) {
                return prev;
            }

            if (prev.some((vehicle) => vehicle.id === newVehicle.id)) {
                return prev;
            }

            return [...prev, newVehicle];
        });

        setData('vehicle_id', newVehicle.id);
        if (newVehicle.customer_id) {
            setData('customer_id', newVehicle.customer_id);
        }
        setShowVehicleModal(false);
        toast.success('Kendaraan berhasil ditambahkan');
    };

    const handleAddService = (service) => {
        const newItem = {
            service_id: service.id,
            service_discount_type: 'none',
            service_discount_value: 0,
            parts: [],
        };
        setData('items', [...data.items, newItem]);
        toast.success(`${service.title} ditambahkan`);
    };

    const handleAddServiceWithParts = (itemData) => {
        if (editingItemIndex !== null) {
            // Update existing item
            const newItems = [...data.items];
            newItems[editingItemIndex] = {
                service_id: itemData.service_id,
                service_discount_type: itemData.service_discount_type,
                service_discount_value: itemData.service_discount_value,
                parts: itemData.parts,
            };
            setData('items', newItems);
            setEditingItemIndex(null);
            toast.success('Item diperbarui');
        } else {
            // Add new item
            const newItem = {
                service_id: itemData.service_id,
                service_discount_type: itemData.service_discount_type,
                service_discount_value: itemData.service_discount_value,
                parts: itemData.parts.filter(p => p.part_id),
            };
            setData('items', [...data.items, newItem]);
            toast.success('Layanan ditambahkan ke pesanan');
        }
    };

    const handleEditItem = (index) => {
        setEditingItemIndex(index);
        setMobileView('services');
    };

    const handleQuickCreatePartFromGrid = (partIndex) => {
        setCurrentPartIndex({ fromGrid: true, index: partIndex });
        setShowPartModal(true);
    };

    const handlePartCreated = (newPart) => {
        router.reload({
            only: ['parts'],
            onSuccess: () => {
                if (currentPartIndex !== null) {
                    const newItems = [...data.items];
                    const itemIndex = currentPartIndex.itemIndex;
                    const partIndex = currentPartIndex.partIndex;
                    newItems[itemIndex].parts[partIndex].part_id = newPart.id;
                    newItems[itemIndex].parts[partIndex].price = newPart.sell_price;
                    setData('items', newItems);
                }
                setShowPartModal(false);
                toast.success('Sparepart berhasil ditambahkan');
            },
        });
    };

    const handleAddItem = () => {
        setData('items', [
            ...data.items,
            { service_id: '', service_discount_type: 'none', service_discount_value: 0, parts: [] },
        ]);
    };

    const handleRemoveItem = (index) => {
        const newItems = data.items.filter((_, i) => i !== index);
        setData('items', newItems);
        toast.success('Layanan dihapus');
    };

    const handleServiceChange = (itemIndex, serviceId) => {
        const newItems = [...data.items];
        newItems[itemIndex].service_id = serviceId;
        setData('items', newItems);
    };

    const handleServiceDiscountChange = (itemIndex, field, value) => {
        const newItems = [...data.items];
        newItems[itemIndex][field] = value;
        setData('items', newItems);
    };

    const handleAddPart = (itemIndex) => {
        const newItems = [...data.items];
        newItems[itemIndex].parts.push({ part_id: '', qty: 1, price: 0 });
        setData('items', newItems);
    };

    const handleRemovePart = (itemIndex, partIndex) => {
        const newItems = [...data.items];
        newItems[itemIndex].parts.splice(partIndex, 1);
        setData('items', newItems);
    };

    const handlePartChange = (itemIndex, partIndex, field, value) => {
        const newItems = [...data.items];
        if (field === 'part_id') {
            const part = parts.find((p) => p.id === parseInt(value));
            if (part) {
                newItems[itemIndex].parts[partIndex].part_id = value;
                newItems[itemIndex].parts[partIndex].price = part.sell_price;
            }
        } else {
            newItems[itemIndex].parts[partIndex][field] =
                field === 'qty' ? parseInt(value) || 1 : parseFloat(value) || 0;
        }
        setData('items', newItems);
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        if (processing || isSubmitting) {
            return;
        }

        // Validation
        if (!data.customer_id) {
            toast.error('Pilih pelanggan terlebih dahulu');
            return;
        }
        if (!data.vehicle_id) {
            toast.error('Pilih kendaraan terlebih dahulu');
            return;
        }
        if (data.items.length === 0) {
            toast.error('Tambahkan minimal satu layanan service');
            return;
        }
        if (!data.items.some(item => item.service_id)) {
            toast.error('Minimal satu item harus memiliki layanan service');
            return;
        }
        if (!data.odometer_km) {
            toast.error('Isi odometer (km) kendaraan terlebih dahulu');
            return;
        }

        // Prepare final data with correct discount/tax types
        const finalData = {
            ...data,
            discount_type: data.discount_value > 0 ? (discountMode === 'nominal' ? 'fixed' : discountMode) : 'none',
            tax_type: data.tax_value > 0 ? (taxMode === 'nominal' ? 'fixed' : taxMode) : 'none',
        };

        setIsSubmitting(true);

        // Submit form with Inertia
        router.post(route('service-orders.store'), finalData, {
            onSuccess: () => {
                toast.success('Service Order berhasil dibuat');
            },
            onError: (errors) => {
                console.error('Submission errors:', errors);
                if (errors && Object.keys(errors).length > 0) {
                    Object.entries(errors).forEach(([key, value]) => {
                        toast.error(`${key}: ${value}`);
                    });
                } else {
                    toast.error('Gagal membuat Service Order');
                }
            },
            onFinish: () => {
                setIsSubmitting(false);
            },
        });
    };

    const handleShowHistory = async () => {
        if (!data.vehicle_id) return;

        setLoadingHistory(true);
        setShowHistoryModal(true);

        try {
            const response = await fetch(route('vehicles.service-history', data.vehicle_id), {
                headers: { 'Accept': 'application/json' },
            });
            const historyData = await response.json();
            setVehicleHistory(historyData.service_orders || []);
        } catch (error) {
            console.error('Error fetching history:', error);
            toast.error('Gagal memuat riwayat kendaraan');
            setVehicleHistory([]);
        } finally {
            setLoadingHistory(false);
        }
    };

    const currentVehicle = liveVehicles.find((v) => v.id === parseInt(data.vehicle_id));
    const itemCount = useMemo(() => data.items.length, [data.items]);

    return (
        <ServiceOrderLayout
            selectedVehicleId={data.vehicle_id}
            onHistoryClick={handleShowHistory}
        >
            <Head title="Tambah Service Order" />

            <div className="h-[calc(100vh-4rem)] flex flex-col lg:flex-row">
                {/* Floating total button for mobile when browsing services */}
                {mobileView === 'services' && data.items.length > 0 && (
                    <div className="fixed right-4 bottom-4 z-50 lg:hidden">
                        <button
                            onClick={() => setMobileView('summary')}
                            aria-label={`Buka ringkasan - ${itemCount} item`}
                            className="inline-flex items-center gap-3 px-4 py-3 rounded-2xl bg-primary-500 text-white shadow-lg hover:bg-primary-600 focus:outline-none"
                        >
                            <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white text-primary-600 font-bold text-sm">
                                {itemCount}
                            </div>
                            <div className="flex flex-col text-right">
                                <div className="text-xs">Total</div>
                                <div className="text-sm font-semibold">{formatCurrency(grandTotal)}</div>
                            </div>
                        </button>
                    </div>
                )}

                {/* Mobile Tab Switcher */}
                <div className="lg:hidden flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <button
                        onClick={() => setMobileView('services')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                            mobileView === 'services'
                                ? 'text-primary-600 border-b-2 border-primary-500'
                                : 'text-slate-500'
                        }`}
                    >
                        <IconClipboardList size={18} />
                        <span>Layanan</span>
                    </button>
                    <button
                        onClick={() => setMobileView('summary')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors relative ${
                            mobileView === 'summary'
                                ? 'text-primary-600 border-b-2 border-primary-500'
                                : 'text-slate-500'
                        }`}
                    >
                        <IconReceipt size={18} />
                        <span>Ringkasan</span>
                        {itemCount > 0 && (
                            <span className="absolute top-2 right-1/4 w-5 h-5 flex items-center justify-center text-xs font-bold bg-primary-500 text-white rounded-full">
                                {itemCount}
                            </span>
                        )}
                    </button>
                </div>

                {/* Left Panel - Services Grid */}
                <div
                    className={`flex-1 bg-slate-100 dark:bg-slate-950 overflow-hidden ${
                        mobileView !== 'services'
                            ? 'hidden lg:flex lg:flex-col'
                            : 'flex flex-col'
                    }`}
                >
                    <ServiceGrid
                        services={services}
                        parts={parts}
                        onAddServiceWithParts={handleAddServiceWithParts}
                        onQuickCreatePart={handleQuickCreatePartFromGrid}
                        onEditItem={handleEditItem}
                        editingItemIndex={editingItemIndex}
                        editingItem={editingItemIndex !== null ? data.items[editingItemIndex] : null}
                    />
                </div>

                {/* Right Panel - Order Summary & Payment */}
                <div
                    className={`w-full lg:w-[420px] xl:w-[480px] flex flex-col bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 ${
                        mobileView !== 'summary' ? 'hidden lg:flex' : 'flex'
                    }`}
                    style={{ height: 'calc(100vh - 4rem)' }}
                >
                    {/* Vehicle Select - Fixed */}
                    <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
                        <VehicleSelect
                            vehicles={customerVehicles.length > 0 ? customerVehicles : liveVehicles}
                            customers={liveCustomers}
                            selected={data.vehicle_id ? (customerVehicles.length > 0 ? customerVehicles : liveVehicles).find(v => Number(v.id) === Number(data.vehicle_id)) : null}
                            onSelect={handleVehicleChange}
                            onVehicleAdded={handleVehicleCreated}
                            placeholder="Pilih kendaraan..."
                            error={errors?.vehicle_id}
                            label="Kendaraan"
                            getOptionDisabled={(v) => isVehicleInService(v.id)}
                            renderOption={(v, isDisabled) => {
                                const statusInfo = getVehicleServiceStatus(v.id);
                                return (
                                    <div className="flex items-center justify-between gap-2 flex-1">
                                        <span className={isDisabled ? 'text-gray-400 dark:text-gray-500' : ''}>
                                            {v.plate_number} - {v.brand} {v.model}
                                        </span>
                                        {isDisabled && statusInfo && (
                                            <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                                                statusInfo.status === 'pending'
                                                    ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                            }`}>
                                                {statusInfo.statusText}
                                            </span>
                                        )}
                                    </div>
                                );
                            }}
                        />
                        {currentVehicle && (
                            <div className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                                {currentVehicle.brand} {currentVehicle.model} ({currentVehicle.year})
                                {insights.vehicle_km !== null && (
                                    <span> â€¢ KM: {insights.vehicle_km?.toLocaleString('id-ID')}</span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Order Items - Scrollable */}
                    <div className="flex-1 overflow-y-auto min-h-0">
                        {/* Customer Selection */}
                        <div className="p-3 border-b border-slate-200 dark:border-slate-800">
                            <CustomerSelect
                                customers={liveCustomers}
                                selected={data.customer_id ? liveCustomers.find(c => Number(c.id) === Number(data.customer_id)) : null}
                                onSelect={handleCustomerChange}
                                onClear={() => {
                                    setData('customer_id', '');
                                    setData('vehicle_id', '');
                                    setCustomerVehicles([]);
                                }}
                                placeholder="Pilih pelanggan..."
                                error={errors?.customer_id}
                                label="Pelanggan"
                            />
                        </div>

                        {/* Odometer Check-in */}
                        <div className="p-3 border-b border-slate-200 dark:border-slate-800">
                            <button
                                type="button"
                                onClick={() => setShowCheckIn(true)}
                                className="w-full py-2 px-3 rounded-xl bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-sm font-medium hover:bg-primary-200 dark:hover:bg-primary-900/50 transition-colors"
                            >
                                {data.odometer_km
                                    ? `Odometer: ${parseInt(data.odometer_km).toLocaleString('id-ID')} km`
                                    : 'Check-in Odometer'}
                            </button>
                        </div>

                        {/* Order Items List */}
                        <div className="p-3 border-b border-slate-200 dark:border-slate-800">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                    <IconShoppingCart size={16} />
                                    Pesanan
                                </h3>
                                {data.items.length > 0 && (
                                    <span className="px-2 py-0.5 text-xs font-bold bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300 rounded-full">
                                        {itemCount} item
                                    </span>
                                )}
                            </div>

                            {data.items.length > 0 ? (
                                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                                    {data.items.map((item, index) => {
                                        const service = services.find((s) => s.id === parseInt(item.service_id));
                                        if (!service) return null;

                                        const servicePrice = service.price;
                                        const serviceDiscount =
                                            item.service_discount_type === 'percent'
                                                ? servicePrice * (item.service_discount_value / 100)
                                                : item.service_discount_type === 'fixed'
                                                ? item.service_discount_value
                                                : 0;
                                        const serviceSubtotal = servicePrice - serviceDiscount;
                                        const partsTotal = item.parts.reduce(
                                            (ps, p) => ps + p.price * p.qty,
                                            0
                                        );
                                        const itemTotal = serviceSubtotal + partsTotal;

                                        return (
                                            <div
                                                key={index}
                                                className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 cursor-pointer transition hover:bg-slate-100 dark:hover:bg-slate-800 border-2 border-transparent hover:border-primary-300 dark:hover:border-primary-700"
                                                onClick={() => handleEditItem(index)}
                                            >
                                                <div className="flex items-start justify-between mb-2">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                                            {service.title}
                                                        </p>
                                                        <p className="text-xs text-slate-600 dark:text-slate-400">
                                                            {formatCurrency(servicePrice)}
                                                            {serviceDiscount > 0 &&
                                                                ` - ${formatCurrency(serviceDiscount)}`}
                                                        </p>
                                                    </div>
                                                    <div className="flex gap-1 ml-2">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleEditItem(index);
                                                            }}
                                                            className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-950/50"
                                                            title="Edit item"
                                                        >
                                                            <IconEdit size={14} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleRemoveItem(index);
                                                            }}
                                                            className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-950/50"
                                                        >
                                                            <IconTrash size={12} />
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Parts List */}
                                                {item.parts.length > 0 && (
                                                    <div className="space-y-1 border-t border-slate-200 dark:border-slate-700 pt-2">
                                                        {item.parts.map((part, partIndex) => {
                                                            const partData = parts.find(
                                                                (p) => p.id === parseInt(part.part_id)
                                                            );
                                                            return (
                                                                <div
                                                                    key={partIndex}
                                                                    className="flex items-center justify-between text-xs"
                                                                >
                                                                    <span className="text-slate-600 dark:text-slate-400 flex-1 truncate">
                                                                        {partData?.name || 'Sparepart'} Ã—{part.qty}
                                                                    </span>
                                                                    <span className="text-slate-900 dark:text-white font-medium">
                                                                        {formatCurrency(part.price * part.qty)}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}

                                                <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                                                    <span className="text-xs text-slate-500">Total Item</span>
                                                    <span className="text-sm font-bold text-primary-600 dark:text-primary-400">
                                                        {formatCurrency(itemTotal)}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="py-6 text-center">
                                    <IconShoppingCart
                                        size={32}
                                        className="mx-auto text-slate-300 dark:text-slate-600 mb-2"
                                    />
                                    <p className="text-sm text-slate-400">Belum ada layanan</p>
                                </div>
                            )}
                        </div>

                        {/* Payment Details */}
                        <div className="p-3 space-y-4">
                            {/* Mechanic */}
                            <div>
                                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                                    Mekanik (Opsional)
                                </label>
                                <select
                                    value={data.mechanic_id}
                                    onChange={(e) => setData('mechanic_id', e.target.value)}
                                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                                >
                                    <option value="">-- Pilih Mekanik --</option>
                                    {mechanics.map((m) => (
                                        <option key={m.id} value={m.id}>
                                            {m.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Discount Input */}
                            <div>
                                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-3">
                                    Diskon
                                </label>
                                <div className="relative flex gap-2 items-center">
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={data.discount_value || 0}
                                        onChange={(e) =>
                                            setData('discount_value', e.target.value.replace(/[^\d.]/g, ''))
                                        }
                                        placeholder="0"
                                        className="flex-1 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                                    />
                                    <DiscountModeToggle
                                        mode={discountMode}
                                        onChange={setDiscountMode}
                                    />
                                </div>
                            </div>

                            {/* Tax Input */}
                            <div>
                                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-3">
                                    Pajak
                                </label>
                                <div className="relative flex gap-2 items-center">
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={data.tax_value || 0}
                                        onChange={(e) =>
                                            setData('tax_value', e.target.value.replace(/[^\d.]/g, ''))
                                        }
                                        placeholder="0"
                                        className="flex-1 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                                    />
                                    <DiscountModeToggle
                                        mode={taxMode}
                                        onChange={setTaxMode}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                                    Kode Voucher
                                </label>
                                <input
                                    type="text"
                                    value={data.voucher_code || ''}
                                    onChange={(e) => setData('voucher_code', e.target.value.toUpperCase())}
                                    placeholder="Contoh: SERVICEHEMAT"
                                    list="service-order-voucher-options"
                                    className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                                />
                                <datalist id="service-order-voucher-options">
                                    {availableVouchers.map((voucher) => (
                                        <option key={voucher.id} value={voucher.code}>{voucher.name}</option>
                                    ))}
                                </datalist>
                                {errors.voucher_code && <p className="mt-1 text-xs text-red-600">{errors.voucher_code}</p>}
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                                    Catatan
                                </label>
                                <textarea
                                    value={data.notes}
                                    onChange={(e) => setData('notes', e.target.value)}
                                    rows="2"
                                    placeholder="Keluhan pelanggan..."
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Summary & Submit - Fixed at bottom */}
                    <div className="flex-shrink-0 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 p-3">
                        {/* Summary Row */}
                        <div className="flex justify-between items-center mb-2 text-sm">
                            <span className="text-slate-500">Subtotal</span>
                            <span className="font-medium">{formatCurrency(itemsSubtotal)}</span>
                        </div>
                        {transactionDiscount > 0 && (
                            <div className="flex justify-between items-center mb-2 text-sm">
                                <span className="text-slate-500">Diskon</span>
                                <span className="text-danger-500">-{formatCurrency(transactionDiscount)}</span>
                            </div>
                        )}
                        {taxAmount > 0 && (
                            <div className="flex justify-between items-center mb-2 text-sm">
                                <span className="text-slate-500">Pajak</span>
                                <span className="text-success-600">+{formatCurrency(taxAmount)}</span>
                            </div>
                        )}
                        <div className="flex justify-between items-center mb-3">
                            <span className="font-semibold text-slate-800 dark:text-white">Total</span>
                            <span className="text-xl font-bold text-primary-600 dark:text-primary-400">
                                {formatCurrency(grandTotal)}
                            </span>
                        </div>

                        {/* Submit Button - Always visible */}
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={processing || isSubmitting || !data.customer_id || !data.vehicle_id || data.items.length === 0}
                            className={`w-full h-12 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                                data.customer_id && data.vehicle_id && data.items.length > 0
                                    ? 'bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white shadow-lg shadow-primary-500/30'
                                    : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                            }`}
                        >
                            {(processing || isSubmitting) ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <IconDeviceFloppy size={18} />
                                    <span>
                                        {!data.customer_id
                                            ? 'Pilih Pelanggan'
                                            : !data.vehicle_id
                                            ? 'Pilih Kendaraan'
                                            : data.items.length === 0
                                            ? 'Tambah Layanan'
                                            : 'Simpan Order'}
                                    </span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
            {/* Modals */}
            <QuickCreateVehicleModal
                isOpen={showVehicleModal}
                onClose={() => setShowVehicleModal(false)}
                initialPlateNumber={vehicleSearchTerm}
                initialCustomerId={data.customer_id}
                customers={liveCustomers}
                onSuccess={handleVehicleCreated}
            />

            <QuickCreatePartModal
                isOpen={showPartModal}
                onClose={() => {
                    setShowPartModal(false);
                    setCurrentPartIndex(null);
                }}
                initialName={partSearchTerm}
                onSuccess={handlePartCreated}
            />

            {/* Check-in Modal */}
            <OdometerCheckInModal
                isOpen={showCheckIn}
                onClose={() => setShowCheckIn(false)}
                prevKm={prevKm}
                onSuccess={(checkInData) => {
                    setData('odometer_km', checkInData.odometer_km);
                    if (checkInData.notes) {
                        setData('notes', (data.notes ? data.notes + '\n' : '') + checkInData.notes);
                    }
                    setShowCheckIn(false);
                    toast.success('Check-in berhasil');
                }}
            />

            {/* Vehicle History Modal */}
            <VehicleHistoryModal
                show={showHistoryModal}
                onClose={() => setShowHistoryModal(false)}
                vehicle={currentVehicle}
                serviceHistory={vehicleHistory}
            />
        </ServiceOrderLayout>
    );
}

// No need for layout wrapper since we're using ServiceOrderLayout directly

