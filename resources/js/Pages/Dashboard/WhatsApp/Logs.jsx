import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Head, Link, router, usePage } from "@inertiajs/react";
import Pagination from "@/Components/Dashboard/Pagination";
import PageHeader from "@/Components/WhatsApp/PageHeader";
import StatCard from "@/Components/WhatsApp/StatCard";
import { toDisplayDateTime } from "@/Utils/datetime";
import { useRealtimeEvents } from "@/Hooks/useRealtimeEvents";
import {
    IconClockHour4,
    IconSend,
    IconAlertTriangle,
    IconWebhook,
    IconShieldX,
    IconRefresh,
} from "@tabler/icons-react";

const statusClassName = {
    queued: "bg-amber-100 text-amber-700",
    sent: "bg-emerald-100 text-emerald-700",
    failed: "bg-red-100 text-red-700",
};

export default function Logs({ filters, summary, outboundStatuses, webhookEvents, outboundLogs, webhookLogs }) {
    const { props } = usePage();
    const flash = props?.flash || {};

    const [outboundQueryText, setOutboundQueryText] = useState(filters?.outbound_q || "");
    const [webhookQueryText, setWebhookQueryText] = useState(filters?.webhook_q || "");
    const [dateFrom, setDateFrom] = useState(filters?.date_from || "");
    const [dateTo, setDateTo] = useState(filters?.date_to || "");

    const outboundStatusValue = filters?.outbound_status || "all";
    const webhookEventValue = filters?.webhook_event || "all";

    const debounceRef = useRef(null);
    const fallbackPollingRef = useRef(null);

    const outboundCountLabel = useMemo(() => {
        if (!outboundLogs?.total) return "0 data";
        return `${outboundLogs.total} data`;
    }, [outboundLogs?.total]);

    const webhookCountLabel = useMemo(() => {
        if (!webhookLogs?.total) return "0 data";
        return `${webhookLogs.total} data`;
    }, [webhookLogs?.total]);

    const applyFilters = (nextFilters) => {
        router.get(route("whatsapp.logs.index"), nextFilters, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const currentFilters = useMemo(() => ({
        outbound_q: outboundQueryText,
        outbound_status: outboundStatusValue,
        webhook_q: webhookQueryText,
        webhook_event: webhookEventValue,
        date_from: dateFrom,
        date_to: dateTo,
    }), [outboundQueryText, outboundStatusValue, webhookQueryText, webhookEventValue, dateFrom, dateTo]);

    const scheduleRealtimeReload = useCallback(() => {
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        debounceRef.current = setTimeout(() => {
            router.reload({
                only: ["summary", "outboundLogs", "webhookLogs", "webhookEvents"],
                preserveScroll: true,
                preserveState: true,
            });
        }, 500);
    }, []);

    const { status: realtimeConnectionStatus } = useRealtimeEvents({
        enabled: true,
        domains: ["whatsapp"],
        onEvent: (payload) => {
            if (payload?.domain !== "whatsapp") return;
            scheduleRealtimeReload();
        },
    });

    const realtimeStatus = realtimeConnectionStatus === "connected"
        ? "connected"
        : realtimeConnectionStatus === "connecting"
            ? "checking"
            : "disconnected";

    useEffect(() => {
        setOutboundQueryText(filters?.outbound_q || "");
        setWebhookQueryText(filters?.webhook_q || "");
        setDateFrom(filters?.date_from || "");
        setDateTo(filters?.date_to || "");
    }, [filters]);

    useEffect(() => {
        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (fallbackPollingRef.current) {
            clearInterval(fallbackPollingRef.current);
            fallbackPollingRef.current = null;
        }

        if (realtimeStatus === "connected") {
            return undefined;
        }

        fallbackPollingRef.current = setInterval(() => {
            router.reload({
                only: ["summary", "outboundLogs", "webhookLogs", "webhookEvents"],
                preserveScroll: true,
                preserveState: true,
            });
        }, 12000);

        return () => {
            if (fallbackPollingRef.current) {
                clearInterval(fallbackPollingRef.current);
                fallbackPollingRef.current = null;
            }
        };
    }, [realtimeStatus]);

    const realtimeStatusBadge = {
        connected: {
            label: "Realtime Connected",
            className: "border-emerald-200 bg-emerald-50 text-emerald-700",
            dotClassName: "bg-emerald-500",
        },
        disconnected: {
            label: "Realtime Disconnected (Polling Aktif)",
            className: "border-red-200 bg-red-50 text-red-700",
            dotClassName: "bg-red-500",
        },
        checking: {
            label: "Realtime Checking (Polling Aktif)",
            className: "border-amber-200 bg-amber-50 text-amber-700",
            dotClassName: "bg-amber-500",
        },
    };

    const activeRealtimeBadge = realtimeStatusBadge[realtimeStatus] || realtimeStatusBadge.checking;

    const submitFilterForm = (event) => {
        event.preventDefault();
        applyFilters(currentFilters);
    };

    const clearFilters = () => {
        const reset = {
            outbound_q: "",
            outbound_status: "all",
            webhook_q: "",
            webhook_event: "all",
            date_from: "",
            date_to: "",
        };
        setOutboundQueryText("");
        setWebhookQueryText("");
        setDateFrom("");
        setDateTo("");
        applyFilters(reset);
    };

    const retryOutbound = (id) => {
        router.post(route("whatsapp.logs.retry", id), {}, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => {
                router.reload({ only: ["outboundLogs"], preserveScroll: true, preserveState: true });
            },
            onError: () => {
                // keep existing behavior
            }
        });
    };

    return (
        <>
            <Head title="Log Pesan WhatsApp" />

            <PageHeader
                title="Log Pesan"
                description="Pantau pengiriman outbound dan event webhook dari service Go."
            >
                <Link
                    href={route("whatsapp.messages.index")}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                    <IconSend size={16} />
                    Kirim Pesan
                </Link>
                <div className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${activeRealtimeBadge.className}`}>
                    <span className={`h-2 w-2 rounded-full ${activeRealtimeBadge.dotClassName}`}></span>
                    <span>{activeRealtimeBadge.label}</span>
                </div>
            </PageHeader>

            {flash?.success && (
                <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    {flash.success}
                </div>
            )}

            <form onSubmit={submitFilterForm} className="mb-6 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                        <label className="text-xs font-medium text-slate-500">Cari Outbound (nomor/pesan/event)</label>
                        <input
                            type="text"
                            value={outboundQueryText}
                            onChange={(e) => setOutboundQueryText(e.target.value)}
                            className="mt-1 w-full h-10 rounded-xl border border-slate-200 px-3 text-sm"
                            placeholder="contoh: 62812"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-slate-500">Cari Webhook (event/device)</label>
                        <input
                            type="text"
                            value={webhookQueryText}
                            onChange={(e) => setWebhookQueryText(e.target.value)}
                            className="mt-1 w-full h-10 rounded-xl border border-slate-200 px-3 text-sm"
                            placeholder="contoh: message.ack"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-xs font-medium text-slate-500">Dari Tanggal</label>
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="mt-1 w-full h-10 rounded-xl border border-slate-200 px-3 text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-slate-500">Sampai Tanggal</label>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="mt-1 w-full h-10 rounded-xl border border-slate-200 px-3 text-sm"
                            />
                        </div>
                    </div>
                </div>

                <div className="mt-4 flex items-center gap-2">
                    <button type="submit" className="rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600">
                        Terapkan Filter
                    </button>
                    <button type="button" onClick={clearFilters} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                        Reset
                    </button>
                </div>
            </form>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                <StatCard title="Total Outbound" value={summary?.outbound_total} icon={<IconSend size={18} />} tone="blue" />
                <StatCard title="Queued" value={summary?.outbound_queued} icon={<IconClockHour4 size={18} />} tone="amber" />
                <StatCard title="Sent" value={summary?.outbound_sent} icon={<IconSend size={18} />} tone="emerald" />
                <StatCard title="Failed" value={summary?.outbound_failed} icon={<IconAlertTriangle size={18} />} tone="red" />
                <StatCard title="Queue Pending" value={summary?.queue_pending} icon={<IconClockHour4 size={18} />} tone="amber" />
                <StatCard title="Queue Failed Jobs" value={summary?.queue_failed} icon={<IconShieldX size={18} />} tone="red" />
                <StatCard title="Total Webhook" value={summary?.webhook_total} icon={<IconWebhook size={18} />} tone="slate" />
                <StatCard title="Invalid Signature" value={summary?.webhook_invalid_signature} icon={<IconShieldX size={18} />} tone="red" />
            </div>

            {(summary?.queue_pending ?? 0) > 0 && (
                <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    Ada {summary.queue_pending} job WhatsApp yang masih antre di database queue. Pastikan proses <span className="font-semibold">php artisan queue:work</span> sedang berjalan di server.
                </div>
            )}

            {(summary?.queue_failed ?? 0) > 0 && (
                <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    Ada {summary.queue_failed} failed job di tabel <span className="font-semibold">failed_jobs</span>. Cek detailnya dengan <span className="font-semibold">php artisan queue:failed</span> lalu lakukan retry jika perlu.
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-lg font-semibold text-slate-900">Outbound Messages</h2>
                        <span className="text-xs text-slate-500">{outboundCountLabel}</span>
                    </div>

                    <div className="mb-4">
                        <label className="text-xs font-medium text-slate-500">Filter Status</label>
                        <select
                            className="mt-1 w-full h-10 rounded-xl border border-slate-200 px-3 text-sm"
                            value={outboundStatusValue}
                            onChange={(e) => applyFilters({
                                ...currentFilters,
                                outbound_status: e.target.value,
                            })}
                        >
                            {outboundStatuses.map((status) => (
                                <option key={status} value={status}>
                                    {status}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[640px] text-sm">
                            <thead className="bg-slate-50 border-y border-slate-200">
                                <tr>
                                    <th className="text-left py-2.5 px-3 font-semibold text-slate-600">Waktu</th>
                                    <th className="text-left py-2.5 px-3 font-semibold text-slate-600">Phone</th>
                                    <th className="text-left py-2.5 px-3 font-semibold text-slate-600">Status</th>
                                    <th className="text-left py-2.5 px-3 font-semibold text-slate-600">Message ID</th>
                                    <th className="text-left py-2.5 px-3 font-semibold text-slate-600">Error</th>
                                    <th className="text-left py-2.5 px-3 font-semibold text-slate-600">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {outboundLogs?.data?.length ? (
                                    outboundLogs.data.map((row) => (
                                        <tr key={row.id} className="border-b border-slate-100 align-top">
                                            <td className="px-3 py-2.5 text-slate-600">{toDisplayDateTime(row.created_at)}</td>
                                            <td className="px-3 py-2.5 font-medium text-slate-800">{row.phone}</td>
                                            <td className="px-3 py-2.5">
                                                <span className={`inline-flex rounded px-2 py-1 text-xs font-medium ${statusClassName[row.status] ?? "bg-slate-100 text-slate-700"}`}>
                                                    {row.status}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5 text-slate-700">{row.external_message_id || "-"}</td>
                                            <td className="px-3 py-2.5 text-red-600 max-w-[280px] break-words">{row.error_message || "-"}</td>
                                            <td className="px-3 py-2.5">
                                                {row.status === "failed" ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => retryOutbound(row.id)}
                                                        className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100"
                                                    >
                                                        <IconRefresh size={14} />
                                                        Retry
                                                    </button>
                                                ) : (
                                                    <span className="text-xs text-slate-400">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={6} className="px-3 py-8 text-center text-slate-500">Belum ada outbound message.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-4">
                        <Pagination links={outboundLogs?.links || []} />
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-lg font-semibold text-slate-900">Webhook Events</h2>
                        <span className="text-xs text-slate-500">{webhookCountLabel}</span>
                    </div>

                    <div className="mb-4">
                        <label className="text-xs font-medium text-slate-500">Filter Event</label>
                        <select
                            className="mt-1 w-full h-10 rounded-xl border border-slate-200 px-3 text-sm"
                            value={webhookEventValue}
                            onChange={(e) => applyFilters({
                                ...currentFilters,
                                webhook_event: e.target.value,
                            })}
                        >
                            {webhookEvents.map((event) => (
                                <option key={event} value={event}>
                                    {event}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[640px] text-sm">
                            <thead className="bg-slate-50 border-y border-slate-200">
                                <tr>
                                    <th className="text-left py-2.5 px-3 font-semibold text-slate-600">Waktu</th>
                                    <th className="text-left py-2.5 px-3 font-semibold text-slate-600">Event</th>
                                    <th className="text-left py-2.5 px-3 font-semibold text-slate-600">Signature</th>
                                    <th className="text-left py-2.5 px-3 font-semibold text-slate-600">Payload</th>
                                </tr>
                            </thead>
                            <tbody>
                                {webhookLogs?.data?.length ? (
                                    webhookLogs.data.map((row) => (
                                        <tr key={row.id} className="border-b border-slate-100 align-top">
                                            <td className="px-3 py-2.5 text-slate-600">{toDisplayDateTime(row.created_at)}</td>
                                            <td className="px-3 py-2.5 font-medium text-slate-800">{row.event || "unknown"}</td>
                                            <td className="px-3 py-2.5">
                                                {row.signature_valid ? (
                                                    <span className="inline-flex rounded bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">valid</span>
                                                ) : (
                                                    <span className="inline-flex rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700">invalid</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2.5 text-slate-600 max-w-[320px]">
                                                <pre className="text-[11px] leading-4 whitespace-pre-wrap break-words max-h-28 overflow-auto rounded bg-slate-50 p-2 border border-slate-200">
                                                    {JSON.stringify(row.payload, null, 2)}
                                                </pre>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="px-3 py-8 text-center text-slate-500">Belum ada webhook event.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-4">
                        <Pagination links={webhookLogs?.links || []} />
                    </div>
                </div>
            </div>
        </>
    );
}
