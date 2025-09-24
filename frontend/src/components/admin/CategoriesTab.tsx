import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { api } from '../../lib/api'
import { Plus, Edit2, Trash2, Tag, Users } from 'lucide-react'
import toast from 'react-hot-toast'

interface Category {
  id: string
  name: string
  description?: string
  color?: string
  _count: {
    contacts: number
  }
}

export default function CategoriesTab() {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const queryClient = useQueryClient()

  // Fetch categories
  const { data: categories = [], isLoading } = useQuery('categories', async () => {
    const response = await api.get('/categories')
    return response.data
  })

  // Delete category mutation
  const deleteCategoryMutation = useMutation(
    (id: string) => api.delete(`/categories/${id}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('categories')
        toast.success('Category deleted successfully')
      },
      onError: (error: any) => {
        const errorMessage = error.response?.data?.error || 'Failed to delete category'
        toast.error(errorMessage)
      }
    }
  )

  const handleDelete = (id: string, contactCount: number) => {
    if (contactCount > 0) {
      toast.error('Cannot delete category with existing contacts')
      return
    }
    
    if (window.confirm('Are you sure you want to delete this category?')) {
      deleteCategoryMutation.mutate(id)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Categories</h2>
          <p className="text-gray-600">Organize contacts with categories</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Add Category</span>
        </button>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <div className="col-span-full p-8 text-center text-gray-500">Loading categories...</div>
        ) : categories.length === 0 ? (
          <div className="col-span-full p-8 text-center text-gray-500">
            <Tag className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p>No categories found</p>
          </div>
        ) : (
          categories.map((category: Category) => (
            <div key={category.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{
                        backgroundColor: category.color || '#6b7280'
                      }}
                    />
                    <h3 className="text-lg font-medium text-gray-900">
                      {category.name}
                    </h3>
                  </div>
                  
                  {category.description && (
                    <p className="text-sm text-gray-600 mb-4">
                      {category.description}
                    </p>
                  )}
                  
                  <div className="flex items-center text-sm text-gray-500">
                    <Users className="h-4 w-4 mr-1" />
                    <span>{category._count.contacts} contacts</span>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2 ml-4">
                  <button
                    onClick={() => setEditingCategory(category)}
                    className="text-primary-600 hover:text-primary-900"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(category.id, category._count.contacts)}
                    className="text-red-600 hover:text-red-900"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || editingCategory) && (
        <CategoryModal
          category={editingCategory}
          onClose={() => {
            setShowCreateModal(false)
            setEditingCategory(null)
          }}
        />
      )}
    </div>
  )
}

function CategoryModal({ 
  category, 
  onClose 
}: { 
  category: Category | null
  onClose: () => void 
}) {
  const [formData, setFormData] = useState({
    name: category?.name || '',
    description: category?.description || '',
    color: category?.color || '#3b82f6'
  })

  const queryClient = useQueryClient()

  const createMutation = useMutation(
    (data: any) => api.post('/categories', data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('categories')
        toast.success('Category created successfully')
        onClose()
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.error || 'Failed to create category')
      }
    }
  )

  const updateMutation = useMutation(
    (data: any) => api.put(`/categories/${category?.id}`, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('categories')
        toast.success('Category updated successfully')
        onClose()
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.error || 'Failed to update category')
      }
    }
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (category) {
      updateMutation.mutate(formData)
    } else {
      createMutation.mutate(formData)
    }
  }

  const predefinedColors = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', 
    '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'
  ]

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {category ? 'Edit Category' : 'Create Category'}
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
                Description
              </label>
              <textarea
                className="input"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Color
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="color"
                  className="w-12 h-8 border border-gray-300 rounded cursor-pointer"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                />
                <input
                  type="text"
                  className="input flex-1"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                />
              </div>
              
              <div className="mt-2 flex flex-wrap gap-2">
                {predefinedColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`w-6 h-6 rounded-full border-2 ${
                      formData.color === color ? 'border-gray-400' : 'border-gray-200'
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setFormData({ ...formData, color })}
                  />
                ))}
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
