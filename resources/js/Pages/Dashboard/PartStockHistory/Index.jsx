import React, { useState, useEffect } from 'react';
import { Head, router, Link } from '@inertiajs/react';
import DashboardLayout from '@/Layouts/DashboardLayout';
import Pagination from '@/Components/Dashboard/Pagination';
import { IconFilter, IconArrowUp, IconArrowDown, IconDatabaseOff, IconDownload } from '@tabler/icons-react';
import { toDisplayDateTime, dateToLocalDateInput } from '@/Utils/datetime';

const defaultFilters = { q: '', part_id: '', type: '', date_from: '', date_to: '' };

const typeColors = {
    purchase_received: 'bg-green-100 text-green-700',
    purchase_order_received: 'bg-green-100 text-green-700',
    sales_order: 'bg-red-100 text-red-700',
    purchase_reversal: 'bg-orange-100 text-orange-700',
    purchase_order_reversal: 'bg-orange-100 text-orange-700',
    sales_order_reversal: 'bg-blue-100 text-blue-700',
    adjustment: 'bg-purple-100 text-purple-700',
    stock_in: 'bg-green-100 text-green-700',
    stock_out: 'bg-red-100 text-red-700',
    in: 'bg-green-100 text-green-700',
    out: 'bg-red-100 text-red-700',
    purchase: 'bg-green-100 text-green-700',
    sale: 'bg-red-100 text-red-700',
};

const typeLabels = {
    purchase_received: 'Purchase Received',
    purchase_order_received: 'PO Received',
    sales_order: 'Sales Order',
    purchase_reversal: 'Purchase Reversal',
    purchase_order_reversal: 'PO Reversal',
    sales_order_reversal: 'SO Reversal',
    adjustment: 'Adjustment',
    stock_in: 'Stock In',
    stock_out: 'Stock Out',
    in: 'Stock In (Manual)',
    out: 'Stock Out (Manual)',
    purchase: 'Part Purchase',
    sale: 'Part Sale',
};

