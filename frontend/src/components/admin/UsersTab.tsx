import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { api } from '../../lib/api'
import { Plus, Edit2, Trash2, User, Shield, UserCheck } from 'lucide-react'
import toast from 'react-hot-toast'

interface User {
  id: string
  email: string
  name: string
  role: 'ADMIN' | 'JOURNALIST'
  createdAt: string
  updatedAt: string
}

export default function UsersTab() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRole, setSelectedRole] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const queryClient = useQueryClient()

  // Fetch users
  const { data: usersData, isLoading } = useQuery(
    ['users', searchTerm, selectedRole],
    async () => {
      const params = new URLSearchParams()
      if (searchTerm) params.append('search', searchTerm)
      if (selectedRole) params.append('role', selectedRole)
      
      const response = await api.get(`/users?${params.toString()}`)
      return response.data
    }
  )

  // Delete user mutation
  const deleteUserMutation = useMutation(
    (id: string) => api.delete(`/users/${id}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('users')
        toast.success('User deleted successfully')
      },
      onError: (error: any) => {
        const errorMessage = error.response?.data?.error || 'Failed to delete user'
        toast.error(errorMessage)
      }
    }
  )

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      deleteUserMutation.mutate(id)
    }
  }

  const getRoleIcon = (role: string) => {
    return role === 'ADMIN' ? <Shield className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />
  }

  const getRoleColor = (role: string) => {
    return role === 'ADMIN' 
      ? 'bg-red-100 text-red-800' 
      : 'bg-blue-100 text-blue-800'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Users</h2>
          <p className="text-gray-600">Manage system users and permissions</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Add User</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search
            </label>
            <input
              type="text"
              placeholder="Search by name or email..."
              className="input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Role
            </label>
            <select
              className="input"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
            >
              <option value="">All Roles</option>
              <option value="ADMIN">Admin</option>
              <option value="JOURNALIST">Journalist</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setSearchTerm('')
                setSelectedRole('')
              }}
              className="btn btn-secondary w-full"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading users...</div>
        ) : usersData?.users?.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <User className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p>No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {usersData?.users?.map((user: User) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                            <User className="h-5 w-5 text-primary-600" />
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {user.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                        {getRoleIcon(user.role)}
                        <span className="ml-1">{user.role}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => setEditingUser(user)}
                          className="text-primary-600 hover:text-primary-900"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(user.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || editingUser) && (
        <UserModal
          user={editingUser}
          onClose={() => {
            setShowCreateModal(false)
            setEditingUser(null)
          }}
        />
      )}
    </div>
  )
}

function UserModal({ 
  user, 
  onClose 
}: { 
  user: User | null
  onClose: () => void 
}) {
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    role: user?.role || 'JOURNALIST'
  })

  const queryClient = useQueryClient()

  const createMutation = useMutation(
    (data: any) => api.post('/auth/register', data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('users')
        toast.success('User created successfully')
        onClose()
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.error || 'Failed to create user')
      }
    }
  )

  const updateMutation = useMutation(
    (data: any) => api.put(`/users/${user?.id}`, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('users')
        toast.success('User updated successfully')
        onClose()
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.error || 'Failed to update user')
      }
    }
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (user) {
      updateMutation.mutate(formData)
    } else {
      // For new users, we need to include a password
      const password = prompt('Enter password for new user:')
      if (!password) return
      
      createMutation.mutate({ ...formData, password })
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {user ? 'Edit User' : 'Create User'}
          </h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name *
              </label>
              <input
                type="text"
                required
                className="input"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email *
              </label>
              <input
                type="email"
                required
                className="input"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role
              </label>
              <select
                className="input"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              >
                <option value="JOURNALIST">Journalist</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMutation.isLoading || updateMutation.isLoading}
                className="btn btn-primary"
              >
                {createMutation.isLoading || updateMutation.isLoading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
