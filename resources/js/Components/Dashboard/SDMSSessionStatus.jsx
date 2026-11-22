import {
    IconAlertTriangle,
    IconCheck,
    IconId,
    IconShieldLock,
    IconSparkles,
} from '@tabler/icons-react';

export default function SDMSSessionStatus({ sdms = null, compact = false, className = '' }) {
    const isAuthenticated = Boolean(sdms?.authenticated);

    if (compact) {
        return (
            <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${isAuthenticated ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200'} ${className}`}>
                {isAuthenticated ? <IconCheck size={14} /> : <IconAlertTriangle size={14} />}
                {isAuthenticated ? 'Sesi SDMS aktif' : 'Sesi SDMS belum aktif'}
            </div>
        );
    }

    return (
        <div
            className={`rounded-3xl border p-4 shadow-sm ${isAuthenticated ? 'border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-cyan-50 dark:border-emerald-900/40 dark:from-emerald-950/20 dark:via-slate-950 dark:to-cyan-950/20' : 'border-amber-200 bg-gradient-to-r from-amber-50 via-white to-slate-50 dark:border-amber-900/40 dark:from-amber-950/20 dark:via-slate-950 dark:to-slate-900/70'} ${className}`}
        >
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-3">
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-slate-600 shadow-sm dark:bg-slate-950/70 dark:text-slate-300">
                        <IconShieldLock size={14} /> Status Sesi SDMS
                    </div>

                    <div className="space-y-1">
                        <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${isAuthenticated ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200'}`}>
                            {isAuthenticated ? <IconCheck size={14} /> : <IconAlertTriangle size={14} />}
                            {isAuthenticated ? 'Tersambung' : 'Belum tersambung'}
                        </div>

                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                            {isAuthenticated ? 'Sesi SDMS aktif dan siap dipakai' : 'Sesi SDMS belum aktif'}
                        </h2>
                        <p className="max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">
                            {isAuthenticated
                                ? 'Token sudah tersimpan di session aplikasi. Halaman SDMS akan langsung memakai kredensial ini untuk request berikutnya.'
                                : 'Silakan login dari popup agar token SDMS tersimpan tanpa pindah halaman.'}
                        </p>
                    </div>
                </div>

                <div className={`rounded-2xl border px-4 py-3 text-sm ${isAuthenticated ? 'border-emerald-200 bg-white/80 text-emerald-900 dark:border-emerald-900/40 dark:bg-slate-950/70 dark:text-emerald-200' : 'border-amber-200 bg-white/80 text-amber-900 dark:border-amber-900/40 dark:bg-slate-950/70 dark:text-amber-200'}`}>
                    <div className="flex items-center gap-2 font-semibold">
                        <IconSparkles size={16} /> Detail Sesi
                    </div>
                    {isAuthenticated ? (
                        <div className="mt-2 space-y-1 text-xs leading-5 opacity-90">
                            <p className="flex items-start gap-2"><IconId size={14} className="mt-0.5 shrink-0" /> Username: {sdms.username || '-'}</p>
                            <p className="flex items-start gap-2"><IconId size={14} className="mt-0.5 shrink-0" /> ID Internal: {sdms.idInternal || '-'}</p>
                            {(sdms.token_type || sdms.expires_in) && (
                                <p className="flex items-start gap-2"><IconCheck size={14} className="mt-0.5 shrink-0" /> {sdms.token_type ? `Type: ${sdms.token_type}` : ''}{sdms.token_type && sdms.expires_in ? ' · ' : ''}{sdms.expires_in ? `Expires in: ${sdms.expires_in}s` : ''}</p>
                            )}
                        </div>
                    ) : (
                        <div className="mt-2 text-xs leading-5 opacity-90">
                            <p>Beberapa fitur SDMS akan tetap menolak request sampai login selesai.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
