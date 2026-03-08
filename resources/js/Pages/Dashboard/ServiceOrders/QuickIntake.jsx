import React from "react";
import { Head, useForm } from "@inertiajs/react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { IconBolt, IconDeviceFloppy } from "@tabler/icons-react";
import toast from "react-hot-toast";

export default function QuickIntake({ mechanics = [] }) {
    const { data, setData, post, processing, errors, reset } = useForm({
        customer_name: "",
        customer_phone: "",
        plate_number: "",
        vehicle_brand: "",
        vehicle_model: "",
        odometer_km: "",
        complaint: "",
        mechanic_id: "",
    });

    const handleSubmit = (e) => {
        e.preventDefault();

        post(route("service-orders.quick-intake.store"), {
            preserveScroll: true,
            onSuccess: () => {
                toast.success("Penerimaan konsumen berhasil dibuat");
                reset();
            },
            onError: () => {
                toast.error("Gagal menyimpan penerimaan cepat");
            },
        });
    };

    return (
        <DashboardLayout>
            <Head title="Penerimaan Cepat" />

            <div className="max-w-4xl space-y-5">
                <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-cyan-600 to-blue-600 p-5 text-white shadow-lg">
                    <div className="flex items-center gap-3">
                        <IconBolt size={28} />
                        <div>
                            <h1 className="text-2xl font-bold">Penerimaan Konsumen Cepat</h1>
                            <p className="text-sm text-white/90">
                                Form ringkas untuk front desk. Isi data inti, simpan, lalu lanjutkan detail servis di belakang.
                            </p>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Nama Konsumen</label>
                            <input
                                type="text"
                                value={data.customer_name}
                                onChange={(e) => setData("customer_name", e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg"
                                placeholder="Nama lengkap"
                                required
                            />
                            {errors.customer_name && <p className="text-xs text-rose-600 mt-1">{errors.customer_name}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">No. Telepon</label>
                            <input
                                type="text"
                                value={data.customer_phone}
                                onChange={(e) => setData("customer_phone", e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg"
                                placeholder="08xxxxxxxxxx"
                                required
                            />
                            {errors.customer_phone && <p className="text-xs text-rose-600 mt-1">{errors.customer_phone}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">No. Polisi</label>
                            <input
                                type="text"
                                value={data.plate_number}
                                onChange={(e) => setData("plate_number", e.target.value.toUpperCase())}
                                className="w-full px-3 py-2 border rounded-lg"
                                placeholder="B1234XYZ"
                                required
                            />
                            {errors.plate_number && <p className="text-xs text-rose-600 mt-1">{errors.plate_number}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Odometer (KM)</label>
                            <input
                                type="number"
                                min="0"
                                value={data.odometer_km}
                                onChange={(e) => setData("odometer_km", e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg"
                                placeholder="Contoh: 12500"
                                required
                            />
                            {errors.odometer_km && <p className="text-xs text-rose-600 mt-1">{errors.odometer_km}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Merk Kendaraan</label>
                            <input
                                type="text"
                                value={data.vehicle_brand}
                                onChange={(e) => setData("vehicle_brand", e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg"
                                placeholder="Toyota / Honda / ..."
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Model Kendaraan</label>
                            <input
                                type="text"
                                value={data.vehicle_model}
                                onChange={(e) => setData("vehicle_model", e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg"
                                placeholder="Avanza / Beat / ..."
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium mb-1">Mekanik Tujuan (opsional)</label>
                            <select
                                value={data.mechanic_id}
                                onChange={(e) => setData("mechanic_id", e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg"
                            >
                                <option value="">Belum ditentukan</option>
                                {mechanics.map((mechanic) => (
                                    <option key={mechanic.id} value={mechanic.id}>
                                        {mechanic.name}
                                    </option>
                                ))}
                            </select>
                            {errors.mechanic_id && <p className="text-xs text-rose-600 mt-1">{errors.mechanic_id}</p>}
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium mb-1">Keluhan / Catatan Awal</label>
                            <textarea
                                rows={4}
                                value={data.complaint}
                                onChange={(e) => setData("complaint", e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg"
                                placeholder="Contoh: mesin bergetar saat idle, rem berbunyi, dll"
                            />
                            {errors.complaint && <p className="text-xs text-rose-600 mt-1">{errors.complaint}</p>}
                        </div>
                    </div>

                    <div className="pt-2 flex justify-end">
                        <button
                            type="submit"
                            disabled={processing}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cyan-600 text-white hover:bg-cyan-700 disabled:opacity-60"
                        >
                            <IconDeviceFloppy size={16} />
                            {processing ? "Menyimpan..." : "Simpan Penerimaan Cepat"}
                        </button>
                    </div>
                </form>
            </div>
        </DashboardLayout>
    );
}
