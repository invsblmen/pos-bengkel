import React from "react";

/**
 * Kartu statistik bersama area WhatsApp.
 * Diekstrak dari StatCard lokal di Manage.jsx dan SummaryCard di QueueMonitor.jsx
 * (gabungan keduanya: nilai + ikon + teks bantuan opsional).
 */
export default function StatCard({ title, value, icon, tone = "slate", helper }) {
    const toneClass = {
        slate: "bg-slate-50 border-slate-200 text-slate-700",
        amber: "bg-amber-50 border-amber-200 text-amber-700",
        emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
        red: "bg-red-50 border-red-200 text-red-700",
        blue: "bg-blue-50 border-blue-200 text-blue-700",
    };

    return (
        <div className={`rounded-2xl border p-4 ${toneClass[tone] ?? toneClass.slate}`}>
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-sm font-medium">{title}</p>
                    <p className="mt-1 text-2xl font-bold">{value ?? 0}</p>
                    {helper ? <p className="mt-1 text-xs opacity-80">{helper}</p> : null}
                </div>
                {icon}
            </div>
        </div>
    );
}
