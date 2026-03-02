import React from "react";
import { toDisplayDateTime } from "@/Utils/datetime";

/**
 * ThermalReceipt - Receipt template optimized for thermal printers (58mm/80mm)
 *
 * Features:
 * - Monospace font for alignment
 * - Fixed width for thermal paper
 * - No colors (thermal printers are B&W)
 * - Simple lines using dashes
 * - Compact layout
 */
export default function ThermalReceipt({
    transaction,
    storeName = "TOKO ANDA",
    storeAddress = "",
    storePhone = "",
    businessSocials = [],
}) {
    const formatPrice = (price = 0) => {
        return "Rp " + Number(price || 0).toLocaleString("id-ID");
    };

    const formatDate = (value) => toDisplayDateTime(value);

    const items = transaction?.details ?? [];

    // Calculate totals
    const subtotal = transaction?.grand_total + (transaction?.discount || 0);
    const discount = transaction?.discount || 0;
    const total = transaction?.grand_total || 0;
    const cash = transaction?.cash || 0;
    const change = transaction?.change || 0;

    const paymentLabels = {
        cash: "TUNAI",
        midtrans: "MIDTRANS",
        xendit: "XENDIT",
    };
    const paymentMethod =
        paymentLabels[transaction?.payment_method?.toLowerCase()] || "TUNAI";

    // Line separator
    const line = "=".repeat(32);
    const dashLine = "-".repeat(32);

    return (
        <div
            className="thermal-receipt font-mono text-xs leading-tight"
            style={{ width: "80mm", padding: "4mm" }}
        >
            {/* Store Header */}
            <div className="text-center mb-2">
                <p className="text-sm font-bold">{storeName}</p>
                {storeAddress && <p className="text-xs">{storeAddress}</p>}
                {storePhone && <p className="text-xs">Telp: {storePhone}</p>}
                {businessSocials.map((social) => (
                    <p key={social.label} className="text-xs">
                        {social.icon ? `${social.icon} ` : ''}{social.value}
                    </p>
                ))}
            </div>

            <pre className="whitespace-pre-wrap">{line}</pre>

            {/* Invoice Info */}
            <div className="my-1">
                <div className="flex justify-between">
                    <span>No:</span>
                    <span>{transaction?.invoice}</span>
                </div>
                <div className="flex justify-between">
                    <span>Tgl:</span>
                    <span>{formatDate(transaction?.created_at)}</span>
                </div>
                <div className="flex justify-between">
                    <span>Kasir:</span>
                    <span>{transaction?.cashier?.name || "-"}</span>
                </div>
                <div className="flex justify-between">
                    <span>Pelanggan:</span>
                    <span>{transaction?.customer?.name || "Umum"}</span>
                </div>
            </div>

            <pre className="whitespace-pre-wrap">{line}</pre>

            {/* Items */}
            <div className="my-1">
                {items.map((item, index) => {
                    const qty = Number(item.qty) || 1;
                    const itemTotal = Number(item.price) || 0;
                    const unitPrice = itemTotal / qty;

                    return (
                        <div key={item.id || index} className="mb-1">
                            <p className="font-medium truncate">
                                {item.product?.title}
                            </p>
                            <div className="flex justify-between">
                                <span>
                                    {qty}x @ {formatPrice(unitPrice)}
                                </span>
                                <span>{formatPrice(itemTotal)}</span>
                            </div>
                        </div>
                    );
                })}
            </div>

            <pre className="whitespace-pre-wrap">{dashLine}</pre>

            {/* Totals */}
            <div className="my-1">
                <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{formatPrice(subtotal)}</span>
                </div>
                {discount > 0 && (
                    <div className="flex justify-between">
                        <span>Diskon</span>
                        <span>-{formatPrice(discount)}</span>
                    </div>
                )}
                <div className="flex justify-between font-bold text-sm">
                    <span>TOTAL</span>
                    <span>{formatPrice(total)}</span>
                </div>
            </div>

            <pre className="whitespace-pre-wrap">{dashLine}</pre>

            {/* Payment Info */}
            <div className="my-1">
                <div className="flex justify-between">
                    <span>Bayar ({paymentMethod})</span>
                    <span>{formatPrice(cash)}</span>
                </div>
                {change > 0 && (
                    <div className="flex justify-between font-bold">
                        <span>Kembali</span>
                        <span>{formatPrice(change)}</span>
                    </div>
                )}
            </div>

            <pre className="whitespace-pre-wrap">{line}</pre>

            {/* Footer */}
            <div className="text-center mt-2">
                <p className="text-xs">Terima kasih</p>
                <p className="text-xs">Barang yang sudah dibeli</p>
                <p className="text-xs">tidak dapat ditukar/dikembalikan</p>
            </div>

            {/* Print-specific styles */}
            <style>{`
                @media print {
                    .thermal-receipt {
                        width: 80mm !important;
                        margin: 0 !important;
                        padding: 2mm !important;
                        font-size: 10pt !important;
                    }
                    @page {
                        size: 80mm auto;
                        margin: 0;
                    }
                }
            `}</style>
        </div>
    );
}

/**
 * Compact Receipt for 58mm printers
 */
export function ThermalReceipt58mm({
    transaction,
    storeName = "TOKO",
    storePhone = "",
    businessSocials = [],
}) {
    const formatPrice = (price = 0) => {
        return "Rp" + Number(price || 0).toLocaleString("id-ID");
    };

    const formatTime = (value) => toDisplayDateTime(value);

    const items = transaction?.details ?? [];
    const line = "-".repeat(24);

    return (
        <div
            className="thermal-receipt-58 font-mono text-xs"
            style={{ width: "58mm", padding: "2mm" }}
        >
            <div className="text-center">
                <p className="font-bold">{storeName}</p>
                {storePhone && <p>{storePhone}</p>}
                {businessSocials.map((social) => (
                    <p key={social.label} className="truncate text-xs">
                        {social.icon ? `${social.icon} ` : ''}{social.value}
                    </p>
                ))}
            </div>

            <pre>{line}</pre>
            <p>#{transaction?.invoice}</p>
            <p>{formatTime(transaction?.created_at)}</p>
            <pre>{line}</pre>

            {items.map((item, i) => (
                <div key={i} className="mb-1">
                    <p className="truncate">{item.product?.title}</p>
                    <div className="flex justify-between">
                        <span>{item.qty}x</span>
                        <span>{formatPrice(item.price)}</span>
                    </div>
                </div>
            ))}

            <pre>{line}</pre>
            <div className="flex justify-between font-bold">
                <span>TOTAL</span>
                <span>{formatPrice(transaction?.grand_total)}</span>
            </div>
            <div className="flex justify-between">
                <span>Bayar</span>
                <span>{formatPrice(transaction?.cash)}</span>
            </div>
            <div className="flex justify-between">
                <span>Kembali</span>
                <span>{formatPrice(transaction?.change)}</span>
            </div>
            <pre>{line}</pre>
            <p className="text-center">Terima kasih!</p>

            <style>{`
                @media print {
                    .thermal-receipt-58 {
                        width: 58mm !important;
                        font-size: 9pt !important;
                    }
                    @page { size: 58mm auto; margin: 0; }
                }
            `}</style>
        </div>
    );
}
