import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { api } from '../../lib/api'
import { Plus, Edit2, Trash2, Users, Phone, Tag } from 'lucide-react'
import toast from 'react-hot-toast'

interface Contact {
  id: number
  name?: string
  phoneNumber: string
  type: 'INDIVIDUAL' | 'GROUP'
  notes?: string
  categories: {
    category: {
      id: number
      name: string
    }
  }[]
  _count: {
    sentMessages: number
    receivedMessages: number
  }
}

interface Category {
  id: number
  name: string
}

export default function ContactsTab() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const queryClient = useQueryClient()

  // Fetch categories
  const { data: categories = [] } = useQuery('categories', async () => {
    const response = await api.get('/categories')
    return response.data
  })

  // Fetch contacts
  const { data: contactsData, isLoading } = useQuery(
    ['contacts', searchTerm, selectedCategory],
    async () => {
      const params = new URLSearchParams()
      if (searchTerm) params.append('search', searchTerm)
      if (selectedCategory) params.append('categoryId', selectedCategory)
      
      const response = await api.get(`/contacts?${params.toString()}`)
      return response.data
    }
  )

  // Delete contact mutation
  const deleteContactMutation = useMutation(
    (id: string) => api.delete(`/contacts/${id}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('contacts')
        toast.success('Contact deleted successfully')
      },
      onError: () => {
        toast.error('Failed to delete contact')
      }
    }
  )

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this contact?')) {
      deleteContactMutation.mutate(id)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Contacts</h2>
          <p className="text-gray-600">Manage contacts and their categories</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Add Contact</span>
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
              placeholder="Search by name or phone..."
              className="input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category
            </label>
            <select
              className="input"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="">All Categories</option>
              {categories.map((category: Category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setSearchTerm('')
                setSelectedCategory('')
              }}
              className="btn btn-secondary w-full"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Contacts Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading contacts...</div>
        ) : !contactsData?.contacts || contactsData.contacts.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p>No contacts found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Messages
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {contactsData.contacts.map((contact: Contact) => (
                  <tr key={contact.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                            <Phone className="h-5 w-5 text-primary-600" />
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {contact.name || 'Unknown'}
                          </div>
                          <div className="text-sm text-gray-500">
                            {contact.phoneNumber}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {contact.categories && contact.categories.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {contact.categories.map((cat, index) => (
                            <span
                              key={cat.category.id}
                              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                            >
                              <Tag className="h-3 w-3 mr-1" />
                              {cat.category.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">No category</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        contact.type === 'GROUP'
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {contact.type === 'GROUP' ? 'Group' : 'Individual'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {contact._count.sentMessages + contact._count.receivedMessages}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => setEditingContact(contact)}
                          className="text-primary-600 hover:text-primary-900"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(contact.id)}
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
      {(showCreateModal || editingContact) && (
        <ContactModal
          contact={editingContact}
          categories={categories}
          onClose={() => {
            setShowCreateModal(false)
            setEditingContact(null)
          }}
        />
      )}
    </div>
  )
}

function ContactModal({ 
  contact, 
  categories, 
  onClose 
}: { 
  contact: Contact | null
  categories: Category[]
  onClose: () => void 
}) {
  const [formData, setFormData] = useState({
    phoneNumber: contact?.phoneNumber || '',
    name: contact?.name || '',
    categoryIds: contact?.categories?.map(c => c.category.id) || [],
    type: contact?.type || 'INDIVIDUAL',
    notes: contact?.notes || ''
  })

  const queryClient = useQueryClient()

  const createMutation = useMutation(
    (data: any) => api.post('/contacts', data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('contacts')
        toast.success('Contact created successfully')
        onClose()
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.error || 'Failed to create contact')
      }
    }
  )

  const updateMutation = useMutation(
    (data: any) => api.put(`/contacts/${contact?.id}`, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('contacts')
        toast.success('Contact updated successfully')
        onClose()
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.error || 'Failed to update contact')
      }
    }
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (contact) {
      updateMutation.mutate(formData)
    } else {
      createMutation.mutate(formData)
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {contact ? 'Edit Contact' : 'Create Contact'}
          </h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number *
              </label>
              <input
                type="tel"
                required
                className="input"
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                type="text"
                className="input"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Categories
              </label>
              <div className="space-y-2">
                {categories.map((category) => (
                  <label key={category.id} className="flex items-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      checked={formData.categoryIds.includes(category.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({ ...formData, categoryIds: [...formData.categoryIds, category.id] })
                        } else {
                          setFormData({ ...formData, categoryIds: formData.categoryIds.filter(id => id !== category.id) })
                        }
                      }}
                    />
                    <span className="ml-2 text-sm text-gray-900">{category.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type
              </label>
              <select
                className="input"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as 'INDIVIDUAL' | 'GROUP' })}
              >
                <option value="INDIVIDUAL">Individual</option>
                <option value="GROUP">Group</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                className="input"
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
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
