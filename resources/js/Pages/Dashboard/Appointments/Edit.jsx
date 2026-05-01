import React, { useState, useEffect } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import toast from 'react-hot-toast';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Card, CardBody, CardHeader, CardTitle } from '@/Components/Card';
import {
    IconArrowLeft,
    IconSearch,
    IconCalendar,
    IconClock,
    IconUser,
    IconTool,
} from '@tabler/icons-react';
import { toDisplayDateLong, toDisplayTime, toInputValue } from '@/Utils/datetime';

export default function Edit({ appointment, mechanics }) {
    const [formData, setFormData] = useState({
        customer_id: appointment.customer_id || '',
        vehicle_id: appointment.vehicle_id || '',
        mechanic_id: appointment.mechanic_id,
        scheduled_at: appointment.scheduled_at,
        notes: appointment.notes || '',
    });

    const [customerQuery, setCustomerQuery] = useState('');
    const [customerResults, setCustomerResults] = useState([]);
    const [customerLoading, setCustomerLoading] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(appointment.customer || null);
    const [availableSlots, setAvailableSlots] = useState([]);
    const [availableSlotsLoading, setAvailableSlotsLoading] = useState(false);
    const [errors, setErrors] = useState({});

    // Format date for datetime-local input (preserve server time, no timezone conversion)
    const formatDateForInput = (dateStr) => {
        // Parse as-is without timezone conversion
        if (!dateStr) return '';
        // If already in correct format, return it
        if (dateStr.includes('T') && dateStr.length >= 16) {
            return dateStr.substring(0, 16);
        }
        // Otherwise parse and format (assumes server sends in local timezone)
        return dateStr.replace(' ', 'T').substring(0, 16);
    };

    const [scheduledAtInput, setScheduledAtInput] = useState(toInputValue(appointment.scheduled_at));

    useEffect(() => {
        setFormData({
            customer_id: appointment.customer_id || '',
            vehicle_id: appointment.vehicle_id || '',
            mechanic_id: appointment.mechanic_id,
            scheduled_at: appointment.scheduled_at,
            notes: appointment.notes || '',
        });
        setSelectedCustomer(appointment.customer || null);
        setScheduledAtInput(toInputValue(appointment.scheduled_at));
    }, [appointment]);

    // Fetch available slots when mechanic or date changes
    useEffect(() => {
        if (formData.mechanic_id && scheduledAtInput) {
            const date = scheduledAtInput.split('T')[0];
            setAvailableSlotsLoading(true);
            fetch(
                route('appointments.available-slots') +
                `?mechanic_id=${formData.mechanic_id}&date=${date}`
            )
                .then((res) => res.json())
                .then((data) => setAvailableSlots(data.available_slots))
                .catch(() => setAvailableSlots([]))
                .finally(() => setAvailableSlotsLoading(false));
        }
    }, [formData.mechanic_id, scheduledAtInput]);

    const handleCustomerSearch = (q) => {
        setCustomerQuery(q);
        if (q && q.length >= 1) {
            setCustomerLoading(true);
            fetch(route('customers.search') + `?q=${encodeURIComponent(q)}`)
                .then((r) => r.json())
                .then((data) => setCustomerResults(data.data || []))
                .catch(() => setCustomerResults([]))
                .finally(() => setCustomerLoading(false));
        } else {
            setCustomerResults([]);
        }
    };

    const handleSelectCustomer = (customer) => {
        setSelectedCustomer(customer);
        setFormData({ ...formData, customer_id: customer.id });
        setCustomerResults([]);
        setCustomerQuery('');
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setErrors({});

        const submitData = {
            customer_id: selectedCustomer?.id || null,
            vehicle_id: formData.vehicle_id || null,
            mechanic_id: formData.mechanic_id,
            scheduled_at: scheduledAtInput.replace('T', ' ') + ':00',
            notes: formData.notes || null,
        };

        router.put(route('appointments.update', appointment.id), submitData, {
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Appointment diperbarui');
                router.reload();
            },
            onError: (errors) => setErrors(errors),
        });
    };

    return (
        <DashboardLayout>
            <Head title="Edit Appointment" />

            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Link
                        href={route('appointments.index')}
                        className="inline-flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                    >
                        <IconArrowLeft size={20} />
                        Kembali
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold">Edit Appointment</h1>
                        <p className="text-gray-600 dark:text-gray-400">
                            Ubah detail appointment #{appointment.id}
                        </p>
                    </div>
                </div>

                {/* Current Info */}
                <Card>
                    <CardBody>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm text-gray-500 mb-1">Tanggal & Waktu Saat Ini</p>
                                <p className="text-lg font-semibold">{toDisplayDateLong(appointment.scheduled_at)} {toDisplayTime(appointment.scheduled_at)}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500 mb-1">Mekanik Saat Ini</p>
                                <p className="text-lg font-semibold">{appointment.mechanic?.name}</p>
                            </div>
                        </div>
                    </CardBody>
                </Card>

                {/* Form */}
                <Card>
                    <CardHeader>
                        <CardTitle>Edit Detail Appointment</CardTitle>
                    </CardHeader>
                    <CardBody>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Customer */}
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Pelanggan
                                </label>
                                {selectedCustomer ? (
                                    <div className="flex items-center justify-between px-4 py-3 border rounded-lg bg-gray-50 dark:bg-gray-800">
                                        <div className="flex items-center gap-2">
                                            <IconUser size={18} className="text-gray-400" />
                                            <div>
                                                <p className="font-medium">{selectedCustomer.name}</p>
                                                <p className="text-sm text-gray-500">{selectedCustomer.phone}</p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            className="text-sm text-blue-600 hover:underline"
                                            onClick={() => {
                                                setSelectedCustomer(null);
                                                setFormData({ ...formData, customer_id: null });
                                            }}
                                        >
                                            Ganti
                                        </button>
                                    </div>
                                ) : (
                                    <div>
                                        <div className="relative">
                                            <span className="absolute left-3 top-2.5 text-gray-400">
                                                <IconSearch size={16} />
                                            </span>
                                            <input
                                                type="text"
                                                placeholder="Cari nama/telepon..."
                                                value={customerQuery}
                                                onChange={(e) => handleCustomerSearch(e.target.value)}
                                                className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                                            />
                                        </div>
                                        {customerLoading && (
                                            <p className="text-xs text-gray-500 mt-2">Mencari...</p>
                                        )}
                                        {!customerLoading && customerQuery && customerResults.length === 0 && (
                                            <p className="text-xs text-gray-500 mt-2">Tidak ada hasil.</p>
                                        )}
                                        {customerResults.length > 0 && (
                                            <div className="mt-2 max-h-40 overflow-y-auto border rounded-lg divide-y">
                                                {customerResults.map((c) => (
                                                    <button
                                                        type="button"
                                                        key={c.id}
                                                        onClick={() => handleSelectCustomer(c)}
                                                        className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800"
                                                    >
                                                        <p className="font-medium text-sm">{c.name}</p>
                                                        <p className="text-xs text-gray-500">{c.phone}</p>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                                <p className="mt-1 text-xs text-gray-500">Opsional</p>
                            </div>

                            {/* Mechanic */}
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Mekanik <span className="text-red-600">*</span>
                                </label>
                                <div className="flex items-center gap-2">
                                    <IconTool size={18} className="text-gray-400" />
                                    <select
                                        value={formData.mechanic_id}
                                        onChange={(e) => {
                                            setFormData({ ...formData, mechanic_id: e.target.value });
                                            setAvailableSlots([]);
                                        }}
                                        className="flex-1 px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                                    >
                                        {mechanics.map((m) => (
                                            <option key={m.id} value={m.id}>
                                                {m.name} ({m.specialty})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                {errors.mechanic_id && (
                                    <p className="text-xs text-red-600 mt-1">{errors.mechanic_id}</p>
                                )}
                            </div>

                            {/* Date & Time */}
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Tanggal & Waktu <span className="text-red-600">*</span>
                                </label>
                                <div className="flex items-center gap-2">
                                    <IconCalendar size={18} className="text-gray-400" />
                                    <input
                                        type="datetime-local"
                                        value={scheduledAtInput}
                                        onChange={(e) => setScheduledAtInput(e.target.value)}
                                        className="flex-1 px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                                    />
                                </div>
                                {errors.scheduled_at && (
                                    <p className="text-xs text-red-600 mt-1">{errors.scheduled_at}</p>
                                )}
                            </div>

                            {/* Available Slots */}
                            {availableSlotsLoading && (
                                <div className="text-sm text-gray-600">Memuat slot tersedia...</div>
                            )}

                            {!availableSlotsLoading && availableSlots.length > 0 && (
                                <div>
                                    <p className="text-sm text-gray-600 mb-2">Slot tersedia untuk mekanik ini:</p>
                                    <div className="grid grid-cols-3 gap-2">
                                        {availableSlots.map((slot, idx) => (
                                            <button
                                                type="button"
                                                key={idx}
                                                onClick={() => setScheduledAtInput(toInputValue(slot.timestamp))}
                                                className="px-3 py-2 text-sm border rounded hover:bg-blue-50 dark:hover:bg-blue-900"
                                            >
                                                {slot.display}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Notes */}
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Catatan (opsional)
                                </label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    placeholder="Tambahkan catatan atau permintaan khusus..."
                                    rows={4}
                                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                                />
                            </div>

                            {/* Actions */}
                            <div className="flex gap-4 pt-4">
                                <button
                                    type="button"
                                    onClick={() => router.get(route('appointments.index'))}
                                    className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                >
                                    Simpan Perubahan
                                </button>
                            </div>
                        </form>
                    </CardBody>
                </Card>
            </div>
        </DashboardLayout>
    );
}
