import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@services/api'

function toIntOrNil(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return Math.trunc(parsed)
}

export default function PartSaleCreate() {
  const navigate = useNavigate()
  const [seed, setSeed] = useState({ customers: [], parts: [] })
  const [loadingSeed, setLoadingSeed] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    customer_id: '',
    sale_date: new Date().toISOString().slice(0, 10),
    part_id: '',
    quantity: '1',
    unit_price: '0',
    status: 'confirmed',
    paid_amount: '0',
    notes: '',
  })

  useEffect(() => {
    let mounted = true

    const load = async () => {
      setLoadingSeed(true)
      setError('')
      try {
        // Reuse create payload source that already exposes customers + parts.
        const res = await api.get('/service-orders/create')
        if (!mounted) return
        setSeed({
          customers: Array.isArray(res?.data?.customers) ? res.data.customers : [],
          parts: Array.isArray(res?.data?.parts) ? res.data.parts : [],
        })
      } catch (err) {
        if (!mounted) return
        setError(err?.response?.data?.error || 'Gagal memuat data referensi part sales.')
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
    const partID = toIntOrNil(form.part_id)
    if (!partID) return 0
    const found = seed.parts.find((p) => Number(p.id) === partID)
    return Number(found?.sell_price || 0)
  }, [form.part_id, seed.parts])

  const onChange = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }))
  }

  const onPartChange = (e) => {
    const partID = e.target.value
    const found = seed.parts.find((p) => Number(p.id) === Number(partID))
    setForm((prev) => ({ ...prev, part_id: partID, unit_price: String(Number(found?.sell_price || prev.unit_price || 0)) }))
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    const payload = {
      customer_id: toIntOrNil(form.customer_id),
      sale_date: form.sale_date,
      items: [
        {
          part_id: toIntOrNil(form.part_id),
          quantity: Math.max(1, Number(form.quantity || 1)),
          unit_price: Math.max(0, Number(form.unit_price || 0)),
          discount_type: 'none',
          discount_value: 0,
        },
      ],
      discount_type: 'none',
      discount_value: 0,
      tax_type: 'none',
      tax_value: 0,
      paid_amount: Math.max(0, Number(form.paid_amount || 0)),
      status: form.status || 'confirmed',
      notes: form.notes || '',
    }

    try {
      const res = await api.post('/part-sales', payload)
      const saleID = Number(res?.data?.sale_id || 0)
      if (saleID > 0) {
        navigate(`/part-sales/${saleID}`)
        return
      }
      navigate('/part-sales')
    } catch (err) {
      const msg = err?.response?.data?.message || 'Gagal membuat part sale.'
      const firstError = Object.values(err?.response?.data?.errors || {})?.[0]
      setError(Array.isArray(firstError) && firstError[0] ? `${msg} ${firstError[0]}` : msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="space-y-4">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Part Sale Create</h1>
        <p className="text-sm text-slate-600">Form baseline create penjualan sparepart via API Go.</p>
      </header>

      <form onSubmit={onSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {error ? <p className="mb-3 text-sm text-rose-600">{error}</p> : null}
        {loadingSeed ? <p className="mb-3 text-sm text-slate-600">Memuat data referensi...</p> : null}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="text-sm text-slate-700">Customer ID
            <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={form.customer_id} onChange={onChange('customer_id')} placeholder="contoh: 1" />
          </label>
          <label className="text-sm text-slate-700">Tanggal Penjualan
            <input type="date" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={form.sale_date} onChange={onChange('sale_date')} />
          </label>
          <label className="text-sm text-slate-700">Part
            <select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={form.part_id} onChange={onPartChange}>
              <option value="">Pilih part</option>
              {seed.parts.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.part_number || '-'})</option>)}
            </select>
          </label>
          <label className="text-sm text-slate-700">Qty
            <input type="number" min="1" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={form.quantity} onChange={onChange('quantity')} />
          </label>
          <label className="text-sm text-slate-700">Unit Price
            <input type="number" min="0" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={form.unit_price} onChange={onChange('unit_price')} placeholder={String(selectedPartPrice)} />
          </label>
          <label className="text-sm text-slate-700">Status
            <select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={form.status} onChange={onChange('status')}>
              <option value="confirmed">confirmed</option>
              <option value="draft">draft</option>
              <option value="waiting_stock">waiting_stock</option>
              <option value="ready_to_notify">ready_to_notify</option>
              <option value="waiting_pickup">waiting_pickup</option>
              <option value="completed">completed</option>
              <option value="cancelled">cancelled</option>
            </select>
          </label>
          <label className="text-sm text-slate-700">Paid Amount
            <input type="number" min="0" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={form.paid_amount} onChange={onChange('paid_amount')} />
          </label>
        </div>

        <label className="mt-3 block text-sm text-slate-700">Catatan
          <textarea rows="3" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={form.notes} onChange={onChange('notes')} />
        </label>

        <div className="mt-4">
          <button type="submit" disabled={submitting} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {submitting ? 'Menyimpan...' : 'Simpan Part Sale'}
          </button>
        </div>
      </form>
    </section>
  )
}
