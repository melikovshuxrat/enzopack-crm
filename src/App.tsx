import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { IntroOverlay } from './components/intro/IntroOverlay'
import { DashboardPage } from './pages/DashboardPage'
import { OrdersPage } from './pages/OrdersPage'
import { OrderCalculatorPage } from './pages/OrderCalculatorPage'
import { ClientsPage } from './pages/ClientsPage'
import { RawMaterialsPage } from './pages/RawMaterialsPage'
import { FinishedProductsPage } from './pages/FinishedProductsPage'
import { SuppliersPage } from './pages/SuppliersPage'
import { EmployeesPage } from './pages/EmployeesPage'
import { FinancePage } from './pages/FinancePage'
import { ProductionSettingsPage } from './pages/ProductionSettingsPage'

export default function App() {
  return (
    <HashRouter>
      <IntroOverlay />
      <AppLayout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/orders/new" element={<OrderCalculatorPage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/materials" element={<RawMaterialsPage />} />
          <Route path="/products" element={<FinishedProductsPage />} />
          <Route path="/suppliers" element={<SuppliersPage />} />
          <Route path="/employees" element={<EmployeesPage />} />
          <Route path="/finance" element={<FinancePage />} />
          <Route path="/production-settings" element={<ProductionSettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppLayout>
    </HashRouter>
  )
}
