import React, { useState, useEffect } from 'react';
import { Head, router, Link } from '@inertiajs/react';
import DashboardLayout from '@/Layouts/DashboardLayout';
import Pagination from '@/Components/Dashboard/Pagination';
import { IconFilter, IconSearch, IconX, IconCirclePlus, IconEye, IconDatabaseOff } from '@tabler/icons-react';
import { toDisplayDate } from '@/Utils/datetime';

const defaultFilters = { q: '', customer_id: '', status: '', date_from: '', date_to: '' };

const statusColors = {
    pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    confirmed: 'bg-blue-100 text-blue-700 border-blue-200',
    fulfilled: 'bg-green-100 text-green-700 border-green-200',
    cancelled: 'bg-red-100 text-red-700 border-red-200',
};

const statusLabels = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    fulfilled: 'Fulfilled',
    cancelled: 'Cancelled',
};

export default function Index({ orders, customers, filters }) {
    const [filterData, setFilterData] = useState({
        ...defaultFilters,
        ...(typeof filters !== 'undefined' ? filters : {}),
    });
    const [showFilters, setShowFilters] = useState(false);
    const [liveItems, setLiveItems] = useState(orders.data || []);

    useEffect(() => {
        setFilterData({
            ...defaultFilters,
            ...(typeof filters !== 'undefined' ? filters : {}),
        });
    }, [filters]);

    useEffect(() => {
        setLiveItems(orders.data || []);
    }, [orders.data]);

    useEffect(() => {
        const channel = window.Echo.channel('workshop.partsalesorders');
        
        channel.listen('.partsalesorder.created', (data) => {
            setLiveItems((prevItems) => [data.order, ...prevItems]);
        });

        return () => {
            window.Echo.leaveChannel('workshop.partsalesorders');
        };
    }, []);

    const handleChange = (field, value) => {
        setFilterData((prev) => ({ ...prev, [field]: value }));
    };

    const applyFilters = (event) => {
        event.preventDefault();
        router.get(route('part-sales-orders.index'), filterData, {
            preserveScroll: true,
            preserveState: true
        });
        setShowFilters(false);
    };

    const resetFilters = () => {
        setFilterData(defaultFilters);
        router.get(route('part-sales-orders.index'), defaultFilters, {
            preserveScroll: true,
            preserveState: true,
            replace: true
        });
    };

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
        }).format(value);
    };

    const formatDate = (dateString) => (dateString ? toDisplayDate(dateString) : '-');

    const hasActiveFilters = filterData.q || filterData.customer_id || filterData.status || filterData.date_from || filterData.date_to;

    return (
        <>
            <Head title="Part Sales Orders" />
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Part Sales Orders</h1>
                        <p className="text-sm text-slate-500">{liveItems.length} orders</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                                showFilters || hasActiveFilters
                                    ? "bg-primary-50 border-primary-200 text-primary-700"
                                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                            }`}
                        >
                            <IconFilter size={18} />
                            <span>Filter</span>
                            {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-primary-500"></span>}
                        </button>
                        <Link
                            href={route('part-sales-orders.create')}
                            className="px-4 py-2 rounded-xl bg-primary-500 text-white inline-flex items-center gap-2 hover:bg-primary-600 transition-colors"
                        >
                            <IconCirclePlus size={16} />
                            <span>New Order</span>
                        </Link>
                    </div>
                </div>

                {/* Filters Panel */}
                {showFilters && (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 mb-4 animate-slide-up">
                        <form onSubmit={applyFilters}>
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Search</label>
                                    <input
                                        type="text"
                                        placeholder="Order number, notes..."
                                        value={filterData.q}
                                        onChange={(e) => handleChange('q', e.target.value)}
                                        className="w-full h-11 px-4 rounded-xl border"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Customer</label>
                                    <select
                                        value={filterData.customer_id}
                                        onChange={(e) => handleChange('customer_id', e.target.value)}
                                        className="w-full h-11 px-4 rounded-xl border"
                                    >
                                        <option value="">All Customers</option>
                                        {customers.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Status</label>
                                    <select
                                        value={filterData.status}
                                        onChange={(e) => handleChange('status', e.target.value)}
                                        className="w-full h-11 px-4 rounded-xl border"
                                    >
                                        <option value="">All Status</option>
                                        <option value="pending">Pending</option>
                                        <option value="confirmed">Confirmed</option>
                                        <option value="fulfilled">Fulfilled</option>
                                        <option value="cancelled">Cancelled</option>
                                    </select>
                                </div>
                                <div className="flex items-end gap-2">
                                    <button
                                        type="submit"
                                        className="flex-1 h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-medium transition-colors"
                                    >
                                        <IconSearch size={18} />
                                        <span>Search</span>
                                    </button>
                                    {hasActiveFilters && (
                                        <button
                                            type="button"
                                            onClick={resetFilters}
                                            className="h-11 px-4 inline-flex items-center justify-center gap-2 rounded-xl border hover:bg-slate-50 transition-colors"
                                        >
                                            <IconX size={18} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </form>
                    </div>
                )}

                {/* Orders List */}
                {liveItems && liveItems.length > 0 ? (
                    <>
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-slate-100 dark:border-slate-800">
                                            <th className="px-4 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">No</th>
                                            <th className="px-4 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Order Number</th>
                                            <th className="px-4 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Customer</th>
                                            <th className="px-4 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Date</th>
                                            <th className="px-4 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Items</th>
                                            <th className="px-4 py-4 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total</th>
                                            <th className="px-4 py-4 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                                            <th className="px-4 py-4 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {liveItems.map((o, idx) => (
                                            <tr key={o.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-400">
                                                    {idx + 1 + ((orders.current_page || 1) - 1) * (orders.per_page || orders.data.length)}
                                                </td>
                                                <td className="px-4 py-4">
                                                    <div className="text-sm font-semibold text-slate-900 dark:text-white">{o.order_number}</div>
                                                    {o.notes && <div className="text-xs text-slate-400 mt-1">{o.notes}</div>}
                                                </td>
                                                <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-400">
                                                    {o.customer?.name || '-'}
                                                </td>
                                                <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-400">
                                                    {formatDate(o.order_date)}
                                                </td>
                                                <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-400">
                                                    {o.details?.length || 0} items
                                                </td>
                                                <td className="px-4 py-4 text-sm text-right font-semibold text-slate-900 dark:text-white">
                                                    {formatCurrency(o.total_amount)}
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border ${statusColors[o.status] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                                                        {statusLabels[o.status] || o.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <Link
                                                        href={route('part-sales-orders.show', o.id)}
                                                        className="inline-flex items-center justify-center gap-1 px-3 py-1 rounded-md text-sm text-primary-600 hover:bg-primary-50 transition-colors"
                                                    >
                                                        <IconEye size={16} />
                                                        <span>View</span>
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <Pagination links={orders.links} />
                    </>
                ) : (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center">
                        <IconDatabaseOff size={48} className="mx-auto text-slate-300 mb-4" />
                        <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">No sales orders found</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                            {hasActiveFilters ? 'Try adjusting your filters' : 'Create your first sales order'}
                        </p>
                        {!hasActiveFilters && (
                            <Link
                                href={route('part-sales-orders.create')}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-500 text-white hover:bg-primary-600 transition-colors"
                            >
                                <IconCirclePlus size={16} />
                                <span>New Sales Order</span>
                            </Link>
                        )}
                    </div>
                )}
        </>
    );
}

Index.layout = (page) => <DashboardLayout children={page} />;
