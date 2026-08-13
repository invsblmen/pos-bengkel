import React, { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import {
    IconChartBar,
    IconTrendingUp,
    IconShoppingCart,
    IconPackage,
    IconFilter,
    IconX
} from '@tabler/icons-react';
import { useRealtimeReportHistoryReload } from '@/Hooks/useRealtimeReportHistoryReload';

export default function PartSalesProfit({ sales, summary, topParts, filters }) {
    useRealtimeReportHistoryReload();
    const [showFilters, setShowFilters] = useState(false);
    const [formFilters, setFormFilters] = useState({
        start_date: filters.start_date || '',
        end_date: filters.end_date || '',
        invoice: filters.invoice || '',
    });

    const handleFilterChange = (field, value) => {
        setFormFilters(prev => ({ ...prev, [field]: value }));
    };

    const applyFilters = () => {
        router.get(route('reports.part-sales-profit.index'), formFilters, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const clearFilters = () => {
        setFormFilters({
            start_date: '',
            end_date: '',
            invoice: '',
        });
        router.get(route('reports.part-sales-profit.index'), {}, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
        }).format(value || 0);
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('id-ID', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <>
            <Head title="Laporan Profit Penjualan Sparepart" />

            <div className="space-y-6">

            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <IconTrendingUp size={28} className="text-primary-500" />
                            Laporan Profit Sparepart
                        </h1>
                        <p className="text-sm text-slate-500 mt-1">
                            Analisis keuntungan berdasarkan FIFO costing dengan margin per supplier
                        </p>
                    </div>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-500 text-white hover:bg-primary-600 transition-colors"
                    >
                        <IconFilter size={18} />
                        Filter
                    </button>
                </div>

            {/* Filter Panel */}
            {showFilters && (
                    <div className="mb-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Filter Laporan</h3>
                            <button
                                onClick={() => setShowFilters(false)}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                <IconX size={20} />
                            </button>
                        </div>
                        <div className="grid gap-4 md:grid-cols-3">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    Dari Tanggal
                                </label>
                                <input
                                    type="date"
                                    value={formFilters.start_date}
                                    onChange={(e) => handleFilterChange('start_date', e.target.value)}
                                    className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    Sampai Tanggal
                                </label>
                                <input
                                    type="date"
                                    value={formFilters.end_date}
                                    onChange={(e) => handleFilterChange('end_date', e.target.value)}
                                    className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    Invoice
                                </label>
                                <input
                                    type="text"
                                    value={formFilters.invoice}
                                    onChange={(e) => handleFilterChange('invoice', e.target.value)}
                                    placeholder="Cari invoice..."
                                    className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-4">
                            <button
                                onClick={applyFilters}
                                className="px-4 py-2 rounded-xl bg-primary-500 text-white hover:bg-primary-600 transition-colors"
                            >
                                Terapkan Filter
                            </button>
                            <button
                                onClick={clearFilters}
                                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
                            >
                                Reset
                            </button>
                        </div>
                    </div>
                )}

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-4 mb-6">
                    <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 text-white">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium opacity-90">Total Keuntungan</span>
                            <IconTrendingUp size={24} className="opacity-75" />
                        </div>
                        <div className="text-2xl font-bold">{formatCurrency(summary.total_profit)}</div>
                        <div className="text-xs mt-1 opacity-75">Margin: {summary.profit_margin}%</div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Revenue</span>
                            <IconChartBar size={24} className="text-blue-500" />
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">
                            {formatCurrency(summary.total_revenue)}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">Modal: {formatCurrency(summary.total_cost)}</div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Transaksi</span>
                            <IconShoppingCart size={24} className="text-purple-500" />
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">
                            {summary.orders_count}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                            Rata-rata: {formatCurrency(summary.average_profit_per_order)}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Item Terjual</span>
                            <IconPackage size={24} className="text-orange-500" />
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">
                            {summary.items_sold}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">Total sparepart</div>
                    </div>
                </div>

            {/* Top Performing Parts */}
            {topParts && topParts.length > 0 && (
                    <div className="mb-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                            Top 10 Sparepart Paling Untung
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-200 dark:border-slate-700">
                                        <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Part</th>
                                        <th className="px-4 py-3 text-center font-semibold text-slate-700 dark:text-slate-300">Qty Terjual</th>
                                        <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300">Total Profit</th>
                                        <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300">Avg Margin</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {topParts.map((part, idx) => (
                                        <tr key={idx} className="border-b border-slate-100 dark:border-slate-800">
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-slate-900 dark:text-white">{part.part_name}</div>
                                                <div className="text-xs text-slate-500">{part.part_number}</div>
                                            </td>
                                            <td className="px-4 py-3 text-center text-slate-700 dark:text-slate-300">
                                                {part.total_quantity}
                                            </td>
                                            <td className="px-4 py-3 text-right font-semibold text-green-600">
                                                {formatCurrency(part.total_profit)}
                                            </td>
                                            <td className="px-4 py-3 text-right text-blue-600 font-medium">
                                                {part.avg_margin.toFixed(2)}%
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

            {/* Sales Table */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Detail Transaksi</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-700">
                                    <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Invoice</th>
                                    <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Tanggal</th>
                                    <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Kasir</th>
                                    <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300">Modal</th>
                                    <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300">Revenue</th>
                                    <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300">Profit</th>
                                    <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300">Margin</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sales.data && sales.data.length > 0 ? (
                                    sales.data.map((sale) => (
                                        <tr key={sale.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                            <td className="px-4 py-3">
                                                <span className="font-medium text-primary-600">{sale.invoice}</span>
                                            </td>
                                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                                                {formatDate(sale.created_at)}
                                            </td>
                                            <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                                                {sale.user?.name || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                                                {formatCurrency(sale.total_cost)}
                                            </td>
                                            <td className="px-4 py-3 text-right font-medium text-slate-900 dark:text-white">
                                                {formatCurrency(sale.total_revenue)}
                                            </td>
                                            <td className="px-4 py-3 text-right font-semibold text-green-600">
                                                {formatCurrency(sale.total_profit)}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                                                    sale.profit_margin >= 20
                                                        ? 'bg-green-100 text-green-700'
                                                        : sale.profit_margin >= 10
                                                        ? 'bg-yellow-100 text-yellow-700'
                                                        : 'bg-red-100 text-red-700'
                                                }`}>
                                                    {sale.profit_margin.toFixed(2)}%
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="7" className="px-4 py-8 text-center text-slate-500">
                                            Tidak ada data transaksi
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {sales.links && sales.links.length > 3 && (
                        <div className="flex justify-center gap-1 mt-6">
                            {sales.links.map((link, index) => (
                                <button
                                    key={index}
                                    onClick={() => link.url && router.get(link.url)}
                                    disabled={!link.url}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                        link.active
                                            ? 'bg-primary-500 text-white'
                                            : link.url
                                            ? 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                                    }`}
                                    dangerouslySetInnerHTML={{ __html: link.label }}
                                />
                            ))}
                        </div>
                    )}
                {/* Info Box */}
                <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                    <div className="flex gap-3">
                        <div className="flex-shrink-0">
                            <IconChartBar size={20} className="text-blue-600" />
                        </div>
                        <div className="text-sm text-blue-900 dark:text-blue-200">
                            <p className="font-semibold mb-1">Tentang Laporan FIFO Costing</p>
                            <p>
                                Profit dihitung menggunakan <strong>metode FIFO</strong> (First In First Out).
                                Setiap penjualan menggunakan harga beli dari batch pembelian tertua yang tersedia.
                                Margin berbeda per supplier dan batch pembelian, sehingga laporan ini memberikan
                                gambaran profit yang akurat berdasarkan biaya aktual.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            </div>
        </>
    );
}
