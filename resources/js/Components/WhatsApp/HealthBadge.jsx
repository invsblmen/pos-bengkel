import React, { useCallback, useEffect, useState } from "react";
import { IconAlertTriangle, IconRefresh } from "@tabler/icons-react";

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

/**
 * Satu-satunya implementasi indikator status koneksi GOWA & worker.
 *
 * - Mengecek endpoint whatsapp.health.check saat mount dan berkala (default 30 detik).
 * - Pil worker ditampilkan bila prop `monitoring` diberikan dan `showWorker` aktif.
 * - Mode `detail` menambahkan panel pesan status, tombol cek manual, dan
 *   peringatan persisten saat service down (pengganti panel health di Logs lama).
 */
export default function HealthBadge({ monitoring = null, showWorker = false, detail = false, pollSeconds = 30 }) {
    const [serviceHealth, setServiceHealth] = useState({
        status: "unknown",
        message: "Belum dicek",
        http_status: null,
        latency_ms: null,
    });
    const [isCheckingHealth, setIsCheckingHealth] = useState(false);
    const [lastHealthCheckedAt, setLastHealthCheckedAt] = useState(null);

    const checkHealth = useCallback(async () => {
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
        checkHealth();
    }, [checkHealth]);

    useEffect(() => {
        if (!pollSeconds || pollSeconds <= 0) {
            return undefined;
        }

        const intervalId = setInterval(() => {
            checkHealth();
        }, pollSeconds * 1000);

        return () => clearInterval(intervalId);
    }, [checkHealth, pollSeconds]);

    const activeServiceHealthBadge = serviceHealthBadge[serviceHealth.status] || serviceHealthBadge.unknown;

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

    const pills = (
        <>
            <div className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${activeServiceHealthBadge.className}`}>
                <span className={`h-2 w-2 rounded-full ${activeServiceHealthBadge.dotClassName}`}></span>
                <span>{activeServiceHealthBadge.label}</span>
            </div>
            {showWorker && monitoring ? (
                <div className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${workerBadge.className}`}>
                    <span className={`h-2 w-2 rounded-full ${workerBadge.dotClassName}`}></span>
                    <span>{workerBadge.label}</span>
                </div>
            ) : null}
            {detail ? (
                <button
                    type="button"
                    onClick={checkHealth}
                    disabled={isCheckingHealth}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                    <IconRefresh size={16} className={isCheckingHealth ? "animate-spin" : ""} />
                    <span>{isCheckingHealth ? "Mengecek..." : "Cek Kesehatan Go"}</span>
                </button>
            ) : null}
        </>
    );

    if (!detail) {
        return pills;
    }

    return (
        <div>
            <div className="flex flex-wrap items-center gap-2">{pills}</div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                <div className="font-medium">Status WhatsApp Go: {serviceHealth.message}</div>
                <div className="text-xs text-slate-500 mt-1">
                    HTTP: {serviceHealth.http_status ?? "-"} | Latency: {serviceHealth.latency_ms ?? "-"} ms
                    {lastHealthCheckedAt ? ` | Last Check: ${lastHealthCheckedAt.toLocaleTimeString()}` : ""}
                </div>
            </div>

            {serviceHealth.status === "down" && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <div className="flex items-center gap-2 font-semibold">
                        <IconAlertTriangle size={16} />
                        Service WhatsApp Go sedang tidak sehat
                    </div>
                    <div className="mt-1 text-xs text-red-600">
                        Auto-check berjalan setiap {pollSeconds} detik. Kamu juga bisa klik tombol Cek Kesehatan Go untuk cek manual.
                    </div>
                </div>
            )}
        </div>
    );
}
