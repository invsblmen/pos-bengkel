import { Link, useParams } from 'react-router-dom'

export default function ModuleScaffold({ title, subtitle, entityName, basePath }) {
  const { id } = useParams()

  return (
    <section className="space-y-4">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs uppercase tracking-wider text-slate-500">Parity Batch 1</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">{title}</h1>
        <p className="mt-2 text-sm text-slate-600">{subtitle}</p>
      </header>

      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-700">
        <p>Halaman ini sudah tersedia sebagai scaffold frontend Go mandiri.</p>
        <p className="mt-1">Langkah berikutnya: koneksi data API Go + parity state/validasi mengikuti halaman Laravel.</p>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link className="rounded-lg border border-slate-300 bg-white px-3 py-2 hover:bg-slate-100" to={basePath}>Index</Link>
        <Link className="rounded-lg border border-slate-300 bg-white px-3 py-2 hover:bg-slate-100" to={`${basePath}/create`}>Create</Link>
        <Link className="rounded-lg border border-slate-300 bg-white px-3 py-2 hover:bg-slate-100" to={`${basePath}/1`}>Show Sample</Link>
        <Link className="rounded-lg border border-slate-300 bg-white px-3 py-2 hover:bg-slate-100" to={`${basePath}/1/edit`}>Edit Sample</Link>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
        <span className="font-medium text-slate-800">Context:</span>{' '}
        entity {entityName}
        {id ? ` | route id: ${id}` : ''}
      </div>
    </section>
  )
}
