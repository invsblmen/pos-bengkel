import React, { useEffect, useMemo, useState } from "react";
import { Head, useForm, usePage } from "@inertiajs/react";
import { IconDownload, IconFileImport, IconUpload } from "@tabler/icons-react";
import toast from "react-hot-toast";

function SummaryCard({ title, value, className = "" }) {
    return (
        <div className={`rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 ${className}`}>
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</p>
            <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
        </div>
    );
}

export default function Index({ datasets = [], selectedType = "", lastResult = null, importError = null, dryRun = false }) {
    const { errors } = usePage().props;
    const [expandedSheets, setExpandedSheets] = useState({});

    const { data, setData, post, processing, progress } = useForm({
        type: selectedType || (datasets[0]?.type ?? ""),
        file: null,
        dry_run: dryRun,
    });

    const selectedDataset = useMemo(() => {
        return datasets.find((item) => item.type === data.type) || null;
    }, [datasets, data.type]);

    const requiredHeaders = useMemo(() => {
        return selectedDataset?.required_headers ?? [];
    }, [selectedDataset]);

    const recommendedHeaders = useMemo(() => {
        return selectedDataset?.recommended_headers ?? [];
    }, [selectedDataset]);

    const groupedDetailFailures = useMemo(() => {
        const failures = Array.isArray(lastResult?.detail_failures) ? lastResult.detail_failures : [];
        if (failures.length === 0) {
            return [];
        }

        const grouped = failures.reduce((acc, item) => {
            const sheet = item.sheet || "Detail";
            if (!acc[sheet]) {
                acc[sheet] = [];
            }

            acc[sheet].push(item);
            return acc;
        }, {});

        return Object.entries(grouped).map(([sheet, items]) => ({
            sheet,
            items,
        }));
    }, [lastResult]);

    const warnings = Array.isArray(lastResult?.warnings) ? lastResult.warnings : [];

    useEffect(() => {
        if (groupedDetailFailures.length === 0) {
            setExpandedSheets({});
            return;
        }

        setExpandedSheets((prev) => {
            const next = {};
            groupedDetailFailures.forEach((group) => {
                next[group.sheet] = prev[group.sheet] ?? true;
            });
            return next;
        });
    }, [groupedDetailFailures]);

    const isTransactionDataset = ["service_orders", "part_purchases", "part_sales"].includes(data.type);

    const onSubmit = (e) => {
        e.preventDefault();

        if (!data.file) {
            toast.error("Pilih file Excel/CSV terlebih dulu.");
            return;
        }

        post(route("imports.store"), {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                toast.success(data.dry_run ? "Preview selesai diproses." : "Import selesai diproses.");
            },
            onError: () => {
                toast.error("Import gagal. Periksa format file dan data.");
            },
        });
    };

    return (
        <>
            <Head title="Manajemen Import" />

            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-white">
                        <IconFileImport size={22} />
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white">Manajemen Import Data Bengkel</h1>
                </div>
                <p className="text-slate-600 dark:text-slate-400">
                    Import data dari sistem lama menggunakan file Excel/CSV dan unduh template sample sesuai jenis data.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Upload File Import</h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        Gunakan urutan import: pelanggan, kendaraan, mekanik, supplier, kategori, lalu data transaksi/master lainnya.
                    </p>
                    {isTransactionDataset && (
                        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 px-4 py-3 text-xs">
                            Dataset transaksi memakai workbook Excel dengan beberapa sheet. CSV tidak didukung untuk pilihan ini.
                        </div>
                    )}

                    <form onSubmit={onSubmit} className="mt-5 space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Jenis Data</label>
                            <select
                                value={data.type}
                                onChange={(e) => setData("type", e.target.value)}
                                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm"
                            >
                                {datasets.map((item) => (
                                    <option key={item.type} value={item.type}>
                                        {item.import_order}. {item.label}
                                    </option>
                                ))}
                            </select>
                            {errors.type && <p className="mt-1 text-xs text-red-600">{errors.type}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">File Excel / CSV</label>
                            <input
                                type="file"
                                accept=".xlsx,.xls,.csv"
                                onChange={(e) => setData("file", e.target.files?.[0] || null)}
                                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm"
                            />
                            {errors.file && <p className="mt-1 text-xs text-red-600">{errors.file}</p>}
                        </div>

                        <label className="flex items-start gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 p-4">
                            <input
                                type="checkbox"
                                checked={data.dry_run}
                                onChange={(e) => setData("dry_run", e.target.checked)}
                                className="mt-1 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                            />
                            <span>
                                <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">Dry run / preview only</span>
                                <span className="block text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    Cek validasi dan kecocokan data tanpa menyimpan ke database.
                                </span>
                            </span>
                        </label>

                        {progress && (
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                                Upload progress: {progress.percentage}%
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={processing}
                            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2.5"
                        >
                            <IconUpload size={16} />
                            {processing ? "Memproses..." : data.dry_run ? "Preview Import" : "Mulai Import"}
                        </button>
                    </form>
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Template Sample</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 mb-3">
                        Download template per jenis data sebelum export dari sistem lama.
                    </p>
                    <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
                        Header bertanda * wajib diisi. Header berwarna biru adalah kolom rekomendasi.
                    </div>

                    <div className="max-h-96 overflow-y-auto pr-1 space-y-2">
                        {datasets.map((item) => (
                            <a
                                key={item.type}
                                href={route("imports.template", item.type)}
                                className="w-full flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800"
                            >
                                <span className="text-sm text-slate-700 dark:text-slate-200">{item.label}</span>
                                <IconDownload size={16} className="text-slate-500" />
                            </a>
                        ))}
                    </div>
                </div>
            </div>

            {selectedDataset?.notes && (
                <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 px-4 py-3 text-sm">
                    Catatan: {selectedDataset.notes}
                </div>
            )}

            {selectedDataset && (requiredHeaders.length > 0 || recommendedHeaders.length > 0) && (
                <div className="mt-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-4">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Kolom Penting Dataset Terpilih</h3>

                    {requiredHeaders.length > 0 && (
                        <div className="mt-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-red-700 dark:text-red-300">Wajib diisi</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                                {requiredHeaders.map((header) => (
                                    <span
                                        key={`required-${header}`}
                                        className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
                                    >
                                        {header}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {recommendedHeaders.length > 0 && (
                        <div className="mt-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">Direkomendasikan</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                                {recommendedHeaders.map((header) => (
                                    <span
                                        key={`recommended-${header}`}
                                        className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200"
                                    >
                                        {header}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {importError && (
                <div className="mt-5 rounded-xl border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm">
                    {importError}
                </div>
            )}

            {lastResult && (
                <div className="mt-6 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                        {lastResult.dry_run ? "Hasil Preview" : "Hasil Import"}: {lastResult.dataset}
                    </h2>
                    <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-3">
                        <SummaryCard title="Diproses" value={lastResult.processed_rows} />
                        <SummaryCard title="Sukses" value={lastResult.successful_rows} className="border-emerald-200 dark:border-emerald-800" />
                        <SummaryCard title="Baru" value={lastResult.created_rows} />
                        <SummaryCard title="Update" value={lastResult.updated_rows} />
                        <SummaryCard title="Gagal" value={lastResult.failed_rows} className="border-red-200 dark:border-red-800" />
                    </div>

                    {warnings.length > 0 && (
                        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 px-4 py-3 text-sm">
                            <p className="font-semibold">Peringatan Import</p>
                            <ul className="mt-2 list-disc space-y-1 pl-5">
                                {warnings.map((warning, idx) => (
                                    <li key={`${warning.message || warning}-${idx}`}>
                                        {warning.line ? `Baris ${warning.line}: ` : ""}
                                        {warning.message || warning}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {lastResult.dry_run && (
                        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 text-blue-800 px-4 py-3 text-sm">
                            Mode preview aktif. Data belum disimpan ke database.
                        </div>
                    )}

                    {lastResult.dry_run && (lastResult.would_create_rows > 0 || lastResult.would_update_rows > 0) && (
                        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-2">
                            <SummaryCard title="Akan Dibuat" value={lastResult.would_create_rows} />
                            <SummaryCard title="Akan Diupdate" value={lastResult.would_update_rows} />
                        </div>
                    )}

                    {(lastResult.detail_rows_processed !== undefined || lastResult.detail_rows_failed !== undefined) && (
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                            <SummaryCard title="Detail Diproses" value={lastResult.detail_rows_processed ?? 0} />
                            <SummaryCard title="Detail Gagal" value={lastResult.detail_rows_failed ?? 0} className="border-red-200 dark:border-red-800" />
                            <SummaryCard title="Detail Dilewati" value={lastResult.detail_rows_skipped ?? 0} />
                        </div>
                    )}

                    {lastResult.failed_rows > 0 && (
                        <div className="mt-5">
                            <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-2">Detail Baris Gagal</h3>
                            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-slate-50 dark:bg-slate-800">
                                        <tr>
                                            <th className="px-3 py-2 text-left font-semibold">Baris</th>
                                            <th className="px-3 py-2 text-left font-semibold">Pesan Error</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {lastResult.failures.map((item, idx) => (
                                            <tr key={`${item.line}-${idx}`} className="border-t border-slate-200 dark:border-slate-700">
                                                <td className="px-3 py-2">{item.line}</td>
                                                <td className="px-3 py-2 text-red-600 dark:text-red-400">{item.message}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {groupedDetailFailures.length > 0 && (
                        <div className="mt-5">
                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                <h3 className="font-semibold text-slate-800 dark:text-slate-100">Detail Baris Gagal (Sheet Detail)</h3>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const next = {};
                                            groupedDetailFailures.forEach((group) => {
                                                next[group.sheet] = true;
                                            });
                                            setExpandedSheets(next);
                                        }}
                                        className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                                    >
                                        Expand All
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const next = {};
                                            groupedDetailFailures.forEach((group) => {
                                                next[group.sheet] = false;
                                            });
                                            setExpandedSheets(next);
                                        }}
                                        className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                                    >
                                        Collapse All
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-3">
                                {groupedDetailFailures.map((group) => (
                                    <div key={`detail-group-${group.sheet}`} className="rounded-lg border border-slate-200 dark:border-slate-700">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setExpandedSheets((prev) => ({
                                                    ...prev,
                                                    [group.sheet]: !prev[group.sheet],
                                                }));
                                            }}
                                            className="w-full text-left cursor-pointer select-none bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-800 dark:text-slate-100"
                                        >
                                            {group.sheet} ({group.items.length} error)
                                        </button>
                                        {expandedSheets[group.sheet] && (
                                            <div className="overflow-x-auto">
                                                <table className="min-w-full text-sm">
                                                    <thead className="bg-slate-50/80 dark:bg-slate-800/80">
                                                        <tr>
                                                            <th className="px-3 py-2 text-left font-semibold">Baris</th>
                                                            <th className="px-3 py-2 text-left font-semibold">Pesan Error</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {group.items.map((item, idx) => (
                                                            <tr key={`detail-${group.sheet}-${item.line}-${idx}`} className="border-t border-slate-200 dark:border-slate-700">
                                                                <td className="px-3 py-2">{item.line}</td>
                                                                <td className="px-3 py-2 text-red-600 dark:text-red-400">{item.message}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </>
    );
}
