import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { MessageSquare, Phone, Tag, Users as UsersIcon, User as UserIcon } from 'lucide-react'

interface Message {
  id: string
  messageType: 'SMS' | 'INSTANT'
  direction: 'FROM' | 'TO' | 'UNKNOWN'
  timestamp: string
  content?: string
  attachment?: string
  location?: string
  sender?: {
    id: number
    name?: string
    phoneNumber: string
    type: 'INDIVIDUAL' | 'GROUP'
    categories: {
      category: {
        id: number
        name: string
      }
    }[]
  }
  receiver?: {
    id: number
    name?: string
    phoneNumber: string
    type: 'INDIVIDUAL' | 'GROUP'
    categories: {
      category: {
        id: number
        name: string
      }
    }[]
  }
  rawLine?: string
  createdAt: string
  updatedAt: string
}

export default function TestPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    fetchMessages()
  }, [])

  const fetchMessages = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch messages from public endpoint (no authentication required)
      const response = await api.get('/messages/public', {
        params: {
          limit: 10000 // Get a large number of messages
        }
      })
      
      setMessages(response.data.messages || [])
    } catch (err: any) {
      console.error('Error fetching messages:', err)
      setError(err.response?.data?.error || 'Failed to fetch messages')
    } finally {
      setLoading(false)
    }
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })
  }

  const getDirectionColor = (direction: string) => {
    switch (direction) {
      case 'FROM':
        return 'bg-green-100 text-green-800'
      case 'TO':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getMessageTypeIcon = (type: string) => {
    switch (type) {
      case 'SMS':
        return <MessageSquare className="h-4 w-4 text-blue-600" />
      case 'INSTANT':
        return <MessageSquare className="h-4 w-4 text-purple-600" />
      default:
        return <MessageSquare className="h-4 w-4 text-gray-600" />
    }
  }

  const getContactInfo = (message: Message) => {
    if (message.direction === 'FROM' && message.sender) {
      return {
        phoneNumber: message.sender.phoneNumber,
        name: message.sender.name,
        type: message.sender.type,
        categories: message.sender.categories
      }
    } else if (message.direction === 'TO' && message.receiver) {
      return {
        phoneNumber: message.receiver.phoneNumber,
        name: message.receiver.name,
        type: message.receiver.type,
        categories: message.receiver.categories
      }
    } else if (message.sender) {
      return {
        phoneNumber: message.sender.phoneNumber,
        name: message.sender.name,
        type: message.sender.type,
        categories: message.sender.categories
      }
    } else if (message.receiver) {
      return {
        phoneNumber: message.receiver.phoneNumber,
        name: message.receiver.name,
        type: message.receiver.type,
        categories: message.receiver.categories
      }
    }
    return null
  }

  const sortedMessages = [...messages].sort((a, b) => {
    const dateA = new Date(a.timestamp).getTime()
    const dateB = new Date(b.timestamp).getTime()
    return sortOrder === 'asc' ? dateA - dateB : dateB - dateA
  })

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-lg font-medium text-gray-700">Loading messages...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-100 text-red-800 p-4">
        <div className="text-lg font-medium">❌ Error: {error}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Messages Database</h1>
            <p className="text-sm text-gray-600 mt-1">
              Total: {messages.length.toLocaleString()} messages
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <a 
              href="/contacts" 
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <UsersIcon className="w-4 h-4" />
              View Contacts
            </a>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Sort: {sortOrder === 'asc' ? 'Oldest First' : 'Newest First'}
            </button>
          </div>
        </div>

        {/* Messages Table */}
        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date & Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    From/To Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Message Content
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Individual/Group
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedMessages.map((message) => {
                  const contactInfo = getContactInfo(message)
                  return (
                    <tr key={message.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDateTime(message.timestamp)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getDirectionColor(message.direction)}`}>
                            {message.direction}
                          </span>
                          <span className="text-sm font-medium text-gray-900">
                            {contactInfo?.phoneNumber || 'Unknown'}
                          </span>
                          {contactInfo?.name && (
                            <span className="text-sm text-gray-500">
                              ({contactInfo.name})
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 max-w-md">
                        <div className="flex items-start space-x-2">
                          {getMessageTypeIcon(message.messageType)}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-900 break-words">
                              {message.content || 'No content'}
                            </p>
                            {message.attachment && (
                              <p className="text-xs text-gray-500 mt-1">
                                📎 {message.attachment}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {contactInfo ? (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            contactInfo.type === 'GROUP'
                              ? 'bg-blue-100 text-blue-800' 
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {contactInfo.type === 'GROUP' ? 'Group' : 'Individual'}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-500">Unknown</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {contactInfo?.categories && contactInfo.categories.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {contactInfo.categories.map((cat, index) => (
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
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}