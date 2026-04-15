'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import api from '@services/api'
import { connectRealtime } from '@services/realtime'
import { Badge, Button, Card, StatCard, Table } from '@components/ui'
import { IconCalendar, IconSearch, IconUser } from '@tabler/icons-react'

const STATUS_TONE = {
  scheduled: 'warning',
  confirmed: 'primary',
  completed: 'success',
  cancelled: 'danger',
}

export default function AppointmentsPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState(null)
  const [mechanics, setMechanics] = useState([])
  const [currentPage, setCurrentPage] = useState(Number(searchParams.get('page') || 1))
  const [lastPage, setLastPage] = useState(1)
  const [from, setFrom] = useState(null)
  const [to, setTo] = useState(null)
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [status, setStatus] = useState(searchParams.get('status') || 'all')
  const [mechanicID, setMechanicID] = useState(searchParams.get('mechanic_id') || 'all')
  const [perPage, setPerPage] = useState(Number(searchParams.get('per_page') || 20))
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)
  const [lastRealtimeEvent, setLastRealtimeEvent] = useState('')
  const [realtimeConnected, setRealtimeConnected] = useState(false)
  const [realtimeReconnecting, setRealtimeReconnecting] = useState(null)
  const [refreshTick, setRefreshTick] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const pageStats = useMemo(() => ({
    today: stats?.today ?? 0,
    scheduled: stats?.scheduled ?? 0,
    confirmed: stats?.confirmed ?? 0,
    completed: stats?.completed ?? 0,
    cancelled: stats?.cancelled ?? 0,
  }), [stats])

  useEffect(() => {
    if (!autoRefresh) return undefined
    const interval = setInterval(() => setRefreshTick((tick) => tick + 1), 30000)
    return () => clearInterval(interval)
  }, [autoRefresh])

  useEffect(() => {
    const disconnect = connectRealtime({
      domains: ['appointments'],
      onOpen: () => {
        setRealtimeConnected(true)
        setRealtimeReconnecting(null)
      },
      onClose: () => setRealtimeConnected(false),
      onReconnecting: (attempt, delay) => setRealtimeReconnecting({ attempt, delay }),
      onEvent: (event) => {
        if (!event) return
        const isDomain = event.domain === 'appointments'
        const isType = typeof event.type === 'string' && event.type.startsWith('appointment.')
        if (!isDomain && !isType) return
        const incomingStatus = event?.data?.status || event?.data?.new_status || null
        const incomingID = event?.id || event?.data?.id || null
        if (incomingID && incomingStatus) {
          setRows((prevRows) => prevRows.map((row) => (
            String(row.id) === String(incomingID) ? { ...row, status: incomingStatus } : row
          )))
        }
        setLastRealtimeEvent(`${event.type || 'event'} @ ${new Date().toLocaleTimeString('id-ID')}`)
        setLastUpdatedAt(new Date())
        setRefreshTick((tick) => tick + 1)
      },
    })

    return () => disconnect()
  }, [])

  useEffect(() => {
    const params = new URLSearchParams()
    if (search.trim() !== '') params.set('search', search.trim())
    if (status !== 'all') params.set('status', status)
    if (mechanicID !== 'all') params.set('mechanic_id', mechanicID)
    if (perPage !== 20) params.set('per_page', String(perPage))
    if (currentPage > 1) params.set('page', String(currentPage))
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname)
  }, [currentPage, search, status, mechanicID, perPage, pathname, router])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const params = { page: currentPage, per_page: perPage }
        if (search.trim() !== '') params.search = search.trim()
        if (status !== 'all') params.status = status
        if (mechanicID !== 'all') params.mechanic_id = mechanicID
        const res = await api.get('/appointments', { params })
        if (!mounted) return
        const payload = res?.data || {}
        const appointments = payload?.appointments || {}
        const list = appointments?.data || []
        setRows(Array.isArray(list) ? list : [])
        setTotal(Number(appointments?.total || 0))
        setStats(payload?.stats || null)
        setMechanics(Array.isArray(payload?.mechanics) ? payload.mechanics : [])
        setCurrentPage(Number(appointments?.current_page || 1))
        setLastPage(Number(appointments?.last_page || 1))
        setFrom(appointments?.from ?? null)
        setTo(appointments?.to ?? null)
        setLastUpdatedAt(new Date())
      } catch (err) {
        if (!mounted) return
        setError(err?.response?.data?.message || 'Gagal memuat data appointment.')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [currentPage, search, status, mechanicID, perPage, refreshTick])

  const onResetFilters = () => {
    setSearch('')
    setStatus('all')
    setMechanicID('all')
    setPerPage(20)
    setCurrentPage(1)
  }

  const canGoPrev = currentPage > 1
  const canGoNext = currentPage < lastPage

  return (
    <section className="space-y-5">
      <Card
        title="Appointments"
        icon={<IconCalendar size={18} strokeWidth={1.7} />}
        footer={<p className="text-sm text-slate-500 dark:text-slate-400">Total data: {total}{from !== null && to !== null ? ` | Menampilkan ${from}-${to}` : ''}</p>}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-300">Kelola antrian appointment, status, dan realtime update.</p>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <label className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <input className="h-4 w-4 rounded border-slate-300" type="checkbox" checked={autoRefresh} onChange={(event) => setAutoRefresh(event.target.checked)} />
                Auto refresh (30s)
              </label>
              <Badge tone={realtimeConnected ? 'success' : (realtimeReconnecting ? 'warning' : 'danger')}>
                {realtimeConnected ? 'Realtime connected' : (realtimeReconnecting ? `Reconnecting (attempt ${realtimeReconnecting.attempt})` : 'Realtime disconnected')}
              </Badge>
              <span className="text-slate-500 dark:text-slate-400">{lastUpdatedAt ? `Last updated: ${lastUpdatedAt.toLocaleTimeString('id-ID')}` : 'Belum ada refresh'}</span>
              {lastRealtimeEvent ? <span className="text-slate-500 dark:text-slate-400">{lastRealtimeEvent}</span> : null}
            </div>
          </div>
          <Button href="/appointments/create" icon={<IconUser size={16} strokeWidth={1.8} />}>
            Buat Appointment
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Today" value={pageStats.today} tone="slate" />
        <StatCard label="Scheduled" value={pageStats.scheduled} tone="warning" />
        <StatCard label="Confirmed" value={pageStats.confirmed} tone="primary" />
        <StatCard label="Completed" value={pageStats.completed} tone="success" />
        <StatCard label="Cancelled" value={pageStats.cancelled} tone="danger" />
      </div>

      <Card title="Filters" icon={<IconSearch size={18} strokeWidth={1.7} />}>
        <form className="grid grid-cols-1 gap-3 md:grid-cols-5" onSubmit={(event) => { event.preventDefault(); setCurrentPage(1) }}>
          <input type="text" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" placeholder="Cari customer, plate, phone" value={search} onChange={(event) => setSearch(event.target.value)} />
          <select className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">Semua status</option>
            <option value="scheduled">Scheduled</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" value={mechanicID} onChange={(event) => setMechanicID(event.target.value)}>
            <option value="all">Semua mekanik</option>
            {mechanics.map((mechanic) => (<option key={mechanic.id} value={String(mechanic.id)}>{mechanic.name || `Mekanik ${mechanic.id}`}</option>))}
          </select>
          <select className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" value={String(perPage)} onChange={(event) => setPerPage(Number(event.target.value) || 20)}>
            <option value="10">10 per halaman</option>
            <option value="20">20 per halaman</option>
            <option value="50">50 per halaman</option>
          </select>
          <div className="flex gap-2">
            <Button type="submit" className="w-full" icon={<IconSearch size={16} strokeWidth={1.8} />}>Terapkan</Button>
            <Button type="button" variant="secondary" className="w-full" onClick={onResetFilters}>Reset</Button>
          </div>
        </form>
      </Card>

      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Jadwal</Table.Th>
            <Table.Th>Customer</Table.Th>
            <Table.Th>Kendaraan</Table.Th>
            <Table.Th>Mekanik</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Aksi</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {loading ? (
            <Table.Empty colSpan={6}>Memuat data...</Table.Empty>
          ) : error ? (
            <Table.Empty colSpan={6}>{error}</Table.Empty>
          ) : rows.length === 0 ? (
            <Table.Empty colSpan={6}>Belum ada appointment.</Table.Empty>
          ) : rows.map((item) => (
            <Table.Tr key={item.id}>
              <Table.Td>{item.scheduled_at || '-'}</Table.Td>
              <Table.Td>{item.customer?.name || '-'}</Table.Td>
              <Table.Td>{item.vehicle?.plate_number || '-'}</Table.Td>
              <Table.Td>{item.mechanic?.name || '-'}</Table.Td>
              <Table.Td><Badge tone={STATUS_TONE[item.status] || 'neutral'}>{item.status || '-'}</Badge></Table.Td>
              <Table.Td>
                <Button href={`/appointments/${item.id}`} size="sm" variant="secondary">Detail</Button>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">Halaman {currentPage} dari {lastPage}</p>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" size="sm" disabled={!canGoPrev || loading} onClick={() => canGoPrev && setCurrentPage((page) => page - 1)}>Sebelumnya</Button>
            <Button type="button" variant="secondary" size="sm" disabled={!canGoNext || loading} onClick={() => canGoNext && setCurrentPage((page) => page + 1)}>Berikutnya</Button>
          </div>
        </div>
      </Card>
    </section>
  )
}
