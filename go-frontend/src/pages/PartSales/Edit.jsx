import ModuleScaffold from '@components/Parity/ModuleScaffold'

export default function PartSaleEdit() {
  return (
    <ModuleScaffold
      title="Part Sale Edit"
      subtitle="Parity edit sale (line item, reservasi stok, validasi status) akan diimplementasi bertahap."
      entityName="part_sales"
      basePath="/part-sales"
    />
  )
}
