import ModuleScaffold from '@components/Parity/ModuleScaffold'

export default function PartSaleShow() {
  return (
    <ModuleScaffold
      title="Part Sale Detail"
      subtitle="Parity detail sale + aksi pembayaran/status/warranty akan diisi setelah fondasi data fetch final."
      entityName="part_sales"
      basePath="/part-sales"
    />
  )
}
