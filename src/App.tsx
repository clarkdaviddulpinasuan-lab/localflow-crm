import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { BusinessProvider } from '@/contexts/BusinessContext'
import { AppRoutes } from '@/AppRoutes'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <BusinessProvider>
          <AppRoutes />
        </BusinessProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
