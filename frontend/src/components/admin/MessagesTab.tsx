import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { api } from '../../lib/api'
import { Plus, Edit2, Trash2, MessageSquare, Phone, Mail, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

interface Message {
  id: number
  content?: string
  messageType: 'SMS' | 'INSTANT'
  direction: 'FROM' | 'TO' | 'UNKNOWN'
  timestamp: string
  sender?: {
    id: number
    name?: string
    phoneNumber: string
  }
  receiver?: {
    id: number
    name?: string
    phoneNumber: string
  }
  attachment?: string
  location?: string
  rawLine?: string
}

export default function MessagesTab() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedType, setSelectedType] = useState('')
  const [selectedDirection, setSelectedDirection] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingMessage, setEditingMessage] = useState<Message | null>(null)

  const queryClient = useQueryClient()

  // Fetch messages
  const { data: messagesData, isLoading } = useQuery(
    ['messages', searchTerm, selectedType, selectedDirection, dateFrom, dateTo],
    async () => {
      const params = new URLSearchParams()
      if (searchTerm) params.append('search', searchTerm)
      if (selectedType) params.append('type', selectedType)
      if (selectedDirection) params.append('direction', selectedDirection)
      if (dateFrom) params.append('dateFrom', dateFrom)
      if (dateTo) params.append('dateTo', dateTo)
      
      const response = await api.get(`/messages?${params.toString()}`)
      return response.data
    }
  )

  // Delete message mutation
  const deleteMessageMutation = useMutation(
    (id: string) => api.delete(`/messages/${id}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('messages')
        toast.success('Message deleted successfully')
      },
      onError: () => {
        toast.error('Failed to delete message')
      }
    }
  )

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this message?')) {
      deleteMessageMutation.mutate(id)
    }
  }

  const getMessageIcon = (type: string) => {
    switch (type) {
      case 'SMS':
        return <MessageSquare className="h-4 w-4" />
      case 'INSTANT':
        return <MessageSquare className="h-4 w-4" />
      default:
        return <MessageSquare className="h-4 w-4" />
    }
  }

  const getMessageTypeColor = (type: string) => {
    switch (type) {
      case 'SMS':
        return 'bg-blue-100 text-blue-800'
      case 'INSTANT':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Messages</h2>
          <p className="text-gray-600">View and manage all messages</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Add Message</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Content
            </label>
            <input
              type="text"
              placeholder="Search message content..."
              className="input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type
            </label>
              <select
                className="input"
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
              >
                <option value="">All Types</option>
                <option value="SMS">SMS</option>
                <option value="INSTANT">Instant</option>
              </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Direction
            </label>
              <select
                className="input"
                value={selectedDirection}
                onChange={(e) => setSelectedDirection(e.target.value)}
              >
                <option value="">All Directions</option>
                <option value="FROM">From</option>
                <option value="TO">To</option>
                <option value="UNKNOWN">Unknown</option>
              </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              From Date
            </label>
            <input
              type="date"
              className="input"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              To Date
            </label>
            <input
              type="date"
              className="input"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={() => {
              setSearchTerm('')
              setSelectedType('')
              setSelectedDirection('')
              setDateFrom('')
              setDateTo('')
            }}
            className="btn btn-secondary"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Messages List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading messages...</div>
        ) : !messagesData?.messages || messagesData.messages.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <MessageSquare className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p>No messages found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {messagesData.messages.map((message: Message) => (
              <div key={message.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-start space-x-4">
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    message.direction === 'FROM' ? 'bg-green-100' : 'bg-blue-100'
                  }`}>
                    {getMessageIcon(message.messageType)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getMessageTypeColor(message.messageType)}`}>
                          {message.messageType}
                        </span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          message.direction === 'FROM' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {message.direction}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setEditingMessage(message)}
                          className="text-primary-600 hover:text-primary-900"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(message.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    
                    <div className="mt-2">
                      <p className="text-sm text-gray-900">
                        <span className="font-medium">
                          {message.sender?.name || message.sender?.phoneNumber || message.receiver?.name || message.receiver?.phoneNumber || 'Unknown'}
                        </span>
                      </p>
                      <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">
                        {message.content || 'No content'}
                      </p>
                      {(message.sender || message.receiver) && (
                        <p className="mt-1 text-xs text-gray-500">
                          {message.direction === 'FROM' 
                            ? `From: ${message.sender?.name || message.sender?.phoneNumber || 'Unknown'}`
                            : `To: ${message.receiver?.name || message.receiver?.phoneNumber || 'Unknown'}`
                          }
                        </p>
                      )}
                    </div>
                    
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-xs text-gray-500">
                        {format(new Date(message.timestamp), 'MMM d, yyyy h:mm a')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || editingMessage) && (
        <MessageModal
          message={editingMessage}
          onClose={() => {
            setShowCreateModal(false)
            setEditingMessage(null)
          }}
        />
      )}
    </div>
  )
}

function MessageModal({ 
  message, 
  onClose 
}: { 
  message: Message | null
  onClose: () => void 
}) {
  const [formData, setFormData] = useState({
    content: message?.content || '',
    type: message?.type || 'SMS',
    direction: message?.direction || 'INCOMING',
    timestamp: message?.timestamp ? new Date(message.timestamp).toISOString().slice(0, 16) : '',
    contactId: message?.contact.id || '',
    senderName: message?.senderName || '',
    receiverName: message?.receiverName || ''
  })

  const queryClient = useQueryClient()

  // Fetch contacts for dropdown
  const { data: contactsData } = useQuery('contacts', async () => {
    const response = await api.get('/contacts')
    return response.data
  })

  const createMutation = useMutation(
    (data: any) => api.post('/messages', data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('messages')
        toast.success('Message created successfully')
        onClose()
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.error || 'Failed to create message')
      }
    }
  )

  const updateMutation = useMutation(
    (data: any) => api.put(`/messages/${message?.id}`, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('messages')
        toast.success('Message updated successfully')
        onClose()
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.error || 'Failed to update message')
      }
    }
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const submitData = {
      ...formData,
      timestamp: new Date(formData.timestamp).toISOString()
    }
    
    if (message) {
      updateMutation.mutate(submitData)
    } else {
      createMutation.mutate(submitData)
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {message ? 'Edit Message' : 'Create Message'}
          </h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Content *
              </label>
              <textarea
                required
                className="input"
                rows={4}
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type
                </label>
                <select
                  className="input"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                >
                  <option value="SMS">SMS</option>
                  <option value="CALL">Call</option>
                  <option value="EMAIL">Email</option>
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Direction
                </label>
                <select
                  className="input"
                  value={formData.direction}
                  onChange={(e) => setFormData({ ...formData, direction: e.target.value })}
                >
                  <option value="INCOMING">Incoming</option>
                  <option value="OUTGOING">Outgoing</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact *
              </label>
              <select
                required
                className="input"
                value={formData.contactId}
                onChange={(e) => setFormData({ ...formData, contactId: e.target.value })}
              >
                <option value="">Select a contact</option>
                {contactsData?.contacts?.map((contact: any) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.name || contact.phoneNumber}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Timestamp *
              </label>
              <input
                type="datetime-local"
                required
                className="input"
                value={formData.timestamp}
                onChange={(e) => setFormData({ ...formData, timestamp: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sender Name
                </label>
                <input
                  type="text"
                  className="input"
                  value={formData.senderName}
                  onChange={(e) => setFormData({ ...formData, senderName: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Receiver Name
                </label>
                <input
                  type="text"
                  className="input"
                  value={formData.receiverName}
                  onChange={(e) => setFormData({ ...formData, receiverName: e.target.value })}
                />
              </div>
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
