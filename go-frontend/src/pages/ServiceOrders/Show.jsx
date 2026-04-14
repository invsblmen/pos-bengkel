import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api from '@services/api'

export default function ServiceOrderShow() {
  const { id } = useParams()
  const [order, setOrder] = useState(null)
  const [warrantyRegistrations, setWarrantyRegistrations] = useState({})
  const [nextStatus, setNextStatus] = useState('pending')
  const [odometerKM, setOdometerKM] = useState('')
  const [statusNotes, setStatusNotes] = useState('')
  const [updating, setUpdating] = useState(false)
  const [actionMessage, setActionMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true

    const load = async () => {
      setLoading(true)
      setError('')

      try {
        const res = await api.get(`/service-orders/${id}`)
        if (!mounted) return
        const payload = res?.data?.order || null
        setOrder(payload)
        if (payload?.status) {
          setNextStatus(payload.status)
        }
        if (payload?.odometer_km) {
          setOdometerKM(String(payload.odometer_km))
        }
        setWarrantyRegistrations(res?.data?.warrantyRegistrations || {})
      } catch (err) {
        if (!mounted) return
        setError(err?.response?.data?.error || 'Gagal memuat detail service order.')
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

  const onUpdateStatus = async () => {
    if (!id || !nextStatus) return

    setUpdating(true)
    setError('')
    setActionMessage('')

    try {
      const payload = {
        status: nextStatus,
        notes: statusNotes,
      }

      if (odometerKM.trim() !== '') {
        payload.odometer_km = Number(odometerKM)
      }

      const res = await api.patch(`/service-orders/${id}/status`, payload)
      const updatedStatus = res?.data?.order?.status || nextStatus
      const updatedKM = res?.data?.order?.odometer_km

      setOrder((prev) => ({
        ...(prev || {}),
        status: updatedStatus,
        odometer_km: updatedKM ?? prev?.odometer_km,
      }))
      setNextStatus(updatedStatus)
      if (updatedKM !== null && updatedKM !== undefined) {
        setOdometerKM(String(updatedKM))
      }
      setActionMessage('Status service order berhasil diperbarui.')
    } catch (err) {
      setError(err?.response?.data?.message || 'Gagal memperbarui status service order.')
    } finally {
      setUpdating(false)
    }
  }

  const details = Array.isArray(order?.details) ? order.details : []

  return (
    <section className="space-y-4">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs uppercase tracking-wide text-slate-500">Parity Critical Screen</p>
        <h1 className="text-2xl font-semibold text-slate-900">Service Order Detail</h1>
        <p className="text-sm text-slate-600">ID: {id}</p>
      </header>

      <div>
        <Link to="/service-orders" className="text-sm font-medium text-slate-700 underline">Kembali ke service order index</Link>
      </div>

      {!loading && !error && order ? (
        <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4">
          <select
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={nextStatus}
            onChange={(event) => setNextStatus(event.target.value)}
          >
            <option value="pending">pending</option>
            <option value="in_progress">in_progress</option>
            <option value="completed">completed</option>
            <option value="paid">paid</option>
            <option value="cancelled">cancelled</option>
          </select>
          <input
            type="number"
            min="0"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Odometer (opsional/wajib saat complete/paid)"
            value={odometerKM}
            onChange={(event) => setOdometerKM(event.target.value)}
          />
          <input
            type="text"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Catatan status"
            value={statusNotes}
            onChange={(event) => setStatusNotes(event.target.value)}
          />
          <button
            type="button"
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onUpdateStatus}
            disabled={updating}
          >
            {updating ? 'Menyimpan...' : 'Update Status'}
          </button>
          {actionMessage ? <p className="text-sm font-medium text-emerald-700 md:col-span-4">{actionMessage}</p> : null}
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {loading ? (
          <p className="text-sm text-slate-600">Memuat detail...</p>
        ) : error ? (
          <p className="text-sm text-rose-600">{error}</p>
        ) : !order ? (
          <p className="text-sm text-slate-600">Service order tidak ditemukan.</p>
        ) : (
          <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
            <div>
              <dt className="text-slate-500">Nomor Order</dt>
              <dd className="font-medium text-slate-900">{order.order_number || '-'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Status</dt>
              <dd className="font-medium text-slate-900">{order.status || '-'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Tanggal</dt>
              <dd className="font-medium text-slate-900">{order.created_at || '-'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Customer</dt>
              <dd className="font-medium text-slate-900">{order.customer?.name || '-'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Kendaraan</dt>
              <dd className="font-medium text-slate-900">{order.vehicle?.plate_number || '-'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Mekanik</dt>
              <dd className="font-medium text-slate-900">{order.mechanic?.name || '-'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Labor Cost</dt>
              <dd className="font-medium text-slate-900">{Number(order.labor_cost || 0).toLocaleString('id-ID')}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Material Cost</dt>
              <dd className="font-medium text-slate-900">{Number(order.material_cost || 0).toLocaleString('id-ID')}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Grand Total</dt>
              <dd className="font-semibold text-slate-900">{Number(order.grand_total || order.total || 0).toLocaleString('id-ID')}</dd>
            </div>
            <div className="md:col-span-3">
              <dt className="text-slate-500">Catatan</dt>
              <dd className="font-medium text-slate-900">{order.notes || '-'}</dd>
            </div>
          </dl>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Item Detail</h2>
        {loading ? (
          <p className="text-sm text-slate-600">Memuat item detail...</p>
        ) : details.length === 0 ? (
          <p className="text-sm text-slate-600">Belum ada item detail pada service order ini.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-600">
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2">Jenis</th>
                  <th className="px-3 py-2">Qty</th>
                  <th className="px-3 py-2">Harga</th>
                  <th className="px-3 py-2">Final</th>
                  <th className="px-3 py-2">Garansi</th>
                </tr>
              </thead>
              <tbody>
                {details.map((item) => {
                  const warranty = warrantyRegistrations?.[item.id]
                  return (
                    <tr key={item.id} className="border-b border-slate-100">
                      <td className="px-3 py-2">{item.service?.name || item.part?.name || '-'}</td>
                      <td className="px-3 py-2">{item.service ? 'Service' : item.part ? 'Part' : '-'}</td>
                      <td className="px-3 py-2">{Number(item.qty || 0).toLocaleString('id-ID')}</td>
                      <td className="px-3 py-2">{Number(item.price || 0).toLocaleString('id-ID')}</td>
                      <td className="px-3 py-2">{Number(item.final_amount || 0).toLocaleString('id-ID')}</td>
                      <td className="px-3 py-2">{warranty?.status || '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
