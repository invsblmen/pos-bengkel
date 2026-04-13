import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '@services/api'

export default function PartSaleIndex() {
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
    <section className="space-y-4">
      <header className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Parity Batch 1</p>
          <h1 className="text-2xl font-semibold text-slate-900">Part Sales</h1>
          <p className="text-sm text-slate-600">Total data: {total}</p>
        </div>
        <Link to="/part-sales/create" className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700">
          Buat Penjualan
        </Link>
      </header>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {loading ? (
          <p className="text-sm text-slate-600">Memuat data...</p>
        ) : error ? (
          <p className="text-sm text-rose-600">{error}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-600">Belum ada part sales.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-600">
                  <th className="px-3 py-2">Nomor</th>
                  <th className="px-3 py-2">Customer</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Payment</th>
                  <th className="px-3 py-2">Total</th>
                  <th className="px-3 py-2">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100">
                    <td className="px-3 py-2">{item.sale_number || '-'}</td>
                    <td className="px-3 py-2">{item.customer?.name || '-'}</td>
                    <td className="px-3 py-2">{item.status || '-'}</td>
                    <td className="px-3 py-2">{item.payment_status || '-'}</td>
                    <td className="px-3 py-2">{Number(item.grand_total || 0).toLocaleString('id-ID')}</td>
                    <td className="px-3 py-2">
                      <Link className="text-slate-700 underline" to={`/part-sales/${item.id}`}>Detail</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
