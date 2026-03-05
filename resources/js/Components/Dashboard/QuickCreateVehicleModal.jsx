import React, { useState, useEffect } from 'react';
import { useForm } from '@inertiajs/react';
import axios from 'axios';
import {
    IconX,
    IconCar,
    IconLoader2,
    IconCheck,
} from '@tabler/icons-react';
import toast from 'react-hot-toast';

export default function QuickCreateVehicleModal({ isOpen, onClose, initialPlateNumber = '', initialCustomerId = null, customers = [], onSuccess }) {
    const { data, setData, processing, errors, reset } = useForm({
        plate_number: initialPlateNumber,
        brand: '',
        model: '',
        year: '',
        color: '',
        customer_id: initialCustomerId || '',
        engine_type: '',
        transmission_type: '',
        cylinder_volume: '',
        chassis_number: '',
        engine_number: '',
        manufacture_year: '',
        registration_number: '',
        registration_date: '',
        stnk_expiry_date: '',
        previous_owner: '',
        notes: '',
    });

    // Local state untuk customers agar bisa update tanpa reload
    const [localCustomers, setLocalCustomers] = useState(customers);
    const [showCreateCustomer, setShowCreateCustomer] = useState(false);
    const [newCustomerData, setNewCustomerData] = useState({
        name: '',
        phone: '',
        email: '',
    });
    const [creatingCustomer, setCreatingCustomer] = useState(false);
    const [customerErrors, setCustomerErrors] = useState({});

    // Sync local customers dengan props saat berubah
    useEffect(() => {
        setLocalCustomers(customers);
    }, [customers]);

    useEffect(() => {
        if (initialCustomerId) {
            setData('customer_id', initialCustomerId);
        }
    }, [initialCustomerId]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            const response = await axios.post(route('vehicles.store'), data, {
                headers: {
                    'Accept': 'application/json',
                }
            });

            const result = response.data;

            // Success
            toast.success(result.message || 'Kendaraan berhasil ditambahkan!');
            if (onSuccess && result.vehicle) {
                onSuccess(result.vehicle);
            }
            reset();
            onClose();
        } catch (error) {
            console.error('Error:', error);

            // Handle validation errors
            if (error.response?.data?.errors) {
                Object.entries(error.response.data.errors).forEach(([field, messages]) => {
                    const message = Array.isArray(messages) ? messages[0] : messages;
                    toast.error(`${field}: ${message}`);
                });
            } else {
                toast.error(error.response?.data?.message || error.message || 'Gagal menambahkan kendaraan!');
            }
        }
    };

    const handleCreateCustomer = async () => {
        if (!newCustomerData.name.trim()) {
            setCustomerErrors({ name: 'Nama pelanggan harus diisi' });
            return;
        }
        if (!newCustomerData.phone.trim()) {
            setCustomerErrors({ phone: 'Nomor telepon harus diisi' });
            return;
        }

        setCustomerErrors({});
        setCreatingCustomer(true);

        try {
            const response = await axios.post(route('customers.storeAjax'), newCustomerData);
            const result = response.data;

            toast.success(result.message || 'Pelanggan berhasil dibuat');

            // Update local customers array (real-time tanpa reload)
            setLocalCustomers(prev => {
                if (prev.some((customer) => customer.id === result.customer.id)) {
                    return prev;
                }

                return [...prev, result.customer];
            });

            // Set customer_id dengan ID pelanggan baru
            setData('customer_id', result.customer.id);
            setShowCreateCustomer(false);
            setNewCustomerData({ name: '', phone: '', email: '' });
            setCustomerErrors({});
        } catch (error) {
            console.error('Error creating customer:', error);

            // Handle validation errors
            if (error.response?.data?.errors) {
                setCustomerErrors(error.response.data.errors);
                const message = error.response.data.message || 'Gagal membuat pelanggan';
                toast.error(message);
            } else {
                const message = error.response?.data?.message || error.message || 'Gagal membuat pelanggan';
                toast.error(message);
                setCustomerErrors({ general: message });
            }
        } finally {
            setCreatingCustomer(false);
        }
    };

    const handleClose = () => {
        reset();
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
                {/* Header */}
                <div className="bg-gradient-to-r from-primary-500 to-primary-600 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3 text-white">
                        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                            <IconCar size={20} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-lg">
                                Tambah Kendaraan
                            </h3>
                            <p className="text-sm text-white/80">
                                Daftarkan kendaraan baru
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                    >
                        <IconX size={18} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="flex flex-col h-[calc(100vh-200px)]">
                    {/* Fixed Customer Selection - Outside Scrollable Area */}
                    <div className="px-6 pt-6 pb-3 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
                        {!showCreateCustomer ? (
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Pemilik Kendaraan <span className="text-danger-500">*</span>
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setShowCreateCustomer(true)}
                                        className="text-xs px-3 py-1 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 hover:bg-primary-200 dark:hover:bg-primary-900/50 transition-colors"
                                    >
                                        + Buat Baru
                                    </button>
                                </div>
                                <select
                                    value={data.customer_id}
                                    onChange={(e) => setData('customer_id', e.target.value)}
                                    className={`w-full h-11 px-4 rounded-xl border ${
                                        errors.customer_id
                                            ? 'border-danger-500 focus:ring-danger-500/20'
                                            : 'border-slate-200 dark:border-slate-700 focus:ring-primary-500/20'
                                    } bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-4 focus:border-primary-500 transition-all`}
                                    required
                                >
                                    <option value="">-- Pilih Pelanggan --</option>
                                    {localCustomers && localCustomers.length > 0 && localCustomers.map((customer) => (
                                        <option key={customer.id} value={customer.id}>
                                            {customer.name} ({customer.phone || '-'})
                                        </option>
                                    ))}
                                </select>
                                {errors.customer_id && (
                                    <p className="mt-1 text-xs text-danger-500">{errors.customer_id}</p>
                                )}
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                    {localCustomers && localCustomers.length > 0
                                        ? `${localCustomers.length} pelanggan tersedia`
                                        : 'Tidak ada pelanggan - gunakan tombol Buat Baru'}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Pelanggan Baru</h4>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowCreateCustomer(false);
                                            setCustomerErrors({});
                                        }}
                                        className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                    >
                                        Kembali
                                    </button>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                                        Nama <span className="text-danger-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={newCustomerData.name}
                                        onChange={(e) => setNewCustomerData({ ...newCustomerData, name: e.target.value })}
                                        placeholder="Nama lengkap"
                                        className={`w-full h-10 px-3 rounded-lg border ${
                                            customerErrors.name ? 'border-danger-500' : 'border-slate-200 dark:border-slate-600'
                                        } bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-primary-500 transition-all text-sm`}
                                    />
                                    {customerErrors.name && <p className="text-xs text-danger-500 mt-1">{customerErrors.name}</p>}
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                                        No. Telepon <span className="text-danger-500">*</span>
                                    </label>
                                    <input
                                        type="tel"
                                        value={newCustomerData.phone}
                                        onChange={(e) => setNewCustomerData({ ...newCustomerData, phone: e.target.value })}
                                        placeholder="081234567890"
                                        className={`w-full h-10 px-3 rounded-lg border ${
                                            customerErrors.phone ? 'border-danger-500' : 'border-slate-200 dark:border-slate-600'
                                        } bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-primary-500 transition-all text-sm`}
                                    />
                                    {customerErrors.phone && (
                                        <p className="text-xs text-danger-500 mt-1">
                                            {Array.isArray(customerErrors.phone) ? customerErrors.phone[0] : customerErrors.phone}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                                        Email
                                    </label>
                                    <input
                                        type="email"
                                        value={newCustomerData.email}
                                        onChange={(e) => setNewCustomerData({ ...newCustomerData, email: e.target.value })}
                                        placeholder="email@example.com"
                                        className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-primary-500 transition-all text-sm"
                                    />
                                </div>
                                {customerErrors.general && (
                                    <div className="text-xs text-danger-500 bg-danger-50 dark:bg-danger-900/20 p-2 rounded">
                                        {customerErrors.general}
                                    </div>
                                )}
                                <button
                                    type="button"
                                    onClick={handleCreateCustomer}
                                    disabled={creatingCustomer}
                                    className="w-full h-10 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white rounded-lg font-medium text-sm transition-colors"
                                >
                                    {creatingCustomer ? 'Membuat...' : 'Buat Pelanggan'}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Scrollable Content */}
                    <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                    {/* Informasi Dasar Section */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-700">
                            <div className="w-2 h-2 rounded-full bg-primary-500"></div>
                            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                                Informasi Dasar
                            </h4>
                        </div>

                        {/* Plate Number */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                Nomor Plat <span className="text-danger-500">*</span>
                            </label>
                            <input
                                type="text"
                                name="plate_number"
                                value={data.plate_number}
                                onChange={(e) => {
                                    const sanitized = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                                    setData('plate_number', sanitized);
                                }}
                                placeholder="B1234XYZ"
                                maxLength={20}
                                className={`w-full h-11 px-4 rounded-xl border ${
                                    errors.plate_number
                                        ? 'border-danger-500 focus:ring-danger-500/20'
                                        : 'border-slate-200 dark:border-slate-700 focus:ring-primary-500/20'
                                } bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-4 focus:border-primary-500 transition-all font-mono text-lg tracking-wider`}
                                required
                            />
                            {errors.plate_number ? (
                                <p className="mt-1 text-xs text-danger-500">{errors.plate_number}</p>
                            ) : (
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                    Hanya huruf dan angka (tanpa spasi)
                                </p>
                            )}
                        </div>

                        {/* Brand & Model Row */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                    Merek <span className="text-danger-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="brand"
                                    value={data.brand}
                                    onChange={(e) => setData('brand', e.target.value)}
                                    placeholder="Honda, Yamaha, Suzuki..."
                                    className={`w-full h-11 px-4 rounded-xl border ${
                                        errors.brand
                                            ? 'border-danger-500 focus:ring-danger-500/20'
                                            : 'border-slate-200 dark:border-slate-700 focus:ring-primary-500/20'
                                    } bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-4 focus:border-primary-500 transition-all`}
                                    required
                                />
                                {errors.brand && (
                                    <p className="mt-1 text-xs text-danger-500">{errors.brand}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                    Model <span className="text-danger-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="model"
                                    value={data.model}
                                    onChange={(e) => setData('model', e.target.value)}
                                    placeholder="Vario, Beat, Scoopy..."
                                    className={`w-full h-11 px-4 rounded-xl border ${
                                        errors.model
                                            ? 'border-danger-500 focus:ring-danger-500/20'
                                            : 'border-slate-200 dark:border-slate-700 focus:ring-primary-500/20'
                                    } bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-4 focus:border-primary-500 transition-all`}
                                    required
                                />
                                {errors.model && (
                                    <p className="mt-1 text-xs text-danger-500">{errors.model}</p>
                                )}
                            </div>
                        </div>

                        {/* Year & Color Row */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                    Tahun
                                </label>
                                <input
                                    type="number"
                                    name="year"
                                    value={data.year}
                                    onChange={(e) => setData('year', e.target.value)}
                                    placeholder="2024"
                                    min="1900"
                                    max={new Date().getFullYear() + 1}
                                    className={`w-full h-11 px-4 rounded-xl border ${
                                        errors.year
                                            ? 'border-danger-500 focus:ring-danger-500/20'
                                            : 'border-slate-200 dark:border-slate-700 focus:ring-primary-500/20'
                                    } bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-4 focus:border-primary-500 transition-all`}
                                />
                                {errors.year && (
                                    <p className="mt-1 text-xs text-danger-500">{errors.year}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                    Warna
                                </label>
                                <input
                                    type="text"
                                    name="color"
                                    value={data.color}
                                    onChange={(e) => setData('color', e.target.value)}
                                    placeholder="Merah, Hitam, Putih..."
                                    className={`w-full h-11 px-4 rounded-xl border ${
                                        errors.color
                                            ? 'border-danger-500 focus:ring-danger-500/20'
                                            : 'border-slate-200 dark:border-slate-700 focus:ring-primary-500/20'
                                    } bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-4 focus:border-primary-500 transition-all`}
                                />
                                {errors.color && (
                                    <p className="mt-1 text-xs text-danger-500">{errors.color}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Spesifikasi Teknis Section */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-700">
                            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                                Spesifikasi Teknis
                            </h4>
                        </div>

                        {/* Engine Type & Transmission Row */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                    Tipe Mesin
                                </label>
                                <input
                                    type="text"
                                    name="engine_type"
                                    value={data.engine_type}
                                    onChange={(e) => setData('engine_type', e.target.value)}
                                    placeholder="4-Stroke, 2-Stroke..."
                                    className={`w-full h-11 px-4 rounded-xl border ${
                                        errors.engine_type
                                            ? 'border-danger-500 focus:ring-danger-500/20'
                                            : 'border-slate-200 dark:border-slate-700 focus:ring-primary-500/20'
                                    } bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-4 focus:border-primary-500 transition-all`}
                                />
                                {errors.engine_type && (
                                    <p className="mt-1 text-xs text-danger-500">{errors.engine_type}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                    Tipe Transmisi
                                </label>
                                <select
                                    name="transmission_type"
                                    value={data.transmission_type}
                                    onChange={(e) => setData('transmission_type', e.target.value)}
                                    className={`w-full h-11 px-4 rounded-xl border ${
                                        errors.transmission_type
                                            ? 'border-danger-500 focus:ring-danger-500/20'
                                            : 'border-slate-200 dark:border-slate-700 focus:ring-primary-500/20'
                                    } bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-4 focus:border-primary-500 transition-all`}
                                >
                                    <option value="">Pilih Transmisi</option>
                                    <option value="manual">Manual</option>
                                    <option value="automatic">Automatic</option>
                                    <option value="semi-automatic">Semi-Automatic</option>
                                </select>
                                {errors.transmission_type && (
                                    <p className="mt-1 text-xs text-danger-500">{errors.transmission_type}</p>
                                )}
                            </div>
                        </div>

                        {/* Cylinder Volume */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                Kapasitas Mesin (cc)
                            </label>
                            <input
                                type="number"
                                name="cylinder_volume"
                                value={data.cylinder_volume}
                                onChange={(e) => setData('cylinder_volume', e.target.value)}
                                placeholder="150"
                                min="50"
                                className={`w-full h-11 px-4 rounded-xl border ${
                                    errors.cylinder_volume
                                        ? 'border-danger-500 focus:ring-danger-500/20'
                                        : 'border-slate-200 dark:border-slate-700 focus:ring-primary-500/20'
                                } bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-4 focus:border-primary-500 transition-all`}
                            />
                            {errors.cylinder_volume && (
                                <p className="mt-1 text-xs text-danger-500">{errors.cylinder_volume}</p>
                            )}
                        </div>
                    </div>

                    {/* Data STNK Section */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-700">
                            <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                                Data STNK
                            </h4>
                        </div>

                        {/* Chassis Number & Engine Number Row */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                    Nomor Rangka (VIN)
                                </label>
                                <input
                                    type="text"
                                    name="chassis_number"
                                    value={data.chassis_number}
                                    onChange={(e) => setData('chassis_number', e.target.value)}
                                    placeholder="Nomor rangka kendaraan"
                                    className={`w-full h-11 px-4 rounded-xl border ${
                                        errors.chassis_number
                                            ? 'border-danger-500 focus:ring-danger-500/20'
                                            : 'border-slate-200 dark:border-slate-700 focus:ring-primary-500/20'
                                    } bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-4 focus:border-primary-500 transition-all`}
                                />
                                {errors.chassis_number && (
                                    <p className="mt-1 text-xs text-danger-500">{errors.chassis_number}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                    Nomor Mesin
                                </label>
                                <input
                                    type="text"
                                    name="engine_number"
                                    value={data.engine_number}
                                    onChange={(e) => setData('engine_number', e.target.value)}
                                    placeholder="Nomor mesin kendaraan"
                                    className={`w-full h-11 px-4 rounded-xl border ${
                                        errors.engine_number
                                            ? 'border-danger-500 focus:ring-danger-500/20'
                                            : 'border-slate-200 dark:border-slate-700 focus:ring-primary-500/20'
                                    } bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-4 focus:border-primary-500 transition-all`}
                                />
                                {errors.engine_number && (
                                    <p className="mt-1 text-xs text-danger-500">{errors.engine_number}</p>
                                )}
                            </div>
                        </div>

                        {/* Manufacture Year & Registration Number Row */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                    Tahun Pembuatan
                                </label>
                                <input
                                    type="number"
                                    name="manufacture_year"
                                    value={data.manufacture_year}
                                    onChange={(e) => setData('manufacture_year', e.target.value)}
                                    placeholder="2024"
                                    min="1900"
                                    max={new Date().getFullYear()}
                                    className={`w-full h-11 px-4 rounded-xl border ${
                                        errors.manufacture_year
                                            ? 'border-danger-500 focus:ring-danger-500/20'
                                            : 'border-slate-200 dark:border-slate-700 focus:ring-primary-500/20'
                                    } bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-4 focus:border-primary-500 transition-all`}
                                />
                                {errors.manufacture_year && (
                                    <p className="mt-1 text-xs text-danger-500">{errors.manufacture_year}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                    Nomor Pendaftaran
                                </label>
                                <input
                                    type="text"
                                    name="registration_number"
                                    value={data.registration_number}
                                    onChange={(e) => setData('registration_number', e.target.value)}
                                    placeholder="Nomor STNK"
                                    className={`w-full h-11 px-4 rounded-xl border ${
                                        errors.registration_number
                                            ? 'border-danger-500 focus:ring-danger-500/20'
                                            : 'border-slate-200 dark:border-slate-700 focus:ring-primary-500/20'
                                    } bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-4 focus:border-primary-500 transition-all`}
                                />
                                {errors.registration_number && (
                                    <p className="mt-1 text-xs text-danger-500">{errors.registration_number}</p>
                                )}
                            </div>
                        </div>

                        {/* Registration Date & STNK Expiry Date Row */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                    Tanggal Pendaftaran
                                </label>
                                <input
                                    type="date"
                                    name="registration_date"
                                    value={data.registration_date}
                                    onChange={(e) => setData('registration_date', e.target.value)}
                                    className={`w-full h-11 px-4 rounded-xl border ${
                                        errors.registration_date
                                            ? 'border-danger-500 focus:ring-danger-500/20'
                                            : 'border-slate-200 dark:border-slate-700 focus:ring-primary-500/20'
                                    } bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-4 focus:border-primary-500 transition-all`}
                                />
                                {errors.registration_date && (
                                    <p className="mt-1 text-xs text-danger-500">{errors.registration_date}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                    Tanggal Kadaluarsa STNK
                                </label>
                                <input
                                    type="date"
                                    name="stnk_expiry_date"
                                    value={data.stnk_expiry_date}
                                    onChange={(e) => setData('stnk_expiry_date', e.target.value)}
                                    className={`w-full h-11 px-4 rounded-xl border ${
                                        errors.stnk_expiry_date
                                            ? 'border-danger-500 focus:ring-danger-500/20'
                                            : 'border-slate-200 dark:border-slate-700 focus:ring-primary-500/20'
                                    } bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-4 focus:border-primary-500 transition-all`}
                                />
                                {errors.stnk_expiry_date && (
                                    <p className="mt-1 text-xs text-danger-500">{errors.stnk_expiry_date}</p>
                                )}
                            </div>
                        </div>

                        {/* Previous Owner */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                Pemilik Sebelumnya
                            </label>
                            <input
                                type="text"
                                name="previous_owner"
                                value={data.previous_owner}
                                onChange={(e) => setData('previous_owner', e.target.value)}
                                placeholder="Nama pemilik sebelumnya (jika ada)"
                                className={`w-full h-11 px-4 rounded-xl border ${
                                    errors.previous_owner
                                        ? 'border-danger-500 focus:ring-danger-500/20'
                                        : 'border-slate-200 dark:border-slate-700 focus:ring-primary-500/20'
                                } bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-4 focus:border-primary-500 transition-all`}
                            />
                            {errors.previous_owner && (
                                <p className="mt-1 text-xs text-danger-500">{errors.previous_owner}</p>
                            )}
                        </div>
                    </div>

                    {/* Catatan Section */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-700">
                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                                Catatan Tambahan
                            </h4>
                        </div>

                        {/* Notes */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                Catatan
                            </label>
                            <textarea
                                name="notes"
                                value={data.notes}
                                onChange={(e) => setData('notes', e.target.value)}
                                placeholder="Catatan tambahan tentang kendaraan..."
                                rows={3}
                                className={`w-full px-4 py-3 rounded-xl border ${
                                    errors.notes
                                        ? 'border-danger-500 focus:ring-danger-500/20'
                                        : 'border-slate-200 dark:border-slate-700 focus:ring-primary-500/20'
                                } bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-4 focus:border-primary-500 transition-all resize-none`}
                            />
                            {errors.notes && (
                                <p className="mt-1 text-xs text-danger-500">{errors.notes}</p>
                            )}
                        </div>
                    </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 p-6 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex-shrink-0">
                        <button
                            type="button"
                            onClick={handleClose}
                            className="flex-1 h-11 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={processing}
                            className="flex-1 h-11 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                        >
                            {processing ? (
                                <>
                                    <IconLoader2
                                        size={18}
                                        className="animate-spin"
                                    />
                                    Menyimpan...
                                </>
                            ) : (
                                <>
                                    <IconCheck size={18} />
                                    Simpan
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
