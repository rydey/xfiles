import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Login from './pages/Login'
import AdminDashboard from './pages/AdminDashboard'
import JournalistPortal from './pages/JournalistPortal'
import TestPage from './pages/TestPage'
import ContactsTestPage from './pages/ContactsTestPage'
import HomePage from './pages/HomePage'
import ChatLogPage from './pages/ChatLogPage'
import MessageCorrectionPage from './pages/MessageCorrectionPage'
import LoadingSpinner from './components/LoadingSpinner'

function App() {
  const { user, loading } = useAuth()

  console.log('App render - user:', user, 'loading:', loading)

  if (loading) {
    return <LoadingSpinner />
  }

  if (!user) {
    return <Login />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Routes>
        <Route
          path="/"
          element={<Navigate to="/home" replace />}
        />
        <Route
          path="/admin"
          element={
            user.role === 'ADMIN'
              ? <AdminDashboard />
              : <Navigate to="/journalist" replace />
          }
        />
        <Route
          path="/journalist"
          element={<JournalistPortal />}
        />
        <Route path="/home" element={<HomePage />} />
        <Route path="/chat/:contactId" element={<ChatLogPage />} />
        <Route path="/correct" element={<MessageCorrectionPage />} />
        <Route path="/test" element={<TestPage />} />
        <Route path="/contacts" element={<ContactsTestPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

export default App