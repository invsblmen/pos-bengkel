import React, { useEffect, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import TransactionPaymentSection from '@/Components/TransactionPaymentSection';
import PaymentReceiptModal from '@/Components/PaymentReceiptModal';
import {
    IconArrowLeft,
    IconPencil,
    IconPrinter,
    IconClipboardList,
    IconShieldCheck,
    IconUser,
    IconCar,
    IconTool,
    IconClock,
    IconCurrencyDollar,
    IconBrandWhatsapp,
} from '@tabler/icons-react';
import { toDisplayDateTime } from '@/Utils/datetime';
import toast from 'react-hot-toast';

export default function Show({ order, warrantyRegistrations = {}, permissions = {}, cashDenominations = [] }) {
    const [liveOrder, setLiveOrder] = useState(order);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [sendingWhatsApp, setSendingWhatsApp] = useState(false);

    useEffect(() => {
        setLiveOrder(order);
    }, [order]);

    const currentOrder = liveOrder || order;

    const formatPrice = (price) =>
        new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
        }).format(Number(price || 0));

    const formatDate = (dateString) => (dateString ? toDisplayDateTime(dateString) : '-');
    const normalizeMoney = (value) => Math.max(0, Number(value || 0));

    const getStatusBadge = (status) => {
        const badges = {
            pending: { color: 'bg-yellow-100 text-yellow-700', label: 'Menunggu' },
            in_progress: { color: 'bg-blue-100 text-blue-700', label: 'Dikerjakan' },
            completed: { color: 'bg-green-100 text-green-700', label: 'Selesai' },
            paid: { color: 'bg-purple-100 text-purple-700', label: 'Sudah Dibayar' },
            cancelled: { color: 'bg-red-100 text-red-700', label: 'Dibatalkan' },
        };
        return badges[status] || badges.pending;
    };

    const getPaymentBadge = (status) => {
        const badges = {
            paid: { color: 'bg-green-100 text-green-700', label: '✓ Lunas' },
            partial: { color: 'bg-blue-100 text-blue-700', label: '◐ Sebagian' },
            unpaid: { color: 'bg-gray-100 text-gray-700', label: '○ Belum Bayar' },
        };
        return badges[status] || badges.unpaid;
    };

    const getWarrantyMeta = (detail) => {
        const registration = warrantyRegistrations?.[detail.id];
        if (!registration) {
            return {
                label: 'Tanpa Garansi',
                badgeClass: 'bg-slate-100 text-slate-700',
                canClaim: false,
                periodDays: 0,
                endDate: null,
                isNearExpiry: false,
            };
        }

        const endDate = registration.warranty_end_date ? new Date(registration.warranty_end_date) : null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (endDate) endDate.setHours(0, 0, 0, 0);

        if (registration.claimed_at || registration.status === 'claimed') {
            return {
                label: 'Sudah Diklaim',
                badgeClass: 'bg-blue-100 text-blue-700',
                canClaim: false,
                periodDays: Number(registration.warranty_period_days || 0),
                endDate: registration.warranty_end_date,
                isNearExpiry: false,
            };
        }

        if (!endDate || endDate < today) {
            return {
                label: 'Expired',
                badgeClass: 'bg-red-100 text-red-700',
                canClaim: false,
                periodDays: Number(registration.warranty_period_days || 0),
                endDate: registration.warranty_end_date,
                isNearExpiry: false,
            };
        }

        const warningThreshold = new Date(today);
        warningThreshold.setDate(warningThreshold.getDate() + 7);

        return {
            label: 'Aktif',
            badgeClass: 'bg-emerald-100 text-emerald-700',
            canClaim: true,
            periodDays: Number(registration.warranty_period_days || 0),
            endDate: registration.warranty_end_date,
            isNearExpiry: endDate <= warningThreshold,
        };
    };

    const handleClaimWarranty = (detail) => {
        const notes = window.prompt('Catatan klaim garansi (opsional):') || '';

        router.post(
            route('service-orders.details.claim-warranty', { id: currentOrder.id, detailId: detail.id }),
            { claim_notes: notes },
            {
                preserveScroll: true,
                onSuccess: () => toast.success('Klaim garansi berhasil dicatat'),
                onError: (errors) => toast.error(errors?.error || 'Gagal mencatat klaim garansi'),
            }
        );
    };

    const handleSendWhatsAppSummary = () => {
        if (!currentOrder?.customer?.phone) {
            toast.error('Pelanggan belum memiliki nomor WhatsApp.');
            return;
        }

        setSendingWhatsApp(true);

        router.post(
            route('service-orders.whatsapp.send', currentOrder.id),
            {},
            {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success('Rincian service order berhasil di-queue ke WhatsApp.');
                },
                onError: (errors) => {
                    toast.error(errors?.phone || errors?.error || 'Gagal mengirim rincian WhatsApp');
                },
                onFinish: () => {
                    setSendingWhatsApp(false);
                },
            }
        );
    };


    const statusBadge = getStatusBadge(currentOrder.status);
    const paymentBadge = getPaymentBadge(currentOrder.payment_status);
    const details = currentOrder.details || [];
    const totalItems = details.reduce((sum, detail) => sum + Number(detail.qty || 0), 0);
    const grossSubtotal = details.reduce(
        (sum, detail) => sum + normalizeMoney(detail.amount ?? detail.price * (detail.qty || 0) ?? 0),
        0
    );
    const itemDiscountTotal = details.reduce(
        (sum, detail) => sum + Math.max(0, normalizeMoney(detail.amount ?? 0) - normalizeMoney(detail.final_amount ?? detail.amount ?? 0)),
        0
    );
    const itemNetSubtotal = Math.max(0, grossSubtotal - itemDiscountTotal);
    const serviceCost = details.reduce(
        (sum, detail) => sum + (detail.service_id ? normalizeMoney(detail.final_amount ?? detail.amount ?? 0) : 0),
        0
    );
    const partCost = details.reduce(
        (sum, detail) => sum + (detail.part_id ? normalizeMoney(detail.final_amount ?? detail.amount ?? 0) : 0),
        0
    );
    const subtotal = details.reduce((sum, detail) => sum + normalizeMoney(detail.final_amount ?? detail.amount ?? 0), 0);
    const storedDiscountAmount = normalizeMoney(currentOrder.discount_amount || 0);
    const orderDiscountAmount = Math.max(0, storedDiscountAmount - itemDiscountTotal);
    const voucherAmount = Math.min(normalizeMoney(currentOrder.voucher_discount_amount || 0), Math.max(0, itemNetSubtotal - orderDiscountAmount));
    const taxAmount = normalizeMoney(currentOrder.tax_amount || 0);
    const roundingAdjustment = Number(currentOrder.rounding_adjustment || 0);
    const calculatedGrandTotal = Math.max(0, itemNetSubtotal - orderDiscountAmount - voucherAmount + taxAmount + roundingAdjustment);
    const storedGrandTotal = Number(currentOrder.grand_total || currentOrder.total || 0);
    const grandTotal = storedGrandTotal > 0 ? storedGrandTotal : calculatedGrandTotal;

    const warrantyActiveCount = details.reduce((sum, detail) => {
        const meta = getWarrantyMeta(detail);
        return meta.label === 'Aktif' ? sum + 1 : sum;
    }, 0);

    const getMechanicHref = (mechanicId) => {
        if (!mechanicId) return null;

        if (route().has('mechanics.show')) {
            return route('mechanics.show', mechanicId);
        }
        if (route().has('mechanics.performance.show')) {
            return route('mechanics.performance.show', mechanicId);
        }
        if (route().has('mechanics.index')) {
            return route('mechanics.index');
        }

        return null;
    };

    const mechanicHref = getMechanicHref(currentOrder.mechanic?.id);

    const paidAmount = Number(currentOrder.paid_amount || 0);
    const remainingAmount = grandTotal - paidAmount;

    const handlePaymentConfirm = (paymentData) => {
        try {
            // Extract received_denominations from payment_meta.cash_breakdown
            const receivedDenominations = Array.isArray(paymentData.payment_meta?.cash_breakdown)
                ? paymentData.payment_meta.cash_breakdown.map(item => ({
                    denomination_id: Number(item.denomination_id || 0),
                    quantity: Number(item.quantity || 0),
                  }))
                : [];

            // IMPORTANT: payment_amount must be the TOTAL CASH RECEIVED, not the amount to apply
            // The backend will then calculate change: change = receivedTotal - appliedAmount
            const cashReceivedTotal = Number(paymentData.payment_meta?.cash_received_total || 0);
            const amountToApply = Number(paymentData.paid_amount || 0);

            // Transform frontend data structure to match backend expectations
            const transformedData = {
                payment_amount: Math.max(1, cashReceivedTotal), // Total cash received from customer
                applied_amount: Math.max(0, amountToApply), // Amount to apply to bill (may differ due to rounding/change)
                payment_method: paymentData.payment_method || 'cash',
                transfer_destination: paymentData.transfer_destination || '',
                payment_meta: paymentData.payment_meta || {},
                received_denominations: receivedDenominations,
            };

            console.log('Payment submission data:', {
                cashReceivedTotal,
                amountToApply,
                transformedData
            });

            router.post(
                route('service-orders.update-payment', currentOrder.id),
                transformedData,
                {
                    preserveScroll: true,
                    onSuccess: () => {
                        toast.success('Pembayaran berhasil dicatat');
                        setShowPaymentModal(false);
                        router.reload();
                    },
                    onError: (errors) => {
                        console.error('Payment error response:', errors);
                        const errorMessage = errors?.payment_amount?.[0] || errors?.error || JSON.stringify(errors) || 'Gagal mencatat pembayaran';
                        toast.error(errorMessage);
                    },
                }
            );
        } catch (error) {
            console.error('Payment handler error:', error);
            toast.error('Terjadi kesalahan saat memproses pembayaran');
        }
    };

    return (
        <>
            <Head title={`Service Order ${currentOrder.order_number}`} />

            <div className="space-y-5">
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Service Order</p>
                            <h1 className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">Order #{currentOrder.order_number}</h1>
                            <p className="mt-1 text-sm text-gray-500">{currentOrder.customer?.name || 'Tanpa pelanggan'} - {currentOrder.vehicle?.plate_number || 'Tanpa kendaraan'}</p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadge.color}`}>{statusBadge.label}</span>
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${paymentBadge.color}`}>{paymentBadge.label}</span>
                            <button
                                type="button"
                                onClick={handleSendWhatsAppSummary}
                                disabled={sendingWhatsApp || !currentOrder.customer?.phone}
                                className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300"
                            >
                                <IconBrandWhatsapp size={16} />
                                {sendingWhatsApp ? 'Mengirim...' : 'Kirim WhatsApp'}
                            </button>
                            <Link href={route('service-orders.print', { id: currentOrder.id, mode: 'invoice' })} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold">
                                <IconPrinter size={16} /> Invoice
                            </Link>
                            <Link href={route('service-orders.print', { id: currentOrder.id, mode: 'work_order' })} className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300">
                                <IconClipboardList size={16} /> WO
                            </Link>
                            <Link href={route('service-orders.index')} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold">
                                <IconArrowLeft size={16} /> Kembali
                            </Link>
                            <Link href={route('service-orders.edit', currentOrder.id)} className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-3 py-2 text-sm font-semibold text-white">
                                <IconPencil size={16} /> Edit
                            </Link>
                        </div>
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                        <p className="mb-1 inline-flex items-center gap-1 text-xs text-gray-500">
                            <IconCurrencyDollar size={14} /> Biaya Jasa
                        </p>
                        <p className="mt-1 text-xl font-bold">{formatPrice(serviceCost)}</p>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                        <p className="mb-1 inline-flex items-center gap-1 text-xs text-gray-500">
                            <IconCar size={14} /> Biaya Part
                        </p>
                        <p className="mt-1 text-xl font-bold">{formatPrice(partCost)}</p>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                        <p className="mb-1 inline-flex items-center gap-1 text-xs text-gray-500">
                            <IconTool size={14} /> Item Pekerjaan
                        </p>
                        <p className="mt-1 text-xl font-bold">{totalItems}</p>
                        <p className="text-xs text-emerald-600">{warrantyActiveCount} item garansi aktif</p>
                    </div>
                    <div className="rounded-xl border border-primary-200 bg-primary-50 p-4 dark:border-primary-800 dark:bg-primary-900/20">
                            <p className="text-xs text-primary-700">Grand Total</p>
                            <p className="mt-1 text-xl font-bold text-primary-800 dark:text-primary-200">{formatPrice(grandTotal)}</p>
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <p className="mb-2 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                            <IconUser size={14} /> Pelanggan
                        </p>
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{currentOrder.customer?.name || '-'}</p>
                        <p className="text-xs text-gray-500">{currentOrder.customer?.phone || 'No phone'}</p>
                        <p className="mt-1 text-xs text-gray-500">{currentOrder.customer?.email || '-'}</p>
                        {permissions?.can_view_customers && currentOrder.customer?.id && (
                            <div className="mt-3">
                                <Link
                                    href={route('customers.show', currentOrder.customer.id)}
                                    className="inline-flex items-center rounded-lg border border-primary-200 px-2.5 py-1.5 text-xs font-semibold text-primary-700"
                                >
                                    Lihat Detail
                                </Link>
                            </div>
                        )}
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <p className="mb-2 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                            <IconCar size={14} /> Kendaraan
                        </p>
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{currentOrder.vehicle ? `${currentOrder.vehicle.brand || ''} ${currentOrder.vehicle.model || ''}`.trim() : '-'}</p>
                        <p className="text-xs text-gray-500">Plat: {currentOrder.vehicle?.plate_number || '-'}</p>
                        <p className="mt-1 text-xs text-gray-500">Tahun: {currentOrder.vehicle?.year || '-'}</p>
                        {permissions?.can_view_vehicles && currentOrder.vehicle?.id && (
                            <div className="mt-3">
                                <Link
                                    href={route('vehicles.show', currentOrder.vehicle.id)}
                                    className="inline-flex items-center rounded-lg border border-primary-200 px-2.5 py-1.5 text-xs font-semibold text-primary-700"
                                >
                                    Lihat Detail
                                </Link>
                            </div>
                        )}
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <p className="mb-2 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                            <IconTool size={14} /> Mekanik
                        </p>
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{currentOrder.mechanic?.name || 'Belum ditentukan'}</p>
                        <p className="text-xs text-gray-500">Spesialisasi: {currentOrder.mechanic?.specialty || '-'}</p>
                        {permissions?.can_view_mechanics && mechanicHref && (
                            <div className="mt-3">
                                <Link
                                    href={mechanicHref}
                                    className="inline-flex items-center rounded-lg border border-primary-200 px-2.5 py-1.5 text-xs font-semibold text-primary-700"
                                >
                                    Lihat Detail
                                </Link>
                            </div>
                        )}
                    </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Detail Layanan & Sparepart</h2>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-800">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Item</th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase">Qty</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase">Harga</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase">Diskon</th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase">Garansi</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase">Subtotal</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {details.map((detail) => {
                                    const warranty = getWarrantyMeta(detail);
                                    const itemBaseAmount = normalizeMoney(detail.amount ?? detail.price * (detail.qty || 0) ?? 0);
                                    const itemFinalAmount = normalizeMoney(detail.final_amount ?? itemBaseAmount);
                                    const detailDiscount = Math.max(0, itemBaseAmount - itemFinalAmount);
                                    const autoDiscount = normalizeMoney(detail.auto_discount_amount || 0);
                                    const manualDiscount = Math.max(0, normalizeMoney(detail.discount_amount || 0) - autoDiscount);
                                    return (
                                        <tr key={detail.id}>
                                            <td className="px-4 py-3 text-sm">
                                                <div className="font-medium text-gray-900 dark:text-gray-100">{detail.service?.title || detail.part?.name || '-'}</div>
                                                <div className="text-xs text-gray-500">{detail.service ? 'Layanan' : detail.part ? 'Sparepart' : '-'}</div>
                                                {detailDiscount > 0 && (
                                                    <div className="mt-1 flex flex-wrap gap-1 text-[11px] font-medium">
                                                        {autoDiscount > 0 && (
                                                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                                Diskon otomatis {formatPrice(autoDiscount)}
                                                            </span>
                                                        )}
                                                        {manualDiscount > 0 && (
                                                            <span className="rounded-full bg-rose-50 px-2 py-0.5 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
                                                                Diskon item {formatPrice(manualDiscount)}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-center text-sm">{detail.qty}</td>
                                            <td className="px-4 py-3 text-right text-sm">{formatPrice(itemBaseAmount)}</td>
                                            <td className="px-4 py-3 text-right text-sm">
                                                {detailDiscount > 0 ? (
                                                    <span className="font-semibold text-rose-600">-{formatPrice(detailDiscount)}</span>
                                                ) : (
                                                    <span className="text-gray-400">-</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold ${warranty.badgeClass}`}>
                                                        <IconShieldCheck size={12} /> {warranty.label}
                                                    </span>
                                                    {warranty.canClaim && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleClaimWarranty(detail)}
                                                            className="rounded bg-blue-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-blue-700"
                                                        >
                                                            Klaim
                                                        </button>
                                                    )}
                                                    {warranty.periodDays > 0 && (
                                                        <span className="text-[10px] text-gray-500">
                                                            {warranty.periodDays} hari, s.d. {formatDate(warranty.endDate)}
                                                        </span>
                                                    )}
                                                    {warranty.isNearExpiry && <span className="text-[10px] font-semibold text-amber-600">Mendekati expired</span>}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right text-sm font-semibold">{formatPrice(itemFinalAmount)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot className="bg-gray-50 dark:bg-gray-800">
                                <tr>
                                    <td colSpan="5" className="px-4 py-2 text-right text-xs text-gray-500">Subtotal bruto</td>
                                    <td className="px-4 py-2 text-right text-sm font-semibold">{formatPrice(grossSubtotal)}</td>
                                </tr>
                                {itemDiscountTotal > 0 && (
                                    <tr>
                                        <td colSpan="5" className="px-4 py-2 text-right text-xs text-gray-500">
                                            Diskon item
                                        </td>
                                        <td className="px-4 py-2 text-right text-sm font-semibold text-red-600">-{formatPrice(itemDiscountTotal)}</td>
                                    </tr>
                                )}
                                {orderDiscountAmount > 0 && (
                                    <tr>
                                        <td colSpan="5" className="px-4 py-2 text-right text-xs text-gray-500">
                                            Diskon order {currentOrder.discount_type === 'percent' ? `(${currentOrder.discount_value || 0}%)` : '(Fixed)'}
                                        </td>
                                        <td className="px-4 py-2 text-right text-sm font-semibold text-red-600">-{formatPrice(orderDiscountAmount)}</td>
                                    </tr>
                                )}
                                {voucherAmount > 0 && (
                                    <tr>
                                        <td colSpan="5" className="px-4 py-2 text-right text-xs text-gray-500">Voucher {currentOrder.voucher_code ? `(${currentOrder.voucher_code})` : ''}</td>
                                        <td className="px-4 py-2 text-right text-sm font-semibold text-violet-600">-{formatPrice(voucherAmount)}</td>
                                    </tr>
                                )}
                                {taxAmount > 0 && (
                                    <tr>
                                        <td colSpan="5" className="px-4 py-2 text-right text-xs text-gray-500">Pajak</td>
                                        <td className="px-4 py-2 text-right text-sm font-semibold text-emerald-600">+{formatPrice(taxAmount)}</td>
                                    </tr>
                                )}
                                {roundingAdjustment !== 0 && (
                                    <tr>
                                        <td colSpan="5" className="px-4 py-2 text-right text-xs text-gray-500">Pembulatan</td>
                                        <td className={`px-4 py-2 text-right text-sm font-semibold ${roundingAdjustment > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                            {roundingAdjustment > 0 ? '+' : '-'}{formatPrice(Math.abs(roundingAdjustment))}
                                        </td>
                                    </tr>
                                )}
                                <tr className="border-t border-gray-300 dark:border-gray-600">
                                    <td colSpan="5" className="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">Grand Total</td>
                                    <td className="px-4 py-3 text-right text-base font-bold text-primary-700 dark:text-primary-300">{formatPrice(grandTotal)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {currentOrder.notes && (
                    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">Catatan</h2>
                        <p className="whitespace-pre-line text-sm text-gray-700 dark:text-gray-300">{currentOrder.notes}</p>
                    </div>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                        <p className="mb-1 inline-flex items-center gap-1 text-xs text-gray-500">
                            <IconClock size={14} /> Estimasi Mulai
                        </p>
                        <p className="text-sm font-semibold">{formatDate(currentOrder.estimated_start_at)}</p>
                        <p className="mt-3 text-xs text-gray-500">Estimasi Selesai</p>
                        <p className="text-sm font-semibold">{formatDate(currentOrder.estimated_finish_at)}</p>
                        <p className="mt-3 text-xs text-gray-500">Dibuat</p>
                        <p className="text-sm font-semibold">{formatDate(currentOrder.created_at)}</p>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                        <p className="text-xs text-gray-500">Aktual Mulai</p>
                        <p className="text-sm font-semibold">{formatDate(currentOrder.actual_start_at)}</p>
                        <p className="mt-3 text-xs text-gray-500">Aktual Selesai</p>
                        <p className="text-sm font-semibold">{formatDate(currentOrder.actual_finish_at)}</p>
                        <p className="mt-3 text-xs text-gray-500">Odometer</p>
                        <p className="text-sm font-semibold">{currentOrder.odometer_km ? `${Number(currentOrder.odometer_km).toLocaleString('id-ID')} km` : '-'}</p>
                    </div>
                </div>

                {remainingAmount > 0 && currentOrder.status !== 'cancelled' && (
                    <TransactionPaymentSection
                        title="Pembayaran"
                        paymentMethod={currentOrder.payment_method || 'cash'}
                        paidAmount={paidAmount}
                        totalAmount={grandTotal}
                        transferDestination={currentOrder.transfer_destination || ''}
                        formatCurrency={formatPrice}
                        onOpenPaymentModal={() => setShowPaymentModal(true)}
                        note="Tekan tombol terima pembayaran untuk mencatat pembayaran service order ini."
                    />
                )}
            </div>

            <PaymentReceiptModal
                show={showPaymentModal}
                onClose={() => setShowPaymentModal(false)}
                onConfirm={handlePaymentConfirm}
                totalAmount={remainingAmount}
                cashDenominations={cashDenominations}
                initialPayment={{
                    payment_method: currentOrder.payment_method || 'cash',
                    transfer_destination: currentOrder.transfer_destination || '',
                    paid_amount: remainingAmount,
                    payment_meta: currentOrder.payment_meta || {},
                }}
                formatCurrency={formatPrice}
            />
        </>
    );
}
