import React, { useState } from "react";
import { Head, Link } from "@inertiajs/react";
import {
    IconArrowLeft,
    IconPrinter,
    IconExternalLink,
    IconReceipt,
    IconFileInvoice,
} from "@tabler/icons-react";
import ThermalReceipt, {
    ThermalReceipt58mm,
} from "@/Components/Receipt/ThermalReceipt";
import { toDisplayDateTime } from "@/Utils/datetime";
import {
    formatBusinessSocials,
    getCompactBusinessSocialDisplay,
    getGoogleBusinessQrUrl,
} from "@/Utils/socialMediaFormatter";

export default function Print({ transaction, businessProfile }) {
    const [printMode, setPrintMode] = useState("invoice"); // 'invoice' | 'thermal80' | 'thermal58'

    const formatPrice = (price = 0) =>
        Number(price || 0).toLocaleString("id-ID", {
            style: "currency",
            currency: "IDR",
            minimumFractionDigits: 0,
        });

    const formatDateTime = (value) => toDisplayDateTime(value);

    const items = transaction?.details ?? [];
    const businessName = businessProfile?.business_name || "TOKO ANDA";
    const businessPhone = businessProfile?.business_phone || "";
    const businessAddress = businessProfile?.business_address || "";
    const consumerNote =
        businessProfile?.receipt_note_transaction ||
        "Simpan nota ini sebagai bukti transaksi. Komplain atau retur dilayani sesuai kebijakan toko.";
    const businessSocials = formatBusinessSocials(businessProfile);
    const compactSocialInfo = getCompactBusinessSocialDisplay(businessProfile);
    const googleBusinessQrUrl = getGoogleBusinessQrUrl(
        businessProfile?.google_my_business,
        108
    );

    const paymentLabels = {
        cash: "Tunai",
        midtrans: "Midtrans",
        xendit: "Xendit",
    };
    const paymentMethodKey = (
        transaction?.payment_method || "cash"
    ).toLowerCase();
    const paymentMethodLabel = paymentLabels[paymentMethodKey] ?? "Tunai";

    const paymentStatuses = {
        paid: "Lunas",
        pending: "Menunggu",
        failed: "Gagal",
        expired: "Kedaluwarsa",
    };
    const paymentStatusKey = (transaction?.payment_status || "").toLowerCase();
    const paymentStatusLabel =
        paymentStatuses[paymentStatusKey] ??
        (paymentMethodKey === "cash" ? "Lunas" : "Menunggu");

    const statusColors = {
        paid: "bg-success-100 text-success-700 dark:bg-success-900/50 dark:text-success-400",
        pending:
            "bg-warning-100 text-warning-700 dark:bg-warning-900/50 dark:text-warning-400",
        failed: "bg-danger-100 text-danger-700 dark:bg-danger-900/50 dark:text-danger-400",
        expired:
            "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400",
    };
    const paymentStatusColor =
        statusColors[paymentStatusKey] ?? statusColors.paid;

    const isNonCash = paymentMethodKey !== "cash";
    const showPaymentLink = isNonCash && transaction.payment_url;

    const handlePrint = () => {
        window.print();
    };

    return (
        <>
            <Head title="Invoice Penjualan" />

            <div className="min-h-screen bg-slate-100 dark:bg-slate-950 py-8 px-4 print:bg-white print:p-0">
                <div className="max-w-4xl mx-auto space-y-6 print:max-w-none">
                    {/* Action Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
                        <Link
                            href={route("transactions.index")}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                            <IconArrowLeft size={18} />
                            Kembali ke kasir
                        </Link>

                        <div className="flex items-center gap-2">
                            {/* Print Mode Selector */}
                            <div className="flex bg-slate-200 dark:bg-slate-800 rounded-xl p-1">
                                <button
                                    onClick={() => setPrintMode("invoice")}
                                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                                        printMode === "invoice"
                                            ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow"
                                            : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
                                    }`}
                                >
                                    <IconFileInvoice
                                        size={16}
                                        className="inline mr-1"
                                    />
                                    Invoice
                                </button>
                                <button
                                    onClick={() => setPrintMode("thermal80")}
                                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                                        printMode === "thermal80"
                                            ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow"
                                            : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
                                    }`}
                                >
                                    <IconReceipt
                                        size={16}
                                        className="inline mr-1"
                                    />
                                    Struk 80mm
                                </button>
                                <button
                                    onClick={() => setPrintMode("thermal58")}
                                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                                        printMode === "thermal58"
                                            ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow"
                                            : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
                                    }`}
                                >
                                    <IconReceipt
                                        size={16}
                                        className="inline mr-1"
                                    />
                                    Struk 58mm
                                </button>
                            </div>

                            {showPaymentLink && (
                                <a
                                    href={transaction.payment_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-primary-200 dark:border-primary-800 text-sm font-semibold text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950/50 transition-colors"
                                >
                                    <IconExternalLink size={18} />
                                    Pembayaran
                                </a>
                            )}

                            <button
                                type="button"
                                onClick={handlePrint}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-sm font-semibold text-white shadow-lg shadow-primary-500/30 transition-colors"
                            >
                                <IconPrinter size={18} />
                                Cetak
                            </button>
                        </div>
                    </div>

                    {/* Thermal Receipt Preview */}
                    {(printMode === "thermal80" ||
                        printMode === "thermal58") && (
                        <div className="flex justify-center print:block">
                            <div className="bg-white rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl p-4 print:shadow-none print:border-0 print:p-0 print:rounded-none">
                                {printMode === "thermal80" ? (
                                    <ThermalReceipt
                                        transaction={transaction}
                                        storeName={businessName}
                                        storeAddress={businessAddress}
                                        storePhone={businessPhone}
                                        businessSocials={businessSocials}
                                        businessSocialInfo={compactSocialInfo}
                                        googleBusinessQrUrl={googleBusinessQrUrl}
                                        consumerNote={consumerNote}
                                    />
                                ) : (
                                    <ThermalReceipt58mm
                                        transaction={transaction}
                                        storeName={businessName}
                                        storePhone={businessPhone}
                                        businessSocials={businessSocials}
                                        businessSocialInfo={compactSocialInfo}
                                        googleBusinessQrUrl={googleBusinessQrUrl}
                                        consumerNote={consumerNote}
                                    />
                                )}
                            </div>
                        </div>
                    )}

                    {/* Invoice View */}
                    {printMode === "invoice" && (
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl print:shadow-none print:border-slate-300">
                            {/* Header */}
                            <div className="bg-gradient-to-r from-primary-500 to-primary-700 px-6 py-6 text-white print:bg-slate-100 print:text-slate-900">
                                <div className="flex flex-wrap items-start justify-between gap-4 print:flex-nowrap print:gap-3">
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <IconReceipt size={24} />
                                            <span className="text-sm font-medium opacity-90 print:opacity-100">
                                                INVOICE
                                            </span>
                                        </div>
                                        <p className="text-2xl font-bold">
                                            {transaction.invoice}
                                        </p>
                                        <p className="text-sm opacity-80 print:opacity-100 mt-1">
                                            {formatDateTime(
                                                transaction.created_at
                                            )}
                                        </p>
                                    </div>

                                    <div className="text-right">
                                        <p className="text-sm font-semibold print:text-slate-700">
                                            {businessName}
                                        </p>
                                        {businessPhone && (
                                            <p className="text-xs opacity-80 print:opacity-100 mt-1">
                                                {businessPhone}
                                            </p>
                                        )}
                                        {businessAddress && (
                                            <p className="text-xs opacity-80 print:opacity-100 mt-1 max-w-xs">
                                                {businessAddress}
                                            </p>
                                        )}
                                        <span
                                            className={`inline-block px-3 py-1 text-xs font-semibold rounded-full ${paymentStatusColor}`}
                                        >
                                            {paymentStatusLabel}
                                        </span>
                                        <p className="text-sm opacity-80 print:opacity-100 mt-2">
                                            {paymentMethodLabel}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Info Grid */}
                            <div className="grid md:grid-cols-2 print:grid-cols-2 gap-6 px-6 py-6 border-b border-slate-100 dark:border-slate-800 print:gap-3 print:px-4 print:py-3">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                                        Pelanggan
                                    </p>
                                    <p className="text-base font-semibold text-slate-900 dark:text-white">
                                        {transaction.customer?.name ?? "Umum"}
                                    </p>
                                    {transaction.customer?.address && (
                                        <p className="text-sm text-slate-600 dark:text-slate-400">
                                            {transaction.customer.address}
                                        </p>
                                    )}
                                    {transaction.customer?.phone && (
                                        <p className="text-sm text-slate-600 dark:text-slate-400">
                                            {transaction.customer.phone}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                                        Kasir
                                    </p>
                                    <p className="text-base font-semibold text-slate-900 dark:text-white">
                                        {transaction.cashier?.name ?? "-"}
                                    </p>
                                </div>
                            </div>

                            {/* Items Table */}
                            <div className="px-6 py-6">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-100 dark:border-slate-800">
                                            <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                                Item
                                            </th>
                                            <th className="pb-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                                Harga
                                            </th>
                                            <th className="pb-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                                Qty
                                            </th>
                                            <th className="pb-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                                Subtotal
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {items.map((item, index) => {
                                            const quantity =
                                                Number(item.qty) || 1;
                                            const subtotal =
                                                Number(item.price) || 0;
                                            const unitPrice =
                                                subtotal / quantity;

                                            return (
                                                <tr key={item.id ?? index}>
                                                    <td className="py-3">
                                                        <p className="font-medium text-slate-900 dark:text-white">
                                                            {item.part?.name || item.service?.title || item.product?.title}
                                                        </p>
                                                        {item.part?.part_number && (
                                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                                Kode: {item.part.part_number}
                                                            </p>
                                                        )}
                                                        {item.service?.title && (
                                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                                {item.service?.description}
                                                            </p>
                                                        )}
                                                    </td>
                                                    <td className="py-3 text-right text-slate-600 dark:text-slate-400">
                                                        {formatPrice(unitPrice)}
                                                    </td>
                                                    <td className="py-3 text-center text-slate-600 dark:text-slate-400">
                                                        {quantity}
                                                    </td>
                                                    <td className="py-3 text-right font-semibold text-slate-900 dark:text-white">
                                                        {formatPrice(subtotal)}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-6 print:px-4 print:py-2.5 border-t border-slate-100 dark:border-slate-800">
                                <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-[1fr_280px] gap-4 print:gap-2 items-start">
                                    <div className="space-y-2 print:space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                                        {(compactSocialInfo.mergedLine || compactSocialInfo.socials.length > 0 || businessProfile?.google_my_business) && (
                                            <div className="flex items-start justify-between gap-3 print:gap-2">
                                                <div className="space-y-1">
                                                    {compactSocialInfo.mergedLine && <p>{compactSocialInfo.mergedLine}</p>}
                                                    {compactSocialInfo.socials.map((social) => (
                                                        <p key={social.label}>{social.label}: {social.value}</p>
                                                    ))}
                                                </div>
                                                {googleBusinessQrUrl && (
                                                    <div className="text-center shrink-0">
                                                        <img src={googleBusinessQrUrl} alt="QR Google Business" className="w-[70px] h-[70px] print:w-[58px] print:h-[58px]" />
                                                        <p className="text-[10px] text-slate-500 mt-0.5">Yuk review {businessName} di Google</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <div>
                                            <p className="font-semibold">Catatan untuk Konsumen</p>
                                            <p>{consumerNote}</p>
                                        </div>
                                    </div>

                                    <div className="w-full max-w-xs ml-auto space-y-1 text-sm print:text-xs">
                                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                            <span>Subtotal</span>
                                            <span>
                                                {formatPrice(
                                                    transaction.grand_total +
                                                        (transaction.discount || 0)
                                                )}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                            <span>Diskon</span>
                                            <span>- {formatPrice(transaction.discount)}</span>
                                        </div>
                                        <div className="flex justify-between text-lg font-bold text-slate-900 dark:text-white pt-1 border-t border-slate-200 dark:border-slate-700 print:text-sm">
                                            <span>Total</span>
                                            <span>{formatPrice(transaction.grand_total)}</span>
                                        </div>
                                        {paymentMethodKey === "cash" && (
                                            <>
                                                <div className="flex justify-between text-slate-600 dark:text-slate-400 pt-1">
                                                    <span>Tunai</span>
                                                    <span>{formatPrice(transaction.cash)}</span>
                                                </div>
                                                <div className="flex justify-between text-success-600 dark:text-success-400 font-medium">
                                                    <span>Kembali</span>
                                                    <span>{formatPrice(transaction.change)}</span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="px-6 py-4 print:px-4 print:py-2 text-center border-t border-slate-100 dark:border-slate-800">
                                <p className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                    Terima kasih telah berbelanja
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
