import React, { useMemo, useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import { IconArrowLeft, IconPrinter, IconReceipt, IconFileInvoice } from '@tabler/icons-react';
import ThermalReceipt, { ThermalReceipt58mm } from '@/Components/Receipt/ThermalReceipt';
import { toDisplayDateTime } from '@/Utils/datetime';
import { formatBusinessSocials } from '@/Utils/socialMediaFormatter';

export default function Print({ sale, businessProfile }) {
    const [printMode, setPrintMode] = useState('invoice');

    const formatCurrency = (value = 0) =>
        new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
        }).format(value || 0);

    const subtotal = sale?.subtotal ?? (sale?.details || []).reduce((sum, detail) => {
        const fallback = (Number(detail.quantity || 0) * Number(detail.unit_price || 0)) - Number(detail.discount_amount || 0);
        return sum + Number(detail.final_amount ?? fallback);
    }, 0);
    const discountAmount = Number(sale?.discount_amount || 0);
    const taxAmount = Number(sale?.tax_amount || 0);
    const grandTotal = Number(sale?.grand_total ?? (subtotal - discountAmount + taxAmount));

    const businessName = businessProfile?.business_name || 'POS BENGKEL';
    const businessPhone = businessProfile?.business_phone || '';
    const businessAddress = businessProfile?.business_address || '';
    const businessSocials = formatBusinessSocials(businessProfile);

    const thermalPayload = useMemo(() => ({
        invoice: sale?.sale_number,
        created_at: sale?.sale_date || sale?.created_at,
        cashier: sale?.creator ? { name: sale.creator.name } : null,
        customer: sale?.customer ? { name: sale.customer.name } : null,
        details: (sale?.details || []).map((detail) => {
            const qty = Number(detail.quantity) || 1;
            const itemTotal = Number(detail.final_amount ?? ((detail.quantity || 0) * (detail.unit_price || 0) - (detail.discount_amount || 0))) || 0;
            return {
                id: detail.id,
                qty,
                price: itemTotal,
                product: {
                    title: detail.part?.name || '-',
                },
            };
        }),
        discount: discountAmount,
        grand_total: grandTotal,
        cash: Number(sale?.paid_amount || 0),
        change: Math.max(0, Number(sale?.paid_amount || 0) - grandTotal),
        payment_method: 'cash',
    }), [sale, discountAmount, grandTotal]);

    return (
        <>
            <Head title={`Cetak Penjualan ${sale?.sale_number || ''}`} />

            <div className="min-h-screen bg-slate-100 dark:bg-slate-950 py-8 px-4 print:bg-white print:p-0">
                <div className="max-w-5xl mx-auto space-y-6">
                    <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
                        <Link
                            href={route('part-sales.show', sale?.id)}
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
                                            <span className="text-sm font-medium opacity-90 print:opacity-100">INVOICE PENJUALAN SPAREPART</span>
                                        </div>
                                        <p className="text-2xl font-bold">{sale?.sale_number}</p>
                                        <p className="text-sm opacity-80 print:opacity-100 mt-1">
                                            {toDisplayDateTime(sale?.sale_date || sale?.created_at)}
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
                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">Pelanggan</p>
                                    <p className="text-base font-semibold text-slate-900 dark:text-white">{sale?.customer?.name || '-'}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">Kasir</p>
                                    <p className="text-base font-semibold text-slate-900 dark:text-white">{sale?.creator?.name || '-'}</p>
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
                                        {(sale?.details || []).map((detail) => {
                                            const qty = Number(detail.quantity || 0);
                                            const lineTotal = Number(detail.final_amount ?? ((detail.quantity || 0) * (detail.unit_price || 0) - (detail.discount_amount || 0))) || 0;
                                            const unitPrice = qty > 0 ? lineTotal / qty : 0;

                                            return (
                                                <tr key={detail.id}>
                                                    <td className="py-3">
                                                        <p className="font-medium text-slate-900 dark:text-white">{detail.part?.name || '-'}</p>
                                                        {detail.part?.part_number && <p className="text-xs text-slate-500 dark:text-slate-400">Kode: {detail.part.part_number}</p>}
                                                    </td>
                                                    <td className="py-3 text-right text-slate-600 dark:text-slate-400">{formatCurrency(unitPrice)}</td>
                                                    <td className="py-3 text-center text-slate-600 dark:text-slate-400">{qty}</td>
                                                    <td className="py-3 text-right font-semibold text-slate-900 dark:text-white">{formatCurrency(lineTotal)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-6">
                                <div className="max-w-xs ml-auto space-y-2 text-sm">
                                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                        <span>Subtotal</span>
                                        <span>{formatCurrency(subtotal)}</span>
                                    </div>
                                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                        <span>Diskon</span>
                                        <span>- {formatCurrency(discountAmount)}</span>
                                    </div>
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

                            {sale?.notes && (
                                <div className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300 border-t border-slate-100 dark:border-slate-800">
                                    <p className="font-semibold mb-1">Catatan</p>
                                    <p className="whitespace-pre-line">{sale.notes}</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
