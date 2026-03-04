import React, { useMemo, useState } from "react";
import { Head, Link } from "@inertiajs/react";
import {
    IconArrowLeft,
    IconPrinter,
    IconReceipt,
    IconFileInvoice,
    IconCar,
    IconUser,
    IconTool,
    IconCalendar,
    IconInfoCircle,
} from "@tabler/icons-react";
import ThermalReceipt, { ThermalReceipt58mm } from "@/Components/Receipt/ThermalReceipt";
import { toDisplayDateTime } from "@/Utils/datetime";
import {
    formatBusinessSocials,
    getCompactBusinessSocialDisplay,
    getGoogleBusinessQrUrl,
} from "@/Utils/socialMediaFormatter";

export default function Print({ order, businessProfile }) {
    const [printMode, setPrintMode] = useState("invoice");

    const formatPrice = (price = 0) =>
        Number(price || 0).toLocaleString("id-ID", {
            style: "currency",
            currency: "IDR",
            minimumFractionDigits: 0,
        });

    const formatDateTime = (value) => (value ? toDisplayDateTime(value) : "-");

    const statusMeta = {
        pending: {
            label: "Menunggu",
            color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
        },
        in_progress: {
            label: "Dikerjakan",
            color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
        },
        completed: {
            label: "Selesai",
            color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
        },
        paid: {
            label: "Dibayar",
            color: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
        },
        cancelled: {
            label: "Dibatalkan",
            color: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
        },
    };

    const statusBadge = statusMeta[order?.status] || statusMeta.pending;

    const items = order?.details || [];
    const subtotal = Number(order?.total) || 0;
    const discount = Number(order?.discount_amount) || 0;
    const tax = Number(order?.tax_amount) || 0;
    const grandTotal = Number(order?.grand_total ?? order?.total ?? 0);
    const businessName = businessProfile?.business_name || "SERVICE";
    const businessPhone = businessProfile?.business_phone || "";
    const businessAddress = businessProfile?.business_address || "";
    const consumerNote =
        businessProfile?.receipt_note_service_order ||
        "Simpan nota ini sebagai bukti service. Klaim garansi service wajib menunjukkan nota ini.";
    const businessSocials = formatBusinessSocials(businessProfile);
    const compactSocialInfo = getCompactBusinessSocialDisplay(businessProfile);
    const googleBusinessQrUrl = getGoogleBusinessQrUrl(
        businessProfile?.google_my_business,
        108
    );

    const thermalPayload = useMemo(() => {
        return {
            invoice: order?.order_number,
            created_at: order?.created_at,
            cashier: order?.mechanic ? { name: order.mechanic.name } : null,
            customer: order?.customer ? { name: order.customer.name } : null,
            details: (order?.details || []).map((detail) => {
                const qty = Number(detail.qty) || 1;
                const totalPrice = (Number(detail.price) || 0) * qty;
                return {
                    ...detail,
                    qty,
                    price: totalPrice,
                    product: {
                        title: detail.service?.title || detail.part?.name || "Item",
                    },
                };
            }),
            discount: discount,
            grand_total: grandTotal,
            cash: grandTotal,
            change: 0,
        };
    }, [order, discount, grandTotal]);

    const handlePrint = () => window.print();

    return (
        <>
            <Head title={`Cetak Service Order ${order?.order_number || ""}`} />

            <div className="min-h-screen bg-slate-100 dark:bg-slate-950 py-8 px-4 print:bg-white print:p-0 print:text-[11px] print:leading-tight">
                <div className="max-w-5xl mx-auto space-y-6 print:max-w-none print:space-y-0">
                    {/* Action Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
                        <Link
                            href={route("service-orders.show", order?.id)}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                            <IconArrowLeft size={18} />
                            Kembali ke detail
                        </Link>

                        <div className="flex items-center gap-2">
                            <div className="flex bg-slate-200 dark:bg-slate-800 rounded-xl p-1">
                                <button
                                    type="button"
                                    onClick={() => setPrintMode("invoice")}
                                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                                        printMode === "invoice"
                                            ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow"
                                            : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
                                    }`}
                                >
                                    <IconFileInvoice size={16} className="inline mr-1" />
                                    Invoice
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPrintMode("thermal80")}
                                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                                        printMode === "thermal80"
                                            ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow"
                                            : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
                                    }`}
                                >
                                    <IconReceipt size={16} className="inline mr-1" />
                                    Struk 80mm
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPrintMode("thermal58")}
                                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                                        printMode === "thermal58"
                                            ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow"
                                            : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
                                    }`}
                                >
                                    <IconReceipt size={16} className="inline mr-1" />
                                    Struk 58mm
                                </button>
                            </div>

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

                    {(printMode === "thermal80" || printMode === "thermal58") && (
                        <div className="flex justify-center print:block">
                            <div className="bg-white rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl p-4 print:shadow-none print:border-0 print:p-0 print:rounded-none">
                                {printMode === "thermal80" ? (
                                    <ThermalReceipt
                                        transaction={thermalPayload}
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
                                        transaction={thermalPayload}
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

                    {printMode === "invoice" && (
                        <div className="service-order-invoice bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl print:shadow-none print:border-slate-300 print:rounded-none">
                            {/* Header */}
                            <div className="bg-gradient-to-r from-primary-500 to-primary-700 px-6 py-6 text-white print:bg-slate-100 print:text-slate-900 print:px-3 print:py-2">
                                <div className="flex flex-wrap items-start justify-between gap-4 print:flex-nowrap print:gap-2">
                                    <div>
                                        <div className="flex items-center gap-2 mb-2 print:mb-1">
                                            <IconReceipt size={24} className="print:w-5 print:h-5" />
                                            <span className="text-sm font-medium opacity-90 print:opacity-100 print:text-xs">SERVICE ORDER</span>
                                        </div>
                                        <p className="text-2xl font-bold print:text-lg">{order?.order_number}</p>
                                        <p className="text-sm opacity-80 print:opacity-100 mt-1 print:mt-0.5 print:text-xs">{formatDateTime(order?.created_at)}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-semibold print:text-slate-700 print:text-xs">
                                            {businessName}
                                        </p>
                                        {businessPhone && (
                                            <p className="text-xs opacity-80 print:opacity-100 mt-1 print:mt-0.5">
                                                {businessPhone}
                                            </p>
                                        )}
                                        {businessAddress && (
                                            <p className="text-xs opacity-80 print:opacity-100 mt-1 print:mt-0.5 max-w-xs print:max-w-[260px]">
                                                {businessAddress}
                                            </p>
                                        )}
                                        <span className={`inline-block px-3 py-1 text-xs font-semibold rounded-full ${statusBadge.color} print:px-2 print:py-0.5 print:text-[10px]`}>
                                            {statusBadge.label}
                                        </span>
                                        {order?.maintenance_type && (
                                            <p className="text-sm opacity-80 print:opacity-100 mt-2 print:mt-1 print:text-xs">
                                                {order.maintenance_type}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Info Grid */}
                            <div className="grid md:grid-cols-3 print:grid-cols-[1fr_1fr_1.2fr] gap-6 px-6 py-6 border-b border-slate-100 dark:border-slate-800 print:gap-2 print:px-3 print:py-2.5">
                                <div className="space-y-3 print:space-y-1.5">
                                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                                        <IconUser size={16} className="print:w-3.5 print:h-3.5" />
                                        <span>Pelanggan</span>
                                    </div>
                                    <p className="text-base font-semibold text-slate-900 dark:text-white print:text-sm">{order?.customer?.name || "Umum"}</p>
                                    {order?.customer?.phone && (
                                        <p className="text-sm text-slate-600 dark:text-slate-400 print:text-xs">{order.customer.phone}</p>
                                    )}
                                    {order?.customer?.address && (
                                        <p className="text-sm text-slate-600 dark:text-slate-400 print:text-xs">{order.customer.address}</p>
                                    )}
                                </div>
                                <div className="space-y-3 print:space-y-1.5">
                                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                                        <IconCar size={16} className="print:w-3.5 print:h-3.5" />
                                        <span>Kendaraan</span>
                                    </div>
                                    <p className="text-base font-semibold text-slate-900 dark:text-white print:text-sm">
                                        {order?.vehicle ? `${order.vehicle.brand} ${order.vehicle.model}` : "-"}
                                    </p>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 print:text-xs">{order?.vehicle?.plate_number || "-"}</p>
                                    {order?.odometer_km && (
                                        <p className="text-sm text-slate-600 dark:text-slate-400 print:text-xs">KM: {Number(order.odometer_km).toLocaleString("id-ID")} km</p>
                                    )}
                                </div>

                                <div className="space-y-3 print:space-y-1.5">
                                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                                        <IconTool size={16} className="print:w-3.5 print:h-3.5" />
                                        <span>Mekanik</span>
                                    </div>
                                    <p className="text-base font-semibold text-slate-900 dark:text-white print:text-sm">{order?.mechanic?.name || "-"}</p>
                                    {order?.mechanic?.specialty && (
                                        <p className="text-sm text-slate-600 dark:text-slate-400 print:text-xs">{order.mechanic.specialty}</p>
                                    )}
                                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                                        <IconCalendar size={16} className="print:w-3.5 print:h-3.5" />
                                        <span>Jadwal</span>
                                    </div>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 print:text-xs">Estimasi Mulai: {formatDateTime(order?.estimated_start_at)}</p>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 print:text-xs">Estimasi Selesai: {formatDateTime(order?.estimated_finish_at)}</p>
                                    {order?.actual_start_at && (
                                        <p className="text-sm text-blue-600 dark:text-blue-400 print:text-xs">Mulai: {formatDateTime(order.actual_start_at)}</p>
                                    )}
                                    {order?.actual_finish_at && (
                                        <p className="text-sm text-emerald-600 dark:text-emerald-400 print:text-xs">Selesai: {formatDateTime(order.actual_finish_at)}</p>
                                    )}
                                </div>
                            </div>

                            {/* Items Table */}
                            <div className="px-6 py-6 print:px-3 print:py-2.5">
                                <table className="w-full text-sm print:text-xs">
                                    <thead>
                                        <tr className="border-b border-slate-100 dark:border-slate-800">
                                            <th className="pb-3 print:pb-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Item</th>
                                            <th className="pb-3 print:pb-2 text-center text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Qty</th>
                                            <th className="pb-3 print:pb-2 text-right text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Harga</th>
                                            <th className="pb-3 print:pb-2 text-right text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Subtotal</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {items.map((detail) => {
                                            const qty = Number(detail.qty) || 1;
                                            const subtotalItem = (Number(detail.price) || 0) * qty;
                                            return (
                                                <tr key={detail.id}>
                                                    <td className="py-3 print:py-1.5">
                                                        <p className="font-medium text-slate-900 dark:text-white print:text-xs">{detail.service?.title || detail.part?.name || "Item"}</p>
                                                        {detail.service?.description && (
                                                            <p className="text-xs text-slate-500 dark:text-slate-400 print:hidden">{detail.service.description}</p>
                                                        )}
                                                        {detail.part?.part_number && (
                                                            <p className="text-xs text-slate-500 dark:text-slate-400 print:text-[10px]">Kode: {detail.part.part_number}</p>
                                                        )}
                                                    </td>
                                                    <td className="py-3 print:py-1.5 text-center text-slate-600 dark:text-slate-400">{qty}</td>
                                                    <td className="py-3 print:py-1.5 text-right text-slate-600 dark:text-slate-400">{formatPrice(Number(detail.price) || 0)}</td>
                                                    <td className="py-3 print:py-1.5 text-right font-semibold text-slate-900 dark:text-white">{formatPrice(subtotalItem)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-6 print:px-3 print:py-2.5 border-t border-slate-100 dark:border-slate-800">
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
                                            <span>{formatPrice(subtotal)}</span>
                                        </div>
                                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                            <span>Diskon</span>
                                            <span>- {formatPrice(discount)}</span>
                                        </div>
                                        {tax > 0 && (
                                            <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                                <span>Pajak</span>
                                                <span>+ {formatPrice(tax)}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between text-lg font-bold text-slate-900 dark:text-white pt-1 border-t border-slate-200 dark:border-slate-700 print:text-sm">
                                            <span>Total</span>
                                            <span>{formatPrice(grandTotal)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {order?.notes && (
                                <div className="px-6 py-4 print:px-3 print:py-1.5 text-sm print:text-xs text-slate-600 dark:text-slate-300 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                                    <IconInfoCircle size={16} className="text-primary-500 print:w-3.5 print:h-3.5" />
                                    <p className="whitespace-pre-line print:leading-tight">{order.notes}</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                @media print {
                    @page {
                        size: A4;
                        margin: 6mm;
                    }

                    .service-order-invoice tr {
                        break-inside: avoid;
                    }
                }
            `}</style>
        </>
    );
}
