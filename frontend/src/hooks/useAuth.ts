import { useState, useEffect } from 'react'
import { api } from '../lib/api'

interface User {
  id: number
  username: string
  role: 'ADMIN' | 'JOURNALIST'
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      setLoading(false)
      return
    }

    // Set token in API client
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`

    // Verify token and get user info
    api.get('/auth/me')
      .then(response => {
        setUser(response.data.user)
      })
      .catch(() => {
        localStorage.removeItem('token')
        delete api.defaults.headers.common['Authorization']
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  const login = async (username: string, password: string) => {
    try {
      const response = await api.post('/auth/login', { username, password })
      const { token, user } = response.data
      
      localStorage.setItem('token', token)
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
      setUser(user)
      
      console.log('Login successful, user set:', user)
      return { success: true }
    } catch (error: any) {
      console.error('Login failed:', error)
      return { 
        success: false, 
        error: error.response?.data?.error || 'Login failed' 
      }
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    delete api.defaults.headers.common['Authorization']
    setUser(null)
  }

  return { user, loading, login, logout }
}
