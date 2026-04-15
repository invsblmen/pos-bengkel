'use client'

import { useEffect, useMemo, useState } from 'react'
import api from '@services/api'
import { Badge, Button, Card, StatCard, Table } from '@components/ui'
import { IconBox, IconPlus, IconRefresh, IconShoppingCart } from '@tabler/icons-react'

const STATUS_TONE = {
  pending: 'warning',
  ordered: 'primary',
  received: 'success',
  cancelled: 'danger',
}

export default function PartPurchasesPage() {
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const stats = useMemo(() => ({
    total: rows.length,
    ordered: rows.filter((item) => item.status === 'ordered').length,
    received: rows.filter((item) => item.status === 'received').length,
    pending: rows.filter((item) => item.status === 'pending').length,
  }), [rows])

  useEffect(() => {
    let mounted = true

    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await api.get('/part-purchases')
        if (!mounted) return

        const list = res?.data?.purchases?.data || []
        setRows(Array.isArray(list) ? list : [])
        setTotal(Number(res?.data?.purchases?.total || 0))
      } catch (err) {
        if (!mounted) return
        setError(err?.response?.data?.message || 'Gagal memuat data part purchases.')
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
        title="Part Purchases"
        icon={<IconShoppingCart size={18} strokeWidth={1.7} />}
        footer={<p className="text-sm text-slate-500 dark:text-slate-400">Total data: {total}</p>}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-sm text-slate-600 dark:text-slate-300">Daftar pembelian parts dengan status stok masuk.</p>
          <Button href="/part-purchases/create" icon={<IconPlus size={16} strokeWidth={1.8} />}>
            Buat Pembelian
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Purchases" value={stats.total} tone="slate" />
        <StatCard label="Ordered" value={stats.ordered} tone="primary" />
        <StatCard label="Received" value={stats.received} tone="success" />
        <StatCard label="Pending" value={stats.pending} tone="warning" />
      </div>

      <Card title="List" icon={<IconBox size={18} strokeWidth={1.7} />}>
        <div className="flex justify-end pb-4">
          <Button type="button" variant="secondary" size="sm" icon={<IconRefresh size={16} strokeWidth={1.8} />} onClick={() => setLoading((value) => !value)}>
            Refresh
          </Button>
        </div>

        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Nomor</Table.Th>
              <Table.Th>Supplier</Table.Th>
              <Table.Th>Tanggal</Table.Th>
              <Table.Th>Status</Table.Th>
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
              <Table.Empty colSpan={6}>Belum ada part purchases.</Table.Empty>
            ) : rows.map((item) => (
              <Table.Tr key={item.id}>
                <Table.Td className="font-medium text-slate-800 dark:text-slate-100">{item.purchase_number || '-'}</Table.Td>
                <Table.Td>{item.supplier?.name || '-'}</Table.Td>
                <Table.Td>{item.purchase_date || '-'}</Table.Td>
                <Table.Td><Badge tone={STATUS_TONE[item.status] || 'neutral'}>{item.status || '-'}</Badge></Table.Td>
                <Table.Td className="font-semibold text-slate-800 dark:text-slate-100">{Number(item.total_amount || item.grand_total || 0).toLocaleString('id-ID')}</Table.Td>
                <Table.Td>
                  <Button href={`/part-purchases/${item.id}`} size="sm" variant="secondary">Detail</Button>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>
    </section>
  )
}
