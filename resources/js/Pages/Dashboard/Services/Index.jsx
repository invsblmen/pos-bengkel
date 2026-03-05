import React, { useState, useEffect } from 'react';
import { Head, Link } from '@inertiajs/react';
import DashboardLayout from '@/Layouts/DashboardLayout';
import Button from '@/Components/Dashboard/Button';
import Search from '@/Components/Dashboard/Search';
import Pagination from '@/Components/Dashboard/Pagination';
import {
    IconCirclePlus, IconPencilCog, IconTrash, IconDatabaseOff,
    IconLayoutGrid, IconList, IconClock, IconCurrencyDollar
} from '@tabler/icons-react';

const formatCurrency = (value = 0) =>
    new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(value);

const complexityBadge = {
    simple: { class: 'bg-success-100 text-success-700 dark:bg-success-900 dark:text-success-300', label: 'Sederhana' },
    medium: { class: 'bg-warning-100 text-warning-700 dark:bg-warning-900 dark:text-warning-300', label: 'Menengah' },
    complex: { class: 'bg-danger-100 text-danger-700 dark:bg-danger-900 dark:text-danger-300', label: 'Kompleks' },
};

const statusBadge = {
    active: { class: 'bg-success-100 text-success-700 dark:bg-success-900 dark:text-success-300', label: 'Aktif' },
    inactive: { class: 'bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300', label: 'Nonaktif' },
};

