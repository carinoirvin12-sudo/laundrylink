import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom'

import AppLayout from './layouts/AppLayout'

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
        <Route
          path="/"
          element={<Navigate to="/dashboard" replace />}
        />

        <Route element={<AppLayout />}>
          <Route
            path="/dashboard"
            element={<Dashboard />}
          />

          {/* IMPORTANT: NEW must be before :id */}
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

        <Route
          path="*"
          element={<Navigate to="/dashboard" replace />}
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App