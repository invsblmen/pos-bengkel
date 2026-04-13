import ModuleScaffold from '@components/Parity/ModuleScaffold'

export default function PartPurchaseShow() {
  return (
    <ModuleScaffold
      title="Part Purchase Detail"
      subtitle="Parity detail purchase + print/status update akan diisi setelah baseline data fetch stabil."
      entityName="part_purchases"
      basePath="/part-purchases"
    />
  )
}
