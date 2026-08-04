import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AppLayout } from '@/components/layout/AppLayout'
import { Login } from '@/pages/Login'
import { Dashboard } from '@/pages/Dashboard'
import { Movimentacoes } from '@/pages/Movimentacoes'
import { RegistrarEntrada } from '@/pages/RegistrarEntrada'
import { VeiculoDetalhe } from '@/pages/VeiculoDetalhe'
import { Clientes } from '@/pages/Clientes'
import { ClienteDetalhe } from '@/pages/ClienteDetalhe'
import { Relatorios } from '@/pages/Relatorios'
import { NovaInspecao } from '@/pages/inspecao/NovaInspecao'
import { Configuracoes } from '@/pages/Configuracoes'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/movimentacoes" element={<Movimentacoes />} />
            <Route path="/movimentacoes/nova" element={<RegistrarEntrada />} />
            <Route path="/veiculos/:id" element={<VeiculoDetalhe />} />
            <Route path="/clientes" element={<Clientes />} />
            <Route path="/clientes/:id" element={<ClienteDetalhe />} />
            <Route path="/relatorios" element={<Relatorios />} />
            <Route path="/inspecoes/nova" element={<NovaInspecao />} />
            <Route path="/configuracoes" element={<Configuracoes />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
