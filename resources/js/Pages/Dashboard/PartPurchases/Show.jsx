import React, { useState } from 'react';
import { Head, router, Link } from '@inertiajs/react';
import DashboardLayout from '@/Layouts/DashboardLayout';
import toast from 'react-hot-toast';
import { IconArrowLeft, IconCalendar, IconTruck, IconUser, IconEdit, IconReceipt, IconPackage, IconCurrencyDollar, IconPrinter } from '@tabler/icons-react';
import { toDisplayDate, todayLocalDate } from '@/Utils/datetime';

const statusColors = {
    pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    ordered: 'bg-blue-100 text-blue-700 border-blue-200',
    received: 'bg-green-100 text-green-700 border-green-200',
    cancelled: 'bg-red-100 text-red-700 border-red-200',
};

const statusLabels = {
    pending: 'Pending',
    ordered: 'Ordered',
    received: 'Received',
    cancelled: 'Cancelled',
};

export default function Show({ purchase }) {
    const [updating, setUpdating] = useState(false);
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [newStatus, setNewStatus] = useState(purchase.status);
    const [actualDeliveryDate, setActualDeliveryDate] = useState(purchase.actual_delivery_date || todayLocalDate());

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
        }).format(value);
    };

    const formatDate = (dateString) => (dateString ? toDisplayDate(dateString) : '-');

    const canChangeStatus = () => {
        return purchase.status !== 'cancelled' && purchase.status !== 'received';
    };

    const updateStatus = () => {
        if (newStatus === purchase.status) {
            setShowStatusModal(false);
            return;
        }

        setUpdating(true);
        router.post(
            route('part-purchases.update-status', purchase.id),
            {
                status: newStatus,
                actual_delivery_date: newStatus === 'received' ? actualDeliveryDate : null,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success('Status updated successfully');
                    setShowStatusModal(false);
                    router.reload();
                },
                onError: (errors) => {
                    toast.error(errors?.message || 'Failed to update status');
                },
                onFinish: () => {
                    setUpdating(false);
                },
            }
        );
    };


    return (
        <>
            <div className="print:hidden">
                <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 -m-6 p-4 sm:p-5 lg:p-6">
                    <div className="space-y-6">

                        {/* Header Card */}
                        <div className="bg-gradient-to-r from-amber-600 to-amber-700 dark:from-amber-700 dark:to-amber-800 rounded-2xl shadow-xl">
                            <div className="px-6 py-5">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-start gap-4">
                                        <button
                                            onClick={() => router.visit(route('part-purchases.index'))}
                                            className="flex items-center justify-center w-14 h-14 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all duration-200 backdrop-blur-sm hover:scale-105"
                                        >
                                            <IconArrowLeft size={22} />
                                        </button>
                                        <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center">
                                            <IconReceipt size={28} className="text-white" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-amber-100 mb-1">Purchase Order</div>
                                            <h1 className="text-3xl font-bold text-white mb-2">{purchase.purchase_number}</h1>
                                            <div className="flex items-center gap-3">
                                                <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium border ${statusColors[purchase.status] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                                                    {statusLabels[purchase.status] || purchase.status}
                                                </span>
                                                <span className="text-amber-100 text-sm">
                                                    {formatDate(purchase.purchase_date)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Link
                                            href={route('part-purchases.print', purchase.id)}
                                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-all duration-200 backdrop-blur-sm border border-white/20"
                                        >
                                            <IconPrinter size={18} />
                                            <span>Print</span>
                                        </Link>
                                        {(purchase.status === 'pending' || purchase.status === 'ordered') && (
                                            <Link
                                                href={route('part-purchases.edit', purchase.id)}
                                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-all duration-200 backdrop-blur-sm border border-white/20"
                                            >
                                                <IconEdit size={18} />
                                                <span>Edit</span>
                                            </Link>
                                        )}
                                        {canChangeStatus() && (
                                            <button
                                                onClick={() => setShowStatusModal(true)}
                                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-amber-600 hover:bg-white/90 font-medium transition-all duration-200 shadow-lg"
                                            >
                                                Update Status
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Purchase Info Grid */}
                        <div className="grid md:grid-cols-3 gap-6">
                            {/* Supplier Info */}
                            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800 p-6 hover:shadow-xl transition-all duration-200">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
                                        <IconTruck size={24} className="text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">Supplier</div>
                                        <div className="font-bold text-lg text-slate-900 dark:text-white mb-1">{purchase.supplier?.name || '-'}</div>
                                        {purchase.supplier?.phone && (
                                            <div className="text-sm text-slate-600 dark:text-slate-400">{purchase.supplier.phone}</div>
                                        )}
                                        {purchase.supplier?.address && (
                                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{purchase.supplier.address}</div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Delivery Info */}
                            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800 p-6 hover:shadow-xl transition-all duration-200">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center flex-shrink-0">
                                        <IconCalendar size={24} className="text-amber-600 dark:text-amber-400" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">Delivery Date</div>
                                        <div className="space-y-2">
                                            <div>
                                                <div className="text-xs text-slate-500">Expected</div>
                                                <div className="font-semibold text-slate-900 dark:text-white">
                                                    {formatDate(purchase.expected_delivery_date)}
                                                </div>
                                            </div>
                                            {purchase.actual_delivery_date && (
                                                <div>
                                                    <div className="text-xs text-slate-500">Actual</div>
                                                    <div className="font-semibold text-green-600">
                                                        {formatDate(purchase.actual_delivery_date)}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Total Amount */}
                            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-xl">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                                        <IconCurrencyDollar size={24} className="text-white" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-sm text-white/80 mb-1">Grand Total</div>
                                        <div className="text-2xl font-bold mb-1">
                                            {formatCurrency(purchase.grand_total || purchase.total_amount)}
                                        </div>
                                        <div className="text-xs text-white/70">
                                            {purchase.details?.length || 0} items
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Payment Summary & Notes */}
                        <div className="grid md:grid-cols-2 gap-6">
                            {/* Payment Breakdown */}
                            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800 p-6 hover:shadow-xl transition-all duration-200">
                                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Payment Summary</h2>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500 dark:text-slate-400">Subtotal</span>
                                        <span className="font-medium text-slate-900 dark:text-white">{formatCurrency(purchase.total_amount)}</span>
                                    </div>

                                    {purchase.discount_amount > 0 && (
                                        <div className="flex justify-between text-sm border-t border-slate-100 dark:border-slate-800 pt-2">
                                            <span className="text-slate-500 dark:text-slate-400">
                                                Discount {purchase.discount_type === 'percent' ? `(${purchase.discount_value}%)` : '(Fixed)'}
                                            </span>
                                            <span className="font-medium text-red-600">-{formatCurrency(purchase.discount_amount)}</span>
                                        </div>
                                    )}

                                    {purchase.tax_amount > 0 && (
                                        <div className="flex justify-between text-sm border-t border-slate-100 dark:border-slate-800 pt-2">
                                            <span className="text-slate-500 dark:text-slate-400">
                                                Tax {purchase.tax_type === 'percent' ? `(${purchase.tax_value}%)` : '(Fixed)'}
                                            </span>
                                            <span className="font-medium text-green-600">+{formatCurrency(purchase.tax_amount)}</span>
                                        </div>
                                    )}

                                    <div className="flex justify-between border-t-2 border-slate-200 dark:border-slate-700 pt-2">
                                        <span className="text-sm text-slate-700 dark:text-slate-300 font-semibold">Grand Total</span>
                                        <span className="text-2xl font-bold text-primary-600">{formatCurrency(purchase.grand_total || purchase.total_amount)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Notes */}
                            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800 p-6 hover:shadow-xl transition-all duration-200">
                                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Notes</h2>
                                {purchase.notes ? (
                                    <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                                        <p className="text-sm text-slate-700 dark:text-slate-300">{purchase.notes}</p>
                                    </div>
                                ) : (
                                    <div className="text-sm text-slate-500 dark:text-slate-400 italic">No notes added</div>
                                )}
                            </div>
                        </div>

                        {/* Items */}
                        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                            <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 border-b border-slate-200 dark:border-slate-700">
                                <h2 className="text-lg font-semibold">Purchase Items</h2>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-slate-100 dark:border-slate-800">
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">No</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Part</th>
                                            <th className="px-6 py-4 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Quantity</th>
                                            <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Unit Price</th>
                                            <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Subtotal</th>
                                            <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Discount</th>
                                            <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {purchase.details && purchase.details.map((detail, idx) => (
                                            <tr key={detail.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{idx + 1}</td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm font-semibold text-slate-900 dark:text-white">{detail.part?.name || '-'}</div>
                                                    <div className="text-xs text-slate-500">
                                                        Kode: {detail.part?.part_number || '-'}
                                                        {detail.part?.category && ` | ${detail.part.category.name}`}
                                                    </div>
                                                    {detail.discount_type && detail.discount_type !== 'none' && (
                                                        <div className="text-xs text-slate-500 mt-0.5">
                                                            Diskon: {detail.discount_type === 'percent' ? `${detail.discount_value}%` : `Rp ${new Intl.NumberFormat('id-ID').format(detail.discount_value)}`}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-center text-sm text-slate-600 dark:text-slate-400">{detail.quantity}</td>
                                                <td className="px-6 py-4 text-right text-sm text-slate-600 dark:text-slate-400">{formatCurrency(detail.unit_price)}</td>
                                                <td className="px-6 py-4 text-right text-sm text-slate-600 dark:text-slate-400">{formatCurrency(detail.subtotal)}</td>
                                                <td className="px-6 py-4 text-right text-sm">
                                                    {(detail.discount_amount || 0) > 0 ? (
                                                        <span className="text-red-600 font-medium">-{formatCurrency(detail.discount_amount)}</span>
                                                    ) : (
                                                        <span className="text-slate-400">-</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-right text-sm font-semibold text-slate-900 dark:text-white">{formatCurrency(detail.final_amount || detail.subtotal)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Status Update Modal */}
                {showStatusModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full">
                            <div className="p-6 border-b border-slate-200">
                                <h3 className="text-lg font-semibold">Update Purchase Status</h3>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        New Status
                                    </label>
                                    <select
                                        value={newStatus}
                                        onChange={(e) => setNewStatus(e.target.value)}
                                        className="w-full h-11 px-4 rounded-xl border border-slate-200"
                                    >
                                        <option value="pending">Pending</option>
                                        <option value="ordered">Ordered</option>
                                        <option value="received">Received</option>
                                        <option value="cancelled">Cancelled</option>
                                    </select>
                                </div>
                                {newStatus === 'received' && (
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                            Actual Delivery Date
                                        </label>
                                        <input
                                            type="date"
                                            value={actualDeliveryDate}
                                            onChange={(e) => setActualDeliveryDate(e.target.value)}
                                            className="w-full h-11 px-4 rounded-xl border border-slate-200"
                                        />
                                        <p className="text-xs text-slate-500 mt-1">
                                            When status is set to "Received", part stock will be updated automatically.
                                        </p>
                                    </div>
                                )}
                            </div>
                            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowStatusModal(false)}
                                    disabled={updating}
                                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={updateStatus}
                                    disabled={updating}
                                    className="px-4 py-2 rounded-xl bg-primary-500 text-white hover:bg-primary-600 transition-colors disabled:opacity-50"
                                >
                                    {updating ? 'Updating...' : 'Update Status'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Print-Only Invoice Layout */}
            <div className="hidden print:block">
                <div className="min-h-screen bg-white p-0">
                    <div className="max-w-4xl mx-auto">
                        <div className="bg-white border border-slate-300 overflow-hidden">
                            <div className="bg-slate-100 px-6 py-6">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <IconReceipt size={22} className="text-slate-700" />
                                            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                                                Purchase Invoice
                                            </span>
                                        </div>
                                        <p className="text-2xl font-bold text-slate-900">
                                            {purchase.purchase_number}
                                        </p>
                                        <p className="text-sm text-slate-600 mt-1">
                                            {formatDate(purchase.purchase_date)}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <span className={`inline-block px-3 py-1 text-xs font-semibold rounded-full ${statusColors[purchase.status] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                                            {statusLabels[purchase.status] || purchase.status}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-6 px-6 py-6 border-b border-slate-100">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Supplier</p>
                                    <p className="text-base font-semibold text-slate-900">
                                        {purchase.supplier?.name || '-'}
                                    </p>
                                    {purchase.supplier?.address && (
                                        <p className="text-sm text-slate-600">{purchase.supplier.address}</p>
                                    )}
                                    {purchase.supplier?.phone && (
                                        <p className="text-sm text-slate-600">{purchase.supplier.phone}</p>
                                    )}
                                </div>
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Delivery</p>
                                    <p className="text-sm text-slate-700">
                                        Expected: {formatDate(purchase.expected_delivery_date)}
                                    </p>
                                    {purchase.actual_delivery_date && (
                                        <p className="text-sm text-slate-700">
                                            Actual: {formatDate(purchase.actual_delivery_date)}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="px-6 py-6">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-100">
                                            <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Part</th>
                                            <th className="pb-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">Harga</th>
                                            <th className="pb-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-400">Qty</th>
                                            <th className="pb-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">Diskon</th>
                                            <th className="pb-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {(purchase.details || []).map((detail, index) => (
                                            <tr key={detail.id ?? index}>
                                                <td className="py-3">
                                                    <p className="font-medium text-slate-900">
                                                        {detail.part?.name || '-'}
                                                    </p>
                                                    {detail.part?.part_number && (
                                                        <p className="text-xs text-slate-500">
                                                            Kode: {detail.part.part_number}
                                                        </p>
                                                    )}
                                                </td>
                                                <td className="py-3 text-right text-slate-600">
                                                    {formatCurrency(detail.unit_price)}
                                                </td>
                                                <td className="py-3 text-center text-slate-600">
                                                    {detail.quantity}
                                                </td>
                                                <td className="py-3 text-right text-slate-600">
                                                    {(detail.discount_amount || 0) > 0
                                                        ? `-${formatCurrency(detail.discount_amount)}`
                                                        : '-'}
                                                </td>
                                                <td className="py-3 text-right font-semibold text-slate-900">
                                                    {formatCurrency(detail.final_amount || detail.subtotal)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="bg-slate-50 px-6 py-6">
                                <div className="max-w-xs ml-auto space-y-2 text-sm">
                                    <div className="flex justify-between text-slate-600">
                                        <span>Subtotal</span>
                                        <span>{formatCurrency(purchase.total_amount)}</span>
                                    </div>
                                    {purchase.discount_amount > 0 && (
                                        <div className="flex justify-between text-slate-600">
                                            <span>Diskon</span>
                                            <span>-{formatCurrency(purchase.discount_amount)}</span>
                                        </div>
                                    )}
                                    {purchase.tax_amount > 0 && (
                                        <div className="flex justify-between text-slate-600">
                                            <span>Pajak</span>
                                            <span>+{formatCurrency(purchase.tax_amount)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-lg font-bold text-slate-900 pt-2 border-t border-slate-200">
                                        <span>Total</span>
                                        <span>{formatCurrency(purchase.grand_total || purchase.total_amount)}</span>
                                    </div>
                                </div>
                            </div>

                            {purchase.notes && (
                                <div className="px-6 py-4 border-t border-slate-100">
                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Catatan</p>
                                    <p className="text-sm text-slate-700">{purchase.notes}</p>
                                </div>
                            )}

                            <div className="px-6 py-4 text-center border-t border-slate-100">
                                <p className="text-xs text-slate-400 uppercase tracking-widest">
                                    Dokumen Pembelian Sparepart
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

Show.layout = (page) => <DashboardLayout children={page} />;
