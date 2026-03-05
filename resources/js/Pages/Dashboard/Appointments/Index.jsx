import React, { useState, useEffect } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import DashboardLayout from '@/Layouts/DashboardLayout';
import Pagination from '@/Components/Dashboard/Pagination';
import {
    IconCalendar,
    IconClock,
    IconUser,
    IconCar,
    IconTool,
    IconCheck,
    IconX,
    IconTrash,
    IconFileExport,
    IconSearch,
    IconPencil,
    IconLayoutGrid,
    IconList,
} from '@tabler/icons-react';
import { toDisplayDate, toDisplayTime, isPast as isPastDate } from '@/Utils/datetime';

const statusConfig = {
    scheduled: {
        label: 'Terjadwal',
        color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        icon: IconClock,
    },
    confirmed: {
        label: 'Dikonfirmasi',
        color: 'bg-blue-100 text-blue-800 border-blue-200',
        icon: IconCheck,
    },
    completed: {
        label: 'Selesai',
        color: 'bg-green-100 text-green-800 border-green-200',
        icon: IconCheck,
    },
    cancelled: {
        label: 'Dibatalkan',
        color: 'bg-red-100 text-red-800 border-red-200',
        icon: IconX,
    },
};

export default function Index({ appointments }) {
    const [statusFilter, setStatusFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState('grid');
    const [liveAppointments, setLiveAppointments] = useState(appointments?.data || []);

    const totalAppointments = liveAppointments?.length || 0;

    // Real-time listener for appointments
    useEffect(() => {
        if (!window.Echo) {
            console.warn('Echo not available - real-time updates disabled');
            return;
        }

        const channel = window.Echo.channel('workshop.appointments');

        channel.listen('.appointment.created', (event) => {
            console.log('Appointment created event received:', event);
            const incomingAppointment = event?.appointment;

            if (!incomingAppointment?.id) {
                console.warn('Invalid appointment data received');
                return;
            }

            setLiveAppointments(prev => {
                const exists = prev.some(a => a.id === incomingAppointment.id);
                if (exists) {
                    console.log('Appointment already in list, skipping');
                    return prev;
                }
                console.log('Adding new appointment:', incomingAppointment.id);
                return [incomingAppointment, ...prev];
            });
        });

        channel.listen('.appointment.deleted', (event) => {
            console.log('Appointment deleted event received:', event);
            const deletedAppointmentId = event?.appointmentId;

            if (!deletedAppointmentId) {
                console.warn('Invalid appointment ID received');
                return;
            }

            setLiveAppointments(prev => {
                const filtered = prev.filter(a => a.id !== deletedAppointmentId);
                console.log('Removed appointment with ID:', deletedAppointmentId);
                return filtered;
            });
        });

        channel.listen('.appointment.updated', (event) => {
            console.log('Appointment updated event received:', event);
            const updatedAppointment = event?.appointment;

            if (!updatedAppointment?.id) {
                console.warn('Invalid appointment data received');
                return;
            }

            setLiveAppointments(prev => {
                const index = prev.findIndex(a => a.id === updatedAppointment.id);
                if (index === -1) {
                    console.log('Appointment not found in list, skipping update');
                    return prev;
                }
                const updated = [...prev];
                updated[index] = updatedAppointment;
                console.log('Updated appointment:', updatedAppointment.id);
                return updated;
            });
        });

        return () => {
            window.Echo.leaveChannel('workshop.appointments');
        };
    }, []);

    const handleStatusChange = (appointmentId, newStatus) => {
        if (confirm(`Ubah status appointment menjadi ${statusConfig[newStatus].label}?`)) {
            router.patch(route('appointments.updateStatus', appointmentId), { status: newStatus }, { preserveScroll: true });
        }
    };

    const handleDelete = (appointmentId) => {
        if (confirm('Yakin ingin membatalkan appointment ini?')) {
            router.delete(route('appointments.destroy', appointmentId), { preserveScroll: true });
        }
    };

    const handleExport = (appointmentId) => {
        window.location.href = route('appointments.export', appointmentId);
    };

    const filteredAppointments = liveAppointments?.filter((apt) => {
        const matchesStatus = statusFilter === 'all' || apt.status === statusFilter;
        const matchesSearch = !searchQuery ||
            apt.customer?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            apt.mechanic?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            apt.vehicle?.plate_number?.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesStatus && matchesSearch;
    });

    return (
        <>
            <Head title="Daftar Appointment" />

            <div className="space-y-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Daftar Appointment</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{totalAppointments} appointment terdaftar</p>
                    </div>
                    <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 w-full lg:w-auto">
                        <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1 self-start">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-primary-500 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                title="Card View"
                            >
                                <IconLayoutGrid size={18} />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-primary-500 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                title="List View"
                            >
                                <IconList size={18} />
                            </button>
                        </div>
                        <div className="flex-1 md:w-72 relative">
                            <IconSearch size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Cari pelanggan, mekanik, atau nomor plat..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200"
                            >
                                <option value="all">Semua Status</option>
                                {Object.entries(statusConfig).map(([key, { label }]) => (
                                    <option key={key} value={key}>{label}</option>
                                ))}
                            </select>
                            <Link
                                href={route('appointments.calendar')}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 transition-colors"
                            >
                                <IconCalendar size={18} />
                                Lihat Kalender
                            </Link>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    {filteredAppointments?.length ? (
                        <>
                            {viewMode === 'grid' ? (
                                <div className="grid grid-cols-1 gap-4">
                                    {filteredAppointments.map((apt) => {
                                        const StatusIcon = statusConfig[apt.status]?.icon || IconClock;
                                        const isPast = isPastDate(apt.scheduled_at);

                                        return (
                                            <div key={apt.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                                                <div className="flex flex-col lg:flex-row gap-4">
                                                    {/* Left: Date & Time */}
                                                    <div className="lg:w-48 flex flex-col items-start lg:items-center lg:justify-center lg:border-r lg:pr-4 border-slate-100 dark:border-slate-800">
                                                        <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                                                            <IconCalendar size={16} />
                                                            {toDisplayDate(apt.scheduled_at)}
                                                        </div>
                                                        <div className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
                                                            <IconClock size={20} />
                                                            {toDisplayTime(apt.scheduled_at) || '00:00'}
                                                        </div>
                                                        {isPast && apt.status !== 'completed' && apt.status !== 'cancelled' && (
                                                            <span className="text-xs text-danger-600 mt-1">Lewat waktu</span>
                                                        )}
                                                    </div>

                                                    {/* Middle: Details */}
                                                    <div className="flex-1 space-y-3">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="space-y-2">
                                                                <div className="flex items-center gap-2">
                                                                    <IconUser size={18} className="text-slate-400" />
                                                                    <span className="font-semibold text-slate-900 dark:text-white">
                                                                        {apt.customer?.name || 'Belum dipilih'}
                                                                    </span>
                                                                </div>

                                                                {apt.vehicle && (
                                                                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                                                        <IconCar size={18} className="text-slate-400" />
                                                                        <span>{apt.vehicle.plate_number}</span>
                                                                        <span className="text-slate-400">•</span>
                                                                        <span>{apt.vehicle.brand} {apt.vehicle.model}</span>
                                                                    </div>
                                                                )}

                                                                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                                                    <IconTool size={18} className="text-slate-400" />
                                                                    <span>Mekanik: <span className="font-medium">{apt.mechanic?.name || '-'}</span></span>
                                                                    {apt.mechanic?.specialty && (
                                                                        <>
                                                                            <span className="text-slate-400">•</span>
                                                                            <span className="text-xs">{apt.mechanic.specialty}</span>
                                                                        </>
                                                                    )}
                                                                </div>

                                                                {apt.notes && (
                                                                    <div className="text-sm text-slate-500 italic mt-2 pl-6">
                                                                        "{apt.notes}"
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border ${statusConfig[apt.status]?.color}`}>
                                                                <StatusIcon size={16} />
                                                                {statusConfig[apt.status]?.label}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Right: Actions */}
                                                    <div className="lg:w-48 flex lg:flex-col gap-2">
                                                        {apt.status === 'scheduled' && (
                                                            <button
                                                                onClick={() => handleStatusChange(apt.id, 'confirmed')}
                                                                className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-1"
                                                            >
                                                                <IconCheck size={16} />
                                                                Konfirmasi
                                                            </button>
                                                        )}
                                                        {apt.status === 'confirmed' && (
                                                            <button
                                                                onClick={() => handleStatusChange(apt.id, 'completed')}
                                                                className="flex-1 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-1"
                                                            >
                                                                <IconCheck size={16} />
                                                                Selesai
                                                            </button>
                                                        )}
                                                        {(apt.status === 'scheduled' || apt.status === 'confirmed') && (
                                                            <button
                                                                onClick={() => handleStatusChange(apt.id, 'cancelled')}
                                                                className="flex-1 px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center gap-1"
                                                            >
                                                                <IconX size={16} />
                                                                Batal
                                                            </button>
                                                        )}

                                                        <button
                                                            onClick={() => handleExport(apt.id)}
                                                            className="flex-1 px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center gap-1"
                                                            title="Export ke Kalender"
                                                        >
                                                            <IconFileExport size={16} />
                                                            ICS
                                                        </button>

                                                        {apt.status !== 'completed' && apt.status !== 'cancelled' && (
                                                            <Link
                                                                href={route('appointments.edit', apt.id)}
                                                                className="flex-1 px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center gap-1"
                                                            >
                                                                <IconPencil size={16} />
                                                                Edit
                                                            </Link>
                                                        )}

                                                        <button
                                                            onClick={() => handleDelete(apt.id)}
                                                            className="flex-1 px-3 py-2 text-sm border border-danger-200 text-danger-600 rounded-lg hover:bg-danger-50 dark:border-danger-900/40 dark:hover:bg-danger-900/20 flex items-center justify-center gap-1"
                                                        >
                                                            <IconTrash size={16} />
                                                            Hapus
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead className="bg-slate-50 dark:bg-slate-800/50">
                                                <tr>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Jadwal</th>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Pelanggan</th>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Kendaraan</th>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Mekanik</th>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Status</th>
                                                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Aksi</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                {filteredAppointments.map((apt) => {
                                                    const StatusIcon = statusConfig[apt.status]?.icon || IconClock;
                                                    const isPast = isPastDate(apt.scheduled_at);
                                                    return (
                                                        <tr key={apt.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                                            <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                                                                <div className="flex items-center gap-2">
                                                                    <IconCalendar size={16} className="text-slate-400" />
                                                                    <span>{toDisplayDate(apt.scheduled_at)}</span>
                                                                </div>
                                                                <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                                                                    <IconClock size={14} className="text-slate-400" />
                                                                    <span>{toDisplayTime(apt.scheduled_at) || '00:00'}</span>
                                                                    {isPast && apt.status !== 'completed' && apt.status !== 'cancelled' && (
                                                                        <span className="ml-1 text-danger-500">Lewat waktu</span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white">{apt.customer?.name || '-'}</td>
                                                            <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                                                                {apt.vehicle ? (
                                                                    <div className="space-y-0.5">
                                                                        <div>{apt.vehicle.plate_number}</div>
                                                                        <div className="text-xs text-slate-500 dark:text-slate-500">{apt.vehicle.brand} {apt.vehicle.model}</div>
                                                                    </div>
                                                                ) : '-'}
                                                            </td>
                                                            <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{apt.mechanic?.name || '-'}</td>
                                                            <td className="px-4 py-3 text-sm">
                                                                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${statusConfig[apt.status]?.color}`}>
                                                                    <StatusIcon size={14} />
                                                                    {statusConfig[apt.status]?.label}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 text-center">
                                                                <div className="flex items-center justify-center gap-2">
                                                                    {apt.status === 'scheduled' && (
                                                                        <button onClick={() => handleStatusChange(apt.id, 'confirmed')} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50">
                                                                            <IconCheck size={14} /> Konfirmasi
                                                                        </button>
                                                                    )}
                                                                    {apt.status === 'confirmed' && (
                                                                        <button onClick={() => handleStatusChange(apt.id, 'completed')} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50">
                                                                            <IconCheck size={14} /> Selesai
                                                                        </button>
                                                                    )}
                                                                    {(apt.status === 'scheduled' || apt.status === 'confirmed') && (
                                                                        <button onClick={() => handleStatusChange(apt.id, 'cancelled')} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800/40 dark:text-slate-200 dark:hover:bg-slate-800">
                                                                            <IconX size={14} /> Batal
                                                                        </button>
                                                                    )}
                                                                    <button onClick={() => handleExport(apt.id)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800/40 dark:text-slate-200 dark:hover:bg-slate-800">
                                                                        <IconFileExport size={14} /> ICS
                                                                    </button>
                                                                    {apt.status !== 'completed' && apt.status !== 'cancelled' && (
                                                                        <Link href={route('appointments.edit', apt.id)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800/40 dark:text-slate-200 dark:hover:bg-slate-800">
                                                                            <IconPencil size={14} /> Edit
                                                                        </Link>
                                                                    )}
                                                                    <button onClick={() => handleDelete(apt.id)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-danger-50 text-danger-700 hover:bg-danger-100 dark:bg-danger-900/30 dark:text-danger-300 dark:hover:bg-danger-900/50">
                                                                        <IconTrash size={14} /> Hapus
                                                                    </button>
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

                            {appointments.last_page > 1 && <Pagination links={appointments.links} />}
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                                <IconCalendar size={28} className="text-slate-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-2">Belum ada appointment</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Coba ubah filter atau buat appointment baru.</p>
                            <Link
                                href={route('appointments.calendar')}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 transition-colors"
                            >
                                <IconCalendar size={18} />
                                Lihat Kalender
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

Index.layout = (page) => <DashboardLayout children={page} />;
