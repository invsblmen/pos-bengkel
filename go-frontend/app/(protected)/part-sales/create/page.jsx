'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@services/api'
import { Button, Card } from '@components/ui'
import { IconArrowLeft, IconDeviceFloppy, IconReceipt } from '@tabler/icons-react'

function toIntOrNil(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return Math.trunc(parsed)
}

const inputClass = 'mt-1 w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-primary-500 focus:ring-4 focus:ring-primary-500/15 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100'
const selectClass = inputClass
const labelClass = 'block text-sm font-medium text-slate-700 dark:text-slate-300'

export default function PartSaleCreatePage() {
  const router = useRouter()
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

  const onChange = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))

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
      items: [{
        part_id: toIntOrNil(form.part_id),
        quantity: Math.max(1, Number(form.quantity || 1)),
        unit_price: Math.max(0, Number(form.unit_price || 0)),
        discount_type: 'none',
        discount_value: 0,
      }],
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
      router.push(saleID > 0 ? `/part-sales/${saleID}` : '/part-sales')
    } catch (err) {
      const msg = err?.response?.data?.message || 'Gagal membuat part sale.'
      const firstError = Object.values(err?.response?.data?.errors || {})?.[0]
      setError(Array.isArray(firstError) && firstError[0] ? `${msg} ${firstError[0]}` : msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="space-y-5">
      <Card
        title="Part Sale Create"
        icon={<IconReceipt size={18} strokeWidth={1.7} />}
        footer={<p className="text-sm text-slate-500 dark:text-slate-400">Buat penjualan parts baru untuk customer.</p>}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="text-sm text-slate-600 dark:text-slate-300">Form ini mengikuti pola visual yang sama dengan service order.</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Harga satuan dapat otomatis terisi dari master part.</p>
          </div>
          <Button href="/part-sales" variant="secondary" icon={<IconArrowLeft size={16} strokeWidth={1.8} />}>
            Kembali ke part sales
          </Button>
        </div>
      </Card>

      <Card title="Form Data" icon={<IconDeviceFloppy size={18} strokeWidth={1.7} />}>
        {error ? <p className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-200">{error}</p> : null}
        {loadingSeed ? <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">Memuat data referensi...</p> : null}

        <form onSubmit={onSubmit} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className={labelClass}>Customer
              <select className={selectClass} value={form.customer_id} onChange={onChange('customer_id')}>
                <option value="">Pilih customer</option>
                {seed.customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className={labelClass}>Tanggal Penjualan
              <input type="date" className={inputClass} value={form.sale_date} onChange={onChange('sale_date')} />
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
              <input type="number" min="0" className={inputClass} value={form.unit_price} onChange={onChange('unit_price')} placeholder={String(selectedPartPrice)} />
            </label>
            <label className={labelClass}>Status
              <select className={selectClass} value={form.status} onChange={onChange('status')}>
                <option value="draft">draft</option>
                <option value="confirmed">confirmed</option>
                <option value="waiting_stock">waiting_stock</option>
                <option value="ready_to_notify">ready_to_notify</option>
                <option value="waiting_pickup">waiting_pickup</option>
                <option value="completed">completed</option>
                <option value="cancelled">cancelled</option>
              </select>
            </label>
            <label className={labelClass}>Paid Amount
              <input type="number" min="0" className={inputClass} value={form.paid_amount} onChange={onChange('paid_amount')} />
            </label>
          </div>

          <label className={labelClass}>Catatan
            <textarea rows="4" className={inputClass} value={form.notes} onChange={onChange('notes')} />
          </label>

          <div className="flex flex-wrap gap-3">
            <Button type="submit" loading={submitting} icon={<IconDeviceFloppy size={16} strokeWidth={1.8} />}>
              {submitting ? 'Menyimpan...' : 'Simpan Part Sale'}
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
