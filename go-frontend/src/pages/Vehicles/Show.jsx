import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api from '@services/api'

export default function VehicleShow() {
  const { id } = useParams()
  const [vehicle, setVehicle] = useState(null)
  const [serviceOrders, setServiceOrders] = useState([])
  const [recommendations, setRecommendations] = useState(null)
  const [history, setHistory] = useState([])
  const [quickLoading, setQuickLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [quickError, setQuickError] = useState('')

  useEffect(() => {
    let mounted = true

    const load = async () => {
      setLoading(true)
      setError('')

      try {
        const res = await api.get(`/vehicles/${id}`)
        if (!mounted) return
        setVehicle(res?.data?.vehicle || null)
        setServiceOrders(Array.isArray(res?.data?.service_orders) ? res.data.service_orders : [])
      } catch (err) {
        if (!mounted) return
        setError(err?.response?.data?.message || 'Gagal memuat detail kendaraan.')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    if (id) {
      load()
    }

    return () => {
      mounted = false
    }
  }, [id])

  const loadRecommendations = async () => {
    if (!id) return
    setQuickLoading(true)
    setQuickError('')
    try {
      const res = await api.get(`/vehicles/${id}/recommendations`)
      setRecommendations(res?.data || null)
    } catch (err) {
      setQuickError(err?.response?.data?.message || 'Gagal memuat rekomendasi kendaraan.')
    } finally {
      setQuickLoading(false)
    }
  }

  const loadServiceHistory = async () => {
    if (!id) return
    setQuickLoading(true)
    setQuickError('')
    try {
      const res = await api.get(`/vehicles/${id}/service-history`)
      setHistory(Array.isArray(res?.data?.service_orders) ? res.data.service_orders : [])
    } catch (err) {
      setQuickError(err?.response?.data?.message || 'Gagal memuat service history kendaraan.')
    } finally {
      setQuickLoading(false)
    }
  }

  return (
    <section className="space-y-4">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs uppercase tracking-wide text-slate-500">Parity Critical Screen</p>
        <h1 className="text-2xl font-semibold text-slate-900">Vehicle Detail</h1>
        <p className="text-sm text-slate-600">ID: {id}</p>
      </header>

      <div>
        <Link to="/vehicles" className="text-sm font-medium text-slate-700 underline">Kembali ke vehicle index</Link>
      </div>

      <div className="grid grid-cols-1 gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-3">
        <button
          type="button"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={loadServiceHistory}
          disabled={loading || quickLoading}
        >
          Muat Service History
        </button>
        <button
          type="button"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={loadRecommendations}
          disabled={loading || quickLoading}
        >
          Muat Recommendations
        </button>
        <div className="text-sm text-slate-600">
          {quickLoading ? 'Memuat quick actions...' : quickError ? <span className="text-rose-600">{quickError}</span> : 'Pilih quick action di atas.'}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {loading ? (
          <p className="text-sm text-slate-600">Memuat detail...</p>
        ) : error ? (
          <p className="text-sm text-rose-600">{error}</p>
        ) : !vehicle ? (
          <p className="text-sm text-slate-600">Detail kendaraan tidak ditemukan.</p>
        ) : (
          <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
            <div>
              <dt className="text-slate-500">Plat</dt>
              <dd className="font-medium text-slate-900">{vehicle.plate_number || '-'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Kendaraan</dt>
              <dd className="font-medium text-slate-900">{[vehicle.brand, vehicle.model, vehicle.year].filter(Boolean).join(' ') || '-'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Pelanggan</dt>
              <dd className="font-medium text-slate-900">{vehicle.customer?.name || '-'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">KM</dt>
              <dd className="font-medium text-slate-900">{vehicle.km ? Number(vehicle.km).toLocaleString('id-ID') : '-'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Last Service</dt>
              <dd className="font-medium text-slate-900">{vehicle.last_service_date || '-'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Next Service</dt>
              <dd className="font-medium text-slate-900">{vehicle.next_service_date || '-'}</dd>
            </div>
          </dl>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Riwayat Service Orders</h2>
        {loading ? (
          <p className="text-sm text-slate-600">Memuat riwayat...</p>
        ) : serviceOrders.length === 0 ? (
          <p className="text-sm text-slate-600">Belum ada service order terkait kendaraan ini.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-600">
                  <th className="px-3 py-2">Nomor</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Tanggal</th>
                  <th className="px-3 py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {serviceOrders.map((order) => (
                  <tr key={order.id} className="border-b border-slate-100">
                    <td className="px-3 py-2">{order.order_number || '-'}</td>
                    <td className="px-3 py-2">{order.status || '-'}</td>
                    <td className="px-3 py-2">{order.created_at || '-'}</td>
                    <td className="px-3 py-2">{Number(order.total_amount || 0).toLocaleString('id-ID')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Quick Service History (API)</h2>
        {history.length === 0 ? (
          <p className="text-sm text-slate-600">Belum ada data quick service history.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-600">
                  <th className="px-3 py-2">Nomor</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Tanggal</th>
                </tr>
              </thead>
              <tbody>
                {history.map((order) => (
                  <tr key={order.id} className="border-b border-slate-100">
                    <td className="px-3 py-2">{order.order_number || '-'}</td>
                    <td className="px-3 py-2">{order.status || '-'}</td>
                    <td className="px-3 py-2">{order.created_at || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Quick Recommendations (API)</h2>
        {!recommendations ? (
          <p className="text-sm text-slate-600">Belum ada data rekomendasi yang dimuat.</p>
        ) : (
          <div className="space-y-3 text-sm">
            <p className="text-slate-600">Riwayat terbaru: <span className="font-medium text-slate-900">{recommendations.recent_history_count ?? 0}</span></p>
            <div>
              <p className="mb-1 font-medium text-slate-900">Recommended Services</p>
              <ul className="list-disc space-y-1 pl-5 text-slate-700">
                {(recommendations.recommended_services || []).map((item) => (
                  <li key={`svc-${item.id}`}>{item.name} ({item.category})</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-1 font-medium text-slate-900">Recommended Parts</p>
              <ul className="list-disc space-y-1 pl-5 text-slate-700">
                {(recommendations.recommended_parts || []).map((item) => (
                  <li key={`part-${item.id}`}>{item.name} ({item.category})</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
