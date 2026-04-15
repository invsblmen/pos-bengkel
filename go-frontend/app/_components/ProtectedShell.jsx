'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import {
  IconArrowDown,
  IconArrowUp,
  IconCalendar,
  IconCar,
  IconLayout2,
  IconLogout,
  IconMenu2,
  IconMoon,
  IconSettings,
  IconSun,
  IconTool,
} from '@tabler/icons-react'

const NAV_SECTIONS = [
  {
    title: 'Overview',
    items: [
      { href: '/', label: 'Dashboard', icon: IconLayout2, permissions: ['dashboard-access'] },
    ],
  },
  {
    title: 'Transaksi',
    items: [
      { href: '/service-orders', label: 'Service Orders', icon: IconTool, permissions: ['service-orders-access'] },
      { href: '/part-sales', label: 'Part Sales', icon: IconArrowUp, permissions: ['part-sales-access'] },
      { href: '/part-purchases', label: 'Part Purchases', icon: IconArrowDown, permissions: ['part-purchases-access'] },
      { href: '/appointments', label: 'Appointments', icon: IconCalendar, permissions: ['appointments-access'] },
      { href: '/vehicles', label: 'Vehicles', icon: IconCar, permissions: ['vehicles-access'] },
    ],
  },
  {
    title: 'System',
    items: [
      { href: '/admin', label: 'Admin', icon: IconSettings, permissions: ['reports-access'] },
    ],
  },
]

export default function ProtectedShell({ children }) {
  const router = useRouter()
  const pathname = usePathname()
  const {
    user,
    isAuthenticated,
    loading,
    logout,
    canAny,
  } = useAuth()
  const { isDarkMode, toggleTheme } = useTheme()

  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') return true
    const stored = window.localStorage.getItem('sidebarOpen')
    return stored === null ? true : stored === 'true'
  })
  useEffect(() => {
    window.localStorage.setItem('sidebarOpen', String(sidebarOpen))
  }, [sidebarOpen])

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace(`/login?from=${encodeURIComponent(pathname || '/')}`)
    }
  }, [loading, isAuthenticated, pathname, router])

  const sections = useMemo(
    () => NAV_SECTIONS
      .map((section) => {
        const checkPermission = typeof canAny === 'function' ? canAny : () => true
        const items = section.items.filter((item) => {
          if (!Array.isArray(item.permissions) || item.permissions.length === 0) return true
          return checkPermission(item.permissions)
        })
        return { ...section, items }
      })
      .filter((section) => section.items.length > 0),
    [canAny]
  )

  const currentTitle = useMemo(() => {
    for (const section of sections) {
      for (const item of section.items) {
        if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
          return item.label
        }
      }
    }
    return 'Dashboard'
  }, [pathname, sections])

  const userInitial = (user?.name || 'U').trim().charAt(0).toUpperCase()

  if (loading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <p className="text-sm text-slate-600 dark:text-slate-300">Memuat sesi...</p>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 text-slate-900 transition-colors duration-200 dark:bg-slate-950 dark:text-slate-100">
      <aside className={`${sidebarOpen ? 'w-65' : 'w-20'} hidden border-r border-slate-200 bg-white transition-all duration-300 md:flex md:flex-col dark:border-slate-800 dark:bg-slate-900`}>
        <div className="flex h-16 items-center justify-center border-b border-slate-100 dark:border-slate-800">
          {sidebarOpen ? (
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-primary-500 to-primary-700 text-sm font-bold text-white">{userInitial}</div>
              <span className="text-xl font-bold text-slate-800 dark:text-slate-100">KASIR</span>
            </div>
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-primary-500 to-primary-700 text-sm font-bold text-white">{userInitial}</div>
          )}
        </div>

        <div className={`border-b border-slate-100 p-3 dark:border-slate-800 ${sidebarOpen ? 'flex items-center gap-3' : 'flex justify-center'}`}>
          <div className={`${sidebarOpen ? 'h-10 w-10' : 'h-8 w-8'} flex items-center justify-center rounded-full bg-linear-to-br from-primary-500 to-primary-700 text-xs font-bold text-white ring-2 ring-slate-100 dark:ring-slate-800`}>
            {userInitial}
          </div>
          {sidebarOpen ? (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">{user?.name || '-'}</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user?.email || '-'}</p>
            </div>
          ) : null}
        </div>

        <nav className="scrollbar-sidebar flex-1 overflow-y-auto py-3">
          {sections.map((section) => (
            <div key={section.title} className="mb-2">
              {sidebarOpen ? (
                <div className="px-4 py-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-600">{section.title}</span>
                </div>
              ) : null}
              <div className={sidebarOpen ? '' : 'flex flex-col items-center'}>
                {section.items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={sidebarOpen ? undefined : item.label}
                      className={`mx-2 mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                        active
                          ? 'bg-primary-50 text-primary-700 ring-1 ring-primary-100 dark:bg-primary-900/30 dark:text-primary-200 dark:ring-primary-900/50'
                          : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/80'
                      } ${sidebarOpen ? '' : 'justify-center px-2'}`}
                    >
                      <Icon size={20} strokeWidth={1.6} />
                      {sidebarOpen ? <span>{item.label}</span> : null}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {sidebarOpen ? (
          <div className="border-t border-slate-100 p-4 dark:border-slate-800">
            <p className="text-center text-[10px] text-slate-400 dark:text-slate-600">Point of Sales v2.0</p>
          </div>
        ) : null}
      </aside>

      <div className="flex h-screen flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 transition-colors duration-200 dark:border-slate-800 dark:bg-slate-900 md:px-6">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setSidebarOpen((open) => !open)}
              className="hidden rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 md:flex"
              title="Toggle Sidebar"
            >
              <IconMenu2 size={20} strokeWidth={1.5} />
            </button>

            <div className="md:hidden">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">KASIR</p>
            </div>

            <div className="hidden items-center md:flex">
              <div className="mr-4 h-6 w-px bg-slate-200 dark:bg-slate-700" />
              <h1 className="text-base font-semibold text-slate-800 dark:text-slate-200">{currentTitle}</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-xl p-2.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              title={isDarkMode ? 'Light Mode' : 'Dark Mode'}
            >
              {isDarkMode ? <IconSun size={20} strokeWidth={1.5} className="text-amber-500" /> : <IconMoon size={20} strokeWidth={1.5} />}
            </button>

            <div className="mx-1 hidden h-8 w-px bg-slate-200 dark:bg-slate-700 md:block" />
            <span className="hidden text-sm text-slate-600 dark:text-slate-300 md:inline">{user?.email || '-'}</span>
            <button
              type="button"
              onClick={async () => {
                await logout()
                router.replace('/login')
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <IconLogout size={16} strokeWidth={1.8} />
              Logout
            </button>
          </div>
        </header>

        <main className="scrollbar-thin min-w-0 flex-1 overflow-y-auto">
          <div className="w-full px-4 py-6 pb-20 md:px-6 md:pb-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  )
}
