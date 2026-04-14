import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api from '@services/api'

export default function AppointmentShow() {
  const { id } = useParams()
  const [appointment, setAppointment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true

    const load = async () => {
      setLoading(true)
      setError('')

      try {
        const res = await api.get(`/appointments/${id}`)
        if (!mounted) return
        setAppointment(res?.data?.appointment || null)
      } catch (err) {
        if (!mounted) return
        setError(err?.response?.data?.message || 'Gagal memuat detail appointment.')
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
        <h1 className="text-2xl font-semibold text-slate-900">Appointment Detail</h1>
        <p className="text-sm text-slate-600">ID: {id}</p>
      </header>

      <div>
        <Link to="/appointments" className="text-sm font-medium text-slate-700 underline">Kembali ke appointment index</Link>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {loading ? (
          <p className="text-sm text-slate-600">Memuat detail...</p>
        ) : error ? (
          <p className="text-sm text-rose-600">{error}</p>
        ) : !appointment ? (
          <p className="text-sm text-slate-600">Detail appointment tidak ditemukan.</p>
        ) : (
          <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
            <div>
              <dt className="text-slate-500">Jadwal</dt>
              <dd className="font-medium text-slate-900">{appointment.scheduled_at || '-'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Status</dt>
              <dd className="font-medium text-slate-900">{appointment.status || '-'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Customer</dt>
              <dd className="font-medium text-slate-900">{appointment.customer?.name || '-'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Phone</dt>
              <dd className="font-medium text-slate-900">{appointment.customer?.phone || '-'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Kendaraan</dt>
              <dd className="font-medium text-slate-900">{appointment.vehicle?.plate_number || '-'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Mekanik</dt>
              <dd className="font-medium text-slate-900">{appointment.mechanic?.name || '-'}</dd>
            </div>
            <div className="md:col-span-2">
              <dt className="text-slate-500">Catatan</dt>
              <dd className="font-medium text-slate-900">{appointment.notes || '-'}</dd>
            </div>
          </dl>
        )}
      </div>
    </section>
  )
}
