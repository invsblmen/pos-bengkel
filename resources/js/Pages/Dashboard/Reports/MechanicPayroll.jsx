import React, { useState } from "react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head, router } from "@inertiajs/react";
import { Card, CardBody, CardHeader, CardTitle } from "@/Components/Card";
import { IconDownload } from "@tabler/icons-react";

export default function MechanicPayroll({ mechanics, filters, summary }) {
    const [formData, setFormData] = useState({
        start_date: filters.start_date,
        end_date: filters.end_date,
    });

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleFilterSubmit = (e) => {
        e.preventDefault();
        router.get(route("reports.mechanic-payroll.index"), formData);
    };

    const handleExport = () => {
        router.get(route("reports.export"), {
            type: "mechanic_payroll",
            start_date: formData.start_date,
            end_date: formData.end_date,
        });
    };

    return (
        <DashboardLayout>
            <Head title="Laporan Gaji Mekanik" />

            <div className="space-y-6">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold">Laporan Gaji Mekanik</h1>
                        <p className="text-gray-600 dark:text-gray-400">
                            Perhitungan gaji estimasi dari jam kerja layanan dan insentif layanan.
                        </p>
                    </div>
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                    >
                        <IconDownload size={18} />
                        Export CSV
                    </button>
                </div>

                <Card>
                    <CardBody>
                        <form onSubmit={handleFilterSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Tanggal Mulai</label>
                                <input
                                    type="date"
                                    name="start_date"
                                    value={formData.start_date}
                                    onChange={handleFilterChange}
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Tanggal Akhir</label>
                                <input
                                    type="date"
                                    name="end_date"
                                    value={formData.end_date}
                                    onChange={handleFilterChange}
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                            </div>
                            <div className="flex items-end">
                                <button type="submit" className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
                                    Terapkan
                                </button>
                            </div>
                        </form>
                    </CardBody>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card><CardBody><p className="text-sm text-gray-500">Total Mekanik</p><p className="text-2xl font-bold">{summary.total_mechanics}</p></CardBody></Card>
                    <Card><CardBody><p className="text-sm text-gray-500">Total Gaji Pokok</p><p className="text-2xl font-bold">Rp {(summary.total_base_salary || 0).toLocaleString("id-ID")}</p></CardBody></Card>
                    <Card><CardBody><p className="text-sm text-gray-500">Total Insentif</p><p className="text-2xl font-bold">Rp {(summary.total_incentive || 0).toLocaleString("id-ID")}</p></CardBody></Card>
                    <Card><CardBody><p className="text-sm text-gray-500">Total Take Home Pay</p><p className="text-2xl font-bold">Rp {(summary.total_take_home_pay || 0).toLocaleString("id-ID")}</p></CardBody></Card>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Rincian Gaji Mekanik</CardTitle>
                    </CardHeader>
                    <CardBody>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="border-b">
                                    <tr>
                                        <th className="text-left py-3 px-4">Nama</th>
                                        <th className="text-left py-3 px-4">No Pegawai</th>
                                        <th className="text-center py-3 px-4">Order</th>
                                        <th className="text-center py-3 px-4">Menit Kerja</th>
                                        <th className="text-right py-3 px-4">Tarif/Jam</th>
                                        <th className="text-right py-3 px-4">Gaji Pokok</th>
                                        <th className="text-right py-3 px-4">Insentif</th>
                                        <th className="text-right py-3 px-4">Take Home Pay</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {mechanics.length > 0 ? mechanics.map((mechanic) => (
                                        <tr key={mechanic.id} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                                            <td className="py-3 px-4 font-medium">{mechanic.name}</td>
                                            <td className="py-3 px-4">{mechanic.employee_number || "-"}</td>
                                            <td className="py-3 px-4 text-center">{mechanic.total_orders}</td>
                                            <td className="py-3 px-4 text-center">{mechanic.estimated_work_minutes}</td>
                                            <td className="py-3 px-4 text-right">Rp {(mechanic.hourly_rate || 0).toLocaleString("id-ID")}</td>
                                            <td className="py-3 px-4 text-right">Rp {(mechanic.base_salary || 0).toLocaleString("id-ID")}</td>
                                            <td className="py-3 px-4 text-right text-green-600 font-semibold">Rp {(mechanic.incentive_amount || 0).toLocaleString("id-ID")}</td>
                                            <td className="py-3 px-4 text-right font-bold">Rp {(mechanic.take_home_pay || 0).toLocaleString("id-ID")}</td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan="8" className="py-6 text-center text-gray-500">Tidak ada data</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardBody>
                </Card>
            </div>
        </DashboardLayout>
    );
}
