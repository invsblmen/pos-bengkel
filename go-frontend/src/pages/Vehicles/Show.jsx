import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api from '@services/api'

export default function VehicleShow() {
  const { id } = useParams()
  const [vehicle, setVehicle] = useState(null)
  const [serviceOrders, setServiceOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
    </section>
  )
}
