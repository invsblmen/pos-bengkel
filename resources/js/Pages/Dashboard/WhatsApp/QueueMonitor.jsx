import React, { useEffect, useMemo, useRef, useState } from "react";
import { Head, Link, router } from "@inertiajs/react";
import { toDisplayDateTime } from "@/Utils/datetime";
import {
    IconAlertTriangle,
    IconBrandWhatsapp,
    IconCheck,
    IconClockHour4,
    IconRefresh,
    IconSend,
    IconShieldX,
} from "@tabler/icons-react";

function SummaryCard({ title, value, icon, tone = "slate", helper }) {
    const toneClass = {
        slate: "bg-slate-50 border-slate-200 text-slate-700",
        amber: "bg-amber-50 border-amber-200 text-amber-700",
        emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
        red: "bg-red-50 border-red-200 text-red-700",
        blue: "bg-blue-50 border-blue-200 text-blue-700",
    };

    return (
        <div className={`rounded-2xl border p-4 ${toneClass[tone] ?? toneClass.slate}`}>
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-sm font-medium">{title}</p>
                    <p className="mt-1 text-2xl font-bold">{value ?? 0}</p>
                    {helper ? <p className="mt-1 text-xs opacity-80">{helper}</p> : null}
                </div>
                {icon}
            </div>
        </div>
    );
}

