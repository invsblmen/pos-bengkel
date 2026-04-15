'use client'

import { useEffect, useState } from 'react'
import api from '@services/api'
import { Button, Card, StatCard } from '@components/ui'
import { IconRefresh, IconRoute, IconAlertTriangle, IconCircleCheck, IconClock } from '@tabler/icons-react'

export default function DashboardPage() {
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
      <Card
        title="Dashboard"
        icon={<IconRoute size={18} strokeWidth={1.7} />}
        footer={<p className="text-sm text-slate-500 dark:text-slate-400">GO Frontend native Next.js (App Router)</p>}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm text-slate-600 dark:text-slate-300">Ringkasan sinkronisasi backend dan status realtime aktif.</p>
          </div>
          <Button href="/service-orders" size="md" icon={<IconRefresh size={16} strokeWidth={1.8} />}>
            Buka Service Orders
          </Button>
        </div>
      </Card>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Batch Total" value={summary.batch_total ?? 0} tone="slate" icon={<IconRoute size={18} strokeWidth={1.8} />} />
        <StatCard label="Pending" value={summary.pending_total ?? 0} tone="warning" icon={<IconClock size={18} strokeWidth={1.8} />} />
        <StatCard label="Failed" value={summary.failed_total ?? 0} tone="danger" icon={<IconAlertTriangle size={18} strokeWidth={1.8} />} />
        <StatCard label="Acknowledged" value={summary.acknowledged_total ?? 0} tone="success" icon={<IconCircleCheck size={18} strokeWidth={1.8} />} />
      </section>

      <Card title="Status Sinkronisasi" icon={<IconRefresh size={18} strokeWidth={1.7} />}>
        {loading ? <p className="text-sm text-slate-600">Memuat status sinkronisasi...</p> : null}
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        {!loading && !error ? (
          <div className="flex flex-wrap gap-2">
            <Button href="/service-orders" icon={<IconRoute size={16} strokeWidth={1.8} />}>
              Service Orders
            </Button>
            <Button href="/part-sales" variant="secondary">
              Part Sales
            </Button>
            <Button href="/appointments" variant="ghost">
              Appointments
            </Button>
          </div>
        ) : null}
      </Card>
    </div>
  )
}
