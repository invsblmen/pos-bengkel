import ModuleScaffold from '@components/Parity/ModuleScaffold'

export default function ServiceOrderEdit() {
  return (
    <ModuleScaffold
      title="Service Order Edit"
      subtitle="Parity edit service order (line item, stock effect, status rule) akan diimplementasi bertahap."
      entityName="service_orders"
      basePath="/service-orders"
    />
  )
}
