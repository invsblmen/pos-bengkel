'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { Button, Card } from '@components/ui'
import {
  IconEye,
  IconEyeOff,
  IconLoader2,
  IconLock,
  IconMail,
  IconShoppingCart,
  IconSparkles,
  IconMoon,
  IconSun,
} from '@tabler/icons-react'

export default function LoginClient({ from = '/' }) {
  const router = useRouter()
  const { login, isAuthenticated, loading } = useAuth()
  const { isDarkMode, toggleTheme } = useTheme()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.replace(from)
    }
  }, [loading, isAuthenticated, from, router])

  const onChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const onSubmit = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      await login(form.email.trim(), form.password)
      router.replace(from)
    } catch (err) {
      const apiError = err?.response?.data?.error || err?.response?.data?.message
      setError(apiError || 'Login gagal. Periksa email dan password.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <button
        type="button"
        onClick={toggleTheme}
        className="absolute right-4 top-4 z-20 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm backdrop-blur transition hover:bg-white dark:border-slate-800 dark:bg-slate-900/90 dark:text-slate-200 dark:hover:bg-slate-900 sm:right-6 sm:top-6"
        aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {isDarkMode ? <IconSun size={16} strokeWidth={1.8} className="text-amber-500" /> : <IconMoon size={16} strokeWidth={1.8} />}
        <span>{isDarkMode ? 'Light' : 'Dark'}</span>
      </button>

      <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <div className="relative flex items-center justify-center overflow-hidden px-4 py-10 sm:px-6 lg:px-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.18),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(37,99,235,0.16),transparent_40%),linear-gradient(180deg,rgba(255,255,255,0.8),rgba(255,255,255,0.95))] dark:bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.22),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(37,99,235,0.18),transparent_40%),linear-gradient(180deg,rgba(2,6,23,0.9),rgba(15,23,42,0.98))]" />
          <div className="relative z-10 w-full max-w-md">
            <div className="mb-8 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br from-primary-500 to-primary-700 text-white shadow-lg shadow-primary-900/20">
                <IconShoppingCart size={24} strokeWidth={1.8} />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary-600 dark:text-primary-300">POS Bengkel</p>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Masuk ke aplikasi</h1>
              </div>
            </div>

            <Card className="border-slate-200/80 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/85" footer={<p className="text-sm text-slate-500 dark:text-slate-400">Akses dashboard, service orders, appointments, dan modul workshop lainnya.</p>}>
              <div className="mb-6 space-y-2">
                <p className="inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700 ring-1 ring-primary-100 dark:bg-primary-900/30 dark:text-primary-200 dark:ring-primary-900/50">
                  <IconSparkles size={14} strokeWidth={1.9} />
                  GO Frontend - Next.js
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-300">Masuk untuk mengakses dashboard dan operasional bengkel.</p>
              </div>

              <form className="space-y-4" onSubmit={onSubmit}>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="email">Email</label>
                  <div className="relative">
                    <IconMail size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={form.email}
                      onChange={onChange}
                      placeholder="nama@email.com"
                      className="w-full rounded-2xl border border-slate-300 bg-white px-11 py-3.5 text-sm text-slate-900 outline-none transition focus:border-primary-500 focus:ring-4 focus:ring-primary-500/15 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="password">Password</label>
                  <div className="relative">
                    <IconLock size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={form.password}
                      onChange={onChange}
                      placeholder="••••••••"
                      className="w-full rounded-2xl border border-slate-300 bg-white px-11 py-3.5 pr-12 text-sm text-slate-900 outline-none transition focus:border-primary-500 focus:ring-4 focus:ring-primary-500/15 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"
                      aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                    >
                      {showPassword ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                    </button>
                  </div>
                </div>

                {error ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-200">
                    {error}
                  </div>
                ) : null}

                <Button type="submit" className="w-full" loading={submitting} icon={submitting ? <IconLoader2 size={18} className="animate-spin" /> : null}>
                  {submitting ? 'Memproses...' : 'Masuk'}
                </Button>
              </form>

              <div className="mt-5 flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
                <Link href="/" className="font-medium text-primary-600 hover:text-primary-700 dark:text-primary-300 dark:hover:text-primary-200">Kembali ke dashboard</Link>
                <span className="hidden sm:inline">Hubungi admin jika akun belum aktif.</span>
              </div>
            </Card>
          </div>
        </div>

        <div className="hidden items-center justify-center bg-linear-to-br from-primary-600 via-primary-700 to-slate-950 px-8 py-12 text-white lg:flex">
          <div className="max-w-md text-center">
            <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-4xl bg-white/10 ring-1 ring-white/15 backdrop-blur">
              <IconShoppingCart size={48} strokeWidth={1.6} />
            </div>
            <h2 className="text-4xl font-bold tracking-tight">Kelola bengkel dengan tampilan yang bersih dan cepat</h2>
            <p className="mt-4 text-lg text-white/80">Dashboard, service orders, appointments, dan transaksi parts disatukan dalam satu pengalaman yang konsisten.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {['Transaksi cepat', 'Realtime updates', 'Workshop focused'].map((feature) => (
                <span key={feature} className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium ring-1 ring-white/10 backdrop-blur">
                  {feature}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
