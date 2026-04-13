import { useEffect, useState } from 'react'
import api from '@services/api'

export default function Dashboard() {
  const [syncStatus, setSyncStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true

    const loadSyncStatus = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await api.get('/sync/status')
        if (!mounted) return
        setSyncStatus(res?.data || null)
      } catch (err) {
        if (!mounted) return
        setError(err?.response?.data?.message || 'Gagal memuat status sinkronisasi.')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadSyncStatus()

    return () => {
      mounted = false
    }
  }, [])

  const summary = syncStatus?.summary || {}

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="mt-3 text-slate-600">
          GO Frontend - Local-first React SPA with SQLite backend
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Status Sinkronisasi Go - Hosting</h2>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
            {syncStatus?.sync_enabled ? 'Sync Enabled' : 'Sync Disabled'}
          </span>
        </div>

        {loading ? (
          <p className="text-sm text-slate-600">Memuat status sinkronisasi...</p>
        ) : error ? (
          <p className="text-sm text-rose-600">{error}</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Batch Total</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{summary.batch_total ?? 0}</p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-amber-50 p-4">
              <p className="text-xs uppercase tracking-wide text-amber-700">Pending</p>
              <p className="mt-1 text-2xl font-semibold text-amber-900">{summary.pending_total ?? 0}</p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-rose-50 p-4">
              <p className="text-xs uppercase tracking-wide text-rose-700">Failed</p>
              <p className="mt-1 text-2xl font-semibold text-rose-900">{summary.failed_total ?? 0}</p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-emerald-50 p-4">
              <p className="text-xs uppercase tracking-wide text-emerald-700">Acknowledged</p>
              <p className="mt-1 text-2xl font-semibold text-emerald-900">{summary.acknowledged_total ?? 0}</p>
            </article>
          </div>
        )}
      </section>
    </div>
  )
}
