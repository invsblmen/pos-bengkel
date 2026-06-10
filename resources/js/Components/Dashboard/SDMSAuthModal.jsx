import { useEffect, useState } from 'react';
import { useForm } from '@inertiajs/react';
import {
    IconAlertCircle,
    IconBuildingFactory,
    IconCheck,
    IconEye,
    IconEyeOff,
    IconKey,
    IconLoader2,
    IconLogin,
    IconShieldLock,
    IconUser,
} from '@tabler/icons-react';
import Modal from '@/Components/Dashboard/Modal';

export default function SDMSAuthModal({ show, onClose, sdms = null }) {
    const { data, setData, post, processing, errors, reset } = useForm({
        idInternal: '',
        username: '',
        password: '',
    });
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        if (!show) {
            setShowPassword(false);
        }
    }, [show]);

    const closeModal = () => {
        reset('password');
        setShowPassword(false);
        onClose();
    };

    const submit = (event) => {
        event.preventDefault();

        post(route('sdms.auth.login'), {
            preserveScroll: true,
            onSuccess: () => {
                reset('password');
                setShowPassword(false);
                onClose();
            },
        });
    };

    return (
        <Modal show={show} onClose={closeModal} maxWidth="5xl" scrollable={true}>
            <div className="-m-4 sm:-m-6 grid overflow-hidden bg-white lg:grid-cols-[1.05fr_0.95fr] dark:bg-slate-950">
                <div className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-cyan-950 to-blue-900 p-6 text-white sm:p-8">
                    <div
                        className="absolute inset-0 opacity-20"
                        style={{
                            backgroundImage:
                                'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.22) 0, transparent 28%), radial-gradient(circle at 80% 0%, rgba(255,255,255,0.12) 0, transparent 24%), radial-gradient(circle at 100% 80%, rgba(34,211,238,0.16) 0, transparent 24%)',
                        }}
                    />
                    <div className="relative space-y-6">
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100">
                            <IconShieldLock size={14} /> Login SDMS
                        </div>

                        <div className="space-y-3">
                            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Masuk ke SDMS tanpa pindah halaman</h2>
                            <p className="max-w-xl text-sm leading-6 text-cyan-50/85 sm:text-base">
                                Gunakan popup ini untuk autentikasi SDMS langsung dari dashboard. Sesi akan tersimpan di aplikasi dan dipakai oleh halaman SDMS yang membutuhkan token.
                            </p>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                            {[
                                'Validasi wajib isi pada semua field',
                                'Password disembunyikan secara default',
                                'Tetap di halaman yang sedang dibuka',
                                'Sesi SDMS langsung dipakai ulang',
                            ].map((item) => (
                                <div key={item} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.08] p-4 backdrop-blur-sm">
                                    <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl bg-white/15 text-cyan-100">
                                        <IconCheck size={16} />
                                    </div>
                                    <p className="text-sm leading-6 text-white/90">{item}</p>
                                </div>
                            ))}
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/[0.08] p-4 backdrop-blur-sm">
                            <div className="flex items-center gap-2 text-sm font-semibold text-cyan-50">
                                <IconBuildingFactory size={16} />
                                Koneksi SDMS
                            </div>
                            <p className="mt-2 text-sm leading-6 text-cyan-50/80">
                                Jika sesi belum aktif, beberapa halaman SDMS akan meminta login. Setelah berhasil, token akan dipakai otomatis untuk request berikutnya.
                            </p>
                        </div>

                        {sdms && (sdms.access_token || sdms.id_token) && (
                            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-50">
                                <div className="flex items-center gap-2 font-semibold">
                                    <IconCheck size={16} /> Sesi aktif terdeteksi
                                </div>
                                <p className="mt-2 leading-6 text-emerald-50/85">
                                    Anda sudah memiliki token SDMS tersimpan. Gunakan popup ini hanya jika ingin login ulang atau mengganti kredensial.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-white p-6 sm:p-8 dark:bg-slate-950">
                    <div className="mb-6 flex items-start justify-between gap-4">
                        <div>
                            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                                <IconLogin size={14} /> Form Login
                            </div>
                            <h3 className="mt-3 text-2xl font-semibold text-slate-900 dark:text-white">Autentikasi SDMS</h3>
                            <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
                                Isi kredensial SDMS Anda untuk membuat sesi baru.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={closeModal}
                            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:text-white"
                        >
                            Tutup
                        </button>
                    </div>

                    {errors.global && (
                        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200">
                            <IconAlertCircle size={18} className="mt-0.5 shrink-0" />
                            <p className="leading-6">{errors.global}</p>
                        </div>
                    )}

                    <form onSubmit={submit} className="space-y-4">
                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                ID Internal
                            </label>
                            <div className="relative">
                                <IconKey size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    value={data.idInternal}
                                    onChange={(event) => setData('idInternal', event.target.value)}
                                    autoComplete="off"
                                    required
                                    minLength={2}
                                    placeholder="Masukkan ID internal"
                                    className={`w-full rounded-2xl border-2 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-4 focus:ring-cyan-500/15 dark:bg-slate-900 dark:text-white ${errors.idInternal ? 'border-rose-500 focus:border-rose-500' : 'border-slate-200 focus:border-cyan-500 dark:border-slate-800'}`}
                                />
                            </div>
                            {errors.idInternal && <p className="mt-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">{errors.idInternal}</p>}
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                Username
                            </label>
                            <div className="relative">
                                <IconUser size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    value={data.username}
                                    onChange={(event) => setData('username', event.target.value)}
                                    autoComplete="username"
                                    required
                                    minLength={2}
                                    placeholder="Masukkan username SDMS"
                                    className={`w-full rounded-2xl border-2 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-4 focus:ring-cyan-500/15 dark:bg-slate-900 dark:text-white ${errors.username ? 'border-rose-500 focus:border-rose-500' : 'border-slate-200 focus:border-cyan-500 dark:border-slate-800'}`}
                                />
                            </div>
                            {errors.username && <p className="mt-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">{errors.username}</p>}
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                Password
                            </label>
                            <div className="relative">
                                <IconKey size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={data.password}
                                    onChange={(event) => setData('password', event.target.value)}
                                    autoComplete="current-password"
                                    required
                                    minLength={4}
                                    placeholder="Masukkan password"
                                    className={`w-full rounded-2xl border-2 bg-white py-3 pl-11 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-4 focus:ring-cyan-500/15 dark:bg-slate-900 dark:text-white ${errors.password ? 'border-rose-500 focus:border-rose-500' : 'border-slate-200 focus:border-cyan-500 dark:border-slate-800'}`}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((current) => !current)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                                    aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                                >
                                    {showPassword ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                                </button>
                            </div>
                            {errors.password && <p className="mt-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">{errors.password}</p>}
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                            <p className="font-semibold text-slate-800 dark:text-slate-200">Validasi login</p>
                            <p className="mt-1">
                                Semua field wajib diisi. Jika login gagal, pesan error dari server akan tampil di atas form.
                            </p>
                        </div>

                        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                            <button
                                type="button"
                                onClick={closeModal}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-900 dark:hover:text-white"
                            >
                                Batal
                            </button>

                            <button
                                type="submit"
                                disabled={processing}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-600/20 transition hover:from-cyan-500 hover:to-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {processing ? <IconLoader2 size={18} className="animate-spin" /> : <IconLogin size={18} />}
                                {processing ? 'Memproses...' : 'Login ke SDMS'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </Modal>
    );
}
