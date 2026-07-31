'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface ProductImage {
  id: string
  image_url: string
  display_order: number
}

interface ProductVideo {
  id: string
  video_url: string
  display_order: number
}

interface ProductVariant {
  id: string
  variant_name: string
  variant_product_id: string
  swatch_image_url: string
  display_order: number
  variant: { id: string; name: string; product_code: string } | null
}

interface Product {
  id: string
  product_code: string
  name: string
  msrp: number
  selling_price: number
  discount_percent: number
  inclusions: string[] | null
  quantity_default: number
  quantity_max: number
  offer_widget_id: string | null
  rich_collection_id: string | null
  cta_text: string
  is_featured: boolean
  product_images: ProductImage[]
  product_videos: ProductVideo[]
  product_variants: ProductVariant[]
}

interface Widget {
  id: string
  name: string
}

interface Collection {
  id: string
  name: string
}

interface VariantRow {
  variant_name: string
  variant_product_id: string
  variant_label: string
  swatch_image_url: string
}

const emptyForm = {
  name: '',
  msrp: '',
  sellingPrice: '',
  ctaText: '',
  isFeatured: false,
  quantityDefault: '',
  quantityMax: '',
  offerWidgetId: '',
  richCollectionId: '',
}

function computeDiscountPercent(msrp: number, sellingPrice: number): number {
  if (!msrp || msrp <= 0 || sellingPrice >= msrp) return 0
  return Math.max(0, Math.ceil(((msrp - sellingPrice) / msrp) * 100))
}

