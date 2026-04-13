export function buildMenu(canAny) {
  return [
    {
      title: 'Overview',
      items: [
        { title: 'Dashboard', path: '/', permissions: ['dashboard-access'] },
      ],
    },
    {
      title: 'Data Master',
      items: [
        { title: 'Sparepart', permissions: ['parts-access'] },
        { title: 'Layanan', permissions: ['services-access'] },
        { title: 'Mekanik', permissions: ['mechanics-access'] },
        { title: 'Pelanggan', permissions: ['customers-access'] },
        { title: 'Kendaraan', permissions: ['vehicles-access'] },
        { title: 'Supplier', permissions: ['suppliers-access'] },
      ],
    },
    {
      title: 'Transaksi',
      items: [
        { title: 'Service Orders', path: '/service-orders', permissions: ['service-orders-access'] },
        { title: 'Penerimaan Cepat', path: '/service-orders/create', permissions: ['service-orders-create'] },
        { title: 'Penjualan Sparepart', path: '/part-sales', permissions: ['part-sales-access'] },
        { title: 'Pembelian Sparepart', path: '/part-purchases', permissions: ['part-purchases-access'] },
        { title: 'Appointment', permissions: ['appointments-access'] },
      ],
    },
    {
      title: 'Operasional',
      items: [
        { title: 'Stock Movement', permissions: ['part-stock-history-access', 'parts-stock-access'] },
        { title: 'Akuntansi Kas', permissions: ['cash-management-access'] },
      ],
    },
    {
      title: 'Laporan',
      items: [
        { title: 'Laporan Bengkel', permissions: ['reports-access'] },
      ],
    },
    {
      title: 'Administrasi',
      items: [
        { title: 'Admin Panel', path: '/admin', permissions: ['users-access', 'roles-access', 'permissions-access'] },
      ],
    },
  ]
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => canAny(item.permissions)),
    }))
    .filter((section) => section.items.length > 0)
}
