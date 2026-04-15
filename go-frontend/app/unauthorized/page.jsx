'use client'

import Link from 'next/link'
import { useTheme } from '@/context/ThemeContext'
import { IconMoon, IconSun, IconShieldLock } from '@tabler/icons-react'

function ThemeToggle() {
  const { isDarkMode, toggleTheme } = useTheme()

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="absolute right-4 top-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm backdrop-blur transition hover:bg-white dark:border-slate-800 dark:bg-slate-900/90 dark:text-slate-200 dark:hover:bg-slate-900"
      aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDarkMode ? <IconSun size={16} strokeWidth={1.8} className="text-amber-500" /> : <IconMoon size={16} strokeWidth={1.8} />}
      <span>{isDarkMode ? 'Light' : 'Dark'}</span>
    </button>
  )
}

export default function UnauthorizedPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-100 px-4 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <ThemeToggle />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(239,68,68,0.12),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.12),transparent_40%)] dark:bg-[radial-gradient(circle_at_top,rgba(239,68,68,0.16),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.12),transparent_40%)]" />
      <div className="relative w-full max-w-md rounded-4xl border border-slate-200 bg-white/95 p-6 text-center shadow-xl shadow-slate-200/40 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-black/20">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 ring-1 ring-rose-100 dark:bg-rose-900/30 dark:text-rose-300 dark:ring-rose-900/40">
          <IconShieldLock size={26} strokeWidth={1.8} />
        </div>
        <p className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Access Denied</p>
        <h1 className="mt-1 text-3xl font-semibold text-slate-900 dark:text-slate-100">403 - Unauthorized</h1>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">Akun Anda tidak memiliki izin untuk membuka halaman ini.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/" className="inline-flex items-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white">Ke Dashboard</Link>
          <Link href="/login" className="inline-flex items-center rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Ke Login</Link>
        </div>
      </div>
    </div>
  )
}
