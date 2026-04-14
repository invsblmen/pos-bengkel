import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api from '@services/api'
import { connectRealtime } from '@services/realtime'

export default function VehicleIndex() {
  const [searchParams, setSearchParams] = useSearchParams()

  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState(null)
  const [currentPage, setCurrentPage] = useState(Number(searchParams.get('page') || 1))
  const [lastPage, setLastPage] = useState(1)
  const [from, setFrom] = useState(null)
  const [to, setTo] = useState(null)
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [brand, setBrand] = useState(searchParams.get('brand') || '')
  const [serviceStatus, setServiceStatus] = useState(searchParams.get('service_status') || '')
  const [sortBy, setSortBy] = useState(searchParams.get('sort_by') || 'created_at')
  const [sortDirection, setSortDirection] = useState(searchParams.get('sort_direction') || 'desc')
  const [perPage, setPerPage] = useState(Number(searchParams.get('per_page') || 8))
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)
  const [lastRealtimeEvent, setLastRealtimeEvent] = useState('')
  const [realtimeConnected, setRealtimeConnected] = useState(false)
  const [refreshTick, setRefreshTick] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!autoRefresh) return undefined

    const interval = setInterval(() => {
      setRefreshTick((tick) => tick + 1)
    }, 30000)

    return () => clearInterval(interval)
  }, [autoRefresh])

  useEffect(() => {
    const disconnect = connectRealtime({
      domains: ['appointments', 'service_orders'],
      onOpen: () => setRealtimeConnected(true),
      onClose: () => setRealtimeConnected(false),
      onEvent: (event) => {
        if (!event) return

        const eventType = typeof event.type === 'string' ? event.type : ''
        const isRelevantDomain = event.domain === 'appointments' || event.domain === 'service_orders'
        const isRelevantType = eventType.startsWith('appointment.') || eventType.startsWith('service_order.')
        if (!isRelevantDomain && !isRelevantType) return

        setLastRealtimeEvent(`${event.type || 'event'} @ ${new Date().toLocaleTimeString('id-ID')}`)
        setLastUpdatedAt(new Date())
        setRefreshTick((tick) => tick + 1)
      },
    })

    return () => {
      disconnect()
    }
  }, [])

  useEffect(() => {
    const nextParams = {}

    if (search.trim() !== '') nextParams.search = search.trim()
    if (brand.trim() !== '') nextParams.brand = brand.trim()
    if (serviceStatus !== '') nextParams.service_status = serviceStatus
    if (sortBy !== 'created_at') nextParams.sort_by = sortBy
    if (sortDirection !== 'desc') nextParams.sort_direction = sortDirection
    if (perPage !== 8) nextParams.per_page = String(perPage)
    if (currentPage > 1) nextParams.page = String(currentPage)

    setSearchParams(nextParams, { replace: true })
  }, [currentPage, search, brand, serviceStatus, sortBy, sortDirection, perPage, setSearchParams])

  useEffect(() => {
    let mounted = true

    const load = async () => {
      setLoading(true)
      setError('')

      try {
        const params = {
          page: currentPage,
          per_page: perPage,
          sort_by: sortBy,
          sort_direction: sortDirection,
        }

        if (search.trim() !== '') params.search = search.trim()
        if (brand.trim() !== '') params.brand = brand.trim()
        if (serviceStatus !== '') params.service_status = serviceStatus

        const res = await api.get('/vehicles', { params })
        if (!mounted) return

        const payload = res?.data || {}
        const vehicles = payload?.vehicles || {}
        const list = vehicles?.data || []

        setRows(Array.isArray(list) ? list : [])
        setTotal(Number(vehicles?.total || 0))
        setStats(payload?.stats || null)
        setCurrentPage(Number(vehicles?.current_page || 1))
        setLastPage(Number(vehicles?.last_page || 1))
        setFrom(vehicles?.from ?? null)
        setTo(vehicles?.to ?? null)
        setLastUpdatedAt(new Date())
      } catch (err) {
        if (!mounted) return
        setError(err?.response?.data?.message || 'Gagal memuat data kendaraan.')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()

    return () => {
      mounted = false
    }
  }, [currentPage, search, brand, serviceStatus, sortBy, sortDirection, perPage, refreshTick])

  const onApplyFilters = (event) => {
    event.preventDefault()
    setCurrentPage(1)
  }

  const onResetFilters = () => {
    setSearch('')
    setBrand('')
    setServiceStatus('')
    setSortBy('created_at')
    setSortDirection('desc')
    setPerPage(8)
    setCurrentPage(1)
  }

  const canGoPrev = currentPage > 1
  const canGoNext = currentPage < lastPage

  return (
    <section className="space-y-4">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs uppercase tracking-wide text-slate-500">Parity Critical Screen</p>
        <h1 className="text-2xl font-semibold text-slate-900">Vehicle Index</h1>
        <p className="text-sm text-slate-600">
          Total data: {total}
          {from !== null && to !== null ? ` | Menampilkan ${from}-${to}` : ''}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <label className="inline-flex items-center gap-2 text-slate-700">
            <input type="checkbox" checked={autoRefresh} onChange={(event) => setAutoRefresh(event.target.checked)} />
            Auto refresh (30s)
          </label>
          <span className="text-slate-500">{lastUpdatedAt ? `Last updated: ${lastUpdatedAt.toLocaleTimeString('id-ID')}` : 'Belum ada refresh'}</span>
          <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${realtimeConnected ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
            {realtimeConnected ? 'Realtime connected' : 'Realtime disconnected'}
          </span>
          {lastRealtimeEvent ? <span className="text-slate-500">{lastRealtimeEvent}</span> : null}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{stats?.total ?? 0}</p>
        </article>
        <article className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-emerald-700">Serviced</p>
          <p className="mt-1 text-xl font-semibold text-emerald-900">{stats?.serviced ?? 0}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-slate-100 p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-600">Never Serviced</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{stats?.never_serviced ?? 0}</p>
        </article>
        <article className="rounded-xl border border-sky-200 bg-sky-50 p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-sky-700">This Month</p>
          <p className="mt-1 text-xl font-semibold text-sky-900">{stats?.this_month ?? 0}</p>
        </article>
      </div>

      <form className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-6" onSubmit={onApplyFilters}>
        <input
          type="text"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="Cari plate, brand, model, customer"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <input
          type="text"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="Brand"
          value={brand}
          onChange={(event) => setBrand(event.target.value)}
        />
        <select
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          value={serviceStatus}
          onChange={(event) => setServiceStatus(event.target.value)}
        >
          <option value="">Semua service status</option>
          <option value="serviced">Serviced</option>
          <option value="never">Never serviced</option>
        </select>
        <select
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          value={sortBy}
          onChange={(event) => setSortBy(event.target.value)}
        >
          <option value="created_at">Urut dibuat</option>
          <option value="plate_number">Urut plat</option>
          <option value="brand">Urut brand</option>
          <option value="model">Urut model</option>
          <option value="year">Urut tahun</option>
        </select>
        <div className="grid grid-cols-2 gap-2">
          <select
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={sortDirection}
            onChange={(event) => setSortDirection(event.target.value)}
          >
            <option value="desc">Desc</option>
            <option value="asc">Asc</option>
          </select>
          <select
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={String(perPage)}
            onChange={(event) => setPerPage(Number(event.target.value) || 8)}
          >
            <option value="8">8</option>
            <option value="20">20</option>
            <option value="50">50</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700">
            Terapkan
          </button>
          <button type="button" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100" onClick={onResetFilters}>
            Reset
          </button>
        </div>
      </form>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {loading ? (
          <p className="text-sm text-slate-600">Memuat data...</p>
        ) : error ? (
          <p className="text-sm text-rose-600">{error}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-600">Belum ada data kendaraan.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-600">
                  <th className="px-3 py-2">Plat</th>
                  <th className="px-3 py-2">Kendaraan</th>
                  <th className="px-3 py-2">Pelanggan</th>
                  <th className="px-3 py-2">KM</th>
                  <th className="px-3 py-2">Last Service</th>
                  <th className="px-3 py-2">Next Service</th>
                  <th className="px-3 py-2">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-900">{item.plate_number || '-'}</td>
                    <td className="px-3 py-2">
                      {[item.brand, item.model, item.year].filter(Boolean).join(' ') || '-'}
                    </td>
                    <td className="px-3 py-2">{item.customer?.name || '-'}</td>
                    <td className="px-3 py-2">{Number(item.km || 0).toLocaleString('id-ID')}</td>
                    <td className="px-3 py-2">{item.last_service_date || '-'}</td>
                    <td className="px-3 py-2">{item.next_service_date || '-'}</td>
                    <td className="px-3 py-2">
                      <Link className="text-slate-700 underline" to={`/vehicles/${item.id}`}>Detail</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <p className="text-sm text-slate-600">Halaman {currentPage} dari {lastPage}</p>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canGoPrev || loading}
            onClick={() => canGoPrev && setCurrentPage((page) => page - 1)}
          >
            Sebelumnya
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canGoNext || loading}
            onClick={() => canGoNext && setCurrentPage((page) => page + 1)}
          >
            Berikutnya
          </button>
        </div>
      </div>
    </section>
  )
}
