'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import api from '@services/api'
import { Badge, Button, Card, Table } from '@components/ui'
import { IconArrowLeft, IconDeviceFloppy, IconShoppingCart } from '@tabler/icons-react'

const STATUS_TONE = {
  pending: 'warning',
  ordered: 'primary',
  received: 'success',
  cancelled: 'danger',
}

export default function PartPurchaseShowPage() {
  const params = useParams()
  const id = params?.id
  const [purchase, setPurchase] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true

    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await api.get(`/part-purchases/${id}`)
        if (!mounted) return
        setPurchase(res?.data?.purchase || null)
      } catch (err) {
        if (!mounted) return
        setError(err?.response?.data?.error || 'Gagal memuat detail part purchase.')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    if (id) load()
    return () => {
      mounted = false
    }
  }, [id])

  const details = Array.isArray(purchase?.details) ? purchase.details : []

  return (
    <section className="space-y-5">
      <Card
        title="Part Purchase Detail"
        icon={<IconShoppingCart size={18} strokeWidth={1.7} />}
        footer={<p className="text-sm text-slate-500 dark:text-slate-400">ID: {id}</p>}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="text-sm text-slate-600 dark:text-slate-300">Rincian pembelian parts dan status stok masuk.</p>
            <div className="flex flex-wrap gap-2">
              <Badge tone={STATUS_TONE[purchase?.status] || 'neutral'}>{purchase?.status || 'loading'}</Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button href="/part-purchases" variant="secondary" icon={<IconArrowLeft size={16} strokeWidth={1.8} />}>Kembali</Button>
            <Button href={`/part-purchases/${id}/edit`} icon={<IconDeviceFloppy size={16} strokeWidth={1.8} />}>Edit</Button>
          </div>
        </div>
      </Card>

      <Card title="Ringkasan" icon={<IconShoppingCart size={18} strokeWidth={1.7} />}>
        {loading ? <p className="text-sm text-slate-600 dark:text-slate-300">Memuat detail...</p> : null}
        {error ? <p className="text-sm text-rose-600 dark:text-rose-300">{error}</p> : null}
        {!loading && !error && purchase ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Purchase ID</p>
              <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{purchase.id || '-'}</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Supplier</p>
              <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{purchase.supplier?.name || '-'}</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Purchase Date</p>
              <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{purchase.purchase_date || '-'}</p>
            </article>
            <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/30">
              <p className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-200">Grand Total</p>
              <p className="mt-1 text-lg font-semibold text-emerald-900 dark:text-emerald-100">{Number(purchase.grand_total || purchase.total || 0).toLocaleString('id-ID')}</p>
            </article>
          </div>
        ) : null}
      </Card>

      <Card title="Meta" icon={<IconShoppingCart size={18} strokeWidth={1.7} />}>
        {!loading && !error && purchase ? (
          <dl className="grid grid-cols-1 gap-4 text-sm md:grid-cols-3">
            <div><dt className="text-slate-500 dark:text-slate-400">Expected Delivery</dt><dd className="font-medium text-slate-900 dark:text-slate-100">{purchase.expected_delivery_date || '-'}</dd></div>
            <div><dt className="text-slate-500 dark:text-slate-400">Margin Type</dt><dd className="font-medium text-slate-900 dark:text-slate-100">{purchase.margin_type || '-'}</dd></div>
            <div><dt className="text-slate-500 dark:text-slate-400">Margin Value</dt><dd className="font-medium text-slate-900 dark:text-slate-100">{Number(purchase.margin_value || 0).toLocaleString('id-ID')}</dd></div>
          </dl>
        ) : null}
      </Card>

      <Card title="Item Detail" icon={<IconShoppingCart size={18} strokeWidth={1.7} />}>
        {loading ? <p className="text-sm text-slate-600 dark:text-slate-300">Memuat item detail...</p> : null}
        {error ? <p className="text-sm text-rose-600 dark:text-rose-300">{error}</p> : null}
        {!loading && !error && details.length === 0 ? <p className="text-sm text-slate-600 dark:text-slate-300">Belum ada item detail pada part purchase ini.</p> : null}
        {!loading && !error && details.length > 0 ? (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Part</Table.Th>
                <Table.Th>Qty</Table.Th>
                <Table.Th>Unit Price</Table.Th>
                <Table.Th>Subtotal</Table.Th>
                <Table.Th>Status</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {details.map((item) => (
                <Table.Tr key={item.id}>
                  <Table.Td className="font-medium text-slate-800 dark:text-slate-100">{item.part?.name || '-'}</Table.Td>
                  <Table.Td>{Number(item.quantity || 0).toLocaleString('id-ID')}</Table.Td>
                  <Table.Td>{Number(item.unit_price || 0).toLocaleString('id-ID')}</Table.Td>
                  <Table.Td className="font-semibold text-slate-800 dark:text-slate-100">{Number(item.subtotal || 0).toLocaleString('id-ID')}</Table.Td>
                  <Table.Td><Badge tone={item.stock_status === 'received' ? 'success' : 'neutral'}>{item.stock_status || 'pending'}</Badge></Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        ) : null}
      </Card>
    </section>
  )
}
