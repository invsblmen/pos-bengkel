import React, { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { IconArrowLeft, IconPrinter, IconPencil, IconEdit, IconCheck, IconX, IconCash, IconShoppingCart, IconReceipt, IconUser, IconDiscount } from '@tabler/icons-react';
import toast from 'react-hot-toast';
import { formatBusinessSocials } from '@/Utils/socialMediaFormatter';

const statusColors = {
    confirmed: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/40 dark:text-green-100',
    draft: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-100',
    waiting_stock: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-100',
    ready_to_notify: 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-100',
    waiting_pickup: 'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-900/40 dark:text-cyan-100',
    completed: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-100',
    cancelled: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-100',
};

const statusLabel = {
    draft: '📝 Draft',
    confirmed: '✅ Dikonfirmasi',
    waiting_stock: '📦 Pemesanan',
    ready_to_notify: '🔔 Siap Diberitahu',
    waiting_pickup: '🛵 Menunggu Diambil',
    completed: '🎯 Selesai',
    cancelled: '❌ Dibatalkan',
};

const paymentColors = {
    paid: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/40 dark:text-green-100',
    partial: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-100',
    unpaid: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-slate-800/60 dark:text-gray-100',
};

export default function Show({ sale, businessProfile }) {
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [newStatus, setNewStatus] = useState(sale.status || 'draft');
    const [updatingStatus, setUpdatingStatus] = useState(false);
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [printMode, setPrintMode] = useState('invoice');
    const [paperSize, setPaperSize] = useState('a4');
    const [paymentAmount, setPaymentAmount] = useState('');
    const [updatingPayment, setUpdatingPayment] = useState(false);

    const formatCurrency = (value = 0) =>
        new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value || 0);

    const formatDate = (value) =>
        value
            ? new Date(value).toLocaleDateString('id-ID', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
              })
            : '-';

    const calculateItemSubtotal = (detail) => (detail.quantity || 0) * (detail.unit_price || 0);
    const calculateItemDiscount = (detail) => detail.discount_amount || 0;
    const calculateItemTotal = (detail) =>
        detail.final_amount !== null && detail.final_amount !== undefined
            ? detail.final_amount
            : calculateItemSubtotal(detail) - calculateItemDiscount(detail);

    const subtotal = sale.subtotal ?? sale.details.reduce((sum, detail) => sum + calculateItemTotal(detail), 0);
    const discountAmount = sale.discount_amount || 0;
    const taxAmount = sale.tax_amount || 0;
    const grandTotal = sale.grand_total ?? subtotal - discountAmount + taxAmount;
    const minimumDownPaymentReminder = Math.ceil(grandTotal * 0.5);
    const paidAmount = sale.paid_amount || 0;
    const remainingAmount = sale.remaining_amount ?? (grandTotal - paidAmount);
    const businessName = businessProfile?.business_name || 'POS BENGKEL';
    const businessPhone = businessProfile?.business_phone || '';
    const businessAddress = businessProfile?.business_address || '';
    const businessSocials = formatBusinessSocials(businessProfile);

    const handlePrint = () => setShowPrintModal(true);

    const doPrint = (mode = 'invoice', size = 'a4') => {
        setPrintMode(mode);
        setPaperSize(size);
        setShowPrintModal(false);
        setTimeout(() => window.print(), 120);
    };

    const canChangeStatus = () => !['completed', 'cancelled'].includes(sale.status);

    const updateStatus = () => {
        if (newStatus === sale.status) {
            setShowStatusModal(false);
            return;
        }

        setUpdatingStatus(true);
        router.post(
            route('part-sales.update-status', sale.id),
            { status: newStatus },
            {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success('Status penjualan berhasil diperbarui');
                    setShowStatusModal(false);
                },
                onError: (errors) => {
                    toast.error(errors?.error || 'Gagal memperbarui status');
                },
                onFinish: () => setUpdatingStatus(false),
            }
        );
    };

    const handleUpdatePayment = () => {
        const amount = Number(paymentAmount || 0);
        if (amount <= 0) {
            toast.error('Masukkan jumlah pembayaran');
            return;
        }

        setUpdatingPayment(true);
        router.post(
            route('part-sales.update-payment', sale.id),
            { payment_amount: amount },
            {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success('Pembayaran berhasil dicatat');
                    setPaymentAmount('');
                },
                onError: (errors) => {
                    toast.error(errors?.error || 'Gagal mencatat pembayaran');
                },
                onFinish: () => setUpdatingPayment(false),
            }
        );
    };

    return (
        <DashboardLayout>
            <Head title={`Penjualan ${sale.sale_number}`} />

            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 -m-6 p-6">
                <div className="space-y-6 print:hidden">
                    {/* Hero Header */}
                    <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 dark:from-emerald-700 dark:to-emerald-800 rounded-2xl shadow-xl">
                        <div className="px-6 py-6">
                            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                                <div className="flex items-center gap-4">
                                    <Link href={route('part-sales.index')}>
                                        <button className="flex items-center justify-center w-12 h-12 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all duration-200 backdrop-blur-sm hover:scale-105">
                                            <IconArrowLeft size={20} />
                                        </button>
                                    </Link>
                                    <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm">
                                        <IconShoppingCart size={28} className="text-white" />
                                    </div>
                                    <div>
                                        <h1 className="text-3xl font-bold text-white">{sale.sale_number}</h1>
                                        <p className="text-emerald-100 mt-1">{formatDate(sale.sale_date || sale.created_at)}</p>
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-3">
                                    <span className={`inline-flex items-center px-4 py-2 rounded-xl text-sm font-bold border-2 shadow-lg ${
                                        statusColors[sale.status] || 'bg-white/10 text-white border-white/20'
                                    }`}>
                                        {statusLabel[sale.status] || sale.status}
                                    </span>
                                    <Link
                                        href={route('part-sales.print', sale.id)}
                                        className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-emerald-700 shadow-xl hover:shadow-2xl hover:scale-105 transition-all"
                                    >
                                        <IconPrinter size={18} /> Cetak
                                    </Link>
                                    {sale.status === 'draft' && (
                                        <Link
                                            href={route('part-sales.edit', sale.id)}
                                            className="inline-flex items-center gap-2 rounded-xl bg-white/10 border-2 border-white/20 px-5 py-2.5 text-sm font-bold text-white hover:bg-white/20 backdrop-blur-sm transition-all"
                                        >
                                            <IconPencil size={18} /> Edit
                                        </Link>
                                    )}
                                    {canChangeStatus() && (
                                        <button
                                            onClick={() => setShowStatusModal(true)}
                                            className="inline-flex items-center gap-2 rounded-xl bg-white/10 border-2 border-white/20 px-5 py-2.5 text-sm font-bold text-white hover:bg-white/20 backdrop-blur-sm transition-all"
                                        >
                                            <IconEdit size={18} /> Update Status
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-6 lg:grid-cols-3">
                        <div className="lg:col-span-2 space-y-6">
                            {/* Details Section */}
                            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                                <div className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 px-6 py-4 border-b border-purple-200 dark:border-purple-700/30">
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-purple-500 text-white shadow-lg shadow-purple-500/30">
                                            <IconReceipt size={20} />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Detail Penjualan</h2>
                                            <p className="text-sm text-slate-600 dark:text-slate-400">{sale.details.length} item sparepart</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 border-b-2 border-slate-200 dark:border-slate-700">
                                            <tr>
                                                <th className="px-6 py-3 text-left font-bold text-slate-700 dark:text-slate-300">Sparepart</th>
                                                <th className="px-6 py-3 text-right font-bold text-slate-700 dark:text-slate-300">Qty</th>
                                                <th className="px-6 py-3 text-right font-bold text-slate-700 dark:text-slate-300">Harga</th>
                                                <th className="px-6 py-3 text-right font-bold text-slate-700 dark:text-slate-300">Diskon</th>
                                                <th className="px-6 py-3 text-right font-bold text-slate-700 dark:text-slate-300">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {sale.details.map((detail) => (
                                                <tr key={detail.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                                                    <td className="px-6 py-4">
                                                        <div className="font-bold text-slate-900 dark:text-white">{detail.part?.name || '-'}</div>
                                                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{detail.part?.part_number || '-'}</div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right font-bold text-slate-900 dark:text-white">{detail.quantity}</td>
                                                    <td className="px-6 py-4 text-right font-semibold text-slate-900 dark:text-white">{formatCurrency(detail.unit_price)}</td>
                                                    <td className="px-6 py-4 text-right font-bold text-red-600 dark:text-red-400">-{formatCurrency(calculateItemDiscount(detail))}</td>
                                                    <td className="px-6 py-4 text-right font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(calculateItemTotal(detail))}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800/60 dark:to-slate-900/60 border-t-2 border-slate-200 dark:border-slate-700">
                                            <tr>
                                                <td colSpan="4" className="px-6 py-4 text-right font-bold text-slate-900 dark:text-white">Subtotal Item</td>
                                                <td className="px-6 py-4 text-right font-bold text-xl text-emerald-600 dark:text-emerald-400">{formatCurrency(subtotal)}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>

                            {sale.notes && (
                                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                                    <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 px-6 py-4 border-b border-blue-200 dark:border-blue-700/30">
                                        <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                            <IconReceipt size={18} className="text-blue-600 dark:text-blue-400" />
                                            Catatan Penjualan
                                        </h3>
                                    </div>
                                    <div className="p-6">
                                        <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{sale.notes}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="space-y-6">
                            {/* Info Card */}
                            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                                <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 px-6 py-4 border-b border-blue-200 dark:border-blue-700/30">
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-500 text-white shadow-lg shadow-blue-500/30">
                                            <IconUser size={20} />
                                        </div>
                                        <h3 className="font-bold text-slate-900 dark:text-white">Informasi</h3>
                                    </div>
                                </div>
                                <div className="p-6 space-y-4">
                                    <div className="space-y-3 text-sm">
                                        <div className="flex items-center justify-between py-3 border-b border-slate-200 dark:border-slate-800">
                                            <span className="text-slate-600 dark:text-slate-400 font-medium">Pelanggan</span>
                                            <span className="font-bold text-slate-900 dark:text-white">{sale.customer?.name || '-'}</span>
                                        </div>
                                        <div className="flex items-center justify-between py-3 border-b border-slate-200 dark:border-slate-800">
                                            <span className="text-slate-600 dark:text-slate-400 font-medium">Dibuat oleh</span>
                                            <span className="font-bold text-slate-900 dark:text-white">{sale.creator?.name || '-'}</span>
                                        </div>
                                        <div className="flex items-center justify-between py-3 border-b border-slate-200 dark:border-slate-800">
                                            <span className="text-slate-600 dark:text-slate-400 font-medium">Status Penjualan</span>
                                            <span className={`inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold border-2 shadow-sm ${
                                                statusColors[sale.status] || 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-slate-800 dark:text-gray-200'
                                            }`}>
                                                {statusLabel[sale.status] || sale.status}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between py-3">
                                            <span className="text-slate-600 dark:text-slate-400 font-medium">Status Pembayaran</span>
                                            <span className={`inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold border-2 shadow-sm ${
                                                paymentColors[sale.payment_status] || paymentColors.unpaid
                                            }`}>
                                                {sale.payment_status === 'paid' ? '✓ Lunas' : sale.payment_status === 'partial' ? '◐ Sebagian' : '○ Belum Bayar'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Summary Card */}
                            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 rounded-2xl shadow-xl border-2 border-emerald-200 dark:border-emerald-700/30 overflow-hidden">
                                <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm">
                                            <IconReceipt size={20} className="text-white" />
                                        </div>
                                        <h3 className="font-bold text-white text-lg">Ringkasan Penjualan</h3>
                                    </div>
                                </div>
                                <div className="p-6 space-y-4">
                                    <div className="space-y-3 text-sm">
                                        <div className="flex items-center justify-between pb-3 border-b border-emerald-200 dark:border-emerald-700/30">
                                            <span className="text-slate-600 dark:text-slate-400 font-medium">Subtotal</span>
                                            <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(subtotal)}</span>
                                        </div>
                                        <div className="flex items-center justify-between pb-3 border-b border-emerald-200 dark:border-emerald-700/30">
                                            <span className="text-slate-600 dark:text-slate-400 font-medium flex items-center gap-1">
                                                <IconDiscount size={14} className="text-red-500" />
                                                Diskon
                                            </span>
                                            <span className="font-bold text-red-600 dark:text-red-400">-{formatCurrency(discountAmount)}</span>
                                        </div>
                                        <div className="flex items-center justify-between pb-3 border-b border-emerald-200 dark:border-emerald-700/30">
                                            <span className="text-slate-600 dark:text-slate-400 font-medium">Pajak</span>
                                            <span className="font-bold text-green-600 dark:text-green-400">+{formatCurrency(taxAmount)}</span>
                                        </div>
                                        <div className="flex items-center justify-between pt-2 pb-4 border-b-2 border-emerald-300 dark:border-emerald-600">
                                            <span className="text-lg font-bold text-slate-900 dark:text-white">Total</span>
                                            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(grandTotal)}</span>
                                        </div>
                                    </div>

                                    <div className="space-y-3 text-sm">
                                        <div className="flex items-center justify-between">
                                            <span className="text-slate-600 dark:text-slate-400 font-medium">Sudah Bayar</span>
                                            <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(paidAmount)}</span>
                                        </div>
                                        {paidAmount > grandTotal && (
                                            <div className="px-4 py-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-700/30">
                                                <div className="flex items-center justify-between">
                                                    <span className="font-bold text-blue-700 dark:text-blue-400">Kembalian</span>
                                                    <span className="font-bold text-blue-600 dark:text-blue-400">{formatCurrency(paidAmount - grandTotal)}</span>
                                                </div>
                                            </div>
                                        )}
                                        <div className="flex items-center justify-between">
                                            <span className="text-slate-600 dark:text-slate-400 font-medium">Sisa Pembayaran</span>
                                            <span className={`font-bold ${
                                                remainingAmount <= 0
                                                    ? 'text-green-600 dark:text-green-400'
                                                    : 'text-slate-900 dark:text-white'
                                            }`}>
                                                {remainingAmount > 0 ? formatCurrency(remainingAmount) : '-'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Payment Section */}
                            {remainingAmount > 0 && sale.status !== 'draft' && (
                                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                                    <div className="bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 px-6 py-4 border-b border-orange-200 dark:border-orange-700/30">
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-orange-500 text-white shadow-lg shadow-orange-500/30">
                                                <IconCash size={20} />
                                            </div>
                                            <h3 className="font-bold text-slate-900 dark:text-white">Catat Pembayaran</h3>
                                        </div>
                                    </div>
                                    <div className="p-6 space-y-4">
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                                                Jumlah Pembayaran
                                            </label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={paymentAmount}
                                                onChange={(e) => setPaymentAmount(e.target.value)}
                                                placeholder="Masukkan jumlah pembayaran..."
                                                className="w-full h-12 px-4 rounded-xl border-2 border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-bold text-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
                                            />
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                                                Sisa yang harus dibayar: <span className="font-bold text-orange-600">{formatCurrency(remainingAmount)}</span>
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleUpdatePayment}
                                            disabled={updatingPayment}
                                            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-600 to-orange-700 text-white py-3 text-sm font-bold hover:from-orange-700 hover:to-orange-800 shadow-lg shadow-orange-500/30 disabled:opacity-70 transition-all hover:scale-105"
                                        >
                                            {updatingPayment ? (
                                                <>
                                                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                    Menyimpan...
                                                </>
                                            ) : (
                                                <>
                                                    <IconCash size={18} /> Simpan Pembayaran
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Print View - Invoice */}
                {printMode === 'invoice' && (
                    <div className="hidden print:block">
                        <div className="mx-auto max-w-[900px] text-slate-900 print:text-black">
                            <div className="border-b-2 border-slate-300 pb-4 mb-4">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h1 className="text-2xl font-bold tracking-wide">INVOICE PENJUALAN SPAREPART</h1>
                                        <p className="text-sm text-slate-600">{sale.sale_number}</p>
                                        <p className="text-sm text-slate-600 mt-1">{businessName}</p>
                                        {businessPhone && <p className="text-xs text-slate-500">{businessPhone}</p>}
                                        {businessAddress && <p className="text-xs text-slate-500">{businessAddress}</p>}
                                        {businessSocials.map((social) => (
                                            <p key={social.label} className="text-xs text-slate-500">
                                                {social.label}: {social.value}
                                            </p>
                                        ))}
                                    </div>
                                    <div className="text-right text-sm text-slate-700">
                                        <p><span className="font-semibold">Tanggal:</span> {formatDate(sale.sale_date || sale.created_at)}</p>
                                        <p><span className="font-semibold">Status:</span> {statusLabel[sale.status] || sale.status}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                                <div className="border border-slate-300 rounded-md p-3">
                                    <p className="font-semibold mb-1">Pelanggan</p>
                                    <p>{sale.customer?.name || '-'}</p>
                                </div>
                                <div className="border border-slate-300 rounded-md p-3 text-right">
                                    <p className="font-semibold mb-1">Pembayaran</p>
                                    <p>{sale.payment_status}</p>
                                </div>
                            </div>

                            <table className="w-full text-sm border border-slate-300">
                                <thead className="bg-slate-100">
                                    <tr>
                                        <th className="px-3 py-2 text-left border-b border-slate-300">Sparepart</th>
                                        <th className="px-3 py-2 text-right border-b border-slate-300">Harga</th>
                                        <th className="px-3 py-2 text-right border-b border-slate-300">Qty</th>
                                        <th className="px-3 py-2 text-right border-b border-slate-300">Diskon</th>
                                        <th className="px-3 py-2 text-right border-b border-slate-300">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sale.details.map((detail) => (
                                        <tr key={detail.id} className="border-b border-slate-200">
                                            <td className="px-3 py-2">{detail.part?.name || '-'}</td>
                                            <td className="px-3 py-2 text-right">{formatCurrency(detail.unit_price)}</td>
                                            <td className="px-3 py-2 text-right">{detail.quantity}</td>
                                            <td className="px-3 py-2 text-right">-{formatCurrency(calculateItemDiscount(detail))}</td>
                                            <td className="px-3 py-2 text-right">{formatCurrency(calculateItemTotal(detail))}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            <div className="mt-4 flex justify-end">
                                <div className="w-80 border border-slate-300 rounded-md p-3 space-y-2 text-sm">
                                    <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                                    <div className="flex justify-between"><span>Diskon</span><span>-{formatCurrency(discountAmount)}</span></div>
                                    <div className="flex justify-between"><span>Pajak</span><span>+{formatCurrency(taxAmount)}</span></div>
                                    <div className="flex justify-between border-t border-slate-300 pt-2 font-semibold text-base"><span>Total</span><span>{formatCurrency(grandTotal)}</span></div>
                                </div>
                            </div>

                            {sale.notes && (
                                <div className="mt-4 text-sm border border-slate-300 rounded-md p-3">
                                    <p className="font-semibold">Catatan:</p>
                                    <p>{sale.notes}</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Print View - POS */}
                {printMode === 'pos' && (
                    <div className="hidden print:block">
                        <div className={`${paperSize === '58mm' ? 'mx-auto w-[58mm]' : 'mx-auto w-[80mm]'} text-[11px] leading-tight text-black`}>
                            <div className="text-center border-b border-dashed border-black pb-2 mb-2">
                                <p className="font-bold text-base">{businessName}</p>
                                {businessPhone && <p>{businessPhone}</p>}
                                {businessAddress && <p>{businessAddress}</p>}
                                {businessSocials.map((social) => (
                                    <p key={social.label}>{social.label}: {social.value}</p>
                                ))}
                                <p>{sale.sale_number}</p>
                                <p>{formatDate(sale.sale_date || sale.created_at)}</p>
                            </div>

                            <div className="mb-2">
                                <p>Pelanggan: {sale.customer?.name || '-'}</p>
                                <p>Status: {statusLabel[sale.status] || sale.status}</p>
                            </div>

                            <div className="border-y border-dashed border-black py-2 space-y-2">
                                {sale.details.map((detail) => (
                                    <div key={detail.id}>
                                        <p className="font-semibold">{detail.part?.name || '-'}</p>
                                        <div className="flex justify-between">
                                            <span>{detail.quantity} x {formatCurrency(detail.unit_price)}</span>
                                            <span>{formatCurrency(calculateItemTotal(detail))}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="py-2 space-y-1 border-b border-dashed border-black">
                                <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                                <div className="flex justify-between"><span>Diskon</span><span>-{formatCurrency(discountAmount)}</span></div>
                                <div className="flex justify-between"><span>Pajak</span><span>+{formatCurrency(taxAmount)}</span></div>
                                <div className="flex justify-between font-bold text-sm pt-1"><span>Total</span><span>{formatCurrency(grandTotal)}</span></div>
                                <div className="flex justify-between"><span>Bayar</span><span>{formatCurrency(paidAmount)}</span></div>
                                <div className="flex justify-between"><span>Sisa</span><span>{formatCurrency(remainingAmount)}</span></div>
                            </div>

                            <div className="pt-2 text-center">
                                <p>Terima kasih atas kunjungan Anda</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Status Update Modal */}
                {showStatusModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
                        <div className="w-full max-w-md rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-2xl border-2 border-slate-200 dark:border-slate-800 animate-slideUp">
                            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm">
                                        <IconEdit size={20} className="text-white" />
                                    </div>
                                    <h3 className="text-xl font-bold text-white">Update Status</h3>
                                </div>
                                <button
                                    onClick={() => setShowStatusModal(false)}
                                    className="flex items-center justify-center w-10 h-10 rounded-xl hover:bg-white/10 text-white transition-all duration-200"
                                >
                                    <IconX size={20} />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                                        Status Baru
                                    </label>
                                    <select
                                        value={newStatus}
                                        onChange={(e) => setNewStatus(e.target.value)}
                                        className="w-full h-12 px-4 rounded-xl border-2 border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                    >
                                        <option value="draft">📝 Draft</option>
                                        <option value="confirmed">✅ Dikonfirmasi</option>
                                        <option value="waiting_stock">📦 Pemesanan</option>
                                        <option value="ready_to_notify">🔔 Siap Diberitahu</option>
                                        <option value="waiting_pickup">🛵 Menunggu Diambil</option>
                                        <option value="completed">🎯 Selesai</option>
                                        <option value="cancelled">❌ Dibatalkan</option>
                                    </select>
                                    {newStatus === 'waiting_stock' && grandTotal > 0 && (
                                        <p className="text-xs text-amber-700 dark:text-amber-400 mt-2 font-medium">
                                            Pengingat pemesanan: DP disarankan minimal {formatCurrency(minimumDownPaymentReminder)} (50% dari total).
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center justify-end gap-3 px-6 py-5 border-t-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
                                <button
                                    type="button"
                                    onClick={() => setShowStatusModal(false)}
                                    className="px-5 py-2.5 rounded-xl border-2 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                                >
                                    Batal
                                </button>
                                <button
                                    type="button"
                                    onClick={updateStatus}
                                    disabled={updatingStatus}
                                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold hover:from-blue-700 hover:to-blue-800 shadow-lg shadow-blue-500/30 disabled:opacity-70 transition-all hover:scale-105"
                                >
                                    {updatingStatus ? (
                                        <>
                                            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Menyimpan...
                                        </>
                                    ) : (
                                        <>
                                            <IconCheck size={18} /> Simpan
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Print Options Modal */}
                {showPrintModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn print:hidden">
                        <div className="w-full max-w-lg rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-2xl border-2 border-slate-200 dark:border-slate-800 animate-slideUp">
                            <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-5 flex items-center justify-between">
                                <h3 className="text-xl font-bold text-white">Pilih Format Cetak</h3>
                                <button onClick={() => setShowPrintModal(false)} className="text-white hover:bg-white/10 rounded-xl w-10 h-10 inline-flex items-center justify-center">
                                    <IconX size={20} />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="grid gap-3">
                                    <button type="button" onClick={() => doPrint('invoice', 'a4')} className="w-full text-left p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all">
                                        <p className="font-bold text-slate-900 dark:text-white">Invoice A4</p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Layout lengkap untuk administrasi</p>
                                    </button>
                                    <button type="button" onClick={() => doPrint('pos', '80mm')} className="w-full text-left p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all">
                                        <p className="font-bold text-slate-900 dark:text-white">POS Thermal 80mm</p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Struk kasir ukuran 80mm</p>
                                    </button>
                                    <button type="button" onClick={() => doPrint('pos', '58mm')} className="w-full text-left p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all">
                                        <p className="font-bold text-slate-900 dark:text-white">POS Thermal 58mm</p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Struk kasir ukuran 58mm</p>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <style>{`
                    @media print {
                        @page {
                            size: ${printMode === 'pos' ? `${paperSize} auto` : 'A4'};
                            margin: ${printMode === 'pos' ? '4mm' : '12mm'};
                        }
                    }
                `}</style>
            </div>
        </DashboardLayout>
    );
}
