import React, { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head, Link, router, usePage } from "@inertiajs/react";
import {
    IconCalendar,
    IconChevronLeft,
    IconChevronRight,
    IconClock,
    IconFilter,
    IconList,
    IconPlus,
    IconSearch,
    IconUser,
    IconX,
} from "@tabler/icons-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/Components/Card";
import {
    dateToLocalDateInput,
    toDisplayDateLong,
    toDisplayTime,
    todayLocalDate,
} from "@/Utils/datetime";

const WEEKDAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const MONTHS = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
];

const statusLabels = {
    scheduled: "Terjadwal",
    confirmed: "Dikonfirmasi",
    completed: "Selesai",
    cancelled: "Dibatalkan",
};

const statusBadgeClass = {
    scheduled: "bg-amber-100 text-amber-700 border-amber-200",
    confirmed: "bg-blue-100 text-blue-700 border-blue-200",
    completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
    cancelled: "bg-rose-100 text-rose-700 border-rose-200",
};

const statusDotClass = {
    scheduled: "bg-amber-500",
    confirmed: "bg-blue-500",
    completed: "bg-emerald-500",
    cancelled: "bg-rose-500",
};

export default function AppointmentCalendar({
    calendar_days,
    year,
    month,
    mechanics,
}) {
    const { props } = usePage();
    const csrfToken = props.csrf_token;

    const [selectedDate, setSelectedDate] = useState(null);
    const [showModal, setShowModal] = useState(false);

    const [selectedMechanic, setSelectedMechanic] = useState("");
    const [selectedSlot, setSelectedSlot] = useState("");
    const [availableSlots, setAvailableSlots] = useState([]);
    const [availableSlotsLoading, setAvailableSlotsLoading] = useState(false);

    const [viewMechanicId, setViewMechanicId] = useState("");
    const [viewStatus, setViewStatus] = useState("all");
    const [agendaQuery, setAgendaQuery] = useState("");

    const [customerQuery, setCustomerQuery] = useState("");
    const [customerResults, setCustomerResults] = useState([]);
    const [customerLoading, setCustomerLoading] = useState(false);
    const [customerError, setCustomerError] = useState("");
    const [selectedCustomer, setSelectedCustomer] = useState(null);

    const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
    const [newCustomerName, setNewCustomerName] = useState("");
    const [newCustomerPhone, setNewCustomerPhone] = useState("");
    const [newCustomerEmail, setNewCustomerEmail] = useState("");
    const [newCustomerAddress, setNewCustomerAddress] = useState("");
    const [creatingCustomer, setCreatingCustomer] = useState(false);

    const [notes, setNotes] = useState("");

    const todayStr = todayLocalDate();

    const toDate = (value) =>
        typeof value === "string"
            ? new Date(`${value}T00:00:00`)
            : new Date(value);

    useEffect(() => {
        if (!window.Echo) return;

        let reloadTimeout = null;
        const reloadCalendar = () => {
            if (reloadTimeout) {
                clearTimeout(reloadTimeout);
            }

            // Debounce tiny bursts of events so UI reload happens once.
            reloadTimeout = setTimeout(() => {
                router.reload({
                    only: ["calendar_days"],
                    preserveScroll: true,
                    preserveState: true,
                });
            }, 120);
        };

        const channel = window.Echo.channel("workshop.appointments");
        channel.listen(".appointment.created", reloadCalendar);
        channel.listen(".appointment.updated", reloadCalendar);
        channel.listen(".appointment.deleted", reloadCalendar);

        return () => {
            if (reloadTimeout) {
                clearTimeout(reloadTimeout);
            }
            window.Echo.leaveChannel("workshop.appointments");
        };
    }, []);

    const dayAppointmentsWithFilter = (day) => {
        if (!day || !day.appointments) return [];
        return day.appointments.filter((a) => {
            const byMechanic =
                !viewMechanicId ||
                String(a?.mechanic?.id ?? a?.mechanic_id) === String(viewMechanicId);
            const byStatus = viewStatus === "all" || a.status === viewStatus;
            return byMechanic && byStatus;
        });
    };

    const monthAppointments = useMemo(() => {
        return calendar_days
            .filter((day) => day)
            .flatMap((day) => dayAppointmentsWithFilter(day));
    }, [calendar_days, viewMechanicId, viewStatus]);

    const stats = useMemo(() => {
        return {
            total: monthAppointments.length,
            scheduled: monthAppointments.filter((a) => a.status === "scheduled").length,
            confirmed: monthAppointments.filter((a) => a.status === "confirmed").length,
            completed: monthAppointments.filter((a) => a.status === "completed").length,
            cancelled: monthAppointments.filter((a) => a.status === "cancelled").length,
        };
    }, [monthAppointments]);

    const agendaItems = useMemo(() => {
        let items = [];

        if (selectedDate) {
            const selectedDay = calendar_days.find((d) => d && d.date === selectedDate);
            items = selectedDay ? dayAppointmentsWithFilter(selectedDay) : [];
        } else {
            items = monthAppointments
                .sort((a, b) => String(a.scheduled_at).localeCompare(String(b.scheduled_at)))
                .slice(0, 12);
        }

        if (!agendaQuery.trim()) return items;

        const q = agendaQuery.toLowerCase();
        return items.filter((a) => {
            return (
                (a.customer?.name || "").toLowerCase().includes(q) ||
                (a.mechanic?.name || "").toLowerCase().includes(q) ||
                (a.status || "").toLowerCase().includes(q)
            );
        });
    }, [calendar_days, selectedDate, monthAppointments, agendaQuery, viewMechanicId, viewStatus]);

    const handleNavigate = (targetMonth, targetYear) => {
        router.get(route("appointments.calendar"), {
            year: targetYear,
            month: targetMonth,
        });
    };

    const handlePrevMonth = () => {
        const newMonth = month === 1 ? 12 : month - 1;
        const newYear = month === 1 ? year - 1 : year;
        handleNavigate(newMonth, newYear);
    };

    const handleNextMonth = () => {
        const newMonth = month === 12 ? 1 : month + 1;
        const newYear = month === 12 ? year + 1 : year;
        handleNavigate(newMonth, newYear);
    };

    const handleGoToday = () => {
        const now = new Date();
        handleNavigate(now.getMonth() + 1, now.getFullYear());
        setSelectedDate(todayStr);
    };

    const handleMonthChange = (e) => {
        handleNavigate(Number(e.target.value), year);
    };

    const handleYearChange = (e) => {
        handleNavigate(month, Number(e.target.value));
    };

    const handleSelectDate = (day) => {
        if (!day) return;

        setSelectedDate(day.date);
        setShowModal(true);
        setSelectedMechanic("");
        setSelectedSlot("");
        setAvailableSlots([]);
        setSelectedCustomer(null);
        setCustomerQuery("");
        setCustomerResults([]);
        setNotes("");
    };

    const handleMechanicSelect = (mechanicId) => {
        setSelectedMechanic(mechanicId);
        setSelectedSlot("");

        let formattedDate = selectedDate;
        if (typeof selectedDate === "object" && selectedDate.format) {
            formattedDate = selectedDate.format("YYYY-MM-DD");
        } else if (selectedDate instanceof Date) {
            formattedDate = dateToLocalDateInput(selectedDate);
        }

        if (!mechanicId || !formattedDate) {
            setAvailableSlots([]);
            return;
        }

        setAvailableSlotsLoading(true);
        fetch(
            `${route("appointments.available-slots")}?mechanic_id=${mechanicId}&date=${formattedDate}`
        )
            .then((res) => res.json())
            .then((data) => {
                setAvailableSlots(data.available_slots || []);
            })
            .catch(() => {
                setAvailableSlots([]);
            })
            .finally(() => setAvailableSlotsLoading(false));
    };

    const handleBookAppointment = (e) => {
        e.preventDefault();

        if (!selectedMechanic || !selectedSlot) {
            alert("Pilih mekanik dan jam terlebih dahulu.");
            return;
        }

        router.post(
            route("appointments.store"),
            {
                mechanic_id: selectedMechanic,
                scheduled_at: selectedSlot,
                customer_id: selectedCustomer?.id ?? null,
                notes: notes || null,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setShowModal(false);
                    setSelectedMechanic("");
                    setSelectedSlot("");
                    setSelectedCustomer(null);
                    setCustomerQuery("");
                    setAvailableSlots([]);
                    setNotes("");
                },
                onError: (errors) => {
                    if (errors.scheduled_at) {
                        alert(errors.scheduled_at);
                    } else {
                        alert("Gagal membuat appointment. Silakan coba lagi.");
                    }
                },
            }
        );
    };

    return (
        <DashboardLayout>
            <Head title="Kalender Booking" />

            <div className="space-y-5">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-gradient-to-r from-sky-600 via-cyan-600 to-emerald-600 p-5 text-white shadow-lg">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">Kalender Booking</h1>
                            <p className="text-sm text-white/90 mt-1">
                                Tampilan compact untuk booking cepat, monitoring slot, dan kontrol agenda harian.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                onClick={handleGoToday}
                                className="px-3 py-2 text-sm rounded-xl bg-white/20 hover:bg-white/30 transition"
                            >
                                Hari Ini
                            </button>
                            <Link
                                href={route("appointments.index")}
                                className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-xl bg-white text-slate-900 hover:bg-slate-100 transition"
                            >
                                <IconList size={16} />
                                Daftar Appointment
                            </Link>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
                        <p className="text-xs text-slate-500">Total Bulan Ini</p>
                        <p className="text-xl font-semibold text-slate-900 dark:text-slate-100">{stats.total}</p>
                    </div>
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                        <p className="text-xs text-amber-700">Terjadwal</p>
                        <p className="text-xl font-semibold text-amber-800">{stats.scheduled}</p>
                    </div>
                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                        <p className="text-xs text-blue-700">Dikonfirmasi</p>
                        <p className="text-xl font-semibold text-blue-800">{stats.confirmed}</p>
                    </div>
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                        <p className="text-xs text-emerald-700">Selesai</p>
                        <p className="text-xl font-semibold text-emerald-800">{stats.completed}</p>
                    </div>
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
                        <p className="text-xs text-rose-700">Dibatalkan</p>
                        <p className="text-xl font-semibold text-rose-800">{stats.cancelled}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
                    <div className="xl:col-span-3">
                        <Card>
                            <CardHeader>
                                <div className="flex flex-col gap-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={handlePrevMonth}
                                                className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                                            >
                                                <IconChevronLeft size={18} />
                                            </button>
                                            <button
                                                onClick={handleNextMonth}
                                                className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                                            >
                                                <IconChevronRight size={18} />
                                            </button>
                                            <CardTitle>{MONTHS[month - 1]} {year}</CardTitle>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <select
                                                value={month}
                                                onChange={handleMonthChange}
                                                className="px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                                            >
                                                {MONTHS.map((name, idx) => (
                                                    <option key={name} value={idx + 1}>
                                                        {name}
                                                    </option>
                                                ))}
                                            </select>
                                            <select
                                                value={year}
                                                onChange={handleYearChange}
                                                className="px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                                            >
                                                {Array.from({ length: 11 }, (_, i) => year - 5 + i).map((y) => (
                                                    <option key={y} value={y}>
                                                        {y}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm">
                                            <IconFilter size={15} />
                                            <span>Filter</span>
                                        </div>
                                        <select
                                            value={viewMechanicId}
                                            onChange={(e) => setViewMechanicId(e.target.value)}
                                            className="px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                                        >
                                            <option value="">Semua Mekanik</option>
                                            {mechanics.map((m) => (
                                                <option key={m.id} value={m.id}>
                                                    {m.name}
                                                </option>
                                            ))}
                                        </select>
                                        <select
                                            value={viewStatus}
                                            onChange={(e) => setViewStatus(e.target.value)}
                                            className="px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                                        >
                                            <option value="all">Semua Status</option>
                                            {Object.keys(statusLabels).map((key) => (
                                                <option key={key} value={key}>
                                                    {statusLabels[key]}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </CardHeader>

                            <CardBody>
                                <div className="grid grid-cols-7 gap-2 mb-2">
                                    {WEEKDAYS.map((day) => (
                                        <div
                                            key={day}
                                            className="text-center text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 py-2"
                                        >
                                            {day}
                                        </div>
                                    ))}
                                </div>

                                <div className="grid grid-cols-7 gap-2">
                                    {calendar_days.map((day, index) => {
                                        if (!day) {
                                            return (
                                                <div
                                                    key={`empty-${index}`}
                                                    className="min-h-[112px] rounded-xl bg-slate-50/70 dark:bg-slate-900/30"
                                                />
                                            );
                                        }

                                        const isToday = day.date === todayStr;
                                        const isSelected = selectedDate === day.date;
                                        const dayNum = day.day_num || toDate(day.date).getDate();
                                        const appointments = dayAppointmentsWithFilter(day);

                                        return (
                                            <button
                                                key={day.date}
                                                onClick={() => handleSelectDate(day)}
                                                className={`min-h-[112px] p-2 rounded-xl border text-left transition ${
                                                    isSelected
                                                        ? "border-cyan-500 ring-2 ring-cyan-200 dark:ring-cyan-900"
                                                        : "border-slate-200 hover:border-cyan-400 dark:border-slate-700"
                                                } ${isToday ? "bg-cyan-50/70 dark:bg-cyan-950/30" : "bg-white dark:bg-slate-900"}`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span
                                                        className={`text-sm font-semibold inline-flex h-7 w-7 items-center justify-center rounded-full ${
                                                            isToday ? "bg-cyan-600 text-white" : "text-slate-800 dark:text-slate-200"
                                                        }`}
                                                    >
                                                        {dayNum}
                                                    </span>
                                                    {appointments.length > 0 && (
                                                        <span className="text-[10px] text-slate-500">
                                                            {appointments.length} booking
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="mt-2 space-y-1">
                                                    {appointments.slice(0, 3).map((apt) => (
                                                        <div
                                                            key={apt.id}
                                                            className="flex items-center gap-1.5 rounded-md bg-slate-100 dark:bg-slate-800 px-1.5 py-1"
                                                        >
                                                            <span className={`h-2 w-2 rounded-full ${statusDotClass[apt.status] || "bg-slate-400"}`} />
                                                            <span className="text-[10px] text-slate-700 dark:text-slate-200 truncate">
                                                                {toDisplayTime(apt.scheduled_at)} {apt.customer?.name || "No Name"}
                                                            </span>
                                                        </div>
                                                    ))}
                                                    {appointments.length > 3 && (
                                                        <p className="text-[10px] text-slate-500">+{appointments.length - 3} lainnya</p>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </CardBody>
                        </Card>
                    </div>

                    <div>
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between gap-2">
                                    <CardTitle>
                                        {selectedDate
                                            ? `Agenda ${toDisplayDateLong(`${selectedDate} 00:00:00`)}`
                                            : "Agenda Bulan Ini"}
                                    </CardTitle>
                                    {selectedDate && (
                                        <button
                                            onClick={() => setSelectedDate(null)}
                                            className="text-xs px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
                                        >
                                            Reset
                                        </button>
                                    )}
                                </div>
                            </CardHeader>
                            <CardBody>
                                <div className="relative mb-3">
                                    <IconSearch size={16} className="absolute left-2.5 top-2.5 text-slate-400" />
                                    <input
                                        value={agendaQuery}
                                        onChange={(e) => setAgendaQuery(e.target.value)}
                                        placeholder="Cari customer/mekanik/status..."
                                        className="w-full pl-8 pr-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                                    />
                                </div>

                                <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
                                    {agendaItems.length === 0 ? (
                                        <div className="text-sm text-slate-500">Tidak ada booking yang cocok.</div>
                                    ) : (
                                        agendaItems.map((apt) => (
                                            <div
                                                key={apt.id}
                                                className="rounded-xl border border-slate-200 dark:border-slate-700 p-3"
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                                            {apt.customer?.name || "Belum dipilih"}
                                                        </p>
                                                        <p className="text-xs text-slate-500 mt-0.5">
                                                            {toDisplayDateLong(apt.scheduled_at)}
                                                        </p>
                                                    </div>
                                                    <span
                                                        className={`text-[10px] px-2 py-1 rounded-full border ${statusBadgeClass[apt.status] || "bg-slate-100 text-slate-700 border-slate-200"}`}
                                                    >
                                                        {statusLabels[apt.status] || apt.status}
                                                    </span>
                                                </div>
                                                <div className="mt-2 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                                                    <p className="flex items-center gap-1">
                                                        <IconClock size={14} />
                                                        {toDisplayTime(apt.scheduled_at)}
                                                    </p>
                                                    <p className="flex items-center gap-1">
                                                        <IconUser size={14} />
                                                        {apt.mechanic?.name || "-"}
                                                    </p>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </CardBody>
                        </Card>
                    </div>
                </div>

                {showModal && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-[1px] z-50 p-3 sm:p-6 overflow-y-auto">
                        <div className="mx-auto max-w-2xl">
                            <Card className="shadow-2xl">
                                <CardHeader>
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <CardTitle>Booking Appointment</CardTitle>
                                            <p className="text-xs text-slate-500 mt-1">
                                                {selectedDate
                                                    ? toDisplayDateLong(`${selectedDate} 00:00:00`)
                                                    : "Pilih tanggal terlebih dahulu"}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setShowModal(false)}
                                            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                                        >
                                            <IconX size={18} />
                                        </button>
                                    </div>
                                </CardHeader>

                                <CardBody>
                                    <form onSubmit={handleBookAppointment} className="space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium mb-1">Mekanik</label>
                                                <select
                                                    value={selectedMechanic}
                                                    onChange={(e) => handleMechanicSelect(e.target.value)}
                                                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                                                >
                                                    <option value="">-- Pilih Mekanik --</option>
                                                    {mechanics.map((mechanic) => (
                                                        <option key={mechanic.id} value={mechanic.id}>
                                                            {mechanic.name}
                                                            {mechanic.specialty ? ` (${mechanic.specialty})` : ""}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium mb-1">Slot Waktu</label>
                                                <div className="min-h-[42px] rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1.5 bg-slate-50 dark:bg-slate-900">
                                                    {availableSlotsLoading ? (
                                                        <p className="text-sm text-slate-500">Memuat slot...</p>
                                                    ) : !selectedMechanic ? (
                                                        <p className="text-sm text-slate-500">Pilih mekanik terlebih dahulu</p>
                                                    ) : availableSlots.length === 0 ? (
                                                        <p className="text-sm text-amber-600">Tidak ada slot tersedia</p>
                                                    ) : (
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {availableSlots.map((slot) => (
                                                                <button
                                                                    type="button"
                                                                    key={slot.timestamp}
                                                                    onClick={() => setSelectedSlot(slot.timestamp)}
                                                                    className={`px-2.5 py-1 rounded-md text-xs border transition ${
                                                                        selectedSlot === slot.timestamp
                                                                            ? "bg-cyan-600 text-white border-cyan-600"
                                                                            : "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 hover:border-cyan-500"
                                                                    }`}
                                                                >
                                                                    {slot.display}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-1">Pelanggan (opsional)</label>
                                            {selectedCustomer ? (
                                                <div className="flex items-center justify-between px-3 py-2 border rounded-lg bg-slate-50 dark:bg-slate-800">
                                                    <div>
                                                        <p className="text-sm font-medium">{selectedCustomer.name}</p>
                                                        <p className="text-xs text-slate-500">{selectedCustomer.phone}</p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className="text-xs text-rose-600 hover:underline"
                                                        onClick={() => setSelectedCustomer(null)}
                                                    >
                                                        Ganti
                                                    </button>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="relative">
                                                        <IconSearch size={16} className="absolute left-2.5 top-2.5 text-slate-400" />
                                                        <input
                                                            type="text"
                                                            value={customerQuery}
                                                            onChange={(e) => {
                                                                const q = e.target.value;
                                                                setCustomerQuery(q);
                                                                setCustomerError("");
                                                                if (q && q.length >= 1) {
                                                                    setCustomerLoading(true);
                                                                    fetch(`${route("customers.search")}?q=${encodeURIComponent(q)}`)
                                                                        .then(async (r) => {
                                                                            if (!r.ok) throw new Error(`HTTP ${r.status}`);
                                                                            return r.json();
                                                                        })
                                                                        .then((data) => setCustomerResults(data.data || []))
                                                                        .catch(() => {
                                                                            setCustomerResults([]);
                                                                            setCustomerError("Tidak dapat mencari pelanggan.");
                                                                        })
                                                                        .finally(() => setCustomerLoading(false));
                                                                } else {
                                                                    setCustomerResults([]);
                                                                }
                                                            }}
                                                            placeholder="Cari nama atau telepon pelanggan"
                                                            className="w-full pl-8 pr-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                                                        />
                                                    </div>

                                                    {customerError && <p className="text-xs text-rose-600 mt-1">{customerError}</p>}
                                                    {customerLoading && <p className="text-xs text-slate-500 mt-1">Mencari pelanggan...</p>}

                                                    {!customerLoading && customerQuery && customerResults.length === 0 && !showNewCustomerForm && (
                                                        <div className="mt-1 flex items-center justify-between">
                                                            <p className="text-xs text-slate-500">Tidak ada hasil.</p>
                                                            {customerQuery.length >= 3 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setShowNewCustomerForm(true);
                                                                        setNewCustomerName(customerQuery);
                                                                    }}
                                                                    className="text-xs text-cyan-600 hover:underline"
                                                                >
                                                                    Tambah pelanggan baru
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}

                                                    {!customerLoading && customerResults.length > 0 && (
                                                        <div className="mt-2 max-h-36 overflow-y-auto border rounded-lg divide-y dark:border-slate-700 dark:divide-slate-700">
                                                            {customerResults.map((c) => (
                                                                <button
                                                                    type="button"
                                                                    key={c.id}
                                                                    onClick={() => {
                                                                        setSelectedCustomer(c);
                                                                        setCustomerResults([]);
                                                                    }}
                                                                    className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800"
                                                                >
                                                                    <p className="text-sm font-medium">{c.name}</p>
                                                                    <p className="text-xs text-slate-500">{c.phone}</p>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {showNewCustomerForm && (
                                                        <div className="mt-2 p-3 border rounded-lg space-y-2 dark:border-slate-700">
                                                            <input
                                                                type="text"
                                                                className="w-full px-3 py-2 border rounded dark:bg-slate-900 dark:border-slate-700"
                                                                value={newCustomerName}
                                                                onChange={(e) => setNewCustomerName(e.target.value)}
                                                                placeholder="Nama"
                                                            />
                                                            <input
                                                                type="text"
                                                                className="w-full px-3 py-2 border rounded dark:bg-slate-900 dark:border-slate-700"
                                                                value={newCustomerPhone}
                                                                onChange={(e) => setNewCustomerPhone(e.target.value)}
                                                                placeholder="No. Telepon"
                                                            />
                                                            <input
                                                                type="email"
                                                                className="w-full px-3 py-2 border rounded dark:bg-slate-900 dark:border-slate-700"
                                                                value={newCustomerEmail}
                                                                onChange={(e) => setNewCustomerEmail(e.target.value)}
                                                                placeholder="Email (opsional)"
                                                            />
                                                            <textarea
                                                                className="w-full px-3 py-2 border rounded dark:bg-slate-900 dark:border-slate-700"
                                                                rows={2}
                                                                value={newCustomerAddress}
                                                                onChange={(e) => setNewCustomerAddress(e.target.value)}
                                                                placeholder="Alamat"
                                                            />
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    type="button"
                                                                    className="px-3 py-2 bg-cyan-600 text-white rounded disabled:opacity-50"
                                                                    disabled={
                                                                        creatingCustomer ||
                                                                        !newCustomerName ||
                                                                        !newCustomerPhone ||
                                                                        !newCustomerAddress
                                                                    }
                                                                    onClick={async () => {
                                                                        try {
                                                                            setCreatingCustomer(true);
                                                                            const res = await fetch(route("customers.storeAjax"), {
                                                                                method: "POST",
                                                                                headers: {
                                                                                    "Content-Type": "application/json",
                                                                                    "X-CSRF-TOKEN": csrfToken,
                                                                                    Accept: "application/json",
                                                                                },
                                                                                body: JSON.stringify({
                                                                                    name: newCustomerName,
                                                                                    no_telp: newCustomerPhone,
                                                                                    email: newCustomerEmail,
                                                                                    address: newCustomerAddress,
                                                                                }),
                                                                            });

                                                                            const data = await res.json();
                                                                            if (!res.ok || !data.success) {
                                                                                alert(data.message || "Gagal membuat pelanggan.");
                                                                                setCreatingCustomer(false);
                                                                                return;
                                                                            }

                                                                            setSelectedCustomer(data.customer);
                                                                            setShowNewCustomerForm(false);
                                                                            setCustomerQuery("");
                                                                            setCustomerResults([]);
                                                                            setNewCustomerEmail("");
                                                                            setNewCustomerName("");
                                                                            setNewCustomerPhone("");
                                                                            setNewCustomerAddress("");
                                                                            setCreatingCustomer(false);
                                                                        } catch {
                                                                            alert("Gagal menambahkan pelanggan.");
                                                                            setCreatingCustomer(false);
                                                                        }
                                                                    }}
                                                                >
                                                                    {creatingCustomer ? "Menyimpan..." : "Simpan & Pilih"}
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="px-3 py-2 border rounded"
                                                                    onClick={() => setShowNewCustomerForm(false)}
                                                                >
                                                                    Batal
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-1">Catatan</label>
                                            <textarea
                                                value={notes}
                                                onChange={(e) => setNotes(e.target.value)}
                                                rows={3}
                                                placeholder="Keluhan, request, atau catatan teknis"
                                                className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                                            />
                                        </div>

                                        <div className="flex gap-2 pt-2">
                                            <button
                                                type="button"
                                                onClick={() => setShowModal(false)}
                                                className="flex-1 px-4 py-2 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
                                            >
                                                Tutup
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={!selectedSlot}
                                                className="flex-1 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 inline-flex items-center justify-center gap-1"
                                            >
                                                <IconPlus size={16} />
                                                Booking Sekarang
                                            </button>
                                        </div>
                                    </form>
                                </CardBody>
                            </Card>
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
