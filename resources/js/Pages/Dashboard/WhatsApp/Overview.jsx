import React, { useState } from "react";
import { Head, Link, router } from "@inertiajs/react";
import PageHeader from "@/Components/WhatsApp/PageHeader";
import StatCard from "@/Components/WhatsApp/StatCard";
import HealthBadge from "@/Components/WhatsApp/HealthBadge";
import { toDisplayDateTime } from "@/Utils/datetime";
import {
    IconAlertTriangle,
    IconBellRinging,
    IconBrandWhatsapp,
    IconCheck,
    IconClockHour4,
    IconRefresh,
    IconSend,
    IconSettings,
    IconShieldX,
    IconUsers,
} from "@tabler/icons-react";

export default function Overview({ summary = {}, monitoring = {}, recentFailed = [] }) {
    const [refreshing, setRefreshing] = useState(false);

    const reloadPage = () => {
        setRefreshing(true);
        router.reload({
            only: ["summary", "monitoring", "recentFailed"],
            preserveScroll: true,
            preserveState: true,
            onFinish: () => setRefreshing(false),
        });
    };

    const retryOutbound = (id) => {
        router.post(route("whatsapp.logs.retry", id), {}, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => {
                router.reload({ only: ["summary", "recentFailed"], preserveScroll: true, preserveState: true });
            },
        });
    };

    return (
        <>
            <Head title="Ringkasan WhatsApp" />

            <PageHeader
                title="Ringkasan WhatsApp"
                description="Satu tempat untuk menjawab: apakah WhatsApp sehat?"
                icon={<IconBrandWhatsapp size={26} className="text-emerald-600" />}
            >
                <Link
                    href={route("whatsapp.messages.index")}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                    <IconSend size={16} />
                    Kirim Pesan
                </Link>
                <Link
                    href={route("whatsapp.settings.edit")}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                    <IconSettings size={16} />
                    Konfigurasi
                </Link>
                <button
                    type="button"
                    onClick={reloadPage}
                    disabled={refreshing}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                    <IconRefresh size={16} className={refreshing ? "animate-spin" : ""} />
                    {refreshing ? "Memuat..." : "Refresh"}
                </button>
            </PageHeader>

            <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <HealthBadge monitoring={monitoring} showWorker detail />
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

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                <StatCard title="Total Outbound" value={summary?.outbound_total} icon={<IconSend size={18} />} tone="blue" />
                <StatCard title="Antre (Queued)" value={summary?.outbound_queued} icon={<IconClockHour4 size={18} />} tone="amber" />
                <StatCard title="Terkirim" value={summary?.outbound_sent} icon={<IconCheck size={18} />} tone="emerald" />
                <StatCard title="Gagal" value={summary?.outbound_failed} icon={<IconAlertTriangle size={18} />} tone="red" />
                <StatCard title="Pelanggan Siap Kirim" value={summary?.customers} icon={<IconUsers size={18} />} tone="emerald" />
                <StatCard title="Reminder Mendatang" value={summary?.appointments} icon={<IconBellRinging size={18} />} tone="blue" />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900">Pesan Gagal Terbaru</h2>
                        <p className="text-sm text-slate-500">Pesan keluar terakhir yang gagal terkirim. Coba lagi langsung dari sini.</p>
                    </div>
                    <Link
                        href={route("whatsapp.logs.index")}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                        <IconShieldX size={16} />
                        Semua Log
                    </Link>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-sm">
                        <thead className="bg-slate-50 border-y border-slate-200">
                            <tr>
                                <th className="text-left py-2.5 px-3 font-semibold text-slate-600">Waktu</th>
                                <th className="text-left py-2.5 px-3 font-semibold text-slate-600">Event</th>
                                <th className="text-left py-2.5 px-3 font-semibold text-slate-600">Nomor</th>
                                <th className="text-left py-2.5 px-3 font-semibold text-slate-600">Error</th>
                                <th className="text-left py-2.5 px-3 font-semibold text-slate-600">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentFailed.length ? (
                                recentFailed.map((row) => (
                                    <tr key={row.id} className="border-b border-slate-100 align-top">
                                        <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{toDisplayDateTime(row.created_at)}</td>
                                        <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">{row.event_type}</td>
                                        <td className="px-3 py-2.5 font-medium text-slate-800">{row.phone}</td>
                                        <td className="px-3 py-2.5 text-red-600 max-w-[320px] break-words">{row.error_message || "-"}</td>
                                        <td className="px-3 py-2.5">
                                            <button
                                                type="button"
                                                onClick={() => retryOutbound(row.id)}
                                                className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100"
                                            >
                                                <IconRefresh size={14} />
                                                Retry
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="px-3 py-8 text-center text-slate-500">Tidak ada pesan gagal. Semua pengiriman terakhir berhasil.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}
