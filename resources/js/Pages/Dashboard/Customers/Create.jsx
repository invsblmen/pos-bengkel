import React from "react";
import { Head, useForm, usePage, Link, router } from "@inertiajs/react";
import Input from "@/Components/Dashboard/Input";
import Textarea from "@/Components/Dashboard/TextArea";
import toast from "react-hot-toast";
import {
    IconUsers,
    IconDeviceFloppy,
    IconArrowLeft,
    IconPhone,
    IconMapPin,
    IconMail,
} from "@tabler/icons-react";

export default function Create() {
    const { errors } = usePage().props;

    const { data, setData, post, processing } = useForm({
        name: "",
        phone: "",
        identity_type: "",
        identity_number: "",
        email: "",
        address: "",
    });

    const submit = (e) => {
        e.preventDefault();
        post(route("customers.store"), {
            onSuccess: () => { toast.success("Pelanggan berhasil ditambahkan"); router.reload(); },
            onError: () => toast.error("Gagal menyimpan pelanggan"),
        });
    };

    return (
        <>
            <Head title="Tambah Pelanggan" />

            <div className="mb-6">
                <Link
                    href={route("customers.index")}
                    className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-primary-600 mb-3"
                >
                    <IconArrowLeft size={16} />
                    Kembali ke Pelanggan
                </Link>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <IconUsers size={28} className="text-primary-500" />
                    Tambah Pelanggan Baru
                </h1>
            </div>

            <form onSubmit={submit}>
                <div className="max-w-2xl">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input
                                    type="text"
                                    label="Nama Pelanggan"
                                    placeholder="Masukkan nama lengkap"
                                    errors={errors.name}
                                    onChange={(e) =>
                                        setData("name", e.target.value)
                                    }
                                    value={data.name}
                                />
                                <div className="relative">
                                    <Input
                                        type="text"
                                        label="No. Handphone"
                                        placeholder="08xxxxxxxxxx"
                                        errors={errors.phone}
                                        onChange={(e) =>
                                            setData("phone", e.target.value)
                                        }
                                        value={data.phone}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Tipe Identitas
                                    </label>
                                    <select
                                        value={data.identity_type}
                                        onChange={(e) => setData("identity_type", e.target.value)}
                                        className="w-full h-11 px-4 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200"
                                    >
                                        <option value="">Pilih tipe identitas</option>
                                        <option value="KTP">KTP</option>
                                        <option value="SIM">SIM</option>
                                        <option value="Passport">Passport</option>
                                    </select>
                                </div>
                                <Input
                                    type="text"
                                    label="Nomor Identitas"
                                    placeholder="Nomor KTP / SIM / Passport"
                                    errors={errors.identity_number}
                                    onChange={(e) => setData("identity_number", e.target.value)}
                                    value={data.identity_number}
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input
                                    type="email"
                                    label="Email"
                                    placeholder="pelanggan@email.com"
                                    errors={errors.email}
                                    onChange={(e) =>
                                        setData("email", e.target.value)
                                    }
                                    value={data.email}
                                />
                            </div>
                            <Textarea
                                label="Alamat"
                                placeholder="Alamat lengkap pelanggan"
                                errors={errors.address}
                                onChange={(e) =>
                                    setData("address", e.target.value)
                                }
                                value={data.address}
                                rows={3}
                            />
                        </div>

                        <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
                            <Link
                                href={route("customers.index")}
                                className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition-colors"
                            >
                                Batal
                            </Link>
                            <button
                                type="submit"
                                disabled={processing}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-medium transition-colors disabled:opacity-50"
                            >
                                <IconDeviceFloppy size={18} />
                                {processing ? "Menyimpan..." : "Simpan"}
                            </button>
                        </div>
                    </div>
                </div>
            </form>
        </>
    );
}
