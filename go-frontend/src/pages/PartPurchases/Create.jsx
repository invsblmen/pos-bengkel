import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@services/api'

function toIntOrNil(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return Math.trunc(parsed)
}

export default function PartPurchaseCreate() {
  const navigate = useNavigate()
  const [seed, setSeed] = useState({ suppliers: [], parts: [] })
  const [loadingSeed, setLoadingSeed] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    supplier_id: '',
    purchase_date: new Date().toISOString().slice(0, 10),
    expected_delivery_date: '',
    part_id: '',
    quantity: '1',
    unit_price: '0',
    margin_type: 'percent',
    margin_value: '0',
    notes: '',
  })

  useEffect(() => {
    let mounted = true

    const load = async () => {
      setLoadingSeed(true)
      setError('')
      try {
        const res = await api.get('/part-purchases/create')
        if (!mounted) return
        setSeed({
          suppliers: Array.isArray(res?.data?.suppliers) ? res.data.suppliers : [],
          parts: Array.isArray(res?.data?.parts) ? res.data.parts : [],
        })
      } catch (err) {
        if (!mounted) return
        setError(err?.response?.data?.error || 'Gagal memuat data referensi part purchase.')
      } finally {
        if (mounted) setLoadingSeed(false)
      }
    }

    load()

    return () => {
      mounted = false
    }
  }, [])

  const onChange = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }))
  }

  const onPartChange = (e) => {
    const partID = e.target.value
    const found = seed.parts.find((p) => Number(p.id) === Number(partID))
    setForm((prev) => ({ ...prev, part_id: partID, unit_price: String(Number(found?.buy_price || prev.unit_price || 0)) }))
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    const payload = {
      supplier_id: toIntOrNil(form.supplier_id),
      purchase_date: form.purchase_date,
      expected_delivery_date: form.expected_delivery_date || null,
      notes: form.notes || '',
      items: [
        {
          part_id: toIntOrNil(form.part_id),
          quantity: Math.max(1, Number(form.quantity || 1)),
          unit_price: Math.max(0, Number(form.unit_price || 0)),
          discount_type: 'none',
          discount_value: 0,
          margin_type: form.margin_type || 'percent',
          margin_value: Math.max(0, Number(form.margin_value || 0)),
          promo_discount_type: 'none',
          promo_discount_value: 0,
        },
      ],
      discount_type: 'none',
      discount_value: 0,
      tax_type: 'none',
      tax_value: 0,
    }

    try {
      const res = await api.post('/part-purchases', payload)
      const purchaseID = Number(res?.data?.purchase_id || 0)
      if (purchaseID > 0) {
        navigate(`/part-purchases/${purchaseID}`)
        return
      }
      navigate('/part-purchases')
    } catch (err) {
      const msg = err?.response?.data?.message || 'Gagal membuat part purchase.'
      const firstError = Object.values(err?.response?.data?.errors || {})?.[0]
      setError(Array.isArray(firstError) && firstError[0] ? `${msg} ${firstError[0]}` : msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="space-y-4">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Part Purchase Create</h1>
        <p className="text-sm text-slate-600">Form baseline create pembelian sparepart via API Go.</p>
      </header>

      <form onSubmit={onSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {error ? <p className="mb-3 text-sm text-rose-600">{error}</p> : null}
        {loadingSeed ? <p className="mb-3 text-sm text-slate-600">Memuat data referensi...</p> : null}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="text-sm text-slate-700">Supplier
            <select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={form.supplier_id} onChange={onChange('supplier_id')}>
              <option value="">Pilih supplier</option>
              {seed.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="text-sm text-slate-700">Tanggal Pembelian
            <input type="date" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={form.purchase_date} onChange={onChange('purchase_date')} />
          </label>
          <label className="text-sm text-slate-700">Estimasi Datang
            <input type="date" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={form.expected_delivery_date} onChange={onChange('expected_delivery_date')} />
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
            <input type="number" min="0" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={form.unit_price} onChange={onChange('unit_price')} />
          </label>
          <label className="text-sm text-slate-700">Margin Type
            <select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={form.margin_type} onChange={onChange('margin_type')}>
              <option value="percent">percent</option>
              <option value="fixed">fixed</option>
            </select>
          </label>
          <label className="text-sm text-slate-700">Margin Value
            <input type="number" min="0" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={form.margin_value} onChange={onChange('margin_value')} />
          </label>
        </div>

        <label className="mt-3 block text-sm text-slate-700">Catatan
          <textarea rows="3" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={form.notes} onChange={onChange('notes')} />
        </label>

        <div className="mt-4">
          <button type="submit" disabled={submitting} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {submitting ? 'Menyimpan...' : 'Simpan Part Purchase'}
          </button>
        </div>
      </form>
    </section>
  )
}