export default function Index({ movements, parts, types, filters }) {
    const [filterData, setFilterData] = useState({
        ...defaultFilters,
        ...(typeof filters !== 'undefined' ? filters : {}),
    });
    const [showFilters, setShowFilters] = useState(false);

    const formatDateInput = (dateObj) => dateToLocalDateInput(dateObj);

    const applyPreset = (days) => {
        const today = new Date();
        const from = new Date();
        from.setDate(today.getDate() - days + 1);
        const next = {
            ...filterData,
            date_from: formatDateInput(from),
            date_to: formatDateInput(today),
        };
        setFilterData(next);
        router.get(route('part-stock-history.index'), next, {
            preserveScroll: true,
            preserveState: true,
            replace: true,
        });
        setShowFilters(false);
    };

    useEffect(() => {
        setFilterData({
            ...defaultFilters,
            ...(typeof filters !== 'undefined' ? filters : {}),
        });
    }, [filters]);

    const handleChange = (field, value) => {
        setFilterData((prev) => ({ ...prev, [field]: value }));
    };

    const applyFilters = (event) => {
        event.preventDefault();
        router.get(route('part-stock-history.index'), filterData, {
            preserveScroll: true,
            preserveState: true
        });
        setShowFilters(false);
    };

    const resetFilters = () => {
        setFilterData(defaultFilters);
        router.get(route('part-stock-history.index'), defaultFilters, {
            preserveScroll: true,
            preserveState: true,
            replace: true
        });
    };

    const formatDate = (dateString) => (dateString ? toDisplayDateTime(dateString) : '-');

    const hasActiveFilters = filterData.q || filterData.part_id || filterData.type || filterData.date_from || filterData.date_to;

    const getReferenceLabel = (m) => {
        if (!m?.reference) return null;
        if (m.reference.purchase_number) return m.reference.purchase_number;
        if (m.reference.order_number) return m.reference.order_number;
        if (m.reference.po_number) return m.reference.po_number;
        if (m.reference.invoice) return m.reference.invoice;
        return null;
    };

    const getReferenceLink = (m) => {
        switch (m.reference_type) {
            case 'App\\Models\\PartPurchase':
                return route('part-purchases.show', m.reference_id);
            // Part Sales Orders and Part Purchase Orders are disabled
            // case 'App\\Models\\PartSalesOrder':
            //     return route('part-sales-orders.show', m.reference_id);
            // case 'App\\Models\\PartPurchaseOrder':
            //     return route('part-purchase-orders.show', m.reference_id);
            default:
                return null;
        }
    };

    return (
        <>
            <Head title="History Transaksi Sparepart" />
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">History Transaksi Sparepart</h1>
                        <p className="text-sm text-slate-500">{movements?.total || 0} mutasi & transaksi stok</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link
                            href={route('parts.stock.in.create')}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-500 text-white text-sm font-medium"
                        >
                            <IconArrowUp size={16} />
                            <span>Sparepart Masuk</span>
                        </Link>
                        <Link
                            href={route('parts.stock.out.create')}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-danger-500 text-white text-sm font-medium"
                        >
                            <IconArrowDown size={16} />
                            <span>Sparepart Keluar</span>
                        </Link>
                        <a
                            href={route('part-stock-history.export', filterData)}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-500 text-white text-sm font-medium hover:bg-green-600 transition-colors"
                        >
                            <IconDownload size={16} />
                            <span>Export CSV</span>
                        </a>
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
                    </div>
                </div>

                {showFilters && (
                    <form onSubmit={applyFilters} className="mb-6 bg-white rounded-2xl border border-slate-200 p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">Search</label>
                                <input
                                    type="text"
                                    placeholder="Notes or reference..."
                                    value={filterData.q}
                                    onChange={(e) => handleChange('q', e.target.value)}
                                    className="w-full h-11 px-4 rounded-xl border border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition-colors"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">Part</label>
                                <select
                                    value={filterData.part_id}
                                    onChange={(e) => handleChange('part_id', e.target.value)}
                                    className="w-full h-11 px-4 rounded-xl border border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition-colors"
                                >
                                    <option value="">All Parts</option>
                                    {parts.map((p) => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">Type</label>
                                <select
                                    value={filterData.type}
                                    onChange={(e) => handleChange('type', e.target.value)}
                                    className="w-full h-11 px-4 rounded-xl border border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition-colors"
                                >
                                    <option value="">All Types</option>
                                    {types.map((t) => (
                                        <option key={t} value={t}>{typeLabels[t] || t}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">Date Range</label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <input
                                        type="date"
                                        value={filterData.date_from}
                                        onChange={(e) => handleChange('date_from', e.target.value)}
                                        className="w-full h-11 px-3 rounded-xl border border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition-colors"
                                    />
                                    <input
                                        type="date"
                                        value={filterData.date_to}
                                        onChange={(e) => handleChange('date_to', e.target.value)}
                                        className="w-full h-11 px-3 rounded-xl border border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition-colors"
                                    />
                                </div>
                                <div className="flex flex-wrap gap-2 mt-2 text-xs">
                                    <button type="button" onClick={() => applyPreset(1)} className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50">Today</button>
                                    <button type="button" onClick={() => applyPreset(7)} className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50">7d</button>
                                    <button type="button" onClick={() => applyPreset(30)} className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50">30d</button>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button
                                type="submit"
                                className="px-4 py-2 rounded-lg bg-primary-500 text-white hover:bg-primary-600 transition-colors text-sm font-medium"
                            >
                                Apply Filters
                            </button>
                            <button
                                type="button"
                                onClick={resetFilters}
                                className="px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-sm font-medium"
                            >
                                Reset
                            </button>
                        </div>
                    </form>
                )}

                {movements?.data?.length > 0 ? (
                    <>
                        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                            <div className="overflow-x-auto max-h-[600px]">
                                <table className="min-w-[1320px] w-full">
                                    <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                                        <tr>
                                            <th className="text-left py-4 px-6 text-sm font-semibold text-slate-700 bg-slate-50">Date</th>
                                            <th className="text-left py-4 px-6 text-sm font-semibold text-slate-700 bg-slate-50">Part</th>
                                            <th className="text-left py-4 px-6 text-sm font-semibold text-slate-700 bg-slate-50">Type</th>
                                            <th className="text-center py-4 px-6 text-sm font-semibold text-slate-700 bg-slate-50">Qty</th>
                                            <th className="text-center py-4 px-6 text-sm font-semibold text-slate-700 bg-slate-50">Before</th>
                                            <th className="text-center py-4 px-6 text-sm font-semibold text-slate-700 bg-slate-50">After</th>
                                            <th className="text-left py-4 px-6 text-sm font-semibold text-slate-700 bg-slate-50">Reference</th>
                                            <th className="text-left py-4 px-6 text-sm font-semibold text-slate-700 bg-slate-50">Supplier</th>
                                            <th className="text-left py-4 px-6 text-sm font-semibold text-slate-700 bg-slate-50">User</th>
                                            <th className="text-left py-4 px-6 text-sm font-semibold text-slate-700 bg-slate-50">Notes</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {movements.data.map((m) => (
                                            <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="py-4 px-6 text-sm">{formatDate(m.created_at)}</td>
                                                <td className="py-4 px-6 text-sm font-medium">{m.part?.name}</td>
                                                <td className="py-4 px-6">
                                                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${typeColors[m.type] || 'bg-slate-100 text-slate-700'}`}>
                                                        {typeLabels[m.type] || m.type}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-6 text-center">
                                                    <div className="inline-flex items-center gap-1">
                                                        {['sale', 'stock_out', 'out', 'sales_order', 'sales_order_reversal', 'purchase_reversal'].includes(m.type) ? (
                                                            <>
                                                                <IconArrowDown size={16} className="text-red-600" />
                                                                <span className="text-red-600 font-medium">-{m.qty}</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <IconArrowUp size={16} className="text-green-600" />
                                                                <span className="text-green-600 font-medium">+{m.qty}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-4 px-6 text-center text-sm">{m.before_stock}</td>
                                                <td className="py-4 px-6 text-center text-sm font-medium">
                                                    {m.after_stock <= 0 ? (
                                                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-red-100 text-red-700 font-semibold">
                                                            {m.after_stock}
                                                        </span>
                                                    ) : m.after_stock <= 5 ? (
                                                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-orange-100 text-orange-700 font-semibold">
                                                            {m.after_stock}
                                                        </span>
                                                    ) : (
                                                        m.after_stock
                                                    )}
                                                </td>
                                                <td className="py-4 px-6 text-sm text-slate-600">
                                                    {(() => {
                                                        const label = getReferenceLabel(m);
                                                        const href = getReferenceLink(m);
                                                        if (href && label) {
                                                            return <Link href={href} className="text-primary-600 hover:text-primary-700 font-medium">{label}</Link>;
                                                        }
                                                        return label || '-';
                                                    })()}
                                                </td>
                                                <td className="py-4 px-6 text-sm text-slate-600">{m.supplier?.name || '-'}</td>
                                                <td className="py-4 px-6 text-sm text-slate-600">{m.user?.name || '-'}</td>
                                                <td className="py-4 px-6 text-sm text-slate-600">{m.notes || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="mt-6">
                            <Pagination links={movements.links} />
                        </div>
                    </>
                ) : (
                    <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                        <IconDatabaseOff className="mx-auto mb-4 text-slate-300" size={64} />
                        <h3 className="text-lg font-semibold text-slate-700 mb-2">No Stock Movements Found</h3>
                        <p className="text-sm text-slate-500">Stock movements will appear here when transactions occur</p>
                    </div>
                )}
        </>
    );
}

Index.layout = (page) => <DashboardLayout children={page} />;
