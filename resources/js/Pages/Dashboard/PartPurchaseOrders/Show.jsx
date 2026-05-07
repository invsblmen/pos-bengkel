import React, { useEffect } from 'react';
import { Head, useForm, Link } from '@inertiajs/react';
import { IconArrowLeft, IconCalendar, IconUser, IconTruck, IconClipboardCheck } from '@tabler/icons-react';
import { toDisplayDate } from '@/Utils/datetime';

const statusColors = {
    pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    approved: 'bg-blue-100 text-blue-700 border-blue-200',
    received: 'bg-green-100 text-green-700 border-green-200',
    cancelled: 'bg-red-100 text-red-700 border-red-200',
};

const statusLabels = {
    pending: 'Pending',
    approved: 'Approved',
    received: 'Received',
    cancelled: 'Cancelled',
};

export default function Show({ order }) {
    const { data, setData, post, processing } = useForm({
        status: order.status,
        actual_delivery_date: order.actual_delivery_date || '',
    });

    useEffect(() => {
        setData('status', order.status);
        setData('actual_delivery_date', order.actual_delivery_date || '');
    }, [order.status, order.actual_delivery_date]);

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
        }).format(value);
    };

    const formatDate = (dateString) => (dateString ? toDisplayDate(dateString) : '-');

    const handleStatusUpdate = (e) => {
        e.preventDefault();
        post(route('part-purchase-orders.update-status', order.id));
    };

    return (
        <>
            <Head title={`PO ${order.po_number}`} />
            <div className="p-6">
                {/* Header */}
                <div className="flex items-center gap-4 mb-6">
                    <Link href={route('part-purchase-orders.index')} className="text-slate-600 hover:text-slate-800">
                        <IconArrowLeft size={24} />
                    </Link>
                    <div className="flex-1">
                        <h1 className="text-2xl font-bold">{order.po_number}</h1>
                        <p className="text-sm text-slate-500">Purchase Order Details</p>
                    </div>
                    <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium border ${statusColors[order.status]}`}>
                        {statusLabels[order.status]}
                    </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column - PO Info */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Info Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white rounded-2xl border border-slate-200 p-4">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
                                        <IconTruck size={20} className="text-primary-600" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500">Supplier</p>
                                        <p className="font-semibold">{order.supplier?.name}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl border border-slate-200 p-4">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                                        <IconCalendar size={20} className="text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500">PO Date</p>
                                        <p className="font-semibold">{formatDate(order.po_date)}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl border border-slate-200 p-4">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                                        <IconClipboardCheck size={20} className="text-green-600" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500">Total Amount</p>
                                        <p className="font-semibold">{formatCurrency(order.total_amount)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Items Table */}
                        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                            <div className="p-6 border-b border-slate-200">
                                <h2 className="text-lg font-semibold">Order Items</h2>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-slate-50 border-b border-slate-200">
                                        <tr>
                                            <th className="text-left py-3 px-6 text-sm font-semibold text-slate-700">Part</th>
                                            <th className="text-right py-3 px-6 text-sm font-semibold text-slate-700">Qty</th>
                                            <th className="text-right py-3 px-6 text-sm font-semibold text-slate-700">Unit Price</th>
                                            <th className="text-right py-3 px-6 text-sm font-semibold text-slate-700">Subtotal</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {order.details?.map((detail) => (
                                            <tr key={detail.id}>
                                                <td className="py-3 px-6 text-sm">{detail.part?.name}</td>
                                                <td className="py-3 px-6 text-sm text-right">{detail.quantity}</td>
                                                <td className="py-3 px-6 text-sm text-right">{formatCurrency(detail.unit_price)}</td>
                                                <td className="py-3 px-6 text-sm text-right font-medium">{formatCurrency(detail.subtotal)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-slate-50 border-t border-slate-200">
                                        <tr>
                                            <td colSpan="3" className="py-3 px-6 text-sm font-semibold text-right">Total:</td>
                                            <td className="py-3 px-6 text-sm font-bold text-right">{formatCurrency(order.total_amount)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>

                        {/* Pricing Summary */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-6">
                            <h2 className="text-lg font-semibold mb-4">Ringkasan Harga</h2>
                            <div className="space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-600">Subtotal Items:</span>
                                    <span className="font-medium">{formatCurrency(order.total_amount)}</span>
                                </div>
                                <div className="border-t border-slate-200 pt-3">
                                    <div className="flex justify-between text-lg font-bold text-primary-600">
                                        <span>Total Amount:</span>
                                        <span>{formatCurrency(order.total_amount)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Notes */}
                        {order.notes && (
                            <div className="bg-white rounded-2xl border border-slate-200 p-6">
                                <h2 className="text-lg font-semibold mb-3">Notes</h2>
                                <p className="text-sm text-slate-600 whitespace-pre-wrap">{order.notes}</p>
                            </div>
                        )}
                    </div>

                    {/* Right Column - Status Update & Timeline */}
                    <div className="space-y-6">
                        {/* Status Update Form */}
                        {order.status !== 'cancelled' && (
                            <div className="bg-white rounded-2xl border border-slate-200 p-6">
                                <h2 className="text-lg font-semibold mb-4">Update Status</h2>
                                <form onSubmit={handleStatusUpdate} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-2">Status</label>
                                        <select
                                            value={data.status}
                                            onChange={(e) => setData('status', e.target.value)}
                                            className="w-full h-11 px-4 rounded-xl border border-slate-200"
                                        >
                                            <option value="pending">Pending</option>
                                            <option value="approved">Approved</option>
                                            <option value="received">Received</option>
                                            <option value="cancelled">Cancelled</option>
                                        </select>
                                    </div>

                                    {data.status === 'received' && (
                                        <div>
                                            <label className="block text-sm font-medium mb-2">Actual Delivery Date</label>
                                            <input
                                                type="date"
                                                value={data.actual_delivery_date}
                                                onChange={(e) => setData('actual_delivery_date', e.target.value)}
                                                className="w-full h-11 px-4 rounded-xl border border-slate-200"
                                            />
                                        </div>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={processing}
                                        className="w-full py-2.5 rounded-xl bg-primary-500 text-white hover:bg-primary-600 transition-colors disabled:opacity-50 font-medium"
                                    >
                                        {processing ? 'Updating...' : 'Update Status'}
                                    </button>
                                </form>
                            </div>
                        )}

                        {/* Timeline */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-6">
                            <h2 className="text-lg font-semibold mb-4">Timeline</h2>
                            <div className="space-y-4">
                                <div className="flex gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                                        <IconCalendar size={16} className="text-slate-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium">PO Created</p>
                                        <p className="text-xs text-slate-500">{formatDate(order.created_at)}</p>
                                    </div>
                                </div>

                                {order.expected_delivery_date && (
                                    <div className="flex gap-3">
                                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                            <IconTruck size={16} className="text-blue-600" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium">Expected Delivery</p>
                                            <p className="text-xs text-slate-500">{formatDate(order.expected_delivery_date)}</p>
                                        </div>
                                    </div>
                                )}

                                {order.actual_delivery_date && (
                                    <div className="flex gap-3">
                                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                                            <IconClipboardCheck size={16} className="text-green-600" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium">Delivered</p>
                                            <p className="text-xs text-slate-500">{formatDate(order.actual_delivery_date)}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
