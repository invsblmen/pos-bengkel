import React, { useMemo, useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import { IconArrowLeft, IconPrinter, IconReceipt, IconFileInvoice } from '@tabler/icons-react';
import ThermalReceipt, { ThermalReceipt58mm } from '@/Components/Receipt/ThermalReceipt';
import { toDisplayDateTime } from '@/Utils/datetime';
import { formatBusinessSocials } from '@/Utils/socialMediaFormatter';

export default function Print({ purchase, businessProfile }) {
    const [printMode, setPrintMode] = useState('invoice');

    const formatCurrency = (value = 0) =>
        new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
        }).format(value || 0);

    const subtotal = Number(purchase?.total_amount || 0);
    const discountAmount = Number(purchase?.discount_amount || 0);
    const taxAmount = Number(purchase?.tax_amount || 0);
    const grandTotal = Number(purchase?.grand_total || subtotal - discountAmount + taxAmount);

    const businessName = businessProfile?.business_name || 'POS BENGKEL';
    const businessPhone = businessProfile?.business_phone || '';
    const businessAddress = businessProfile?.business_address || '';
    const businessSocials = formatBusinessSocials(businessProfile);

    const thermalPayload = useMemo(() => ({
        invoice: purchase?.purchase_number,
        created_at: purchase?.purchase_date || purchase?.created_at,
        customer: purchase?.supplier ? { name: purchase.supplier.name } : null,
        details: (purchase?.details || []).map((detail) => ({
            id: detail.id,
            qty: Number(detail.quantity || 0),
            price: Number(detail.final_amount || detail.subtotal || 0),
            product: {
                title: detail.part?.name || '-',
            },
        })),
        discount: discountAmount,
        grand_total: grandTotal,
        cash: grandTotal,
        change: 0,
        payment_method: 'cash',
    }), [purchase, discountAmount, grandTotal]);

    return (
        <>
            <Head title={`Cetak Pembelian ${purchase?.purchase_number || ''}`} />

            <div className="min-h-screen bg-slate-100 dark:bg-slate-950 py-8 px-4 print:bg-white print:p-0">
                <div className="max-w-5xl mx-auto space-y-6">
                    <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
                        <Link
                            href={route('part-purchases.show', purchase?.id)}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                            <IconArrowLeft size={18} />
                            Kembali ke detail
                        </Link>

                        <div className="flex items-center gap-2">
                            <div className="flex bg-slate-200 dark:bg-slate-800 rounded-xl p-1">
                                <button
                                    type="button"
                                    onClick={() => setPrintMode('invoice')}
                                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                                        printMode === 'invoice'
                                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow'
                                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                                    }`}
                                >
                                    <IconFileInvoice size={16} className="inline mr-1" />
                                    Invoice
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPrintMode('thermal80')}
                                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                                        printMode === 'thermal80'
                                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow'
                                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                                    }`}
                                >
                                    <IconReceipt size={16} className="inline mr-1" />
                                    Struk 80mm
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPrintMode('thermal58')}
                                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                                        printMode === 'thermal58'
                                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow'
                                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                                    }`}
                                >
                                    <IconReceipt size={16} className="inline mr-1" />
                                    Struk 58mm
                                </button>
                            </div>

                            <button
                                type="button"
                                onClick={() => window.print()}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-sm font-semibold text-white shadow-lg shadow-primary-500/30 transition-colors"
                            >
                                <IconPrinter size={18} />
                                Cetak
                            </button>
                        </div>
                    </div>

                    {(printMode === 'thermal80' || printMode === 'thermal58') && (
                        <div className="flex justify-center print:block">
                            <div className="bg-white rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl p-4 print:shadow-none print:border-0 print:p-0 print:rounded-none">
                                {printMode === 'thermal80' ? (
                                    <ThermalReceipt
                                        transaction={thermalPayload}
                                        storeName={businessName}
                                        storeAddress={businessAddress}
                                        storePhone={businessPhone}
                                        businessSocials={businessSocials}
                                    />
                                ) : (
                                    <ThermalReceipt58mm
                                        transaction={thermalPayload}
                                        storeName={businessName}
                                        storePhone={businessPhone}
                                        businessSocials={businessSocials}
                                    />
                                )}
                            </div>
                        </div>
                    )}

                    {printMode === 'invoice' && (
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl print:shadow-none print:border-slate-300">
                            <div className="bg-gradient-to-r from-primary-500 to-primary-700 px-6 py-6 text-white print:bg-slate-100 print:text-slate-900">
                                <div className="flex flex-wrap items-start justify-between gap-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <IconReceipt size={24} />
                                            <span className="text-sm font-medium opacity-90 print:opacity-100">INVOICE PEMBELIAN SPAREPART</span>
                                        </div>
                                        <p className="text-2xl font-bold">{purchase?.purchase_number}</p>
                                        <p className="text-sm opacity-80 print:opacity-100 mt-1">
                                            {toDisplayDateTime(purchase?.purchase_date || purchase?.created_at)}
                                        </p>
                                    </div>

                                    <div className="text-right max-w-sm">
                                        <p className="text-sm font-semibold print:text-slate-700">{businessName}</p>
                                        {businessPhone && <p className="text-xs opacity-80 print:opacity-100 mt-1">{businessPhone}</p>}
                                        {businessAddress && <p className="text-xs opacity-80 print:opacity-100 mt-1">{businessAddress}</p>}
                                        {businessSocials.map((social) => (
                                            <p key={social.label} className="text-xs opacity-80 print:opacity-100 mt-1">
                                                {social.icon ? `${social.icon} ` : ''}{social.value}
                                            </p>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-6 px-6 py-6 border-b border-slate-100 dark:border-slate-800">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">Supplier</p>
                                    <p className="text-base font-semibold text-slate-900 dark:text-white">{purchase?.supplier?.name || '-'}</p>
                                    {purchase?.supplier?.phone && <p className="text-sm text-slate-600 dark:text-slate-400">{purchase.supplier.phone}</p>}
                                    {purchase?.supplier?.address && <p className="text-sm text-slate-600 dark:text-slate-400">{purchase.supplier.address}</p>}
                                </div>
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">Pengiriman</p>
                                    <p className="text-sm text-slate-700 dark:text-slate-300">Estimasi: {toDisplayDateTime(purchase?.expected_delivery_date)}</p>
                                    {purchase?.actual_delivery_date && (
                                        <p className="text-sm text-slate-700 dark:text-slate-300">Aktual: {toDisplayDateTime(purchase.actual_delivery_date)}</p>
                                    )}
                                </div>
                            </div>

                            <div className="px-6 py-6">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-100 dark:border-slate-800">
                                            <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Item</th>
                                            <th className="pb-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Harga</th>
                                            <th className="pb-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Qty</th>
                                            <th className="pb-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Subtotal</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {(purchase?.details || []).map((detail) => (
                                            <tr key={detail.id}>
                                                <td className="py-3">
                                                    <p className="font-medium text-slate-900 dark:text-white">{detail.part?.name || '-'}</p>
                                                    {detail.part?.part_number && <p className="text-xs text-slate-500 dark:text-slate-400">Kode: {detail.part.part_number}</p>}
                                                </td>
                                                <td className="py-3 text-right text-slate-600 dark:text-slate-400">{formatCurrency(detail.unit_price)}</td>
                                                <td className="py-3 text-center text-slate-600 dark:text-slate-400">{detail.quantity}</td>
                                                <td className="py-3 text-right font-semibold text-slate-900 dark:text-white">{formatCurrency(detail.final_amount || detail.subtotal)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-6">
                                <div className="max-w-xs ml-auto space-y-2 text-sm">
                                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                        <span>Subtotal</span>
                                        <span>{formatCurrency(subtotal)}</span>
                                    </div>
                                    {discountAmount > 0 && (
                                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                            <span>Diskon</span>
                                            <span>- {formatCurrency(discountAmount)}</span>
                                        </div>
                                    )}
                                    {taxAmount > 0 && (
                                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                            <span>Pajak</span>
                                            <span>+ {formatCurrency(taxAmount)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-lg font-bold text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-700">
                                        <span>Total</span>
                                        <span>{formatCurrency(grandTotal)}</span>
                                    </div>
                                </div>
                            </div>

                            {purchase?.notes && (
                                <div className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300 border-t border-slate-100 dark:border-slate-800">
                                    <p className="font-semibold mb-1">Catatan</p>
                                    <p className="whitespace-pre-line">{purchase.notes}</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
