'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@services/api'
import { Button, Card } from '@components/ui'
import { IconArrowLeft, IconDeviceFloppy, IconShoppingCart } from '@tabler/icons-react'

function toIntOrNil(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return Math.trunc(parsed)
}

const inputClass = 'mt-1 w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-primary-500 focus:ring-4 focus:ring-primary-500/15 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100'
const selectClass = inputClass
const labelClass = 'block text-sm font-medium text-slate-700 dark:text-slate-300'

export default function PartPurchaseCreatePage() {
  const router = useRouter()
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

  const onChange = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))

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
      items: [{
        part_id: toIntOrNil(form.part_id),
        quantity: Math.max(1, Number(form.quantity || 1)),
        unit_price: Math.max(0, Number(form.unit_price || 0)),
        discount_type: 'none',
        discount_value: 0,
        margin_type: form.margin_type || 'percent',
        margin_value: Math.max(0, Number(form.margin_value || 0)),
        promo_discount_type: 'none',
        promo_discount_value: 0,
      }],
      discount_type: 'none',
      discount_value: 0,
      tax_type: 'none',
      tax_value: 0,
    }

    try {
      const res = await api.post('/part-purchases', payload)
      const purchaseID = Number(res?.data?.purchase_id || 0)
      router.push(purchaseID > 0 ? `/part-purchases/${purchaseID}` : '/part-purchases')
    } catch (err) {
      const msg = err?.response?.data?.message || 'Gagal membuat part purchase.'
      const firstError = Object.values(err?.response?.data?.errors || {})?.[0]
      setError(Array.isArray(firstError) && firstError[0] ? `${msg} ${firstError[0]}` : msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="space-y-5">
      <Card
        title="Part Purchase Create"
        icon={<IconShoppingCart size={18} strokeWidth={1.7} />}
        footer={<p className="text-sm text-slate-500 dark:text-slate-400">Buat pembelian parts baru dari supplier.</p>}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="text-sm text-slate-600 dark:text-slate-300">Gunakan layout ini agar flow pembelian terasa sama dengan transaksi lain.</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Margin dan promo diproses di backend sesuai payload yang dikirim.</p>
          </div>
          <Button href="/part-purchases" variant="secondary" icon={<IconArrowLeft size={16} strokeWidth={1.8} />}>
            Kembali ke part purchases
          </Button>
        </div>
      </Card>

      <Card title="Form Data" icon={<IconDeviceFloppy size={18} strokeWidth={1.7} />}>
        {error ? <p className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-200">{error}</p> : null}
        {loadingSeed ? <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">Memuat data referensi...</p> : null}

        <form onSubmit={onSubmit} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className={labelClass}>Supplier
              <select className={selectClass} value={form.supplier_id} onChange={onChange('supplier_id')}>
                <option value="">Pilih supplier</option>
                {seed.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label className={labelClass}>Tanggal Pembelian
              <input type="date" className={inputClass} value={form.purchase_date} onChange={onChange('purchase_date')} />
            </label>
            <label className={labelClass}>Estimasi Datang
              <input type="date" className={inputClass} value={form.expected_delivery_date} onChange={onChange('expected_delivery_date')} />
            </label>
            <label className={labelClass}>Part
              <select className={selectClass} value={form.part_id} onChange={onPartChange}>
                <option value="">Pilih part</option>
                {seed.parts.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.part_number || '-'})</option>)}
              </select>
            </label>
            <label className={labelClass}>Qty
              <input type="number" min="1" className={inputClass} value={form.quantity} onChange={onChange('quantity')} />
            </label>
            <label className={labelClass}>Unit Price
              <input type="number" min="0" className={inputClass} value={form.unit_price} onChange={onChange('unit_price')} />
            </label>
            <label className={labelClass}>Margin Type
              <select className={selectClass} value={form.margin_type} onChange={onChange('margin_type')}>
                <option value="percent">percent</option>
                <option value="fixed">fixed</option>
              </select>
            </label>
            <label className={labelClass}>Margin Value
              <input type="number" min="0" className={inputClass} value={form.margin_value} onChange={onChange('margin_value')} />
            </label>
          </div>

          <label className={labelClass}>Catatan
            <textarea rows="3" className={inputClass} value={form.notes} onChange={onChange('notes')} />
          </label>

          <div className="flex flex-wrap gap-3">
            <Button type="submit" loading={submitting} icon={<IconDeviceFloppy size={16} strokeWidth={1.8} />}>
              {submitting ? 'Menyimpan...' : 'Simpan Part Purchase'}
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
