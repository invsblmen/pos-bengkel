import React from "react";

/**
 * Kepala halaman bersama untuk seluruh area WhatsApp.
 * Kiri: judul + deskripsi. Kanan: aksi (children).
 */
export default function PageHeader({ title, description, icon, children }) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
            <div>
                <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
                    {icon}
                    {title}
                </h1>
                {description ? (
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
                ) : null}
            </div>
            {children ? (
                <div className="flex flex-wrap items-center gap-2">{children}</div>
            ) : null}
        </div>
    );
}
