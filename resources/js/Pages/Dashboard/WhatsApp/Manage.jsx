import React, { useMemo, useState } from "react";
import { Head, router } from "@inertiajs/react";
import PageHeader from "@/Components/WhatsApp/PageHeader";
import {
    IconBellRinging,
    IconBrandWhatsapp,
    IconCalendar,
    IconGift,
    IconPhone,
    IconSearch,
    IconSend,
} from "@tabler/icons-react";
import toast from "react-hot-toast";
import { toDisplayDateTime } from "@/Utils/datetime";

const getErrorMessage = (value, fallback) => {
    if (Array.isArray(value)) {
        return value[0] || fallback;
    }

    return value || fallback;
};

export default function Manage({ summary = {}, customers = [], appointments = [] }) {
    const [recipientMode, setRecipientMode] = useState("selected");
    const [headline, setHeadline] = useState("Promo servis berkala");
    const [body, setBody] = useState("Kami sedang ada promo servis dan pengecekan berkala untuk pelanggan setia.");
    const [note, setNote] = useState("");
    const [customerFilter, setCustomerFilter] = useState("");
    const [selectedCustomerIds, setSelectedCustomerIds] = useState([]);
    const [broadcasting, setBroadcasting] = useState(false);
    const [sendingReminderId, setSendingReminderId] = useState(null);

    const filteredCustomers = useMemo(() => {
        const term = customerFilter.trim().toLowerCase();
        if (!term) return customers;

        return customers.filter((customer) => {
            return [customer.name, customer.phone]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(term));
        });
    }, [customerFilter, customers]);

    const toggleCustomer = (customerId) => {
        const numericId = Number(customerId);

        setSelectedCustomerIds((current) => {
            if (current.includes(numericId)) {
                return current.filter((id) => id !== numericId);
            }

            return [...current, numericId];
        });
    };

    const sendReminder = (appointmentId) => {
        setSendingReminderId(appointmentId);

        router.post(
            route("whatsapp.messages.reminder", appointmentId),
            {},
            {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success("Reminder servis berhasil di-queue.");
                },
                onError: (errors) => {
                    toast.error(getErrorMessage(errors?.phone, getErrorMessage(errors?.error, "Gagal mengirim reminder servis.")));
                },
                onFinish: () => {
                    setSendingReminderId(null);
                },
            }
        );
    };

    const submitBroadcast = (event) => {
        event.preventDefault();

        setBroadcasting(true);

        router.post(
            route("whatsapp.messages.broadcast"),
            {
                recipient_mode: recipientMode,
                customer_ids: recipientMode === "selected" ? selectedCustomerIds : [],
                headline,
                body,
                note,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success("Broadcast promo berhasil di-queue.");
                    setSelectedCustomerIds([]);
                },
                onError: (errors) => {
                    toast.error(
                        getErrorMessage(
                            errors?.customer_ids,
                            getErrorMessage(errors?.body, getErrorMessage(errors?.headline, "Gagal mengirim broadcast promo."))
                        )
                    );
                },
                onFinish: () => {
                    setBroadcasting(false);
                },
            }
        );
    };

    return (
        <>
            <Head title="Kirim Pesan WhatsApp" />

            <div className="space-y-6">
                <PageHeader
                    title="Kirim Pesan"
                    description="Kirim reminder servis dan broadcast promo langsung dari Laravel."
                    icon={<IconBrandWhatsapp size={26} className="text-emerald-600" />}
                />

                <div className="grid gap-6 xl:grid-cols-5">
                    <div className="xl:col-span-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div className="mb-4 flex items-center justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Reminder Servis Mendatang</h2>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Klik untuk mengirim pengingat ke pelanggan yang sudah punya jadwal.</p>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800">
                                        <th className="py-3 pr-4">Pelanggan</th>
                                        <th className="py-3 pr-4">Jadwal</th>
                                        <th className="py-3 pr-4">Kendaraan</th>
                                        <th className="py-3 pr-4">Status</th>
                                        <th className="py-3 pr-4">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {appointments.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="py-8 text-center text-slate-500">
                                                Belum ada appointment mendatang.
                                            </td>
                                        </tr>
                                    ) : (
                                        appointments.map((appointment) => (
                                            <tr key={appointment.id} className="border-b border-slate-100 dark:border-slate-800">
                                                <td className="py-3 pr-4">
                                                    <div className="font-medium text-slate-900 dark:text-white">{appointment.customer?.name || "-"}</div>
                                                    <div className="text-xs text-slate-500">{appointment.customer?.phone || "No phone"}</div>
                                                </td>
                                                <td className="py-3 pr-4 text-slate-700 dark:text-slate-300">
                                                    <span className="inline-flex items-center gap-1.5">
                                                        <IconCalendar size={14} className="text-slate-400" />
                                                        {toDisplayDateTime(appointment.scheduled_at)}
                                                    </span>
                                                </td>
                                                <td className="py-3 pr-4 text-slate-700 dark:text-slate-300">
                                                    {appointment.vehicle?.plate_number || "-"}
                                                </td>
                                                <td className="py-3 pr-4 text-slate-700 dark:text-slate-300">
                                                    {appointment.status || "-"}
                                                </td>
                                                <td className="py-3 pr-4">
                                                    <button
                                                        type="button"
                                                        onClick={() => sendReminder(appointment.id)}
                                                        disabled={sendingReminderId === appointment.id}
                                                        className="inline-flex items-center gap-2 rounded-xl border border-primary-200 px-3 py-2 text-xs font-semibold text-primary-700 hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-60"
                                                    >
                                                        <IconBellRinging size={14} />
                                                        {sendingReminderId === appointment.id ? "Mengirim..." : "Kirim Reminder"}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="xl:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div className="mb-4 flex items-center gap-2">
                            <IconGift size={20} className="text-emerald-600" />
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Broadcast Promo</h2>
                        </div>

                        <form className="space-y-4" onSubmit={submitBroadcast}>
                            <div>
                                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Mode Penerima</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setRecipientMode("selected")}
                                        className={`rounded-xl border px-3 py-2 text-sm font-semibold ${recipientMode === "selected" ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600"}`}
                                    >
                                        Pilih Pelanggan
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setRecipientMode("all")}
                                        className={`rounded-xl border px-3 py-2 text-sm font-semibold ${recipientMode === "all" ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600"}`}
                                    >
                                        Semua Pelanggan
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Headline</label>
                                <input
                                    type="text"
                                    value={headline}
                                    onChange={(event) => setHeadline(event.target.value)}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Isi Pesan</label>
                                <textarea
                                    rows={6}
                                    value={body}
                                    onChange={(event) => setBody(event.target.value)}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Catatan Tambahan</label>
                                <textarea
                                    rows={3}
                                    value={note}
                                    onChange={(event) => setNote(event.target.value)}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                                    placeholder="Opsional"
                                />
                            </div>

                            {recipientMode === "selected" && (
                                <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                                    <div className="mb-3 flex items-center gap-2">
                                        <IconSearch size={16} className="text-slate-400" />
                                        <input
                                            type="text"
                                            value={customerFilter}
                                            onChange={(event) => setCustomerFilter(event.target.value)}
                                            placeholder="Cari pelanggan atau nomor"
                                            className="w-full border-0 bg-transparent p-0 text-sm outline-none placeholder:text-slate-400"
                                        />
                                    </div>

                                    <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                                        {filteredCustomers.length === 0 ? (
                                            <p className="text-sm text-slate-500">Tidak ada pelanggan yang cocok.</p>
                                        ) : (
                                            filteredCustomers.map((customer) => (
                                                <label key={customer.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-800">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedCustomerIds.includes(Number(customer.id))}
                                                        onChange={() => toggleCustomer(customer.id)}
                                                        className="mt-1 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                                    />
                                                    <div>
                                                        <div className="font-medium text-slate-900 dark:text-white">{customer.name}</div>
                                                        <div className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                                                            <IconPhone size={12} />
                                                            {customer.phone}
                                                        </div>
                                                    </div>
                                                </label>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={broadcasting}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <IconSend size={16} />
                                {broadcasting ? "Mengirim..." : "Queue Broadcast Promo"}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </>
    );
}
