'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import api from '@services/api'
import { Badge, Button, Card, Table } from '@components/ui'
import { IconArrowLeft, IconDeviceFloppy, IconReceipt } from '@tabler/icons-react'

const STATUS_TONE = {
  draft: 'warning',
  confirmed: 'primary',
  waiting_stock: 'info',
  ready_to_notify: 'success',
  waiting_pickup: 'purple',
  completed: 'success',
  cancelled: 'danger',
}

const PAYMENT_TONE = {
  unpaid: 'warning',
  partial: 'primary',
  paid: 'success',
  refunded: 'neutral',
}

export default function PartSaleShowPage() {
  const params = useParams()
  const id = params?.id
  const [sale, setSale] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true

    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await api.get(`/part-sales/${id}`)
        if (!mounted) return
        setSale(res?.data?.sale || null)
      } catch (err) {
        if (!mounted) return
        setError(err?.response?.data?.error || 'Gagal memuat detail part sale.')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    if (id) load()
    return () => {
      mounted = false
    }
  }, [id])

  const details = Array.isArray(sale?.details) ? sale.details : []

  return (
    <section className="space-y-5">
      <Card
        title="Part Sale Detail"
        icon={<IconReceipt size={18} strokeWidth={1.7} />}
        footer={<p className="text-sm text-slate-500 dark:text-slate-400">ID: {id}</p>}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="text-sm text-slate-600 dark:text-slate-300">Rincian penjualan parts dan status pembayaran.</p>
            <div className="flex flex-wrap gap-2">
              <Badge tone={STATUS_TONE[sale?.status] || 'neutral'}>{sale?.status || 'loading'}</Badge>
              <Badge tone={PAYMENT_TONE[sale?.payment_status] || 'neutral'}>{sale?.payment_status || 'loading'}</Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button href="/part-sales" variant="secondary" icon={<IconArrowLeft size={16} strokeWidth={1.8} />}>Kembali</Button>
            <Button href={`/part-sales/${id}/edit`} icon={<IconDeviceFloppy size={16} strokeWidth={1.8} />}>Edit</Button>
          </div>
        </div>
      </Card>

      <Card title="Ringkasan" icon={<IconReceipt size={18} strokeWidth={1.7} />}>
        {loading ? <p className="text-sm text-slate-600 dark:text-slate-300">Memuat detail...</p> : null}
        {error ? <p className="text-sm text-rose-600 dark:text-rose-300">{error}</p> : null}
        {!loading && !error && sale ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Sale ID</p>
              <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{sale.id || '-'}</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Customer</p>
              <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{sale.customer?.name || '-'}</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Sale Date</p>
              <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{sale.sale_date || '-'}</p>
            </article>
            <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/30">
              <p className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-200">Grand Total</p>
              <p className="mt-1 text-lg font-semibold text-emerald-900 dark:text-emerald-100">{Number(sale.grand_total || sale.total || 0).toLocaleString('id-ID')}</p>
            </article>
          </div>
        ) : null}
      </Card>

      <Card title="Meta" icon={<IconReceipt size={18} strokeWidth={1.7} />}>
        {!loading && !error && sale ? (
          <dl className="grid grid-cols-1 gap-4 text-sm md:grid-cols-3">
            <div><dt className="text-slate-500 dark:text-slate-400">Voucher</dt><dd className="font-medium text-slate-900 dark:text-slate-100">{sale.voucher?.code || '-'}</dd></div>
            <div><dt className="text-slate-500 dark:text-slate-400">Paid Amount</dt><dd className="font-medium text-slate-900 dark:text-slate-100">{Number(sale.paid_amount || 0).toLocaleString('id-ID')}</dd></div>
            <div><dt className="text-slate-500 dark:text-slate-400">Notes</dt><dd className="font-medium text-slate-900 dark:text-slate-100">{sale.notes || '-'}</dd></div>
          </dl>
        ) : null}
      </Card>

      <Card title="Item Detail" icon={<IconReceipt size={18} strokeWidth={1.7} />}>
        {loading ? <p className="text-sm text-slate-600 dark:text-slate-300">Memuat item detail...</p> : null}
        {error ? <p className="text-sm text-rose-600 dark:text-rose-300">{error}</p> : null}
        {!loading && !error && details.length === 0 ? <p className="text-sm text-slate-600 dark:text-slate-300">Belum ada item detail pada part sale ini.</p> : null}
        {!loading && !error && details.length > 0 ? (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Part</Table.Th>
                <Table.Th>Qty</Table.Th>
                <Table.Th>Unit Price</Table.Th>
                <Table.Th>Discount</Table.Th>
                <Table.Th>Subtotal</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {details.map((item) => (
                <Table.Tr key={item.id}>
                  <Table.Td className="font-medium text-slate-800 dark:text-slate-100">{item.part?.name || '-'}</Table.Td>
                  <Table.Td>{Number(item.quantity || 0).toLocaleString('id-ID')}</Table.Td>
                  <Table.Td>{Number(item.unit_price || 0).toLocaleString('id-ID')}</Table.Td>
                  <Table.Td>{Number(item.discount_amount || 0).toLocaleString('id-ID')}</Table.Td>
                  <Table.Td className="font-semibold text-slate-800 dark:text-slate-100">{Number(item.subtotal || 0).toLocaleString('id-ID')}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        ) : null}
      </Card>
    </section>
  )
}
