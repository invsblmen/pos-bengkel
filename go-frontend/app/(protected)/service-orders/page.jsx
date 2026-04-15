'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import api from '@services/api'
import { connectRealtime } from '@services/realtime'
import { Badge, Button, Card, StatCard, Table } from '@components/ui'
import { IconPlus, IconRefresh, IconSearch, IconTool } from '@tabler/icons-react'

const STATUS_TONE = {
  pending: 'warning',
  in_progress: 'primary',
  completed: 'success',
  paid: 'success',
  cancelled: 'danger',
}

export default function ServiceOrdersPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [mechanics, setMechanics] = useState([])
  const [currentPage, setCurrentPage] = useState(Number(searchParams.get('page') || 1))
  const [lastPage, setLastPage] = useState(1)
  const [from, setFrom] = useState(null)
  const [to, setTo] = useState(null)
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [status, setStatus] = useState(searchParams.get('status') || 'all')
  const [mechanicID, setMechanicID] = useState(searchParams.get('mechanic_id') || 'all')
  const [dateFrom, setDateFrom] = useState(searchParams.get('date_from') || '')
  const [dateTo, setDateTo] = useState(searchParams.get('date_to') || '')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)
  const [lastRealtimeEvent, setLastRealtimeEvent] = useState('')
  const [realtimeConnected, setRealtimeConnected] = useState(false)
  const [realtimeReconnecting, setRealtimeReconnecting] = useState(null)
  const [refreshTick, setRefreshTick] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const stats = useMemo(() => ({
    pending: rows.filter((row) => row.status === 'pending').length,
    in_progress: rows.filter((row) => row.status === 'in_progress').length,
    completed: rows.filter((row) => row.status === 'completed').length,
    paid: rows.filter((row) => row.status === 'paid').length,
  }), [rows])

  useEffect(() => {
    if (!autoRefresh) return undefined
    const interval = setInterval(() => setRefreshTick((tick) => tick + 1), 30000)
    return () => clearInterval(interval)
  }, [autoRefresh])

  useEffect(() => {
    const disconnect = connectRealtime({
      domains: ['service_orders'],
      onOpen: () => {
        setRealtimeConnected(true)
        setRealtimeReconnecting(null)
      },
      onClose: () => setRealtimeConnected(false),
      onReconnecting: (attempt, delay) => setRealtimeReconnecting({ attempt, delay }),
      onEvent: (event) => {
        if (!event) return
        const isDomain = event.domain === 'service_orders'
        const isType = typeof event.type === 'string' && event.type.startsWith('service_order.')
        if (!isDomain && !isType) return

        const incomingStatus = event?.data?.new_status || event?.data?.status || null
        const incomingID = event?.id || event?.data?.id || null
        if (incomingID && incomingStatus) {
          setRows((prevRows) => prevRows.map((row) => (
            String(row.id) === String(incomingID)
              ? { ...row, status: incomingStatus }
              : row
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
    if (dateFrom !== '') params.set('date_from', dateFrom)
    if (dateTo !== '') params.set('date_to', dateTo)
    if (currentPage > 1) params.set('page', String(currentPage))

    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname)
  }, [currentPage, search, status, mechanicID, dateFrom, dateTo, pathname, router])

  useEffect(() => {
    let mounted = true

    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const params = { page: currentPage }
        if (search.trim() !== '') params.search = search.trim()
        if (status !== 'all') params.status = status
        if (mechanicID !== 'all') params.mechanic_id = mechanicID
        if (dateFrom !== '') params.date_from = dateFrom
        if (dateTo !== '') params.date_to = dateTo

        const res = await api.get('/service-orders', { params })
        if (!mounted) return

        const payload = res?.data || {}
        const orders = payload?.orders || {}
        const list = orders?.data || []
        setRows(Array.isArray(list) ? list : [])
        setTotal(Number(orders?.total || 0))
        setMechanics(Array.isArray(payload?.mechanics) ? payload.mechanics : [])
        setCurrentPage(Number(orders?.current_page || 1))
        setLastPage(Number(orders?.last_page || 1))
        setFrom(orders?.from ?? null)
        setTo(orders?.to ?? null)
        setLastUpdatedAt(new Date())
      } catch (err) {
        if (!mounted) return
        setError(err?.response?.data?.error || 'Gagal memuat data service order.')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [currentPage, search, status, mechanicID, dateFrom, dateTo, refreshTick])

  const canGoPrev = currentPage > 1
  const canGoNext = currentPage < lastPage

  return (
    <section className="space-y-5">
      <Card
        title="Service Orders"
        icon={<IconTool size={18} strokeWidth={1.7} />}
        footer={(
          <div className="flex flex-wrap gap-2 text-sm text-slate-500 dark:text-slate-400">
            <span>Total data: {total}</span>
            {from !== null && to !== null ? <span>| Menampilkan {from}-{to}</span> : null}
          </div>
        )}
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">Ringkasan status layanan, filter, dan update realtime.</p>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
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
        <div className="mt-5 flex flex-wrap gap-3">
          <Button href="/service-orders/create" icon={<IconPlus size={16} strokeWidth={1.8} />}>
            Buat Service Order
          </Button>
          <Button variant="secondary" icon={<IconRefresh size={16} strokeWidth={1.8} />} onClick={() => setRefreshTick((tick) => tick + 1)}>
            Refresh
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total" value={total} tone="slate" icon={<IconTool size={18} strokeWidth={1.8} />} />
        <StatCard label="Pending" value={stats.pending} tone="warning" />
        <StatCard label="In Progress" value={stats.in_progress} tone="primary" />
        <StatCard label="Completed" value={stats.completed} tone="success" />
      </div>

      <Card title="Filters" icon={<IconSearch size={18} strokeWidth={1.7} />}>
        <form className="grid grid-cols-1 gap-3 md:grid-cols-6" onSubmit={(event) => { event.preventDefault(); setCurrentPage(1) }}>
          <input type="text" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" placeholder="Cari nomor/customer/plate" value={search} onChange={(event) => setSearch(event.target.value)} />
          <select className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">Semua status</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="paid">Paid</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" value={mechanicID} onChange={(event) => setMechanicID(event.target.value)}>
            <option value="all">Semua mekanik</option>
            {mechanics.map((mechanic) => (
              <option key={mechanic.id} value={String(mechanic.id)}>{mechanic.name || `Mekanik ${mechanic.id}`}</option>
            ))}
          </select>
          <input type="date" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          <input type="date" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          <div className="flex gap-2">
            <Button type="submit" className="w-full" icon={<IconSearch size={16} strokeWidth={1.8} />}>
              Terapkan
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => {
                setSearch('')
                setStatus('all')
                setMechanicID('all')
                setDateFrom('')
                setDateTo('')
                setCurrentPage(1)
              }}
            >
              Reset
            </Button>
          </div>
        </form>
      </Card>

      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Order</Table.Th>
            <Table.Th>Customer</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Total</Table.Th>
            <Table.Th>Aksi</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {loading ? (
            <Table.Empty colSpan={5}>Memuat data...</Table.Empty>
          ) : error ? (
            <Table.Empty colSpan={5}>{error}</Table.Empty>
          ) : rows.length === 0 ? (
            <Table.Empty colSpan={5}>Belum ada service order.</Table.Empty>
          ) : rows.map((item) => (
            <Table.Tr key={item.id}>
              <Table.Td className="font-medium text-slate-800 dark:text-slate-100">{item.order_number || '-'}</Table.Td>
              <Table.Td>{item.customer?.name || '-'}</Table.Td>
              <Table.Td><Badge tone={STATUS_TONE[item.status] || 'neutral'}>{item.status || '-'}</Badge></Table.Td>
              <Table.Td className="font-semibold text-slate-800 dark:text-slate-100">{Number(item.total || 0).toLocaleString('id-ID')}</Table.Td>
              <Table.Td>
                <Button href={`/service-orders/${item.id}`} size="sm" variant="secondary">
                  Detail
                </Button>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">Halaman {currentPage} dari {lastPage}</p>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" size="sm" disabled={!canGoPrev || loading} onClick={() => canGoPrev && setCurrentPage((page) => page - 1)}>
              Sebelumnya
            </Button>
            <Button type="button" variant="secondary" size="sm" disabled={!canGoNext || loading} onClick={() => canGoNext && setCurrentPage((page) => page + 1)}>
              Berikutnya
            </Button>
          </div>
        </div>
      </Card>
    </section>
  )
}
