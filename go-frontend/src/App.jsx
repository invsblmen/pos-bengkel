import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import ProtectedRoute from '@components/ProtectedRoute'
import DashboardLayout from '@components/Layout/DashboardLayout'
import Dashboard from '@pages/Dashboard'
import Login from '@pages/Login'
import Unauthorized from '@pages/Unauthorized'
import AdminPanel from '@pages/AdminPanel'
import ServiceOrderIndex from '@pages/ServiceOrders/Index'
import ServiceOrderCreate from '@pages/ServiceOrders/Create'
import ServiceOrderShow from '@pages/ServiceOrders/Show'
import ServiceOrderEdit from '@pages/ServiceOrders/Edit'
import PartSaleIndex from '@pages/PartSales/Index'
import PartSaleCreate from '@pages/PartSales/Create'
import PartSaleShow from '@pages/PartSales/Show'
import PartSaleEdit from '@pages/PartSales/Edit'
import PartPurchaseIndex from '@pages/PartPurchases/Index'
import PartPurchaseCreate from '@pages/PartPurchases/Create'
import PartPurchaseShow from '@pages/PartPurchases/Show'
import PartPurchaseEdit from '@pages/PartPurchases/Edit'
import AppointmentIndex from '@pages/Appointments/Index'
import AppointmentShow from '@pages/Appointments/Show'
import VehicleIndex from '@pages/Vehicles/Index'
import VehicleShow from '@pages/Vehicles/Show'

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/unauthorized" element={<Unauthorized />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
              <Route index element={<Dashboard />} />

              <Route element={<ProtectedRoute requiredPermissions={['users-access', 'roles-access', 'permissions-access']} />}>
                <Route path="admin" element={<AdminPanel />} />
              </Route>

              <Route element={<ProtectedRoute requiredPermissions={['service-orders-access']} />}>
                <Route path="service-orders" element={<ServiceOrderIndex />} />
                <Route path="service-orders/create" element={<ServiceOrderCreate />} />
                <Route path="service-orders/:id" element={<ServiceOrderShow />} />
                <Route path="service-orders/:id/edit" element={<ServiceOrderEdit />} />
              </Route>

              <Route element={<ProtectedRoute requiredPermissions={['part-sales-access']} />}>
                <Route path="part-sales" element={<PartSaleIndex />} />
                <Route path="part-sales/create" element={<PartSaleCreate />} />
                <Route path="part-sales/:id" element={<PartSaleShow />} />
                <Route path="part-sales/:id/edit" element={<PartSaleEdit />} />
              </Route>

              <Route element={<ProtectedRoute requiredPermissions={['part-purchases-access']} />}>
                <Route path="part-purchases" element={<PartPurchaseIndex />} />
                <Route path="part-purchases/create" element={<PartPurchaseCreate />} />
                <Route path="part-purchases/:id" element={<PartPurchaseShow />} />
                <Route path="part-purchases/:id/edit" element={<PartPurchaseEdit />} />
              </Route>

              <Route element={<ProtectedRoute requiredPermissions={['appointments-access']} />}>
                <Route path="appointments" element={<AppointmentIndex />} />
                <Route path="appointments/:id" element={<AppointmentShow />} />
              </Route>

              <Route element={<ProtectedRoute requiredPermissions={['vehicles-access']} />}>
                <Route path="vehicles" element={<VehicleIndex />} />
                <Route path="vehicles/:id" element={<VehicleShow />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App
