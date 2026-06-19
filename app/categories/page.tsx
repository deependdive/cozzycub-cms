'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface Category {
  id: string
  name: string
  description: string
  slug: string
  image_url: string
}

export default function CategoriesManager() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    slug: '',
    image_url: '',
  })

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase.from('categories').select('*')
      if (error) throw error
      setCategories(data || [])
    } catch (error) {
      console.error('Error:', error)
      alert('Failed to load categories')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
      // Auto-generate slug from name
      ...(name === 'name' && {
        slug: value
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^\w-]/g, ''),
      }),
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      if (editing) {
        const response = await fetch(`/api/categories/${editing}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        })
        if (!response.ok) throw new Error('Failed to update')
      } else {
        const response = await fetch('/api/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        })
        if (!response.ok) throw new Error('Failed to create')
      }

      resetForm()
      fetchCategories()
    } catch (error) {
      console.error('Error:', error)
      alert('Failed to save category')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this category?')) return

    try {
      const response = await fetch(`/api/categories/${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Failed to delete')
      fetchCategories()
    } catch (error) {
      console.error('Error:', error)
      alert('Failed to delete category')
    }
  }

  const handleEdit = (category: Category) => {
    setFormData(category)
    setEditing(category.id)
    setShowForm(true)
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      slug: '',
      image_url: '',
    })
    setEditing(null)
    setShowForm(false)
  }

  if (loading) return <div className="p-8 text-center text-white">Loading...</div>

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <Link href="/" className="text-blue-400 hover:text-blue-300 mb-4 inline-block">
              ← Back to Dashboard
            </Link>
            <h1 className="text-4xl font-bold">Categories</h1>
            <p className="text-gray-400">Total: {categories.length}</p>
          </div>
          <button
            onClick={() => (showForm ? resetForm() : setShowForm(true))}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-semibold"
          >
            {showForm ? '✕ Cancel' : '+ Add Category'}
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <div className="bg-gray-800 rounded-lg p-8 mb-8">
            <h2 className="text-2xl font-bold mb-6">{editing ? 'Edit Category' : 'Add New Category'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="text"
                name="name"
                placeholder="Category Name"
                value={formData.name}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-green-500 focus:outline-none"
              />

              <textarea
                name="description"
                placeholder="Category Description"
                value={formData.description}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-green-500 focus:outline-none"
              />

              <input
                type="text"
                name="slug"
                placeholder="URL Slug (auto-generated)"
                value={formData.slug}
                onChange={handleInputChange}
                className="w-full px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-green-500 focus:outline-none"
              />

              <input
                type="text"
                name="image_url"
                placeholder="Category Image URL"
                value={formData.image_url}
                onChange={handleInputChange}
                className="w-full px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-green-500 focus:outline-none"
              />

              <div className="flex gap-4">
                <button
                  type="submit"
                  className="px-6 py-2 bg-green-600 hover:bg-green-700 rounded font-semibold"
                >
                  {editing ? 'Update' : 'Create'} Category
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded font-semibold"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Categories Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((category) => (
            <div key={category.id} className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-xl font-bold mb-2">{category.name}</h3>
              <p className="text-gray-400 text-sm mb-4">{category.description}</p>
              <p className="text-xs text-gray-500 mb-4">Slug: {category.slug}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(category)}
                  className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(category.id)}
                  className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 rounded text-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        {categories.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p>No categories yet. Create your first category!</p>
          </div>
        )}
      </div>
    </div>
  )
}
