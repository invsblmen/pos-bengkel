'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import api from '@services/api'
import { Badge, Button, Card, Table } from '@components/ui'
import { IconArrowLeft, IconCar, IconRefresh } from '@tabler/icons-react'

const SERVICE_TONE = {
  serviced: 'success',
  never: 'warning',
  unknown: 'neutral',
}

const STATUS_TONE = {
  pending: 'warning',
  in_progress: 'primary',
  completed: 'success',
  cancelled: 'danger',
}

export default function VehicleShowPage() {
  const params = useParams()
  const id = params?.id
  const [vehicle, setVehicle] = useState(null)
  const [serviceOrders, setServiceOrders] = useState([])
  const [recommendations, setRecommendations] = useState(null)
  const [history, setHistory] = useState([])
  const [quickLoading, setQuickLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [quickError, setQuickError] = useState('')

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await api.get(`/vehicles/${id}`)
        if (!mounted) return
        setVehicle(res?.data?.vehicle || null)
        setServiceOrders(Array.isArray(res?.data?.service_orders) ? res.data.service_orders : [])
      } catch (err) {
        if (!mounted) return
        setError(err?.response?.data?.message || 'Gagal memuat detail kendaraan.')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    if (id) load()
    return () => { mounted = false }
  }, [id])

  const loadRecommendations = async () => {
    if (!id) return
    setQuickLoading(true)
    setQuickError('')
    try {
      const res = await api.get(`/vehicles/${id}/recommendations`)
      setRecommendations(res?.data || null)
    } catch (err) {
      setQuickError(err?.response?.data?.message || 'Gagal memuat rekomendasi kendaraan.')
    } finally {
      setQuickLoading(false)
    }
  }

  const loadServiceHistory = async () => {
    if (!id) return
    setQuickLoading(true)
    setQuickError('')
    try {
      const res = await api.get(`/vehicles/${id}/service-history`)
      setHistory(Array.isArray(res?.data?.service_orders) ? res.data.service_orders : [])
    } catch (err) {
      setQuickError(err?.response?.data?.message || 'Gagal memuat service history kendaraan.')
    } finally {
      setQuickLoading(false)
    }
  }

  return (
    <section className="space-y-5">
      <Card
        title="Vehicle Detail"
        icon={<IconCar size={18} strokeWidth={1.7} />}
        footer={<p className="text-sm text-slate-500 dark:text-slate-400">ID: {id}</p>}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="text-sm text-slate-600 dark:text-slate-300">Detail kendaraan, history service, dan rekomendasi servis.</p>
            <div className="flex flex-wrap gap-2">
              <Badge tone={SERVICE_TONE[vehicle?.service_status] || 'neutral'}>{vehicle?.service_status || 'loading'}</Badge>
              {vehicle?.plate_number ? <Badge tone="primary">{vehicle.plate_number}</Badge> : null}
            </div>
          </div>
          <Button href="/vehicles" variant="secondary" icon={<IconArrowLeft size={16} strokeWidth={1.8} />}>
            Kembali
          </Button>
        </div>
      </Card>

      <Card title="Quick Actions" icon={<IconRefresh size={18} strokeWidth={1.7} />}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Button type="button" variant="secondary" onClick={loadServiceHistory} disabled={loading || quickLoading}>
            Muat Service History
          </Button>
          <Button type="button" variant="secondary" onClick={loadRecommendations} disabled={loading || quickLoading}>
            Muat Recommendations
          </Button>
          <div className="text-sm text-slate-600 dark:text-slate-300">
            {quickLoading ? 'Memuat quick actions...' : quickError ? <span className="text-rose-600 dark:text-rose-300">{quickError}</span> : 'Pilih quick action di atas.'}
          </div>
        </div>
      </Card>

      <Card title="Ringkasan" icon={<IconCar size={18} strokeWidth={1.7} />}>
        {loading ? <p className="text-sm text-slate-600 dark:text-slate-300">Memuat detail...</p> : null}
        {error ? <p className="text-sm text-rose-600 dark:text-rose-300">{error}</p> : null}
        {!loading && !error && !vehicle ? <p className="text-sm text-slate-600 dark:text-slate-300">Detail kendaraan tidak ditemukan.</p> : null}
        {!loading && !error && vehicle ? (
          <dl className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
            <div><dt className="text-slate-500 dark:text-slate-400">Plat</dt><dd className="font-medium text-slate-900 dark:text-slate-100">{vehicle.plate_number || '-'}</dd></div>
            <div><dt className="text-slate-500 dark:text-slate-400">Kendaraan</dt><dd className="font-medium text-slate-900 dark:text-slate-100">{[vehicle.brand, vehicle.model, vehicle.year].filter(Boolean).join(' ') || '-'}</dd></div>
            <div><dt className="text-slate-500 dark:text-slate-400">Pelanggan</dt><dd className="font-medium text-slate-900 dark:text-slate-100">{vehicle.customer?.name || '-'}</dd></div>
            <div><dt className="text-slate-500 dark:text-slate-400">KM</dt><dd className="font-medium text-slate-900 dark:text-slate-100">{vehicle.km ? Number(vehicle.km).toLocaleString('id-ID') : '-'}</dd></div>
            <div><dt className="text-slate-500 dark:text-slate-400">Last Service</dt><dd className="font-medium text-slate-900 dark:text-slate-100">{vehicle.last_service_date || '-'}</dd></div>
            <div><dt className="text-slate-500 dark:text-slate-400">Next Service</dt><dd className="font-medium text-slate-900 dark:text-slate-100">{vehicle.next_service_date || '-'}</dd></div>
          </dl>
        ) : null}
      </Card>

      <Card title="Riwayat Service Orders" icon={<IconCar size={18} strokeWidth={1.7} />}>
        {loading ? <p className="text-sm text-slate-600 dark:text-slate-300">Memuat riwayat...</p> : null}
        {!loading && serviceOrders.length === 0 ? <p className="text-sm text-slate-600 dark:text-slate-300">Belum ada service order terkait kendaraan ini.</p> : null}
        {!loading && serviceOrders.length > 0 ? (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Nomor</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Tanggal</Table.Th>
                <Table.Th>Total</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {serviceOrders.map((order) => (
                <Table.Tr key={order.id}>
                  <Table.Td><Link className="font-medium text-slate-700 underline decoration-slate-300 underline-offset-4 dark:text-slate-200" href={`/service-orders/${order.id}`}>{order.order_number || '-'}</Link></Table.Td>
                  <Table.Td><Badge tone={STATUS_TONE[order.status] || 'neutral'}>{order.status || '-'}</Badge></Table.Td>
                  <Table.Td>{order.created_at || '-'}</Table.Td>
                  <Table.Td>{Number(order.total_amount || 0).toLocaleString('id-ID')}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        ) : null}
      </Card>

      <Card title="Quick Service History" icon={<IconRefresh size={18} strokeWidth={1.7} />}>
        {history.length === 0 ? <p className="text-sm text-slate-600 dark:text-slate-300">Belum ada data quick service history.</p> : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Nomor</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Tanggal</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {history.map((order) => (
                <Table.Tr key={order.id}>
                  <Table.Td><Link className="font-medium text-slate-700 underline decoration-slate-300 underline-offset-4 dark:text-slate-200" href={`/service-orders/${order.id}`}>{order.order_number || '-'}</Link></Table.Td>
                  <Table.Td><Badge tone={STATUS_TONE[order.status] || 'neutral'}>{order.status || '-'}</Badge></Table.Td>
                  <Table.Td>{order.created_at || '-'}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>

      <Card title="Quick Recommendations" icon={<IconRefresh size={18} strokeWidth={1.7} />}>
        {!recommendations ? <p className="text-sm text-slate-600 dark:text-slate-300">Belum ada data rekomendasi yang dimuat.</p> : (
          <div className="space-y-3 text-sm">
            <p className="text-slate-600 dark:text-slate-300">Riwayat terbaru: <span className="font-medium text-slate-900 dark:text-slate-100">{recommendations.recent_history_count ?? 0}</span></p>
            <div>
              <p className="mb-2 font-medium text-slate-900 dark:text-slate-100">Recommended Services</p>
              <div className="flex flex-wrap gap-2">
                {(recommendations.recommended_services || []).map((item) => (<Badge key={`svc-${item.id}`} tone="primary">{item.name} ({item.category})</Badge>))}
              </div>
            </div>
            <div>
              <p className="mb-2 font-medium text-slate-900 dark:text-slate-100">Recommended Parts</p>
              <div className="flex flex-wrap gap-2">
                {(recommendations.recommended_parts || []).map((item) => (<Badge key={`part-${item.id}`} tone="success">{item.name} ({item.category})</Badge>))}
              </div>
            </div>
          </div>
        )}
      </Card>
    </section>
  )
}
