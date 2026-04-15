'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import api from '@services/api'
import { Badge, Button, Card } from '@components/ui'
import { IconArrowLeft, IconCalendar, IconDeviceFloppy } from '@tabler/icons-react'

const STATUS_OPTIONS = ['scheduled', 'confirmed', 'completed', 'cancelled']
const STATUS_TONE = {
  scheduled: 'warning',
  confirmed: 'primary',
  completed: 'success',
  cancelled: 'danger',
}

export default function AppointmentShowPage() {
  const params = useParams()
  const id = params?.id
  const [appointment, setAppointment] = useState(null)
  const [nextStatus, setNextStatus] = useState('scheduled')
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState('')
  const [actionMessage, setActionMessage] = useState('')

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await api.get(`/appointments/${id}`)
        if (!mounted) return
        const payload = res?.data?.appointment || null
        setAppointment(payload)
        if (payload?.status) setNextStatus(payload.status)
      } catch (err) {
        if (!mounted) return
        setError(err?.response?.data?.message || 'Gagal memuat detail appointment.')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    if (id) load()
    return () => {
      mounted = false
    }
  }, [id])

  const onUpdateStatus = async () => {
    if (!id || !nextStatus) return
    setUpdating(true)
    setActionMessage('')
    setError('')
    try {
      await api.patch(`/appointments/${id}/status`, { status: nextStatus })
      setAppointment((prev) => ({ ...(prev || {}), status: nextStatus }))
      setActionMessage('Status appointment berhasil diperbarui.')
    } catch (err) {
      setError(err?.response?.data?.message || 'Gagal memperbarui status appointment.')
    } finally {
      setUpdating(false)
    }
  }

  return (
    <section className="space-y-5">
      <Card
        title="Appointment Detail"
        icon={<IconCalendar size={18} strokeWidth={1.7} />}
        footer={<p className="text-sm text-slate-500 dark:text-slate-400">ID: {id}</p>}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="text-sm text-slate-600 dark:text-slate-300">Detail appointment, status, dan customer vehicle info.</p>
            <Badge tone={STATUS_TONE[appointment?.status] || 'neutral'}>{appointment?.status || 'loading'}</Badge>
          </div>
          <Button href="/appointments" variant="secondary" icon={<IconArrowLeft size={16} strokeWidth={1.8} />}>
            Kembali
          </Button>
        </div>
      </Card>

      <Card title="Update Status" icon={<IconDeviceFloppy size={18} strokeWidth={1.7} />}>
        {!loading && !error && appointment ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_1.5fr_auto] md:items-center">
            <select className="rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none transition focus:border-primary-500 focus:ring-4 focus:ring-primary-500/15 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" value={nextStatus} onChange={(event) => setNextStatus(event.target.value)}>
              {STATUS_OPTIONS.map((status) => (<option key={status} value={status}>{status}</option>))}
            </select>
            <div className="text-sm text-slate-600 dark:text-slate-300">
              Customer: <span className="font-medium text-slate-900 dark:text-slate-100">{appointment.customer?.name || '-'}</span>
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-300">
              Kendaraan: <span className="font-medium text-slate-900 dark:text-slate-100">{appointment.vehicle?.plate_number || '-'}</span>
            </div>
            <Button type="button" loading={updating} onClick={onUpdateStatus} icon={<IconDeviceFloppy size={16} strokeWidth={1.8} />}>
              {updating ? 'Menyimpan...' : 'Update Status'}
            </Button>
            {actionMessage ? <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300 md:col-span-4">{actionMessage}</p> : null}
          </div>
        ) : null}
      </Card>

      <Card title="Detail Utama" icon={<IconCalendar size={18} strokeWidth={1.7} />}>
        {loading ? <p className="text-sm text-slate-600 dark:text-slate-300">Memuat detail...</p> : null}
        {error ? <p className="text-sm text-rose-600 dark:text-rose-300">{error}</p> : null}
        {!loading && !error && appointment ? (
          <dl className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
            <div><dt className="text-slate-500 dark:text-slate-400">Jadwal</dt><dd className="font-medium text-slate-900 dark:text-slate-100">{appointment.scheduled_at || '-'}</dd></div>
            <div><dt className="text-slate-500 dark:text-slate-400">Status</dt><dd className="font-medium text-slate-900 dark:text-slate-100">{appointment.status || '-'}</dd></div>
            <div><dt className="text-slate-500 dark:text-slate-400">Customer</dt><dd className="font-medium text-slate-900 dark:text-slate-100">{appointment.customer?.name || '-'}</dd></div>
            <div><dt className="text-slate-500 dark:text-slate-400">Phone</dt><dd className="font-medium text-slate-900 dark:text-slate-100">{appointment.customer?.phone || '-'}</dd></div>
            <div><dt className="text-slate-500 dark:text-slate-400">Kendaraan</dt><dd className="font-medium text-slate-900 dark:text-slate-100">{appointment.vehicle?.plate_number || '-'}</dd></div>
            <div><dt className="text-slate-500 dark:text-slate-400">Mekanik</dt><dd className="font-medium text-slate-900 dark:text-slate-100">{appointment.mechanic?.name || '-'}</dd></div>
            <div className="md:col-span-2"><dt className="text-slate-500 dark:text-slate-400">Catatan</dt><dd className="font-medium text-slate-900 dark:text-slate-100">{appointment.notes || '-'}</dd></div>
          </dl>
        ) : null}
      </Card>
    </section>
  )
}