// Service Card for Grid View
function ServiceCard({ service }) {
    const complexity = complexityBadge[service.complexity_level] || complexityBadge.simple;
    const status = statusBadge[service.status] || statusBadge.active;

    return (
        <div className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-2">
                    <span className="px-2.5 py-1 text-xs font-medium bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-400 rounded-md inline-flex items-center gap-1">
                        <span>{service.category?.icon || '🔧'}</span>
                        <span>{service.category?.name || 'Uncategorized'}</span>
                    </span>
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${status.class}`}>
                        {status.label}
                    </span>
                </div>
                <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${complexity.class}`}>
                    {complexity.label}
                </span>
            </div>
            <div className="p-4">
                <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-1 line-clamp-2">{service.name}</h3>
                {service.description && <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-3">{service.description}</p>}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 mb-3">
                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                        <IconClock size={16} />
                        <span className="text-sm font-medium">{service.duration} menit</span>
                    </div>
                    <div className="text-right">
                        <p className="text-base font-bold text-primary-600 dark:text-primary-400">{formatCurrency(service.price)}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Link href={route('services.edit', service.id)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-warning-100 text-warning-600 hover:bg-warning-200 dark:bg-warning-900/50 dark:text-warning-400 text-sm font-medium transition-colors">
                        <IconPencilCog size={16} /> <span>Edit</span>
                    </Link>
                    <Button type="delete" icon={<IconTrash size={16} />} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-danger-100 text-danger-600 hover:bg-danger-200 dark:bg-danger-900/50 dark:text-danger-400 text-sm font-medium" url={route('services.destroy', service.id)} label="Hapus" />
                </div>
            </div>
        </div>
    );
}

function Index({ services }) {
    const [viewMode, setViewMode] = useState('grid');
    const [liveServices, setLiveServices] = useState(services?.data || []);

    // Real-time listener for new services
    useEffect(() => {
        if (!window.Echo) {
            console.warn('Echo not available - real-time updates disabled');
            return;
        }

        const channel = window.Echo.channel('workshop.services');

        channel.listen('.service.created', (event) => {
            console.log('Service created event received:', event);
            const incomingService = event?.service;

            if (!incomingService?.id) {
                console.warn('Invalid service data received');
                return;
            }

            // Add new service to the list if not already exists
            setLiveServices(prev => {
                const exists = prev.some(s => s.id === incomingService.id);
                if (exists) {
                    console.log('Service already in list, skipping');
                    return prev;
                }
                console.log('Adding new service to list:', incomingService.name);
                return [incomingService, ...prev];
            });
        });

        channel.listen('.service.deleted', (event) => {
            console.log('Service deleted event received:', event);
            const deletedServiceId = event?.serviceId;

            if (!deletedServiceId) {
                console.warn('Invalid service ID received');
                return;
            }

            // Remove service from the list
            setLiveServices(prev => {
                const filtered = prev.filter(s => s.id !== deletedServiceId);
                console.log('Removed service with ID:', deletedServiceId);
                return filtered;
            });
        });

        channel.listen('.service.updated', (event) => {
            console.log('Service updated event received:', event);
            const updatedService = event?.service;

            if (!updatedService?.id) {
                console.warn('Invalid service data received');
                return;
            }

            // Update service in the list
            setLiveServices(prev => {
                const index = prev.findIndex(s => s.id === updatedService.id);
                if (index === -1) {
                    console.log('Service not found in list, skipping update');
                    return prev;
                }
                const updated = [...prev];
                updated[index] = updatedService;
                console.log('Updated service:', updatedService.name);
                return updated;
            });
        });

        return () => {
            window.Echo.leaveChannel('workshop.services');
        };
    }, []);

    return (
        <>
            <Head title="Daftar Layanan" />

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Daftar Layanan Bengkel</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{liveServices?.length || 0} layanan tersedia</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-primary-500 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                title="Grid View"
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
                        <Search route={route('services.index')} />
                        <Button type="link" href={route('services.create')} icon={<IconCirclePlus size={18} />} label="Tambah Layanan" />
                    </div>
                </div>

                {liveServices && liveServices.length > 0 ? (
                    <>
                        {viewMode === 'grid' ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {liveServices.map((service) => (
                                    <ServiceCard key={service.id} service={service} />
                                ))}
                            </div>
                        ) : (
                            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                                                <th className="px-4 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">No</th>
                                                <th className="px-4 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Nama Layanan</th>
                                                <th className="px-4 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Kategori</th>
                                                <th className="px-4 py-4 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Harga</th>
                                                <th className="px-4 py-4 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Durasi</th>
                                                <th className="px-4 py-4 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Kompleksitas</th>
                                                <th className="px-4 py-4 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                                                <th className="px-4 py-4 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {liveServices.map((service, idx) => {
                                                const complexity = complexityBadge[service.complexity_level] || complexityBadge.simple;
                                                const status = statusBadge[service.status] || statusBadge.active;

                                                return (
                                                    <tr key={service.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                        <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-400">{idx + 1 + ((services.current_page || 1) - 1) * (services.per_page || liveServices.length)}</td>
                                                        <td className="px-4 py-4">
                                                            <div className="text-sm font-semibold text-slate-900 dark:text-white">{service.name}</div>
                                                            {service.description && <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">{service.description}</div>}
                                                        </td>
                                                        <td className="px-4 py-4 whitespace-nowrap">
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-400 rounded-full">
                                                                <span>{service.category?.icon || '🔧'}</span>
                                                                <span>{service.category?.name || '-'}</span>
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-4 text-center text-sm font-semibold text-slate-900 dark:text-white">{formatCurrency(service.price)}</td>
                                                        <td className="px-4 py-4 text-center text-sm text-slate-600 dark:text-slate-400">{service.duration} menit</td>
                                                        <td className="px-4 py-4 text-center">
                                                            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${complexity.class}`}>
                                                                {complexity.label}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-4 text-center">
                                                            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${status.class}`}>
                                                                {status.label}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-4 text-center">
                                                            <div className="flex items-center justify-center gap-1">
                                                                <Link href={route('services.edit', service.id)} className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-medium text-warning-700 bg-warning-50 hover:bg-warning-100 dark:bg-warning-900/30 dark:text-warning-300 dark:hover:bg-warning-900/50 transition-colors">
                                                                    <IconPencilCog size={14} className="mr-1" /> Edit
                                                                </Link>
                                                                <Button type="delete" icon={<IconTrash size={14} />} className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-medium text-danger-700 bg-danger-50 hover:bg-danger-100 dark:bg-danger-900/30 dark:text-danger-300 dark:hover:bg-danger-900/50" url={route('services.destroy', service.id)} label="Hapus" />
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
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                        <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                            <IconDatabaseOff size={32} className="text-slate-400" strokeWidth={1.5} />
                        </div>
                        <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-1">Belum Ada Layanan</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Layanan bengkel akan muncul di sini setelah dibuat.</p>
                        <Button type="link" href={route('services.create')} icon={<IconCirclePlus size={18} />} label="Tambah Layanan Pertama" />
                    </div>
                )}

            {services.last_page > 1 && <Pagination links={services.links} />}
        </>
    );
}

Index.layout = (page) => <DashboardLayout children={page} />;

export default Index;
