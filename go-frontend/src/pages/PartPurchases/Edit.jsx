import ModuleScaffold from '@components/Parity/ModuleScaffold'

export default function PartPurchaseEdit() {
  return (
    <ModuleScaffold
      title="Part Purchase Edit"
      subtitle="Parity edit purchase (line replace + total recalculation) akan diimplementasi bertahap."
      entityName="part_purchases"
      basePath="/part-purchases"
    />
  )
}
