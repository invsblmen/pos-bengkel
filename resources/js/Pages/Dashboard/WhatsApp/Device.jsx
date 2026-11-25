import React, { useCallback, useEffect, useRef, useState } from "react";
import { Head } from "@inertiajs/react";
import PageHeader from "@/Components/WhatsApp/PageHeader";
import {
    IconAlertTriangle,
    IconDeviceMobile,
    IconExternalLink,
    IconPlayerPlay,
    IconPlayerStop,
    IconRefresh,
} from "@tabler/icons-react";

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

export default function Device() {
    const [serviceHealth, setServiceHealth] = useState({
        status: "unknown",
        message: "Belum dicek",
        http_status: null,
        latency_ms: null,
    });
    const [isCheckingHealth, setIsCheckingHealth] = useState(false);
    const [isManagingService, setIsManagingService] = useState(false);
    const [lastHealthCheckedAt, setLastHealthCheckedAt] = useState(null);
    const [healthToast, setHealthToast] = useState(null);

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

    const manageGoService = useCallback(async (action) => {
        setIsManagingService(true);
        try {
            // Prefer local binary endpoints if available
            let useLocal = false;
            try {
                const s = await window.axios.get(route('whatsapp.go.local.status'));
                if (s?.status === 200) useLocal = true;
            } catch (e) {
                // 404 or not found -> fallback to docker
                useLocal = false;
            }

            let response;
            if (useLocal) {
                if (action === 'status') response = await window.axios.get(route('whatsapp.go.local.status'));
                if (action === 'start') response = await window.axios.post(route('whatsapp.go.local.start'));
                if (action === 'stop') response = await window.axios.post(route('whatsapp.go.local.stop'));
                if (action === 'restart') {
                    await window.axios.post(route('whatsapp.go.local.stop'));
                    response = await window.axios.post(route('whatsapp.go.local.start'));
                }
            } else {
                if (action === 'status') response = await window.axios.get(route('whatsapp.go.docker.status'));
                if (action === 'start') response = await window.axios.post(route('whatsapp.go.docker.start'));
                if (action === 'stop') response = await window.axios.post(route('whatsapp.go.docker.stop'));
                if (action === 'restart') response = await window.axios.post(route('whatsapp.go.docker.restart'));
            }

            setHealthToast({ tone: 'success', message: `Perintah ${action} dikirim.` });
            setTimeout(() => setHealthToast(null), 4000);
            // refresh health after action
            setTimeout(() => checkWhatsAppGoHealth(), 1500);
            return response?.data;
        } catch (error) {
            setHealthToast({ tone: 'danger', message: `Gagal menjalankan ${action}: ${error?.response?.data?.error || error?.message}` });
            setTimeout(() => setHealthToast(null), 6000);
            throw error;
        } finally {
            setIsManagingService(false);
        }
    }, [checkWhatsAppGoHealth]);

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

    const activeServiceHealthBadge = serviceHealthBadge[serviceHealth.status] || serviceHealthBadge.unknown;

    const toastClassName = healthToast?.tone === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-red-200 bg-red-50 text-red-700";

    return (
        <>
            <Head title="Perangkat GOWA" />

            {healthToast && (
                <div className={`fixed top-5 right-5 z-50 rounded-xl border px-4 py-3 text-sm shadow-lg ${toastClassName}`}>
                    {healthToast.message}
                </div>
            )}

            <PageHeader
                title="Perangkat GOWA"
                description="Kontrol service WhatsApp Go (docker atau binary lokal) dan akses dashboard GOWA."
                icon={<IconDeviceMobile size={26} className="text-emerald-600" />}
            />

            <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                        <h2 className="text-lg font-semibold text-slate-900">Status Service</h2>
                        <div className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${activeServiceHealthBadge.className}`}>
                            <span className={`h-2 w-2 rounded-full ${activeServiceHealthBadge.dotClassName}`}></span>
                            <span>{activeServiceHealthBadge.label}</span>
                        </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
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
                                Auto-check berjalan setiap 30 detik. Kamu juga bisa klik tombol Cek Kesehatan Go untuk cek manual.
                            </div>
                        </div>
                    )}

                    <div className="mt-6 flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => manageGoService('start')}
                            disabled={isManagingService}
                            className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                        >
                            <IconPlayerPlay size={16} />
                            Start
                        </button>
                        <button
                            type="button"
                            onClick={() => manageGoService('stop')}
                            disabled={isManagingService}
                            className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
                        >
                            <IconPlayerStop size={16} />
                            Stop
                        </button>
                        <button
                            type="button"
                            onClick={() => manageGoService('restart')}
                            disabled={isManagingService}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                        >
                            <IconRefresh size={16} />
                            Restart
                        </button>
                        <button
                            type="button"
                            onClick={checkWhatsAppGoHealth}
                            disabled={isCheckingHealth}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                        >
                            <IconRefresh size={16} className={isCheckingHealth ? "animate-spin" : ""} />
                            <span>{isCheckingHealth ? "Mengecek..." : "Cek Kesehatan Go"}</span>
                        </button>
                    </div>

                    <p className="mt-4 text-xs text-slate-500">
                        Kontrol otomatis memilih binary lokal bila tersedia, dan jatuh ke docker bila tidak. Status kesehatan diperiksa otomatis setiap 30 detik.
                    </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col">
                    <h2 className="text-lg font-semibold text-slate-900 mb-2">Dashboard GOWA</h2>
                    <p className="text-sm text-slate-500 mb-6">
                        Kelola perangkat WhatsApp, sesi, dan pairing langsung di dashboard bawaan GOWA (dibuka di tab baru).
                    </p>
                    <a
                        href={route("whatsapp.go.index")}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-auto inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
                    >
                        <IconExternalLink size={18} />
                        Buka Dashboard GOWA
                    </a>
                </div>
            </div>
        </>
    );
}
