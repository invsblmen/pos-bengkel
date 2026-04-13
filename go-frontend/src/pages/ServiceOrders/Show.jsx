import ModuleScaffold from '@components/Parity/ModuleScaffold'

export default function ServiceOrderShow() {
  return (
    <ModuleScaffold
      title="Service Order Detail"
      subtitle="Parity detail + timeline + actions (print/status/warranty) akan diisi setelah baseline data fetch stabil."
      entityName="service_orders"
      basePath="/service-orders"
    />
  )
}
