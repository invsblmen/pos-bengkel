import React, { useEffect } from "react";
import { Head, useForm, usePage } from "@inertiajs/react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import Input from "@/Components/Dashboard/Input";
import { IconDeviceFloppy, IconBuildingStore } from "@tabler/icons-react";
import toast from "react-hot-toast";

export default function BusinessProfile({ profile }) {
    const { flash } = usePage().props;

    const { data, setData, put, errors, processing } = useForm({
        business_name: profile?.business_name ?? "",
        business_phone: profile?.business_phone ?? "",
        business_address: profile?.business_address ?? "",
        facebook: profile?.facebook ?? "",
        instagram: profile?.instagram ?? "",
        tiktok: profile?.tiktok ?? "",
        google_my_business: profile?.google_my_business ?? "",
        website: profile?.website ?? "",
    });

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error) toast.error(flash.error);
    }, [flash]);

    const handleSubmit = (e) => {
        e.preventDefault();
        put(route("settings.business-profile.update"), { preserveScroll: true });
    };

    return (
        <>
            <Head title="Profil Bisnis" />

            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <IconBuildingStore size={28} className="text-primary-500" />
                    Profil Bisnis
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Informasi bisnis ini akan ditampilkan pada hasil print transaksi
                </p>
            </div>

            <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
                    <Input
                        label="Nama Usaha"
                        type="text"
                        value={data.business_name}
                        onChange={(e) => setData("business_name", e.target.value)}
                        errors={errors?.business_name}
                        placeholder="Contoh: Bengkel Maju Jaya"
                    />

                    <Input
                        label="Nomor HP Usaha"
                        type="text"
                        value={data.business_phone}
                        onChange={(e) => setData("business_phone", e.target.value)}
                        errors={errors?.business_phone}
                        placeholder="Contoh: 081234567890"
                    />

                    <div>
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                            Alamat Usaha
                        </label>
                        <textarea
                            rows={4}
                            value={data.business_address}
                            onChange={(e) =>
                                setData("business_address", e.target.value)
                            }
                            className="w-full px-4 py-3 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                            placeholder="Contoh: Jl. Raya Contoh No. 12, Jakarta"
                        />
                        {errors?.business_address && (
                            <small className="text-xs text-danger-500 mt-1 block">
                                {errors.business_address}
                            </small>
                        )}
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <Input
                            label="Facebook"
                            type="text"
                            value={data.facebook}
                            onChange={(e) => setData("facebook", e.target.value)}
                            errors={errors?.facebook}
                            placeholder="Contoh: bengkelmajujaya"
                        />

                        <Input
                            label="Instagram"
                            type="text"
                            value={data.instagram}
                            onChange={(e) => setData("instagram", e.target.value)}
                            errors={errors?.instagram}
                            placeholder="Contoh: @bengkelmajujaya"
                        />

                        <Input
                            label="TikTok"
                            type="text"
                            value={data.tiktok}
                            onChange={(e) => setData("tiktok", e.target.value)}
                            errors={errors?.tiktok}
                            placeholder="Contoh: @bengkelmajujaya"
                        />

                        <Input
                            label="Google My Business"
                            type="text"
                            value={data.google_my_business}
                            onChange={(e) =>
                                setData("google_my_business", e.target.value)
                            }
                            errors={errors?.google_my_business}
                            placeholder="Contoh: Bengkel Maju Jaya Official"
                        />

                        <Input
                            label="Website"
                            type="text"
                            value={data.website}
                            onChange={(e) => setData("website", e.target.value)}
                            errors={errors?.website}
                            placeholder="Contoh: https://bengkelmajujaya.com"
                        />
                    </div>
                </div>

                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={processing}
                        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-medium transition-colors disabled:opacity-50"
                    >
                        <IconDeviceFloppy size={18} />
                        {processing ? "Menyimpan..." : "Simpan Profil"}
                    </button>
                </div>
            </form>
        </>
    );
}

BusinessProfile.layout = (page) => <DashboardLayout children={page} />;
