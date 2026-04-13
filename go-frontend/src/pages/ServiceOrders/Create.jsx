import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@services/api'

function toIntOrNil(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return Math.trunc(parsed)
}

export default function ServiceOrderCreate() {
  const navigate = useNavigate()
  const [seed, setSeed] = useState({ customers: [], vehicles: [], mechanics: [], services: [], parts: [] })
  const [loadingSeed, setLoadingSeed] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState(() => ({
    submission_token: `go-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
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
        const res = await api.get('/service-orders/create')
        if (!mounted) return
        setSeed({
          customers: Array.isArray(res?.data?.customers) ? res.data.customers : [],
          vehicles: Array.isArray(res?.data?.vehicles) ? res.data.vehicles : [],
          mechanics: Array.isArray(res?.data?.mechanics) ? res.data.mechanics : [],
          services: Array.isArray(res?.data?.services) ? res.data.services : [],
          parts: Array.isArray(res?.data?.parts) ? res.data.parts : [],
        })
      } catch (err) {
        if (!mounted) return
        setError(err?.response?.data?.error || 'Gagal memuat data create service order.')
      } finally {
        if (mounted) setLoadingSeed(false)
      }
    }

    load()

    return () => {
      mounted = false
    }
  }, [])

  const selectedPartPrice = useMemo(() => {
    const id = toIntOrNil(form.part_id)
    if (!id) return 0
    const found = seed.parts.find((p) => Number(p.id) === id)
    return Number(found?.sell_price || 0)
  }, [form.part_id, seed.parts])

  const onChange = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }))
  }

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
      submission_token: form.submission_token,
      customer_id: toIntOrNil(form.customer_id),
      vehicle_id: toIntOrNil(form.vehicle_id),
      mechanic_id: toIntOrNil(form.mechanic_id),
      odometer_km: Math.max(0, Number(form.odometer_km || 0)),
      status: form.status || 'pending',
      notes: form.notes || '',
      items: [
        {
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
        },
      ],
    }

    try {
      const res = await api.post('/service-orders', payload)
      const orderID = Number(res?.data?.order?.id || 0)
      if (orderID > 0) {
        navigate(`/service-orders/${orderID}`)
        return
      }
      navigate('/service-orders')
    } catch (err) {
      const msg = err?.response?.data?.message || 'Gagal membuat service order.'
      const firstError = Object.values(err?.response?.data?.errors || {})?.[0]
      setError(Array.isArray(firstError) && firstError[0] ? `${msg} ${firstError[0]}` : msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="space-y-4">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Service Order Create</h1>
        <p className="text-sm text-slate-600">Form baseline untuk transaksi service order via API Go.</p>
      </header>

      <form onSubmit={onSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {error ? <p className="mb-3 text-sm text-rose-600">{error}</p> : null}
        {loadingSeed ? <p className="mb-3 text-sm text-slate-600">Memuat referensi data...</p> : null}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="text-sm text-slate-700">Customer ID
            <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={form.customer_id} onChange={onChange('customer_id')} placeholder="contoh: 1" />
          </label>
          <label className="text-sm text-slate-700">Vehicle ID
            <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={form.vehicle_id} onChange={onChange('vehicle_id')} placeholder="contoh: 1" />
          </label>
          <label className="text-sm text-slate-700">Mechanic
            <select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={form.mechanic_id} onChange={onChange('mechanic_id')}>
              <option value="">Pilih mekanik</option>
              {seed.mechanics.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
          <label className="text-sm text-slate-700">Status
            <select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={form.status} onChange={onChange('status')}>
              <option value="pending">pending</option>
              <option value="in_progress">in_progress</option>
              <option value="completed">completed</option>
              <option value="paid">paid</option>
              <option value="cancelled">cancelled</option>
            </select>
          </label>
          <label className="text-sm text-slate-700">Odometer KM
            <input type="number" min="0" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={form.odometer_km} onChange={onChange('odometer_km')} />
          </label>
          <label className="text-sm text-slate-700">Service (opsional)
            <select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={form.service_id} onChange={onChange('service_id')}>
              <option value="">Tanpa service item</option>
              {seed.services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="text-sm text-slate-700">Part (opsional)
            <select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={form.part_id} onChange={onPartChange}>
              <option value="">Tanpa part item</option>
              {seed.parts.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.part_number || '-'})</option>)}
            </select>
          </label>
          <label className="text-sm text-slate-700">Qty Part
            <input type="number" min="1" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={form.qty} onChange={onChange('qty')} />
          </label>
          <label className="text-sm text-slate-700">Harga Part
            <input type="number" min="0" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={form.price} onChange={onChange('price')} placeholder={String(selectedPartPrice)} />
          </label>
        </div>

        <label className="mt-3 block text-sm text-slate-700">Catatan
          <textarea className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" rows="3" value={form.notes} onChange={onChange('notes')} />
        </label>

        <div className="mt-4 flex gap-2">
          <button type="submit" disabled={submitting} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {submitting ? 'Menyimpan...' : 'Simpan Service Order'}
          </button>
        </div>
      </form>
    </section>
  )
}
