import React, { useState, useEffect } from 'react';
import { Head, Link, useForm } from '@inertiajs/react';
import { IconArrowLeft, IconCalendar } from '@tabler/icons-react';
import { toDisplayDate } from '@/Utils/datetime';

export default function Show({ order }) {
    const { data, setData, post, processing } = useForm({
        status: order.status,
        actual_delivery_date: order.actual_delivery_date || '',
    });

    const [showStatusForm, setShowStatusForm] = useState(false);

    useEffect(() => {
        setData('status', order.status);
        setData('actual_delivery_date', order.actual_delivery_date || '');
    }, [order.status, order.actual_delivery_date]);

    const handleStatusSubmit = (e) => {
        e.preventDefault();
        post(route('part-sales-orders.update-status', order.id));
    };

    const statusBadgeColor = {
        pending: 'bg-yellow-100 text-yellow-700',
        confirmed: 'bg-blue-100 text-blue-700',
        fulfilled: 'bg-green-100 text-green-700',
        cancelled: 'bg-red-100 text-red-700',
    };

    const statusLabel = {
        pending: 'Pending',
        confirmed: 'Confirmed',
        fulfilled: 'Fulfilled',
        cancelled: 'Cancelled',
    };

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
        }).format(value);
    };

    const formatDate = (date) => (date ? toDisplayDate(date) : '-');

    return (
        <>
            <Head title={`Sales Order ${order.order_number}`} />
            <div className="p-6">
                <div className="flex items-center gap-4 mb-6">
                    <Link href={route('part-sales-orders.index')} className="text-slate-600 hover:text-slate-800">
                        <IconArrowLeft size={24} />
                    </Link>
                    <div className="flex-1">
                        <h1 className="text-2xl font-bold">{order.order_number}</h1>
                        <p className="text-sm text-slate-500">Sales Order Details</p>
                    </div>
                    <span className={`px-4 py-2 rounded-lg font-medium text-sm ${statusBadgeColor[order.status]}`}>
                        {statusLabel[order.status]}
                    </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <div className="bg-white rounded-2xl border border-slate-200 p-6">
                        <p className="text-sm text-slate-600 mb-1">Customer</p>
                        <p className="font-semibold">{order.customer?.name}</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-200 p-6">
                        <p className="text-sm text-slate-600 mb-1">Order Date</p>
                        <p className="font-semibold">{formatDate(order.order_date)}</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-200 p-6">
                        <p className="text-sm text-slate-600 mb-1">Total Amount</p>
                        <p className="font-semibold text-lg text-primary-600">{formatCurrency(order.total_amount)}</p>
                    </div>
                </div>

                {/* Items */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
                    <h3 className="font-semibold text-lg mb-4">Items</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b">
                                    <th className="text-left py-2 font-medium text-sm">Part Name</th>
                                    <th className="text-center py-2 font-medium text-sm">Qty</th>
                                    <th className="text-right py-2 font-medium text-sm">Unit Price</th>
                                    <th className="text-right py-2 font-medium text-sm">Subtotal</th>
                                </tr>
                            </thead>
                            <tbody>
                                {order.details?.map(detail => (
                                    <tr key={detail.id} className="border-b hover:bg-slate-50">
                                        <td className="py-3">{detail.part?.name}</td>
                                        <td className="py-3 text-center">{detail.quantity}</td>
                                        <td className="py-3 text-right">{formatCurrency(detail.unit_price)}</td>
                                        <td className="py-3 text-right font-semibold">{formatCurrency(detail.subtotal)}</td>
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

                    {/* Pricing Summary */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
                        <h3 className="font-semibold text-lg mb-4">Ringkasan Harga</h3>
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
                </div>

                {/* Status Update Form */}
                {order.status !== 'cancelled' && (
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-semibold text-lg">Update Status</h3>
                            <button
                                type="button"
                                onClick={() => setShowStatusForm(!showStatusForm)}
                                className="text-primary-600 hover:text-primary-700 font-medium"
                            >
                                {showStatusForm ? 'Cancel' : 'Change Status'}
                            </button>
                        </div>

                        {showStatusForm && (
                            <form onSubmit={handleStatusSubmit}>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-2">New Status *</label>
                                        <select
                                            value={data.status}
                                            onChange={(e) => setData('status', e.target.value)}
                                            className="w-full h-11 px-4 rounded-xl border"
                                        >
                                            <option value="pending">Pending</option>
                                            <option value="confirmed">Confirmed</option>
                                            <option value="fulfilled">Fulfilled</option>
                                            <option value="cancelled">Cancelled</option>
                                        </select>
                                    </div>

                                    {data.status === 'fulfilled' && (
                                        <div>
                                            <label className="block text-sm font-medium mb-2">Actual Delivery Date</label>
                                            <input
                                                type="date"
                                                value={data.actual_delivery_date}
                                                onChange={(e) => setData('actual_delivery_date', e.target.value)}
                                                className="w-full h-11 px-4 rounded-xl border"
                                            />
                                        </div>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={processing}
                                        className="w-full h-11 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-colors disabled:opacity-50 font-medium"
                                    >
                                        {processing ? 'Updating...' : 'Update Status'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                )}

                {/* Notes */}
                {order.notes && (
                    <div className="bg-blue-50 rounded-2xl border border-blue-200 p-6 mb-6">
                        <h3 className="font-semibold mb-2">Notes</h3>
                        <p className="text-sm text-slate-700">{order.notes}</p>
                    </div>
                )}

                {/* Dates */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6">
                    <h3 className="font-semibold text-lg mb-4">Timeline</h3>
                    <div className="space-y-3 text-sm">
                        <div className="flex items-center gap-3">
                            <IconCalendar size={16} className="text-slate-400" />
                            <div>
                                <p className="text-slate-600">Created</p>
                                <p className="font-medium">{formatDate(order.created_at)}</p>
                            </div>
                        </div>
                        {order.expected_delivery_date && (
                            <div className="flex items-center gap-3">
                                <IconCalendar size={16} className="text-slate-400" />
                                <div>
                                    <p className="text-slate-600">Expected Delivery</p>
                                    <p className="font-medium">{formatDate(order.expected_delivery_date)}</p>
                                </div>
                            </div>
                        )}
                        {order.actual_delivery_date && (
                            <div className="flex items-center gap-3">
                                <IconCalendar size={16} className="text-green-400" />
                                <div>
                                    <p className="text-slate-600">Actual Delivery</p>
                                    <p className="font-medium text-green-700">{formatDate(order.actual_delivery_date)}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
