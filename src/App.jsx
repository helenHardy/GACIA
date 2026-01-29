import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import Inventory from './pages/Inventory'
import Branches from './pages/Branches'
import POS from './pages/POS'
import Users from './pages/Users'
import Settings from './pages/Settings'
import Suppliers from './pages/Suppliers'
import Purchases from './pages/Purchases'
import Transfers from './pages/Transfers'
import Reports from './pages/Reports'
import Customers from './pages/Customers'
import Sales from './pages/Sales'
import Quotations from './pages/Quotations'
import Classifications from './pages/Classifications'
import { Loader2 } from 'lucide-react'

// Componente para proteger rutas mas complejo si se requiere roles
const ProtectedRoute = ({ children, session }) => {
  if (!session) {
    return <Navigate to="/login" replace />
  }
  return children
}

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Verificar sesión inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    // Escuchar cambios en la autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'hsl(var(--background))' }}>
        <Loader2 size={48} className="animate-spin" style={{ color: 'hsl(var(--primary))' }} />
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!session ? <Login /> : <Navigate to="/" replace />} />

        <Route path="/" element={
          <ProtectedRoute session={session}>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Dashboard />} />
          <Route path="pos" element={<POS />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="branches" element={<Branches />} />
          <Route path="users" element={<Users />} />
          <Route path="suppliers" element={<Suppliers />} />
          <Route path="purchases" element={<Purchases />} />
          <Route path="transfers" element={<Transfers />} />
          <Route path="reports" element={<Reports />} />
          <Route path="customers" element={<Customers />} />
          <Route path="sales" element={<Sales />} />
          <Route path="quotations" element={<Quotations />} />
          <Route path="classifications" element={<Classifications />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
