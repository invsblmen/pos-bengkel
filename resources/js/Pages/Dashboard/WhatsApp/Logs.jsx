import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Head, router, usePage } from "@inertiajs/react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import Pagination from "@/Components/Dashboard/Pagination";
import { toDisplayDateTime } from "@/Utils/datetime";
import { useRealtimeEvents } from "@/Hooks/useRealtimeEvents";
import {
    IconBrandWhatsapp,
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

function SummaryCard({ title, value, icon, tone = "slate" }) {
    const toneClass = {
        slate: "bg-slate-50 border-slate-200 text-slate-700",
        amber: "bg-amber-50 border-amber-200 text-amber-700",
        emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
        red: "bg-red-50 border-red-200 text-red-700",
        blue: "bg-blue-50 border-blue-200 text-blue-700",
    };

    return (
        <div className={`rounded-2xl border p-4 ${toneClass[tone] ?? toneClass.slate}`}>
            <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">{title}</p>
                {icon}
            </div>
            <p className="text-2xl font-bold">{value ?? 0}</p>
        </div>
    );
}

export default function Logs({ filters, summary, outboundStatuses, webhookEvents, outboundLogs, webhookLogs }) {
    const { props } = usePage();
    const flash = props?.flash || {};
    const [serviceHealth, setServiceHealth] = useState({
        status: "unknown",
        message: "Belum dicek",
        http_status: null,
        latency_ms: null,
    });
    const [isCheckingHealth, setIsCheckingHealth] = useState(false);
    const [lastHealthCheckedAt, setLastHealthCheckedAt] = useState(null);
    const [healthToast, setHealthToast] = useState(null);

    const [outboundQueryText, setOutboundQueryText] = useState(filters?.outbound_q || "");
    const [webhookQueryText, setWebhookQueryText] = useState(filters?.webhook_q || "");
    const [dateFrom, setDateFrom] = useState(filters?.date_from || "");
    const [dateTo, setDateTo] = useState(filters?.date_to || "");

    const outboundStatusValue = filters?.outbound_status || "all";
    const webhookEventValue = filters?.webhook_event || "all";

    const debounceRef = useRef(null);
    const fallbackPollingRef = useRef(null);
    const previousServiceHealthStatusRef = useRef("unknown");
    const toastTimeoutRef = useRef(null);

    const playDownAlertBeep = useCallback(() => {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;

            const ctx = new AudioCtx();
            const oscillator = ctx.createOscillator();
            const gain = ctx.createGain();

            oscillator.type = "sine";
            oscillator.frequency.setValueAtTime(880, ctx.currentTime);

            gain.gain.setValueAtTime(0.0001, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);

            oscillator.connect(gain);
            gain.connect(ctx.destination);

            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + 0.25);

            oscillator.onended = () => {
                if (typeof ctx.close === "function") {
                    ctx.close();
                }
            };
        } catch (_) {
            // Ignore browser autoplay/audio restrictions.
        }
    }, []);

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
        });
    };

    const checkWhatsAppGoHealth = useCallback(async () => {
        setIsCheckingHealth(true);

        try {
            const response = await window.axios.get(route("whatsapp.health.check"));
            const data = response?.data || {};

            setServiceHealth({
                status: data.status || "unknown",
                message: data.message || "Tidak ada respons dari endpoint health-check.",
                http_status: data.http_status ?? null,
                latency_ms: data.latency_ms ?? null,
            });
            setLastHealthCheckedAt(new Date());
        } catch (error) {
            setServiceHealth({
                status: "down",
                message: error?.response?.data?.message || error?.message || "Gagal cek status service WhatsApp Go.",
                http_status: null,
                latency_ms: null,
            });
            setLastHealthCheckedAt(new Date());
        } finally {
            setIsCheckingHealth(false);
        }
    }, []);

    useEffect(() => {
        checkWhatsAppGoHealth();
    }, [checkWhatsAppGoHealth]);

    useEffect(() => {
        const intervalId = setInterval(() => {
            checkWhatsAppGoHealth();
        }, 30000);

        return () => clearInterval(intervalId);
    }, [checkWhatsAppGoHealth]);

    useEffect(() => {
        const previousStatus = previousServiceHealthStatusRef.current;
        const currentStatus = serviceHealth.status;

        if (previousStatus !== currentStatus && (currentStatus === "up" || currentStatus === "down")) {
            setHealthToast({
                tone: currentStatus === "up" ? "success" : "danger",
                message: currentStatus === "up"
                    ? "Service WhatsApp Go kembali normal."
                    : "Service WhatsApp Go terdeteksi down.",
            });

            if (toastTimeoutRef.current) {
                clearTimeout(toastTimeoutRef.current);
            }

            if (currentStatus === "down") {
                playDownAlertBeep();
            }

            toastTimeoutRef.current = setTimeout(() => {
                setHealthToast(null);
            }, 5000);
        }

        previousServiceHealthStatusRef.current = currentStatus;
    }, [serviceHealth.status, playDownAlertBeep]);

    useEffect(() => {
        return () => {
            if (toastTimeoutRef.current) {
                clearTimeout(toastTimeoutRef.current);
            }
        };
    }, []);

    const serviceHealthBadge = {
        up: {
            label: "Go Service Up",
            className: "border-emerald-200 bg-emerald-50 text-emerald-700",
            dotClassName: "bg-emerald-500",
        },
        auth_required: {
            label: "Go Service Auth Required",
            className: "border-amber-200 bg-amber-50 text-amber-700",
            dotClassName: "bg-amber-500",
        },
        down: {
            label: "Go Service Down",
            className: "border-red-200 bg-red-50 text-red-700",
            dotClassName: "bg-red-500",
        },
        unknown: {
            label: "Go Service Unknown",
            className: "border-slate-200 bg-slate-50 text-slate-700",
            dotClassName: "bg-slate-500",
        },
    };

    const activeServiceHealthBadge = serviceHealthBadge[serviceHealth.status] || serviceHealthBadge.unknown;

    const toastClassName = healthToast?.tone === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-red-200 bg-red-50 text-red-700";

    return (
        <>
            <Head title="WhatsApp Logs" />

            {healthToast && (
                <div className={`fixed top-5 right-5 z-50 rounded-xl border px-4 py-3 text-sm shadow-lg ${toastClassName}`}>
                    {healthToast.message}
                </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">WhatsApp Monitor</h1>
                    <p className="text-sm text-slate-500">Pantau pengiriman outbound dan event webhook dari service Go.</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700 text-sm">
                        <IconBrandWhatsapp size={18} />
                        <span>Realtime-ready log dashboard</span>
                    </div>
                    <div className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${activeRealtimeBadge.className}`}>
                        <span className={`h-2 w-2 rounded-full ${activeRealtimeBadge.dotClassName}`}></span>
                        <span>{activeRealtimeBadge.label}</span>
                    </div>
                    <div className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${activeServiceHealthBadge.className}`}>
                        <span className={`h-2 w-2 rounded-full ${activeServiceHealthBadge.dotClassName}`}></span>
                        <span>{activeServiceHealthBadge.label}</span>
                    </div>
                    <button
                        type="button"
                        onClick={checkWhatsAppGoHealth}
                        disabled={isCheckingHealth}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                        <IconRefresh size={16} className={isCheckingHealth ? "animate-spin" : ""} />
                        <span>{isCheckingHealth ? "Mengecek..." : "Cek Kesehatan Go"}</span>
                    </button>
                </div>
            </div>

            <div className="mb-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                <div className="font-medium">Status WhatsApp Go: {serviceHealth.message}</div>
                <div className="text-xs text-slate-500 mt-1">
                    HTTP: {serviceHealth.http_status ?? "-"} | Latency: {serviceHealth.latency_ms ?? "-"} ms
                    {lastHealthCheckedAt ? ` | Last Check: ${lastHealthCheckedAt.toLocaleTimeString()}` : ""}
                </div>
            </div>

            {serviceHealth.status === "down" && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <div className="flex items-center gap-2 font-semibold">
                        <IconAlertTriangle size={16} />
                        Service WhatsApp Go sedang tidak sehat
                    </div>
                    <div className="mt-1 text-xs text-red-600">
                        Auto-check berjalan setiap 30 detik. Kamu juga bisa klik tombol Cek Kesehatan Go untuk cek manual.
                    </div>
                </div>
            )}

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
                <SummaryCard title="Total Outbound" value={summary?.outbound_total} icon={<IconSend size={18} />} tone="blue" />
                <SummaryCard title="Queued" value={summary?.outbound_queued} icon={<IconClockHour4 size={18} />} tone="amber" />
                <SummaryCard title="Sent" value={summary?.outbound_sent} icon={<IconSend size={18} />} tone="emerald" />
                <SummaryCard title="Failed" value={summary?.outbound_failed} icon={<IconAlertTriangle size={18} />} tone="red" />
                <SummaryCard title="Total Webhook" value={summary?.webhook_total} icon={<IconWebhook size={18} />} tone="slate" />
                <SummaryCard title="Invalid Signature" value={summary?.webhook_invalid_signature} icon={<IconShieldX size={18} />} tone="red" />
            </div>

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

Logs.layout = (page) => <DashboardLayout children={page} />;