export default function ProductsManager() {
  const [products, setProducts] = useState<Product[]>([])
  const [widgets, setWidgets] = useState<Widget[]>([])
  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [formError, setFormError] = useState('')

  const [formData, setFormData] = useState(emptyForm)
  const [inclusions, setInclusions] = useState<string[]>([])
  const [images, setImages] = useState<string[]>([''])
  const [videos, setVideos] = useState<string[]>([])
  const [variants, setVariants] = useState<VariantRow[]>([])
  const [variantSearch, setVariantSearch] = useState('')

  useEffect(() => {
    fetchProducts()
    fetchWidgets()
    fetchCollections()
  }, [])

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select(
          `*,
          product_images(id, image_url, display_order),
          product_videos(id, video_url, display_order),
          product_variants!product_variants_product_id_fkey(id, variant_name, swatch_image_url, display_order, variant_product_id, variant:products!product_variants_variant_product_id_fkey(id, name, product_code))`
        )
        .order('created_at', { ascending: false })
      if (error) throw error
      setProducts((data as unknown as Product[]) || [])
    } catch (error) {
      console.error('Error:', error)
      alert('Failed to load products')
    } finally {
      setLoading(false)
    }
  }

  const fetchWidgets = async () => {
    const { data } = await supabase.from('widgets').select('id, name').order('name')
    setWidgets(data || [])
  }

  const fetchCollections = async () => {
    const { data } = await supabase.from('collections').select('id, name').order('name')
    setCollections(data || [])
  }

  const discountPreview = computeDiscountPercent(parseFloat(formData.msrp) || 0, parseFloat(formData.sellingPrice) || 0)

  const handleFieldChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }))
  }

  const availableVariantProducts = useMemo(() => {
    const addedIds = new Set(variants.map((v) => v.variant_product_id))
    const query = variantSearch.trim().toLowerCase()
    return products
      .filter((p) => p.id !== editing && !addedIds.has(p.id))
      .filter((p) => !query || p.name.toLowerCase().includes(query) || p.product_code.includes(query))
  }, [products, variants, editing, variantSearch])

  const handleAddVariant = (product: Product) => {
    setVariants((prev) => [
      ...prev,
      {
        variant_name: '',
        variant_product_id: product.id,
        variant_label: `${product.name} (${product.product_code})`,
        swatch_image_url: '',
      },
    ])
    setVariantSearch('')
  }

  const handleRemoveVariant = (variantProductId: string) => {
    setVariants((prev) => prev.filter((v) => v.variant_product_id !== variantProductId))
  }

  const handleVariantFieldChange = (variantProductId: string, field: 'variant_name' | 'swatch_image_url', value: string) => {
    setVariants((prev) => prev.map((v) => (v.variant_product_id === variantProductId ? { ...v, [field]: value } : v)))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')

    const msrp = parseFloat(formData.msrp)
    const sellingPrice = parseFloat(formData.sellingPrice)
    const quantityDefault = parseInt(formData.quantityDefault, 10)
    const quantityMax = formData.quantityMax ? parseInt(formData.quantityMax, 10) : 20
    const trimmedImages = images.map((i) => i.trim()).filter(Boolean)

    if (!formData.name.trim()) return setFormError('Product name is required')
    if (!msrp || msrp <= 0) return setFormError('MSRP must be a positive number')
    if (!sellingPrice || sellingPrice <= 0) return setFormError('Selling price must be a positive number')
    if (sellingPrice > msrp) return setFormError('Selling price cannot exceed MSRP')
    if (!quantityDefault || quantityDefault < 1) return setFormError('Quantity default must be at least 1')
    if (quantityMax < quantityDefault) return setFormError('Quantity max cannot be less than quantity default')
    if (trimmedImages.length === 0) return setFormError('At least one product image is required')
    for (const v of variants) {
      if (!v.variant_name.trim() || !v.swatch_image_url.trim()) {
        return setFormError('Each variant needs a name and a swatch image')
      }
    }

    setSaving(true)
    try {
      const payload = {
        name: formData.name.trim(),
        msrp,
        selling_price: sellingPrice,
        inclusions: inclusions.map((i) => i.trim()).filter(Boolean),
        quantity_default: quantityDefault,
        quantity_max: quantityMax,
        offer_widget_id: formData.offerWidgetId || null,
        rich_collection_id: formData.richCollectionId || null,
        cta_text: formData.ctaText.trim() || 'Add to Cart',
        is_featured: formData.isFeatured,
        images: trimmedImages,
        videos: videos.map((v) => v.trim()).filter(Boolean),
        variants: variants.map((v) => ({
          variant_name: v.variant_name.trim(),
          variant_product_id: v.variant_product_id,
          swatch_image_url: v.swatch_image_url.trim(),
        })),
      }

      const response = editing
        ? await fetch(`/api/products/${editing}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to save product')

      resetForm()
      fetchProducts()
    } catch (error) {
      console.error('Error:', error)
      setFormError(error instanceof Error ? error.message : 'Failed to save product')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this product?')) return

    try {
      const response = await fetch(`/api/products/${id}`, { method: 'DELETE' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to delete')
      fetchProducts()
    } catch (error) {
      console.error('Error:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete product')
    }
  }

  const handleEdit = (product: Product) => {
    setFormData({
      name: product.name,
      msrp: String(product.msrp),
      sellingPrice: String(product.selling_price),
      ctaText: product.cta_text,
      isFeatured: product.is_featured,
      quantityDefault: String(product.quantity_default),
      quantityMax: String(product.quantity_max),
      offerWidgetId: product.offer_widget_id || '',
      richCollectionId: product.rich_collection_id || '',
    })
    setInclusions(product.inclusions || [])
    setImages(
      product.product_images.length > 0
        ? [...product.product_images].sort((a, b) => a.display_order - b.display_order).map((i) => i.image_url)
        : ['']
    )
    setVideos([...product.product_videos].sort((a, b) => a.display_order - b.display_order).map((v) => v.video_url))
    setVariants(
      [...product.product_variants]
        .sort((a, b) => a.display_order - b.display_order)
        .map((v) => ({
          variant_name: v.variant_name,
          variant_product_id: v.variant_product_id,
          variant_label: v.variant ? `${v.variant.name} (${v.variant.product_code})` : 'Unknown product',
          swatch_image_url: v.swatch_image_url,
        }))
    )
    setEditing(product.id)
    setFormError('')
    setVariantSearch('')
    setShowForm(true)
  }

  const resetForm = () => {
    setFormData(emptyForm)
    setInclusions([])
    setImages([''])
    setVideos([])
    setVariants([])
    setEditing(null)
    setFormError('')
    setVariantSearch('')
    setShowForm(false)
  }

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return products
    return products.filter((p) => p.name.toLowerCase().includes(query) || p.product_code.includes(query))
  }, [products, search])

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

        {showForm && (
          <div className="bg-gray-800 rounded-lg p-8 mb-8">
            <h2 className="text-2xl font-bold mb-6">{editing ? 'Edit Product' : 'Add New Product'}</h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              {formError && (
                <p className="text-sm text-red-400 bg-red-900/30 border border-red-800 rounded px-4 py-2">{formError}</p>
              )}

              {/* Core fields */}
              <div className="grid md:grid-cols-2 gap-4">
                <input
                  type="text"
                  name="name"
                  placeholder="Product Name"
                  value={formData.name}
                  onChange={handleFieldChange}
                  required
                  className="px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                />
                <label className="flex items-center px-4 py-2 bg-gray-700 rounded border border-gray-600 cursor-pointer hover:bg-gray-600">
                  <input
                    type="checkbox"
                    name="isFeatured"
                    checked={formData.isFeatured}
                    onChange={handleFieldChange}
                    className="mr-2"
                  />
                  <span>Featured</span>
                </label>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <input
                  type="number"
                  name="msrp"
                  placeholder="MSRP (₹)"
                  value={formData.msrp}
                  onChange={handleFieldChange}
                  step="0.01"
                  required
                  className="px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                />
                <input
                  type="number"
                  name="sellingPrice"
                  placeholder="Selling Price (₹)"
                  value={formData.sellingPrice}
                  onChange={handleFieldChange}
                  step="0.01"
                  required
                  className="px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                />
                <div className="px-4 py-2 bg-gray-700/50 rounded border border-gray-700 flex items-center text-gray-300">
                  Discount: <span className="ml-1 font-semibold text-green-400">{discountPreview}%</span>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <input
                  type="number"
                  name="quantityDefault"
                  placeholder="Quantity Default"
                  value={formData.quantityDefault}
                  onChange={handleFieldChange}
                  min={1}
                  required
                  className="px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                />
                <input
                  type="number"
                  name="quantityMax"
                  placeholder="Quantity Max (default 20)"
                  value={formData.quantityMax}
                  onChange={handleFieldChange}
                  min={1}
                  className="px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                />
                <input
                  type="text"
                  name="ctaText"
                  placeholder='CTA Text (default "Add to Cart")'
                  value={formData.ctaText}
                  onChange={handleFieldChange}
                  className="px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <select
                  name="offerWidgetId"
                  value={formData.offerWidgetId}
                  onChange={handleFieldChange}
                  className="px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Offer Widget (none)</option>
                  {widgets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
                <select
                  name="richCollectionId"
                  value={formData.richCollectionId}
                  onChange={handleFieldChange}
                  className="px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Rich Collection (none)</option>
                  {collections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Inclusions */}
              <ListSection
                title="Inclusions"
                items={inclusions}
                onChange={setInclusions}
                placeholder="e.g. Paint brush"
                addLabel="+ Add Inclusion"
              />

              {/* Images */}
              <ListSection
                title="Product Images (at least 1 required)"
                items={images}
                onChange={setImages}
                placeholder="https://... image URL"
                addLabel="+ Add Image"
                minItems={1}
              />

              {/* Videos */}
              <ListSection
                title="Gallery Videos (optional)"
                items={videos}
                onChange={setVideos}
                placeholder="https://... video URL"
                addLabel="+ Add Video"
              />

              {/* Variants */}
              <div className="border border-gray-700 rounded-lg p-4">
                <h3 className="font-semibold mb-3">Variants (optional)</h3>

                {variants.length > 0 && (
                  <div className="space-y-3 mb-4">
                    {variants.map((v) => (
                      <div key={v.variant_product_id} className="bg-gray-700 rounded p-3 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-300">→ {v.variant_label}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveVariant(v.variant_product_id)}
                            className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs"
                          >
                            Remove
                          </button>
                        </div>
                        <div className="grid md:grid-cols-2 gap-2">
                          <input
                            type="text"
                            placeholder="Variant name (e.g. Red)"
                            value={v.variant_name}
                            onChange={(e) => handleVariantFieldChange(v.variant_product_id, 'variant_name', e.target.value)}
                            className="px-3 py-2 bg-gray-800 rounded border border-gray-600 text-sm"
                          />
                          <input
                            type="text"
                            placeholder="Swatch image URL"
                            value={v.swatch_image_url}
                            onChange={(e) =>
                              handleVariantFieldChange(v.variant_product_id, 'swatch_image_url', e.target.value)
                            }
                            className="px-3 py-2 bg-gray-800 rounded border border-gray-600 text-sm"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <input
                  type="text"
                  placeholder="Find a product to link as a variant..."
                  value={variantSearch}
                  onChange={(e) => setVariantSearch(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none mb-2"
                />
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {availableVariantProducts.length === 0 && (
                    <p className="text-xs text-gray-500">No other products available to link.</p>
                  )}
                  {availableVariantProducts.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleAddVariant(p)}
                      className="w-full text-left px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                    >
                      + {p.name} ({p.product_code})
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded font-semibold"
                >
                  {saving ? 'Saving...' : `${editing ? 'Update' : 'Create'} Product`}
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

        <div className="mb-6">
          <input
            type="text"
            placeholder="Find a product by name or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-md px-4 py-2 bg-gray-800 rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-6 py-4 text-left">Product</th>
                <th className="px-6 py-4 text-left">Code</th>
                <th className="px-6 py-4 text-left">Price</th>
                <th className="px-6 py-4 text-left">Discount</th>
                <th className="px-6 py-4 text-left">Assets</th>
                <th className="px-6 py-4 text-left">Featured</th>
                <th className="px-6 py-4 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-gray-700 transition">
                  <td className="px-6 py-4 font-semibold">{product.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-400">{product.product_code}</td>
                  <td className="px-6 py-4">
                    <span className="line-through text-gray-500 text-sm mr-1">₹{product.msrp}</span>
                    <span>₹{product.selling_price}</span>
                  </td>
                  <td className="px-6 py-4">{product.discount_percent}%</td>
                  <td className="px-6 py-4 text-sm text-gray-400">
                    {product.product_images.length} img · {product.product_videos.length} vid ·{' '}
                    {product.product_variants.length} var
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

          {filteredProducts.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <p>{search ? `No products match "${search}"` : 'No products yet. Create your first product!'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ListSection({
  title,
  items,
  onChange,
  placeholder,
  addLabel,
  minItems = 0,
}: {
  title: string
  items: string[]
  onChange: (items: string[]) => void
  placeholder: string
  addLabel: string
  minItems?: number
}) {
  const handleItemChange = (index: number, value: string) => {
    const next = [...items]
    next[index] = value
    onChange(next)
  }

  const handleRemove = (index: number) => {
    onChange(items.filter((_, i) => i !== index))
  }

  return (
    <div className="border border-gray-700 rounded-lg p-4">
      <h3 className="font-semibold mb-3">{title}</h3>
      <div className="space-y-2 mb-3">
        {items.map((item, index) => (
          <div key={index} className="flex gap-2">
            <input
              type="text"
              placeholder={placeholder}
              value={item}
              onChange={(e) => handleItemChange(index, e.target.value)}
              className="flex-1 px-3 py-2 bg-gray-700 rounded border border-gray-600 text-sm focus:border-blue-500 focus:outline-none"
            />
            {items.length > minItems && (
              <button
                type="button"
                onClick={() => handleRemove(index)}
                className="px-3 py-2 bg-red-600 hover:bg-red-700 rounded text-sm"
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange([...items, ''])}
        className="text-sm px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded"
      >
        {addLabel}
      </button>
    </div>
  )
}
