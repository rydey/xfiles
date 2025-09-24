import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { LogOut, Star, Tag, Plus, X, Save } from 'lucide-react'

interface Contact {
  id: string;
  name: string | null;
  phoneNumber: string;
  type: 'INDIVIDUAL' | 'GROUP';
  messageCount: number;
  isFeatured?: boolean;
}

interface Category {
  id: string;
  name: string;
  contactCount: number;
}

export default function AdminDashboard() {
  const { user, logout } = useAuth()
  const [activeTab, setActiveTab] = useState<'featured' | 'categories'>('featured')
  const [contacts, setContacts] = useState<Contact[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [contactSearchTerm, setContactSearchTerm] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch contacts
      const contactsResponse = await fetch('http://localhost:3001/api/contacts/public')
      if (!contactsResponse.ok) throw new Error('Failed to fetch contacts')
      const contactsData = await contactsResponse.json()
      setContacts(contactsData.contacts)

      // Fetch categories
      const categoriesResponse = await fetch('http://localhost:3001/api/categories/public')
      if (!categoriesResponse.ok) throw new Error('Failed to fetch categories')
      const categoriesData = await categoriesResponse.json()
      setCategories(categoriesData.categories)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleFeatured = async (contactId: string, isFeatured: boolean) => {
    try {
      // For now, we'll just update the local state
      // In a real app, you'd make an API call to update the database
      setContacts(prev => prev.map(contact => 
        contact.id === contactId 
          ? { ...contact, isFeatured: !isFeatured }
          : contact
      ))
    } catch (e: any) {
      setError(`Failed to update featured status: ${e.message}`)
    }
  }

  const addCategory = async () => {
    if (!newCategoryName.trim()) return
    
    try {
      const response = await fetch('http://localhost:3001/api/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ name: newCategoryName.trim() })
      })
      
      if (!response.ok) throw new Error('Failed to create category')
      
      setNewCategoryName('')
      setShowAddCategory(false)
      fetchData() // Refresh data
    } catch (e: any) {
      setError(`Failed to create category: ${e.message}`)
    }
  }

  const deleteCategory = async (categoryId: string) => {
    if (!confirm('Are you sure you want to delete this category?')) return
    
    try {
      const response = await fetch(`http://localhost:3001/api/categories/${categoryId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      
      if (!response.ok) throw new Error('Failed to delete category')
      
      fetchData() // Refresh data
    } catch (e: any) {
      setError(`Failed to delete category: ${e.message}`)
    }
  }

  const tabs = [
    { id: 'featured', label: 'Featured Contacts', icon: Star },
    { id: 'categories', label: 'Categories', icon: Tag },
  ] as const

  const renderTabContent = () => {
    switch (activeTab) {
      case 'featured':
        return <FeaturedContactsTab 
          contacts={contacts} 
          onToggleFeatured={toggleFeatured}
          searchTerm={contactSearchTerm}
          setSearchTerm={setContactSearchTerm}
          loading={loading}
          error={error}
        />
      case 'categories':
        return <CategoriesTab 
          categories={categories}
          newCategoryName={newCategoryName}
          setNewCategoryName={setNewCategoryName}
          showAddCategory={showAddCategory}
          setShowAddCategory={setShowAddCategory}
          onAddCategory={addCategory}
          onDeleteCategory={deleteCategory}
          loading={loading}
          error={error}
        />
      default:
        return <FeaturedContactsTab 
          contacts={contacts} 
          onToggleFeatured={toggleFeatured}
          searchTerm={contactSearchTerm}
          setSearchTerm={setContactSearchTerm}
          loading={loading}
          error={error}
        />
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
                Admin Dashboard
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
        {/* Navigation Tabs */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as 'featured' | 'categories')}
                  className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </nav>
        </div>

        {/* Tab Content */}
        {renderTabContent()}
      </div>
    </div>
  )
}

// Featured Contacts Tab Component
function FeaturedContactsTab({ 
  contacts, 
  onToggleFeatured, 
  searchTerm,
  setSearchTerm,
  loading, 
  error 
}: { 
  contacts: Contact[]
  onToggleFeatured: (contactId: string, isFeatured: boolean) => void
  searchTerm: string
  setSearchTerm: (term: string) => void
  loading: boolean
  error: string | null
}) {
  if (loading) return <div className="text-center py-8">Loading contacts...</div>
  if (error) return <div className="text-center py-8 text-red-600">Error: {error}</div>

  // Filter and sort contacts
  const filteredContacts = contacts.filter(contact => {
    if (!searchTerm.trim()) return true
    
    const searchLower = searchTerm.toLowerCase()
    return (
      contact.name?.toLowerCase().includes(searchLower) ||
      contact.phoneNumber.includes(searchTerm) ||
      contact.phoneNumber.replace(/\D/g, '').includes(searchTerm.replace(/\D/g, ''))
    )
  })

  const sortedContacts = [...filteredContacts]
    .sort((a, b) => b.messageCount - a.messageCount)
    .slice(0, searchTerm.trim() ? filteredContacts.length : 20)

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Featured Contacts Management</h2>
            <p className="text-sm text-gray-600 mt-1">
              Search and manage contacts to feature on the home page
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <input
              type="text"
              placeholder="Search contacts by name or phone number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Results Summary */}
        <div className="mb-4">
          <p className="text-sm text-gray-600">
            {searchTerm.trim() 
              ? `Found ${sortedContacts.length} contacts matching "${searchTerm}"`
              : `Showing top ${sortedContacts.length} contacts by message count`
            }
          </p>
        </div>
        
        {sortedContacts.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">🔍</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm.trim() ? 'No contacts found' : 'No contacts available'}
            </h3>
            <p className="text-gray-500">
              {searchTerm.trim() 
                ? `No contacts match "${searchTerm}". Try a different search term.`
                : 'There are no contacts in the database.'
              }
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedContacts.map(contact => (
              <div 
                key={contact.id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-semibold text-sm">
                        {contact.name ? contact.name.charAt(0).toUpperCase() : '?'}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {contact.name || 'No name'}
                      </h3>
                      <p className="text-sm text-gray-500">{contact.phoneNumber}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => onToggleFeatured(contact.id, contact.isFeatured || false)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      contact.isFeatured 
                        ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {contact.isFeatured ? 'Featured' : 'Mark Featured'}
                  </button>
                </div>
                
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span>{contact.messageCount} messages</span>
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    contact.type === 'GROUP' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {contact.type}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Categories Tab Component
function CategoriesTab({ 
  categories,
  newCategoryName,
  setNewCategoryName,
  showAddCategory,
  setShowAddCategory,
  onAddCategory,
  onDeleteCategory,
  loading,
  error
}: { 
  categories: Category[]
  newCategoryName: string
  setNewCategoryName: (name: string) => void
  showAddCategory: boolean
  setShowAddCategory: (show: boolean) => void
  onAddCategory: () => void
  onDeleteCategory: (categoryId: string) => void
  loading: boolean
  error: string | null
}) {
  if (loading) return <div className="text-center py-8">Loading categories...</div>
  if (error) return <div className="text-center py-8 text-red-600">Error: {error}</div>

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Categories</h2>
          <button
            onClick={() => setShowAddCategory(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Category</span>
          </button>
        </div>

        {showAddCategory && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <input
                type="text"
                placeholder="Category name..."
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyPress={(e) => e.key === 'Enter' && onAddCategory()}
              />
              <button
                onClick={onAddCategory}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Save className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setShowAddCategory(false)
                  setNewCategoryName('')
                }}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map(category => (
            <div 
              key={category.id}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-gray-900">{category.name}</h3>
                <button
                  onClick={() => onDeleteCategory(category.id)}
                  className="text-red-500 hover:text-red-700 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-sm text-gray-500">
                {category.contactCount} contacts
              </p>
            </div>
          ))}
        </div>

        {categories.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No categories found. Add your first category above.
          </div>
        )}
      </div>
    </div>
  )
}
