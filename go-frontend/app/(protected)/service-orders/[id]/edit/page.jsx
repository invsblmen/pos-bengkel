'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@services/api'
import { Button, Card } from '@components/ui'
import { IconArrowLeft, IconDeviceFloppy, IconTool } from '@tabler/icons-react'

function toIntOrNil(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return Math.trunc(parsed)
}

const inputClass = 'mt-1 w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-primary-500 focus:ring-4 focus:ring-primary-500/15 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100'
const selectClass = inputClass
const labelClass = 'block text-sm font-medium text-slate-700 dark:text-slate-300'

export default function ServiceOrderEditPage({ params }) {
  const { id } = params
  const router = useRouter()
  const [seed, setSeed] = useState({ customers: [], vehicles: [], mechanics: [], services: [], parts: [] })
  const [loadingSeed, setLoadingSeed] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState(() => ({
    customer_id: '',
    vehicle_id: '',
    mechanic_id: '',
    odometer_km: '0',
    status: 'pending',
    notes: '',
    service_id: '',
    part_id: '',
    qty: '1',
    price: '0',
  }))

  useEffect(() => {
    let mounted = true

    const load = async () => {
      setLoadingSeed(true)
      setError('')
      try {
        const res = await api.get(`/service-orders/${id}/edit`)
        if (!mounted) return

        const order = res?.data?.order || {}
        const firstDetail = order.details?.[0]

        setSeed({
          customers: Array.isArray(res?.data?.customers) ? res.data.customers : [],
          vehicles: Array.isArray(res?.data?.vehicles) ? res.data.vehicles : [],
          mechanics: Array.isArray(res?.data?.mechanics) ? res.data.mechanics : [],
          services: Array.isArray(res?.data?.services) ? res.data.services : [],
          parts: Array.isArray(res?.data?.parts) ? res.data.parts : [],
        })

        setForm({
          customer_id: String(order.customer_id || ''),
          vehicle_id: String(order.vehicle_id || ''),
          mechanic_id: String(order.mechanic_id || ''),
          odometer_km: String(order.odometer_km || '0'),
          status: order.status || 'pending',
          notes: order.notes || '',
          service_id: firstDetail?.service_id ? String(firstDetail.service_id) : '',
          part_id: firstDetail?.parts?.[0]?.part_id ? String(firstDetail.parts[0].part_id) : '',
          qty: firstDetail?.parts?.[0]?.qty ? String(firstDetail.parts[0].qty) : '1',
          price: firstDetail?.parts?.[0]?.price ? String(firstDetail.parts[0].price) : '0',
        })
      } catch (err) {
        if (!mounted) return
        setError(err?.response?.data?.error || 'Gagal memuat data edit service order.')
      } finally {
        if (mounted) setLoadingSeed(false)
      }
    }

    if (id) load()
    return () => {
      mounted = false
    }
  }, [id])

  const selectedPartPrice = useMemo(() => {
    const partID = toIntOrNil(form.part_id)
    if (!partID) return 0
    const found = seed.parts.find((p) => Number(p.id) === partID)
    return Number(found?.sell_price || 0)
  }, [form.part_id, seed.parts])

  const onChange = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))

  const onPartChange = (e) => {
    const partID = e.target.value
    const found = seed.parts.find((p) => Number(p.id) === Number(partID))
    setForm((prev) => ({
      ...prev,
      part_id: partID,
      price: partID ? String(Number(found?.sell_price || prev.price || 0)) : prev.price,
    }))
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    const payload = {
      customer_id: toIntOrNil(form.customer_id),
      vehicle_id: toIntOrNil(form.vehicle_id),
      mechanic_id: toIntOrNil(form.mechanic_id),
      odometer_km: Math.max(0, Number(form.odometer_km || 0)),
      status: form.status || 'pending',
      notes: form.notes || '',
      items: [{
        service_id: toIntOrNil(form.service_id),
        parts: toIntOrNil(form.part_id)
          ? [{
              part_id: toIntOrNil(form.part_id),
              qty: Math.max(1, Number(form.qty || 1)),
              price: Math.max(0, Number(form.price || 0)),
              discount_type: 'none',
              discount_value: 0,
            }]
          : [],
      }],
    }

    try {
      await api.put(`/service-orders/${id}`, payload)
      router.push(`/service-orders/${id}`)
    } catch (err) {
      const msg = err?.response?.data?.message || 'Gagal memperbarui service order.'
      const firstError = Object.values(err?.response?.data?.errors || {})?.[0]
      setError(Array.isArray(firstError) && firstError[0] ? `${msg} ${firstError[0]}` : msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="space-y-5">
      <Card
        title="Service Order Edit"
        icon={<IconTool size={18} strokeWidth={1.7} />}
        footer={<p className="text-sm text-slate-500 dark:text-slate-400">Perbarui data transaksi workshop yang sudah ada.</p>}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="text-sm text-slate-600 dark:text-slate-300">Form ini mempertahankan struktur input yang sama dengan create page agar mudah dipahami.</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Service order ID: {id}</p>
          </div>
          <Button href={`/service-orders/${id}`} variant="secondary" icon={<IconArrowLeft size={16} strokeWidth={1.8} />}>
            Kembali ke detail
          </Button>
        </div>
      </Card>

      <Card title="Form Data" icon={<IconDeviceFloppy size={18} strokeWidth={1.7} />}>
        {error ? <p className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-200">{error}</p> : null}
        {loadingSeed ? <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">Memuat referensi data...</p> : null}

        <form onSubmit={onSubmit} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className={labelClass}>Customer
              <select className={selectClass} value={form.customer_id} onChange={onChange('customer_id')}>
                <option value="">Pilih customer</option>
                {seed.customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className={labelClass}>Vehicle
              <select className={selectClass} value={form.vehicle_id} onChange={onChange('vehicle_id')}>
                <option value="">Pilih vehicle</option>
                {seed.vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate_number} - {v.brand} {v.model}</option>)}
              </select>
            </label>
            <label className={labelClass}>Mechanic
              <select className={selectClass} value={form.mechanic_id} onChange={onChange('mechanic_id')}>
                <option value="">Pilih mekanik</option>
                {seed.mechanics.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>
            <label className={labelClass}>Status
              <select className={selectClass} value={form.status} onChange={onChange('status')}>
                <option value="pending">pending</option>
                <option value="in_progress">in_progress</option>
                <option value="completed">completed</option>
                <option value="paid">paid</option>
                <option value="cancelled">cancelled</option>
              </select>
            </label>
            <label className={labelClass}>Odometer KM
              <input type="number" min="0" className={inputClass} value={form.odometer_km} onChange={onChange('odometer_km')} />
            </label>
            <label className={labelClass}>Service (opsional)
              <select className={selectClass} value={form.service_id} onChange={onChange('service_id')}>
                <option value="">Tanpa service item</option>
                {seed.services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label className={labelClass}>Part (opsional)
              <select className={selectClass} value={form.part_id} onChange={onPartChange}>
                <option value="">Tanpa part item</option>
                {seed.parts.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.part_number || '-'})</option>)}
              </select>
            </label>
            <label className={labelClass}>Qty Part
              <input type="number" min="1" className={inputClass} value={form.qty} onChange={onChange('qty')} />
            </label>
            <label className={labelClass}>Harga Part
              <input type="number" min="0" className={inputClass} value={form.price} onChange={onChange('price')} placeholder={String(selectedPartPrice)} />
            </label>
          </div>

          <label className={labelClass}>Catatan
            <textarea className={inputClass} rows="4" value={form.notes} onChange={onChange('notes')} />
          </label>

          <div className="flex flex-wrap gap-3">
            <Button type="submit" loading={submitting} icon={<IconDeviceFloppy size={16} strokeWidth={1.8} />}>
              {submitting ? 'Menyimpan...' : 'Perbarui Service Order'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => router.back()}>
              Batal
            </Button>
          </div>
        </form>
      </Card>
    </section>
  )
}
