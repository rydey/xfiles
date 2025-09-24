import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { LogOut, Search, Download } from 'lucide-react'
import { useQuery } from 'react-query'
import { api } from '../lib/api'
import toast from 'react-hot-toast'

interface Contact {
  id: string
  name?: string
  phoneNumber: string
  category?: {
    id: string
    name: string
    color?: string
  }
  isGroup: boolean
  _count: {
    messages: number
  }
}

export default function JournalistPortal() {
  const { user, logout } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)

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

  const handleExportMessages = async (contactId: string) => {
    try {
      const response = await api.get(`/messages/export/${contactId}?format=csv`, {
        responseType: 'blob'
      })
      
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `messages-${contactId}.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      
      toast.success('Messages exported successfully!')
    } catch (error) {
      toast.error('Failed to export messages')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                Journalist Portal
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Welcome, {user?.username}
              </span>
              <button
                onClick={logout}
                className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search contacts by name or phone number..."
                  className="input pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="sm:w-64">
              <select
                className="input"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="">All Categories</option>
                {categories.map((category: any) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Contacts List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">Contacts</h2>
                <p className="text-sm text-gray-600">
                  {contactsData?.pagination?.total || 0} contacts found
                </p>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {isLoading ? (
                  <div className="p-6 text-center text-gray-500">Loading...</div>
                ) : contactsData?.contacts?.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">No contacts found</div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {contactsData?.contacts?.map((contact: Contact) => (
                      <div
                        key={contact.id}
                        className={`p-4 hover:bg-gray-50 cursor-pointer ${
                          selectedContact?.id === contact.id ? 'bg-primary-50 border-r-2 border-primary-500' : ''
                        }`}
                        onClick={() => setSelectedContact(contact)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {contact.name || contact.phoneNumber}
                            </p>
                            {contact.name && (
                              <p className="text-sm text-gray-500 truncate">
                                {contact.phoneNumber}
                              </p>
                            )}
                            {contact.category && (
                              <span
                                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-1"
                                style={{
                                  backgroundColor: contact.category.color ? `${contact.category.color}20` : '#f3f4f6',
                                  color: contact.category.color || '#374151'
                                }}
                              >
                                {contact.category.name}
                              </span>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-500">
                              {contact._count.messages} messages
                            </p>
                            {contact.isGroup && (
                              <span className="text-xs text-blue-600">Group</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="lg:col-span-2">
            {selectedContact ? (
              <ContactMessages 
                contact={selectedContact} 
                onExport={() => handleExportMessages(selectedContact.id)}
              />
            ) : (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                <div className="mx-auto h-12 w-12 text-gray-400">💬</div>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No contact selected</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Select a contact to view their messages
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ContactMessages({ contact, onExport }: { contact: Contact; onExport: () => void }) {
  const { data: messagesData, isLoading } = useQuery(
    ['messages', contact.id],
    async () => {
      const response = await api.get(`/messages?contactId=${contact.id}&limit=100`)
      return response.data
    }
  )

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium text-gray-900">
              {contact.name || contact.phoneNumber}
            </h2>
            {contact.name && (
              <p className="text-sm text-gray-500">{contact.phoneNumber}</p>
            )}
          </div>
          <button
            onClick={onExport}
            className="flex items-center space-x-2 btn btn-primary"
          >
            <Download className="h-4 w-4" />
            <span>Export</span>
          </button>
        </div>
      </div>
      
      <div className="max-h-96 overflow-y-auto">
        {isLoading ? (
          <div className="p-6 text-center text-gray-500">Loading messages...</div>
        ) : messagesData?.messages?.length === 0 ? (
          <div className="p-6 text-center text-gray-500">No messages found</div>
        ) : (
          <div className="divide-y divide-gray-200">
            {messagesData?.messages?.map((message: any) => (
              <div key={message.id} className="p-4">
                <div className="flex items-start space-x-3">
                  <div className={`flex-shrink-0 w-2 h-2 rounded-full mt-2 ${
                    message.direction === 'INCOMING' ? 'bg-green-400' : 'bg-blue-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900">
                        {message.direction === 'INCOMING' ? 'Incoming' : 'Outgoing'} {message.type}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(message.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">
                      {message.content}
                    </p>
                    {(message.senderName || message.receiverName) && (
                      <p className="mt-1 text-xs text-gray-500">
                        {message.direction === 'INCOMING' 
                          ? `From: ${message.senderName || 'Unknown'}`
                          : `To: ${message.receiverName || 'Unknown'}`
                        }
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