export default function QueueMonitor({ summary = {}, monitoring = {}, recentOutbound = [], refreshIntervalSeconds = 15 }) {
    const [refreshing, setRefreshing] = useState(false);
    const [lastRefreshAt, setLastRefreshAt] = useState(null);
    const [toast, setToast] = useState(null);
    const prevWorkerActive = useRef(monitoring?.worker_active ?? false);

    const workerBadge = monitoring?.worker_active
        ? {
            label: "Worker Aktif",
            className: "border-emerald-200 bg-emerald-50 text-emerald-700",
            dotClassName: "bg-emerald-500",
        }
        : {
            label: "Worker Tidak Aktif",
            className: "border-red-200 bg-red-50 text-red-700",
            dotClassName: "bg-red-500",
        };

    const queueAlert = useMemo(() => {
        if ((summary?.queue_pending ?? 0) > 0) {
            return {
                tone: "amber",
                text: `Ada ${summary.queue_pending} job masih antre. Pastikan queue worker berjalan.`,
            };
        }

        if (!monitoring?.worker_active) {
            return {
                tone: "red",
                text: "Belum ada heartbeat worker. Kemungkinan queue worker belum berjalan.",
            };
        }

        return {
            tone: "emerald",
            text: "Queue worker aktif dan antrean sedang kosong atau terkendali.",
        };
    }, [monitoring?.worker_active, summary?.queue_pending]);

    const reloadPage = () => {
        setRefreshing(true);
        router.reload({
            only: ["summary", "monitoring", "recentOutbound", "refreshIntervalSeconds"],
            preserveScroll: true,
            preserveState: true,
            onFinish: () => {
                setRefreshing(false);
                setLastRefreshAt(new Date());
            },
        });
    };

    useEffect(() => {
        const intervalId = setInterval(reloadPage, Math.max(5, refreshIntervalSeconds) * 1000);
        return () => clearInterval(intervalId);
    }, [refreshIntervalSeconds]);

    // Visual notification when worker becomes inactive
    useEffect(() => {
        const currentlyActive = !!monitoring?.worker_active;
        const previouslyActive = !!prevWorkerActive.current;

        if (previouslyActive && !currentlyActive) {
            const message = "Worker queue terdeteksi tidak aktif. Periksa proses php artisan queue:work.";
            setToast({ message, tone: "red" });

            // Try browser notification
            try {
                if ("Notification" in window) {
                    if (Notification.permission === "granted") {
                        new Notification("WhatsApp Queue - Worker Down", { body: message });
                    } else if (Notification.permission !== "denied") {
                        Notification.requestPermission().then((perm) => {
                            if (perm === "granted") new Notification("WhatsApp Queue - Worker Down", { body: message });
                        });
                    }
                }
            } catch (e) {
                // ignore
            }

            // Short beep via WebAudio
            try {
                const ctx = new (window.AudioContext || window.webkitAudioContext)();
                const o = ctx.createOscillator();
                const g = ctx.createGain();
                o.type = "sine";
                o.frequency.value = 880;
                g.gain.value = 0.03;
                o.connect(g);
                g.connect(ctx.destination);
                o.start();
                setTimeout(() => {
                    o.stop();
                    try { ctx.close(); } catch (e) {}
                }, 250);
            } catch (e) {
                // ignore audio errors
            }

            // auto-hide toast
            setTimeout(() => setToast(null), 10000);
        }

        prevWorkerActive.current = currentlyActive;
    }, [monitoring?.worker_active]);

    useEffect(() => {
        setLastRefreshAt(new Date());
    }, []);

    return (
        <>
            <Head title="WhatsApp Queue Monitor" />

            {toast ? (
                <div className="fixed top-4 right-4 z-50 w-full max-w-sm">
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 shadow">
                        <div className="flex items-start gap-3">
                            <div className="mt-0.5">
                                <IconAlertTriangle size={20} className="text-red-600" />
                            </div>
                            <div className="flex-1 text-sm text-red-800">
                                <div className="font-semibold">Worker tidak aktif</div>
                                <div className="mt-1 text-xs opacity-90">{toast.message}</div>
                            </div>
                            <div>
                                <button onClick={() => setToast(null)} className="text-sm text-red-700 underline">Tutup</button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">WhatsApp Queue Monitor</h1>
                    <p className="text-sm text-slate-500">Pantau worker queue, heartbeat, dan antrean pesan WhatsApp secara real time.</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Link
                        href={route("whatsapp.logs.index")}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                        <IconSend size={16} />
                        Log WhatsApp
                    </Link>
                    <Link
                        href={route("whatsapp.messages.index")}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                        <IconBrandWhatsapp size={16} />
                        Manajemen Pesan
                    </Link>
                    <button
                        type="button"
                        onClick={reloadPage}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                        disabled={refreshing}
                    >
                        <IconRefresh size={16} className={refreshing ? "animate-spin" : ""} />
                        {refreshing ? "Memuat..." : "Refresh"}
                    </button>
                </div>
            </div>

            <div className={`mb-6 rounded-2xl border px-4 py-3 text-sm ${queueAlert.tone === "emerald" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : queueAlert.tone === "amber" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-red-200 bg-red-50 text-red-700"}`}>
                <div className="flex items-center gap-2 font-semibold">
                    {queueAlert.tone === "red" ? <IconAlertTriangle size={16} /> : <IconCheck size={16} />}
                    {queueAlert.text}
                </div>
                <div className="mt-1 text-xs opacity-80">
                    Auto-refresh setiap {Math.max(5, refreshIntervalSeconds)} detik.
                    {lastRefreshAt ? ` Refresh terakhir ${lastRefreshAt.toLocaleTimeString()}.` : ""}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
                <SummaryCard
                    title="Worker Status"
                    value={monitoring?.worker_active ? "Aktif" : "Tidak Aktif"}
                    icon={<span className={`h-3 w-3 rounded-full ${workerBadge.dotClassName}`}></span>}
                    tone={monitoring?.worker_active ? "emerald" : "red"}
                    helper={monitoring?.worker_active ? `Heartbeat terakhir ${monitoring?.worker_last_heartbeat || "-"}` : "Tidak ada heartbeat baru."}
                />
                <SummaryCard title="Queue Pending" value={summary?.queue_pending} icon={<IconClockHour4 size={18} />} tone="amber" helper="Job masih antre di tabel jobs" />
                <SummaryCard title="Queue Failed" value={summary?.queue_failed} icon={<IconShieldX size={18} />} tone="red" helper="Job yang gagal diproses worker" />
                <SummaryCard title="Outbound Queued" value={summary?.outbound_queued} icon={<IconSend size={18} />} tone="blue" helper="Pesan WhatsApp yang menunggu kirim" />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900">Ringkasan Queue</h2>
                            <p className="text-sm text-slate-500">Status antrean database queue dan heartbeat worker terakhir.</p>
                        </div>
                        <div className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${workerBadge.className}`}>
                            <span className={`h-2 w-2 rounded-full ${workerBadge.dotClassName}`}></span>
                            {workerBadge.label}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-xs font-medium text-slate-500">Heartbeat TTL</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">{monitoring?.heartbeat_ttl_seconds ?? 90} detik</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-xs font-medium text-slate-500">Heartbeat Key</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900 break-all">whatsapp:queue:heartbeat</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-xs font-medium text-slate-500">Worker PID</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">{monitoring?.heartbeat?.pid ?? "-"}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-xs font-medium text-slate-500">Worker Host</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">{monitoring?.heartbeat?.host ?? "-"}</p>
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <h2 className="text-lg font-semibold text-slate-900 mb-3">Status Cepat</h2>
                    <div className="space-y-3 text-sm text-slate-700">
                        <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                            <span>Total outbound</span>
                            <span className="font-semibold">{summary?.outbound_total ?? 0}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                            <span>Sent</span>
                            <span className="font-semibold text-emerald-700">{summary?.outbound_sent ?? 0}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                            <span>Failed</span>
                            <span className="font-semibold text-red-700">{summary?.outbound_failed ?? 0}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                            <span>Age heartbeat</span>
                            <span className="font-semibold">{monitoring?.worker_age_seconds ?? "-"} detik</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900">Recent Outbound</h2>
                        <p className="text-sm text-slate-500">10 pesan WhatsApp terbaru yang masuk ke queue.</p>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-sm">
                        <thead className="bg-slate-50 border-y border-slate-200 text-slate-600">
                            <tr>
                                <th className="px-3 py-2 text-left font-semibold">Waktu</th>
                                <th className="px-3 py-2 text-left font-semibold">Event</th>
                                <th className="px-3 py-2 text-left font-semibold">Nomor</th>
                                <th className="px-3 py-2 text-left font-semibold">Status</th>
                                <th className="px-3 py-2 text-left font-semibold">Catatan</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentOutbound.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-3 py-6 text-center text-slate-500">
                                        Belum ada data outbound.
                                    </td>
                                </tr>
                            ) : recentOutbound.map((item) => (
                                <tr key={item.id} className="border-b border-slate-100 last:border-b-0">
                                    <td className="px-3 py-3 whitespace-nowrap text-slate-600">{toDisplayDateTime(item.created_at)}</td>
                                    <td className="px-3 py-3 whitespace-nowrap text-slate-700">{item.event_type}</td>
                                    <td className="px-3 py-3 whitespace-nowrap text-slate-700">{item.phone}</td>
                                    <td className="px-3 py-3 whitespace-nowrap">
                                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${item.status === "sent" ? "bg-emerald-100 text-emerald-700" : item.status === "failed" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                                            {item.status}
                                        </span>
                                    </td>
                                    <td className="px-3 py-3 text-slate-600">
                                        {item.status === "failed" ? item.error_message || "-" : item.status === "sent" ? toDisplayDateTime(item.sent_at) : "Menunggu worker"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}