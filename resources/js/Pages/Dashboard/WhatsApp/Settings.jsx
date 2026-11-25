import React, { useCallback, useEffect, useState } from "react";
import { Head, useForm, usePage } from "@inertiajs/react";
import Input from "@/Components/Dashboard/Input";
import Checkbox from "@/Components/Dashboard/Checkbox";
import {
    IconBell,
    IconBrandWhatsapp,
    IconDeviceFloppy,
    IconPlugConnected,
    IconRefresh,
} from "@tabler/icons-react";
import toast from "react-hot-toast";

function TogglePill({ checked, onChange, disabled = false }) {
    return (
        <label
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                disabled ? "opacity-50 pointer-events-none" : "cursor-pointer"
            } ${
                checked
                    ? "bg-success-100 dark:bg-success-900/50 text-success-700 dark:text-success-400"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-500"
            }`}
        >
            <Checkbox
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
            />
            {checked ? "Aktif" : "Nonaktif"}
        </label>
    );
}

function ToggleRow({ title, description, checked, onChange, disabled = false, indented = false }) {
    return (
        <div
            className={`flex items-start justify-between gap-4 py-4 border-b border-slate-100 dark:border-slate-800 last:border-0 last:pb-0 first:pt-0 ${
                indented ? "ml-6 pl-4 border-l-2 border-l-slate-100 dark:border-l-slate-800" : ""
            } ${disabled ? "opacity-50" : ""}`}
        >
            <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
            </div>
            <TogglePill checked={checked} onChange={onChange} disabled={disabled} />
        </div>
    );
}

export default function Settings({ setting }) {
    const { flash } = usePage().props;
    const [health, setHealth] = useState(null);
    const [checkingHealth, setCheckingHealth] = useState(false);

    const { data, setData, put, errors, processing, isDirty } = useForm({
        enabled: setting?.enabled ?? false,
        api_base_url: setting?.api_base_url ?? "",
        api_timeout_seconds: setting?.api_timeout_seconds ?? 15,
        api_device_id: setting?.api_device_id ?? "",
        api_username: setting?.api_username ?? "",
        api_password: "",
        notify_service_order_created: setting?.notify_service_order_created ?? true,
        notify_service_order_updated: setting?.notify_service_order_updated ?? false,
        notify_part_sale_order_ready: setting?.notify_part_sale_order_ready ?? true,
        part_sale_auto_waiting_pickup: setting?.part_sale_auto_waiting_pickup ?? true,
    });

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error) toast.error(flash.error);
    }, [flash]);

    const checkHealth = useCallback(async () => {
        setCheckingHealth(true);
        try {
            const response = await window.axios.get(route("whatsapp.health.check"));
            const result = response?.data || {};
            setHealth({
                status: result.status || "unknown",
                message: result.message || "Tidak ada respons dari endpoint health-check.",
                latency_ms: result.latency_ms ?? null,
            });
        } catch (error) {
            setHealth({
                status: "down",
                message: error?.response?.data?.message || error?.message || "Gagal cek status service WhatsApp Go.",
                latency_ms: null,
            });
        } finally {
            setCheckingHealth(false);
        }
    }, []);

    useEffect(() => {
        checkHealth();
    }, [checkHealth]);

    const handleSubmit = (e) => {
        e.preventDefault();
        put(route("whatsapp.settings.update"), { preserveScroll: true });
    };

    const healthPill = (() => {
        if (checkingHealth && !health) {
            return { label: "Memeriksa koneksi…", className: "bg-slate-100 dark:bg-slate-800 text-slate-500", dot: "bg-slate-400" };
        }
        if (health?.status === "up") {
            return { label: `Terhubung${health.latency_ms != null ? ` • ${health.latency_ms} ms` : ""}`, className: "bg-success-100 dark:bg-success-900/50 text-success-700 dark:text-success-400", dot: "bg-success-500" };
        }
        if (health?.status === "auth_required") {
            return { label: "Butuh autentikasi", className: "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400", dot: "bg-amber-500" };
        }
        return { label: "Tidak terhubung", className: "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400", dot: "bg-red-500" };
    })();

    return (
        <>
            <Head title="Konfigurasi WhatsApp" />

            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <IconBrandWhatsapp size={28} className="text-primary-500" />
                        Konfigurasi WhatsApp
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Koneksi GOWA dan notifikasi otomatis. Nilai di halaman ini menimpa nilai .env; kolom yang dikosongkan kembali memakai nilai .env.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <span
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${healthPill.className}`}
                        title={health?.message || ""}
                    >
                        <span className={`w-2 h-2 rounded-full ${healthPill.dot}`} />
                        {healthPill.label}
                    </span>
                    <button
                        type="button"
                        onClick={checkHealth}
                        disabled={checkingHealth}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-all disabled:opacity-50"
                        title="Periksa ulang koneksi"
                    >
                        <IconRefresh size={16} className={checkingHealth ? "animate-spin" : ""} />
                    </button>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="max-w-3xl space-y-6 pb-24">
                {/* Koneksi GOWA */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                            <IconPlugConnected size={18} />
                            Koneksi GOWA
                        </h3>
                        <TogglePill
                            checked={data.enabled}
                            onChange={(value) => setData("enabled", value)}
                        />
                    </div>
                    <div className={`space-y-4 ${!data.enabled ? "opacity-50 pointer-events-none" : ""}`}>
                        <div className="grid gap-4 md:grid-cols-2">
                            <Input
                                label="Alamat API GOWA"
                                type="text"
                                value={data.api_base_url}
                                onChange={(e) => setData("api_base_url", e.target.value)}
                                errors={errors?.api_base_url}
                                placeholder="http://127.0.0.1:3000"
                            />
                            <Input
                                label="Timeout (detik)"
                                type="number"
                                min="1"
                                max="120"
                                value={data.api_timeout_seconds}
                                onChange={(e) => setData("api_timeout_seconds", e.target.value)}
                                errors={errors?.api_timeout_seconds}
                                placeholder="15"
                            />
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                            <Input
                                label="Device ID"
                                type="text"
                                value={data.api_device_id}
                                onChange={(e) => setData("api_device_id", e.target.value)}
                                errors={errors?.api_device_id}
                                placeholder="Device ID GOWA"
                            />
                            <Input
                                label="Username API"
                                type="text"
                                value={data.api_username}
                                onChange={(e) => setData("api_username", e.target.value)}
                                errors={errors?.api_username}
                                placeholder="Username Basic Auth GOWA"
                            />
                        </div>
                        <Input
                            label="Password API"
                            type="password"
                            value={data.api_password}
                            onChange={(e) => setData("api_password", e.target.value)}
                            errors={errors?.api_password}
                            placeholder={setting?.has_password ? "•••••••• (tersimpan — kosongkan bila tidak diubah)" : "Belum diatur"}
                        />
                    </div>
                </div>

                {/* Notifikasi Otomatis */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                        <IconBell size={18} />
                        Notifikasi Otomatis
                    </h3>
                    <ToggleRow
                        title="Service order dibuat"
                        description="Kirim ringkasan WhatsApp ke konsumen saat service order baru dibuat."
                        checked={data.notify_service_order_created}
                        onChange={(value) => setData("notify_service_order_created", value)}
                    />
                    <ToggleRow
                        title="Service order diperbarui"
                        description="Kirim ringkasan WhatsApp ke konsumen saat service order diperbarui."
                        checked={data.notify_service_order_updated}
                        onChange={(value) => setData("notify_service_order_updated", value)}
                    />
                    <ToggleRow
                        title="Pesanan sparepart siap"
                        description="Beritahu konsumen lewat WhatsApp saat pesanan sparepart-nya sudah datang dan siap diambil."
                        checked={data.notify_part_sale_order_ready}
                        onChange={(value) => setData("notify_part_sale_order_ready", value)}
                    />
                    <ToggleRow
                        title="Otomatis Menunggu Diambil"
                        description="Setelah notifikasi terkirim, status penjualan langsung maju menjadi Menunggu Diambil."
                        checked={data.part_sale_auto_waiting_pickup}
                        onChange={(value) => setData("part_sale_auto_waiting_pickup", value)}
                        disabled={!data.notify_part_sale_order_ready}
                        indented
                    />
                </div>

                {/* Bilah simpan lengket */}
                <div className="sticky bottom-4 z-10">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl px-6 py-4 flex items-center justify-between gap-4">
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {isDirty ? "Ada perubahan yang belum disimpan." : "Semua perubahan tersimpan."}
                        </p>
                        <button
                            type="submit"
                            disabled={processing || !isDirty}
                            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-medium transition-colors disabled:opacity-50"
                        >
                            <IconDeviceFloppy size={18} />
                            {processing ? "Menyimpan..." : "Simpan Konfigurasi"}
                        </button>
                    </div>
                </div>
            </form>
        </>
    );
}
