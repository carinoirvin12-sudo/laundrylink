
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom'

import AppLayout from './layouts/AppLayout'
import Landing from './pages/Landing/Landing'
import Dashboard from './pages/Dashboard/Dashboard'
import Orders from './pages/Orders/Orders'
import NewOrder from './pages/NewOrder/NewOrder'
import OrderDetails from './pages/OrderDetails/OrderDetails'
import Customers from './pages/Customers/Customers'
import CustomerDetails from './pages/CustomerDetails/CustomerDetails'
import Machines from './pages/Machines/Machines'
import Services from './pages/Services/Services'
import OverduePickups from './pages/OverduePickups/OverduePickups'
import Reports from './pages/Reports/Reports'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* PUBLIC LANDING PAGE */}
        <Route
          path="/"
          element={<Landing />}
        />

        {/* MANAGEMENT SYSTEM PAGES */}
        <Route element={<AppLayout />}>
          <Route
            path="/dashboard"
            element={<Dashboard />}
          />

          <Route
            path="/orders"
            element={<Orders />}
          />

          <Route
            path="/orders/new"
            element={<NewOrder />}
          />

          <Route
            path="/orders/:id"
            element={<OrderDetails />}
          />

          <Route
            path="/customers"
            element={<Customers />}
          />

          <Route
            path="/customers/:id"
            element={<CustomerDetails />}
          />

          <Route
            path="/machines"
            element={<Machines />}
          />

          <Route
            path="/services"
            element={<Services />}
          />

          <Route
            path="/overdue"
            element={<OverduePickups />}
          />

          <Route
            path="/reports"
            element={<Reports />}
          />
        </Route>

        {/* UNKNOWN ROUTES */}
        <Route
          path="*"
          element={<Navigate to="/" replace />}
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
