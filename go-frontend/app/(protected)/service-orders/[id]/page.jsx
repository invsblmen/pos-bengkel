'use client'

import { useEffect, useState } from 'react'
import api from '@services/api'
import { Badge, Button, Card, Table } from '@components/ui'
import { IconArrowLeft, IconDeviceFloppy, IconTool } from '@tabler/icons-react'

const STATUS_TONE = {
  pending: 'warning',
  in_progress: 'primary',
  completed: 'success',
  paid: 'success',
  cancelled: 'danger',
}

export default function ServiceOrderShowPage({ params }) {
  const { id } = params
  const [order, setOrder] = useState(null)
  const [warrantyRegistrations, setWarrantyRegistrations] = useState({})
  const [nextStatus, setNextStatus] = useState('pending')
  const [odometerKM, setOdometerKM] = useState('')
  const [statusNotes, setStatusNotes] = useState('')
  const [updating, setUpdating] = useState(false)
  const [actionMessage, setActionMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true

    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await api.get(`/service-orders/${id}`)
        if (!mounted) return
        const payload = res?.data?.order || null
        setOrder(payload)
        if (payload?.status) setNextStatus(payload.status)
        if (payload?.odometer_km) setOdometerKM(String(payload.odometer_km))
        setWarrantyRegistrations(res?.data?.warrantyRegistrations || {})
      } catch (err) {
        if (!mounted) return
        setError(err?.response?.data?.error || 'Gagal memuat detail service order.')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    if (id) load()
    return () => {
      mounted = false
    }
  }, [id])

  const onUpdateStatus = async () => {
    if (!id || !nextStatus) return
    setUpdating(true)
    setError('')
    setActionMessage('')

    try {
      const payload = { status: nextStatus, notes: statusNotes }
      if (odometerKM.trim() !== '') payload.odometer_km = Number(odometerKM)

      const res = await api.patch(`/service-orders/${id}/status`, payload)
      const updatedStatus = res?.data?.order?.status || nextStatus
      const updatedKM = res?.data?.order?.odometer_km

      setOrder((prev) => ({ ...(prev || {}), status: updatedStatus, odometer_km: updatedKM ?? prev?.odometer_km }))
      setNextStatus(updatedStatus)
      if (updatedKM !== null && updatedKM !== undefined) setOdometerKM(String(updatedKM))
      setActionMessage('Status service order berhasil diperbarui.')
    } catch (err) {
      setError(err?.response?.data?.message || 'Gagal memperbarui status service order.')
    } finally {
      setUpdating(false)
    }
  }

  const details = Array.isArray(order?.details) ? order.details : []

  return (
    <section className="space-y-5">
      <Card
        title="Service Order Detail"
        icon={<IconTool size={18} strokeWidth={1.7} />}
        footer={<p className="text-sm text-slate-500 dark:text-slate-400">ID: {id}</p>}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="text-sm text-slate-600 dark:text-slate-300">Rincian transaksi workshop dan status tracking.</p>
            <div className="flex flex-wrap gap-2">
              <Badge tone={STATUS_TONE[order?.status] || 'neutral'}>{order?.status || 'loading'}</Badge>
              {order?.order_number ? <Badge tone="primary">{order.order_number}</Badge> : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button href="/service-orders" variant="secondary" icon={<IconArrowLeft size={16} strokeWidth={1.8} />}>
              Kembali
            </Button>
            <Button href={`/service-orders/${id}/edit`} icon={<IconDeviceFloppy size={16} strokeWidth={1.8} />}>
              Edit
            </Button>
          </div>
        </div>
      </Card>

      <Card title="Update Status" icon={<IconDeviceFloppy size={18} strokeWidth={1.7} />}>
        {!loading && !error && order ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <select className="rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none transition focus:border-primary-500 focus:ring-4 focus:ring-primary-500/15 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" value={nextStatus} onChange={(event) => setNextStatus(event.target.value)}>
              <option value="pending">pending</option>
              <option value="in_progress">in_progress</option>
              <option value="completed">completed</option>
              <option value="paid">paid</option>
              <option value="cancelled">cancelled</option>
            </select>
            <input type="number" min="0" className="rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none transition focus:border-primary-500 focus:ring-4 focus:ring-primary-500/15 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" placeholder="Odometer" value={odometerKM} onChange={(event) => setOdometerKM(event.target.value)} />
            <input type="text" className="rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none transition focus:border-primary-500 focus:ring-4 focus:ring-primary-500/15 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" placeholder="Catatan status" value={statusNotes} onChange={(event) => setStatusNotes(event.target.value)} />
            <Button type="button" loading={updating} onClick={onUpdateStatus}>
              {updating ? 'Menyimpan...' : 'Update Status'}
            </Button>
            {actionMessage ? <p className="text-sm font-medium text-emerald-700 md:col-span-4 dark:text-emerald-300">{actionMessage}</p> : null}
          </div>
        ) : null}
      </Card>

      <Card title="Detail Utama" icon={<IconTool size={18} strokeWidth={1.7} />}>
        {loading ? <p className="text-sm text-slate-600 dark:text-slate-300">Memuat detail...</p> : null}
        {error ? <p className="text-sm text-rose-600 dark:text-rose-300">{error}</p> : null}
        {!loading && !error && order ? (
          <dl className="grid grid-cols-1 gap-4 text-sm md:grid-cols-3">
            <div><dt className="text-slate-500 dark:text-slate-400">Nomor Order</dt><dd className="font-medium text-slate-900 dark:text-slate-100">{order.order_number || '-'}</dd></div>
            <div><dt className="text-slate-500 dark:text-slate-400">Status</dt><dd className="font-medium text-slate-900 dark:text-slate-100">{order.status || '-'}</dd></div>
            <div><dt className="text-slate-500 dark:text-slate-400">Tanggal</dt><dd className="font-medium text-slate-900 dark:text-slate-100">{order.created_at || '-'}</dd></div>
            <div><dt className="text-slate-500 dark:text-slate-400">Customer</dt><dd className="font-medium text-slate-900 dark:text-slate-100">{order.customer?.name || '-'}</dd></div>
            <div><dt className="text-slate-500 dark:text-slate-400">Kendaraan</dt><dd className="font-medium text-slate-900 dark:text-slate-100">{order.vehicle?.plate_number || '-'}</dd></div>
            <div><dt className="text-slate-500 dark:text-slate-400">Mekanik</dt><dd className="font-medium text-slate-900 dark:text-slate-100">{order.mechanic?.name || '-'}</dd></div>
          </dl>
        ) : null}
      </Card>

      <Card title="Item Detail" icon={<IconTool size={18} strokeWidth={1.7} />}>
        {loading ? <p className="text-sm text-slate-600 dark:text-slate-300">Memuat item detail...</p> : null}
        {!loading && details.length === 0 ? <p className="text-sm text-slate-600 dark:text-slate-300">Belum ada item detail.</p> : null}
        {!loading && details.length > 0 ? (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Item</Table.Th>
                <Table.Th>Jenis</Table.Th>
                <Table.Th>Qty</Table.Th>
                <Table.Th>Harga</Table.Th>
                <Table.Th>Final</Table.Th>
                <Table.Th>Garansi</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {details.map((item) => {
                const warranty = warrantyRegistrations?.[item.id]
                return (
                  <Table.Tr key={item.id}>
                    <Table.Td className="font-medium text-slate-800 dark:text-slate-100">{item.service?.name || item.part?.name || '-'}</Table.Td>
                    <Table.Td>{item.service ? 'Service' : item.part ? 'Part' : '-'}</Table.Td>
                    <Table.Td>{Number(item.qty || 0).toLocaleString('id-ID')}</Table.Td>
                    <Table.Td>{Number(item.price || 0).toLocaleString('id-ID')}</Table.Td>
                    <Table.Td className="font-semibold text-slate-800 dark:text-slate-100">{Number(item.final_amount || 0).toLocaleString('id-ID')}</Table.Td>
                    <Table.Td><Badge tone={warranty?.status ? 'success' : 'neutral'}>{warranty?.status || '-'}</Badge></Table.Td>
                  </Table.Tr>
                )
              })}
            </Table.Tbody>
          </Table>
        ) : null}
      </Card>
    </section>
  )
}
