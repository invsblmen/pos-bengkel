'use client'

import { useEffect, useMemo, useState } from 'react'
import api from '@services/api'
import { Badge, Button, Card, StatCard, Table } from '@components/ui'
import { IconCash, IconPlus, IconReceipt, IconRefresh } from '@tabler/icons-react'

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
}

export default function PartSalesPage() {
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const stats = useMemo(() => ({
    total: rows.length,
    paid: rows.filter((item) => item.payment_status === 'paid').length,
    unpaid: rows.filter((item) => item.payment_status === 'unpaid').length,
    completed: rows.filter((item) => item.status === 'completed').length,
  }), [rows])

  useEffect(() => {
    let mounted = true

    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await api.get('/part-sales')
        if (!mounted) return

        const list = res?.data?.sales?.data || []
        setRows(Array.isArray(list) ? list : [])
        setTotal(Number(res?.data?.sales?.total || 0))
      } catch (err) {
        if (!mounted) return
        setError(err?.response?.data?.message || 'Gagal memuat data part sales.')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [])

  return (
    <section className="space-y-5">
      <Card
        title="Part Sales"
        icon={<IconReceipt size={18} strokeWidth={1.7} />}
        footer={<p className="text-sm text-slate-500 dark:text-slate-400">Total data: {total}</p>}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-sm text-slate-600 dark:text-slate-300">Daftar penjualan parts dengan status dan pembayaran.</p>
          <Button href="/part-sales/create" icon={<IconPlus size={16} strokeWidth={1.8} />}>
            Buat Penjualan
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Sales" value={stats.total} tone="slate" />
        <StatCard label="Paid" value={stats.paid} tone="success" />
        <StatCard label="Unpaid" value={stats.unpaid} tone="warning" />
        <StatCard label="Completed" value={stats.completed} tone="primary" />
      </div>

      <Card title="List" icon={<IconCash size={18} strokeWidth={1.7} />}>
        <div className="flex justify-end pb-4">
          <Button type="button" variant="secondary" size="sm" icon={<IconRefresh size={16} strokeWidth={1.8} />} onClick={() => setLoading((value) => !value)}>
            Refresh
          </Button>
        </div>

        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Nomor</Table.Th>
              <Table.Th>Customer</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Payment</Table.Th>
              <Table.Th>Total</Table.Th>
              <Table.Th>Aksi</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {loading ? (
              <Table.Empty colSpan={6}>Memuat data...</Table.Empty>
            ) : error ? (
              <Table.Empty colSpan={6}>{error}</Table.Empty>
            ) : rows.length === 0 ? (
              <Table.Empty colSpan={6}>Belum ada part sales.</Table.Empty>
            ) : rows.map((item) => (
              <Table.Tr key={item.id}>
                <Table.Td className="font-medium text-slate-800 dark:text-slate-100">{item.sale_number || '-'}</Table.Td>
                <Table.Td>{item.customer?.name || '-'}</Table.Td>
                <Table.Td><Badge tone={STATUS_TONE[item.status] || 'neutral'}>{item.status || '-'}</Badge></Table.Td>
                <Table.Td><Badge tone={PAYMENT_TONE[item.payment_status] || 'neutral'}>{item.payment_status || '-'}</Badge></Table.Td>
                <Table.Td className="font-semibold text-slate-800 dark:text-slate-100">{Number(item.grand_total || 0).toLocaleString('id-ID')}</Table.Td>
                <Table.Td>
                  <Button href={`/part-sales/${item.id}`} size="sm" variant="secondary">Detail</Button>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>
    </section>
  )
}
