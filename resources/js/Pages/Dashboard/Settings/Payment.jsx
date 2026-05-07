import React, { useEffect } from "react";
import { Head, useForm, usePage } from "@inertiajs/react";
import Input from "@/Components/Dashboard/Input";
import Checkbox from "@/Components/Dashboard/Checkbox";
import {
    IconCreditCard,
    IconDeviceFloppy,
    IconBrandStripe,
    IconCash,
} from "@tabler/icons-react";
import toast from "react-hot-toast";

export default function Payment({ setting, supportedGateways = [] }) {
    const { flash } = usePage().props;

    const { data, setData, put, errors, processing } = useForm({
        default_gateway: setting?.default_gateway ?? "cash",
        midtrans_enabled: setting?.midtrans_enabled ?? false,
        midtrans_server_key: setting?.midtrans_server_key ?? "",
        midtrans_client_key: setting?.midtrans_client_key ?? "",
        midtrans_production: setting?.midtrans_production ?? false,
        xendit_enabled: setting?.xendit_enabled ?? false,
        xendit_secret_key: setting?.xendit_secret_key ?? "",
        xendit_public_key: setting?.xendit_public_key ?? "",
        xendit_production: setting?.xendit_production ?? false,
    });

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error) toast.error(flash.error);
    }, [flash]);

    const handleSubmit = (e) => {
        e.preventDefault();
        put(route("settings.payments.update"), { preserveScroll: true });
    };

    const isGatewaySelectable = (gateway) => {
        if (gateway === "cash") return true;
        if (gateway === "midtrans") return data.midtrans_enabled;
        if (gateway === "xendit") return data.xendit_enabled;
        return false;
    };

    return (
        <>
            <Head title="Pengaturan Payment" />

            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <IconCreditCard size={28} className="text-primary-500" />
                    Pengaturan Payment Gateway
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Konfigurasi metode pembayaran dan gateway
                </p>
            </div>

            <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
                {/* Default Gateway */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                        <IconCash size={18} />
                        Gateway Default
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                        Gateway pembayaran default yang digunakan kasir saat
                        membuka halaman transaksi.
                    </p>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Pilih Gateway
                        </label>
                        <select
                            value={data.default_gateway}
                            onChange={(e) =>
                                setData("default_gateway", e.target.value)
                            }
                            className="w-full h-11 px-4 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                        >
                            {supportedGateways.map((gw) => (
                                <option
                                    key={gw.value}
                                    value={gw.value}
                                    disabled={!isGatewaySelectable(gw.value)}
                                >
                                    {gw.label}
                                    {!isGatewaySelectable(gw.value) &&
                                        " (nonaktif)"}
                                </option>
                            ))}
                        </select>
                        {errors?.default_gateway && (
                            <small className="text-xs text-danger-500 mt-1">
                                {errors.default_gateway}
                            </small>
                        )}
                    </div>
                </div>

                {/* Midtrans */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                            <IconBrandStripe size={18} />
                            Midtrans Snap
                        </h3>
                        <label
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all ${
                                data.midtrans_enabled
                                    ? "bg-success-100 dark:bg-success-900/50 text-success-700 dark:text-success-400"
                                    : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                            }`}
                        >
                            <Checkbox
                                checked={data.midtrans_enabled}
                                onChange={(e) =>
                                    setData(
                                        "midtrans_enabled",
                                        e.target.checked
                                    )
                                }
                            />
                            {data.midtrans_enabled ? "Aktif" : "Nonaktif"}
                        </label>
                    </div>
                    <div
                        className={`space-y-4 ${
                            !data.midtrans_enabled
                                ? "opacity-50 pointer-events-none"
                                : ""
                        }`}
                    >
                        <div className="grid gap-4 md:grid-cols-2">
                            <Input
                                label="Server Key"
                                type="text"
                                value={data.midtrans_server_key}
                                onChange={(e) =>
                                    setData(
                                        "midtrans_server_key",
                                        e.target.value
                                    )
                                }
                                errors={errors?.midtrans_server_key}
                                placeholder="SB-Mid-server-xxx"
                            />
                            <Input
                                label="Client Key"
                                type="text"
                                value={data.midtrans_client_key}
                                onChange={(e) =>
                                    setData(
                                        "midtrans_client_key",
                                        e.target.value
                                    )
                                }
                                errors={errors?.midtrans_client_key}
                                placeholder="SB-Mid-client-xxx"
                            />
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <Checkbox
                                checked={data.midtrans_production}
                                onChange={(e) =>
                                    setData(
                                        "midtrans_production",
                                        e.target.checked
                                    )
                                }
                            />
                            <span className="text-sm text-slate-600 dark:text-slate-400">
                                Mode Produksi
                            </span>
                        </label>
                    </div>
                </div>

                {/* Xendit */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                            <IconCreditCard size={18} />
                            Xendit Invoice
                        </h3>
                        <label
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all ${
                                data.xendit_enabled
                                    ? "bg-success-100 dark:bg-success-900/50 text-success-700 dark:text-success-400"
                                    : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                            }`}
                        >
                            <Checkbox
                                checked={data.xendit_enabled}
                                onChange={(e) =>
                                    setData("xendit_enabled", e.target.checked)
                                }
                            />
                            {data.xendit_enabled ? "Aktif" : "Nonaktif"}
                        </label>
                    </div>
                    <div
                        className={`space-y-4 ${
                            !data.xendit_enabled
                                ? "opacity-50 pointer-events-none"
                                : ""
                        }`}
                    >
                        <div className="grid gap-4 md:grid-cols-2">
                            <Input
                                label="Secret Key"
                                type="text"
                                value={data.xendit_secret_key}
                                onChange={(e) =>
                                    setData("xendit_secret_key", e.target.value)
                                }
                                errors={errors?.xendit_secret_key}
                                placeholder="xnd_development_xxx"
                            />
                            <Input
                                label="Public Key"
                                type="text"
                                value={data.xendit_public_key}
                                onChange={(e) =>
                                    setData("xendit_public_key", e.target.value)
                                }
                                errors={errors?.xendit_public_key}
                                placeholder="xnd_public_development_xxx"
                            />
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <Checkbox
                                checked={data.xendit_production}
                                onChange={(e) =>
                                    setData(
                                        "xendit_production",
                                        e.target.checked
                                    )
                                }
                            />
                            <span className="text-sm text-slate-600 dark:text-slate-400">
                                Mode Produksi
                            </span>
                        </label>
                    </div>
                </div>

                {/* Submit */}
                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={processing}
                        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-medium transition-colors disabled:opacity-50"
                    >
                        <IconDeviceFloppy size={18} />
                        {processing ? "Menyimpan..." : "Simpan Konfigurasi"}
                    </button>
                </div>
            </form>
        </>
    );
}
