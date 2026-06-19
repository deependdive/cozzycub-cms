'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { PRODUCT_CLASSIFICATIONS } from '@/lib/config'

interface Product {
  id: string
  name: string
  description: string
  price: number
  category_id: string
  image_url: string
  stock: number
  is_featured: boolean
  classification?: string
}

interface Category {
  id: string
  name: string
}

export default function ProductsManager() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category_id: '',
    image_url: '',
    stock: '',
    is_featured: false,
    classification: '',
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [productsRes, categoriesRes] = await Promise.all([
        supabase.from('products').select('*'),
        supabase.from('categories').select('*'),
      ])

      setProducts(productsRes.data || [])
      setCategories(categoriesRes.data || [])
    } catch (error) {
      console.error('Error:', error)
      alert('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      alert(`File is too large. Maximum size is 5MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB`)
      return
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }

    setUploadingImage(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed')
      }

      setFormData((prev) => ({ ...prev, image_url: data.imageUrl }))
      alert('Image uploaded successfully!')
    } catch (error) {
      console.error('Upload error:', error)
      alert(`Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setUploadingImage(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const productData = {
        name: formData.name,
        description: formData.description,
        price: parseFloat(formData.price),
        category_id: formData.category_id || null,
        image_url: formData.image_url,
        stock: parseInt(formData.stock),
        is_featured: formData.is_featured,
        classification: formData.classification || null,
      }

      if (editing) {
        const response = await fetch(`/api/products/${editing}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(productData),
        })
        if (!response.ok) throw new Error('Failed to update')
      } else {
        const response = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(productData),
        })
        if (!response.ok) throw new Error('Failed to create')
      }

      resetForm()
      fetchData()
    } catch (error) {
      console.error('Error:', error)
      alert('Failed to save product')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this product?')) return

    try {
      const response = await fetch(`/api/products/${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Failed to delete')
      fetchData()
    } catch (error) {
      console.error('Error:', error)
      alert('Failed to delete product')
    }
  }

  const handleEdit = (product: Product) => {
    setFormData({
      name: product.name,
      description: product.description,
      price: product.price.toString(),
      category_id: product.category_id || '',
      image_url: product.image_url,
      stock: product.stock.toString(),
      is_featured: product.is_featured,
      classification: product.classification || '',
    })
    setEditing(product.id)
    setShowForm(true)
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      price: '',
      category_id: '',
      image_url: '',
      stock: '',
      is_featured: false,
      classification: '',
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
            <h1 className="text-4xl font-bold">Products</h1>
            <p className="text-gray-400">Total: {products.length}</p>
          </div>
          <button
            onClick={() => (showForm ? resetForm() : setShowForm(true))}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold"
          >
            {showForm ? '✕ Cancel' : '+ Add Product'}
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <div className="bg-gray-800 rounded-lg p-8 mb-8">
            <h2 className="text-2xl font-bold mb-6">{editing ? 'Edit Product' : 'Add New Product'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid md:grid-cols-3 gap-4">
                <input
                  type="text"
                  name="name"
                  placeholder="Product Name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className="px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                />
                <select
                  name="category_id"
                  value={formData.category_id}
                  onChange={handleInputChange}
                  className="px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Select Category</option>
                  {categories.length === 0 ? (
                    <option disabled>Create categories first →</option>
                  ) : (
                    categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))
                  )}
                </select>
                <select
                  name="classification"
                  value={formData.classification}
                  onChange={handleInputChange}
                  className="px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Select Type</option>
                  {PRODUCT_CLASSIFICATIONS.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.label}
                    </option>
                  ))}
                </select>
              </div>

              <textarea
                name="description"
                placeholder="Product Description"
                value={formData.description}
                onChange={handleInputChange}
                rows={4}
                className="w-full px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              />

              <div className="grid md:grid-cols-3 gap-4">
                <input
                  type="number"
                  name="price"
                  placeholder="Price (₹)"
                  value={formData.price}
                  onChange={handleInputChange}
                  step="0.01"
                  required
                  className="px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                />
                <input
                  type="number"
                  name="stock"
                  placeholder="Stock"
                  value={formData.stock}
                  onChange={handleInputChange}
                  required
                  className="px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                />
                <label className="flex items-center px-4 py-2 bg-gray-700 rounded border border-gray-600 cursor-pointer hover:bg-gray-600">
                  <input
                    type="checkbox"
                    name="is_featured"
                    checked={formData.is_featured}
                    onChange={handleInputChange}
                    className="mr-2"
                  />
                  <span>Featured</span>
                </label>
              </div>

              <div className="border-2 border-dashed border-gray-600 rounded p-6 bg-gray-700/30">
                <label className="cursor-pointer block">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploadingImage}
                    className="hidden"
                  />
                  <div className={`text-center transition ${uploadingImage ? 'opacity-50 cursor-wait' : 'hover:opacity-80'}`}>
                    <p className="text-lg font-semibold mb-1">
                      {uploadingImage ? '⏳ Uploading...' : '📸 Click to upload image'}
                    </p>
                    <p className="text-sm text-gray-400">Max 5MB • JPG, PNG, WebP</p>
                  </div>
                </label>
                {formData.image_url && (
                  <p className="text-sm text-green-400 mt-3">
                    ✓ Image: {formData.image_url}
                  </p>
                )}
              </div>

              <div className="flex gap-4">
                <button
                  type="submit"
                  className="px-6 py-2 bg-green-600 hover:bg-green-700 rounded font-semibold"
                >
                  {editing ? 'Update' : 'Create'} Product
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

        {/* Products Table */}
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-6 py-4 text-left">Name</th>
                <th className="px-6 py-4 text-left">Price</th>
                <th className="px-6 py-4 text-left">Stock</th>
                <th className="px-6 py-4 text-left">Category</th>
                <th className="px-6 py-4 text-left">Featured</th>
                <th className="px-6 py-4 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-gray-700 transition">
                  <td className="px-6 py-4">
                    <p className="font-semibold">{product.name}</p>
                    <p className="text-sm text-gray-400">{product.description?.slice(0, 50)}...</p>
                  </td>
                  <td className="px-6 py-4">₹{product.price}</td>
                  <td className="px-6 py-4">{product.stock}</td>
                  <td className="px-6 py-4">
                    {categories.find((c) => c.id === product.category_id)?.name || 'Uncategorized'}
                  </td>
                  <td className="px-6 py-4">{product.is_featured ? '✓' : '—'}</td>
                  <td className="px-6 py-4 space-x-2">
                    <button
                      onClick={() => handleEdit(product)}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(product.id)}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {products.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <p>No products yet. Create your first product!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
