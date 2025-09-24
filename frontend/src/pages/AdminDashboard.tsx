import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { LogOut, Star, Tag, Plus, X, Save } from 'lucide-react'
import { api } from '../lib/api'

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
  const [activeTab, setActiveTab] = useState<'featured' | 'categories' | 'edit'>('featured')
  const [contacts, setContacts] = useState<Contact[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [contactSearchTerm, setContactSearchTerm] = useState('')
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [editForm, setEditForm] = useState({
    name: '',
    phoneNumber: '',
    type: 'INDIVIDUAL' as 'INDIVIDUAL' | 'GROUP',
    categoryIds: [] as string[],
  })
  const [mergeTargetSearch, setMergeTargetSearch] = useState('')
  const [mergeTarget, setMergeTarget] = useState<Contact | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch contacts
      const contactsResponse = await api.get('/contacts/public')
      setContacts(contactsResponse.data.contacts)

      // Fetch categories
      const categoriesResponse = await api.get('/categories/public')
      setCategories(categoriesResponse.data.categories)
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
      await api.post('/categories', { name: newCategoryName.trim() })
      
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
      await api.delete(`/categories/${categoryId}`)
      
      fetchData() // Refresh data
    } catch (e: any) {
      setError(`Failed to delete category: ${e.message}`)
    }
  }

  const tabs = [
    { id: 'featured', label: 'Featured Contacts', icon: Star },
    { id: 'categories', label: 'Categories', icon: Tag },
    { id: 'edit', label: 'Edit Contact', icon: Save },
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
          allContacts={contacts}
          newCategoryName={newCategoryName}
          setNewCategoryName={setNewCategoryName}
          showAddCategory={showAddCategory}
          setShowAddCategory={setShowAddCategory}
          onAddCategory={addCategory}
          onDeleteCategory={deleteCategory}
          refreshAll={fetchData}
          loading={loading}
          error={error}
        />
      case 'edit':
        return <EditContactTab 
          contacts={contacts}
          categories={categories}
          searchTerm={contactSearchTerm}
          setSearchTerm={setContactSearchTerm}
          selectedContact={selectedContact}
          setSelectedContact={setSelectedContact}
          editForm={editForm}
          setEditForm={setEditForm}
          onSave={async () => {
            if (!selectedContact) return
            setLoading(true)
            setError(null)
            try {
              await api.put(`/contacts/${selectedContact.id}`, {
                name: editForm.name,
                phoneNumber: editForm.phoneNumber,
                type: editForm.type,
                categoryIds: editForm.categoryIds.map(id => parseInt(id)),
              })
              await fetchData()
            } catch (e: any) {
              setError(`Failed to save contact: ${e.message}`)
            } finally {
              setLoading(false)
            }
          }}
          mergeTargetSearch={mergeTargetSearch}
          setMergeTargetSearch={setMergeTargetSearch}
          mergeTarget={mergeTarget}
          setMergeTarget={setMergeTarget}
          onMerged={async () => {
            await fetchData()
          }}
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
// Edit Contact Tab Component
function EditContactTab({
  contacts,
  categories,
  searchTerm,
  setSearchTerm,
  selectedContact,
  setSelectedContact,
  editForm,
  setEditForm,
  onSave,
  mergeTargetSearch,
  setMergeTargetSearch,
  mergeTarget,
  setMergeTarget,
  onMerged,
  loading,
  error
}: {
  contacts: Contact[]
  categories: Category[]
  searchTerm: string
  setSearchTerm: (t: string) => void
  selectedContact: Contact | null
  setSelectedContact: (c: Contact | null) => void
  editForm: { name: string; phoneNumber: string; type: 'INDIVIDUAL' | 'GROUP'; categoryIds: string[] }
  setEditForm: (f: { name: string; phoneNumber: string; type: 'INDIVIDUAL' | 'GROUP'; categoryIds: string[] }) => void
  onSave: () => void
  mergeTargetSearch: string
  setMergeTargetSearch: (t: string) => void
  mergeTarget: Contact | null
  setMergeTarget: (c: Contact | null) => void
  onMerged: () => void
  loading: boolean
  error: string | null
}) {
  if (loading) return <div className="text-center py-8">Loading...</div>
  if (error) return <div className="text-center py-8 text-red-600">Error: {error}</div>

  const filtered = contacts.filter(c => {
    if (!searchTerm.trim()) return true
    const s = searchTerm.toLowerCase()
    return (
      c.name?.toLowerCase().includes(s) ||
      c.phoneNumber.includes(searchTerm) ||
      c.phoneNumber.replace(/\D/g, '').includes(searchTerm.replace(/\D/g, ''))
    )
  }).slice(0, 50)

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Edit Contact</h2>

        {/* Search and select */}
        <div className="mb-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <div className="mb-3">
              <input
                type="text"
                placeholder="Search contacts by name or phone number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-3 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="max-h-80 overflow-auto divide-y divide-gray-100 border rounded-lg">
              {filtered.map(c => (
                <button
                  key={c.id}
                  onClick={() => {
                    setSelectedContact(c)
                    setEditForm({
                      name: c.name || '',
                      phoneNumber: c.phoneNumber,
                      type: c.type,
                      categoryIds: [],
                    })
                    setMergeTarget(null)
                  }}
                  className={`w-full text-left p-3 hover:bg-gray-50 ${selectedContact?.id === c.id ? 'bg-blue-50' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900">{c.name || 'No name'}</div>
                      <div className="text-sm text-gray-500">{c.phoneNumber}</div>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">{c.type}</span>
                  </div>
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="p-4 text-sm text-gray-500">No contacts match your search.</div>
              )}
            </div>
          </div>

          {/* Edit form */}
          <div>
            {!selectedContact ? (
              <div className="text-gray-500">Select a contact to edit.</div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={editForm.phoneNumber}
                    onChange={(e) => setEditForm({ ...editForm, phoneNumber: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={editForm.type}
                    onChange={(e) => setEditForm({ ...editForm, type: e.target.value as 'INDIVIDUAL' | 'GROUP' })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="INDIVIDUAL">INDIVIDUAL</option>
                    <option value="GROUP">GROUP</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categories</label>
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-auto border rounded p-2">
                    {categories.map(cat => {
                      const checked = editForm.categoryIds.includes(cat.id)
                      return (
                        <label key={cat.id} className="inline-flex items-center space-x-2 text-sm">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEditForm({ ...editForm, categoryIds: [...editForm.categoryIds, cat.id] })
                              } else {
                                setEditForm({ ...editForm, categoryIds: editForm.categoryIds.filter(id => id !== cat.id) })
                              }
                            }}
                          />
                          <span>{cat.name}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
                <div className="pt-2 flex items-center gap-3">
                  <button
                    onClick={onSave}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Save Changes
                  </button>
                </div>

                {/* Merge section */}
                <div className="pt-6 mt-4 border-t">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-900">Merge With Another Contact</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">Select a second contact to merge into the current one. All messages and categories will be moved to the current contact, and the other contact will be deleted.</p>
                  <div className="mb-3">
                    <input
                      type="text"
                      placeholder="Search contact to merge..."
                      value={mergeTargetSearch}
                      onChange={(e) => setMergeTargetSearch(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div className="max-h-48 overflow-auto divide-y border rounded">
                    {contacts
                      .filter(c => c.id !== selectedContact.id)
                      .filter(c => {
                        if (!mergeTargetSearch.trim()) return true
                        const s = mergeTargetSearch.toLowerCase()
                        return c.name?.toLowerCase().includes(s) || c.phoneNumber.includes(mergeTargetSearch)
                      })
                      .slice(0, 30)
                      .map(c => (
                        <button
                          key={c.id}
                          onClick={() => setMergeTarget(c)}
                          className={`w-full text-left p-2 hover:bg-gray-50 ${mergeTarget?.id === c.id ? 'bg-red-50' : ''}`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-sm font-medium">{c.name || 'No name'}</div>
                              <div className="text-xs text-gray-500">{c.phoneNumber}</div>
                            </div>
                            <span className="text-xs">{c.type}</span>
                          </div>
                        </button>
                      ))}
                  </div>
                  <div className="mt-3">
                    <button
                      disabled={!mergeTarget}
                      onClick={async () => {
                        if (!selectedContact || !mergeTarget) return
                        if (!confirm('This will merge the selected contact into the current one and delete it. Proceed?')) return
                        try {
                          await api.post('/contacts/merge', { sourceId: mergeTarget.id, targetId: selectedContact.id })
                          setMergeTarget(null)
                          onMerged()
                          alert('Contacts merged successfully')
                        } catch (e: any) {
                          alert(`Failed to merge: ${e.message}`)
                        }
                      }}
                      className={`px-4 py-2 rounded-lg text-white ${mergeTarget ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-400 cursor-not-allowed'}`}
                    >
                      Merge Into Current
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
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
  allContacts,
  newCategoryName,
  setNewCategoryName,
  showAddCategory,
  setShowAddCategory,
  onAddCategory,
  onDeleteCategory,
  refreshAll,
  loading,
  error
}: { 
  categories: Category[]
  allContacts: Contact[]
  newCategoryName: string
  setNewCategoryName: (name: string) => void
  showAddCategory: boolean
  setShowAddCategory: (show: boolean) => void
  onAddCategory: () => void
  onDeleteCategory: (categoryId: string) => void
  refreshAll: () => void
  loading: boolean
  error: string | null
}) {
  if (loading) return <div className="text-center py-8">Loading categories...</div>
  if (error) return <div className="text-center py-8 text-red-600">Error: {error}</div>

  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null)
  const [categoryContacts, setCategoryContacts] = useState<Record<string, Contact[]>>({})
  const [addSearch, setAddSearch] = useState('')

  const loadCategoryContacts = async (categoryId: string) => {
    try {
      const res = await api.get(`/categories/${categoryId}/contacts`)
      setCategoryContacts(prev => ({ ...prev, [categoryId]: res.data.contacts }))
    } catch (e: any) {
      console.error('Failed to load category contacts', e)
    }
  }

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

        <div className="space-y-3">
          {categories.map(category => (
            <div key={category.id} className="border border-gray-200 rounded-lg">
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={async () => {
                      const next = expandedCategoryId === category.id ? null : category.id
                      setExpandedCategoryId(next)
                      if (next) await loadCategoryContacts(category.id)
                    }}
                    className="text-sm px-2 py-1 rounded bg-gray-100 hover:bg-gray-200"
                  >
                    {expandedCategoryId === category.id ? 'Hide' : 'View'}
                  </button>
                  <h3 className="font-medium text-gray-900">{category.name}</h3>
                  <span className="text-sm text-gray-500">{category.contactCount} contacts</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      const newName = prompt('New category name', category.name)
                      if (!newName || !newName.trim()) return
                      try {
                        await api.put(`/categories/${category.id}`, { name: newName.trim() })
                        refreshAll()
                      } catch (e: any) {
                        alert(`Rename failed: ${e.message}`)
                      }
                    }}
                    className="text-sm px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => onDeleteCategory(category.id)}
                    className="text-sm px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {expandedCategoryId === category.id && (
                <div className="p-4 border-t space-y-3">
                  {/* Add contact to category */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Search contacts to add..."
                      value={addSearch}
                      onChange={(e) => setAddSearch(e.target.value)}
                      className="flex-1 px-3 py-2 border rounded"
                    />
                    <div className="text-sm text-gray-500">{(categoryContacts[category.id]?.length || 0)} in category</div>
                  </div>
                  <div className="max-h-48 overflow-auto divide-y border rounded">
                    {allContacts
                      .filter(c => !(categoryContacts[category.id]?.some(cc => cc.id === c.id)))
                      .filter(c => {
                        if (!addSearch.trim()) return true
                        const s = addSearch.toLowerCase()
                        return c.name?.toLowerCase().includes(s) || c.phoneNumber.includes(addSearch)
                      })
                      .slice(0, 30)
                      .map(c => (
                        <button
                          key={c.id}
                          onClick={async () => {
                            try {
                              await api.post(`/categories/${category.id}/contacts`, { contactId: parseInt(c.id) })
                              await loadCategoryContacts(category.id)
                              refreshAll()
                            } catch (e: any) {
                              alert(`Failed to add: ${e.message}`)
                            }
                          }}
                          className="w-full text-left p-2 hover:bg-gray-50"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-sm font-medium">{c.name || 'No name'}</div>
                              <div className="text-xs text-gray-500">{c.phoneNumber}</div>
                            </div>
                            <span className="text-xs">{c.type}</span>
                          </div>
                        </button>
                      ))}
                  </div>

                  {/* List contacts in category */}
                  <div className="border rounded">
                    {(categoryContacts[category.id] || []).map(c => (
                      <div key={c.id} className="flex items-center justify-between p-2 border-b last:border-b-0">
                        <div>
                          <div className="text-sm font-medium">{c.name || 'No name'}</div>
                          <div className="text-xs text-gray-500">{c.phoneNumber}</div>
                        </div>
                        <button
                          onClick={async () => {
                            try {
                              await api.delete(`/categories/${category.id}/contacts/${c.id}`)
                              await loadCategoryContacts(category.id)
                              refreshAll()
                            } catch (e: any) {
                              alert(`Failed to remove: ${e.message}`)
                            }
                          }}
                          className="text-sm px-2 py-1 rounded bg-gray-200 hover:bg-gray-300"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    {(categoryContacts[category.id]?.length || 0) === 0 && (
                      <div className="p-3 text-sm text-gray-500">No contacts in this category</div>
                    )}
                  </div>
                </div>
              )}
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
