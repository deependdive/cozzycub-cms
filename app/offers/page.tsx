'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface Product {
  id: string
  name: string
  product_code: string
}

interface PromoCode {
  id: string
  code: string
  label: string | null
  applies_to: 'cart' | 'item' | 'delivery'
  discount_percent: number | null
  discount_amount: number | null
  free_delivery: boolean
  min_purchase_amount: number | null
  min_quantity: number | null
  max_discount_amount: number | null
  max_usage: number | null
  usage_count: number
  is_active: boolean
  expires_at: string | null
  promo_code_products: { product_id: string; products: { id: string; name: string; product_code: string } | null }[]
}

const emptyForm = {
  code: '',
  label: '',
  appliesTo: 'cart' as 'cart' | 'item' | 'delivery',
  discountPercent: '',
  discountAmount: '',
  freeDelivery: false,
  minPurchaseAmount: '',
  minQuantity: '',
  maxDiscountAmount: '',
  maxUsage: '',
  isActive: true,
  expiresAt: '',
}

export default function OffersManager() {
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [formError, setFormError] = useState('')

  const [formData, setFormData] = useState(emptyForm)
  const [scopedProductIds, setScopedProductIds] = useState<string[]>([])
  const [productSearch, setProductSearch] = useState('')

  useEffect(() => {
    fetchPromoCodes()
    fetchProducts()
  }, [])

  const fetchPromoCodes = async () => {
    try {
      const response = await fetch('/api/promo-codes')
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to load offers')
      setPromoCodes(data.promoCodes || [])
    } catch (error) {
      console.error('Error:', error)
      alert('Failed to load offers')
    } finally {
      setLoading(false)
    }
  }

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('id, name, product_code').order('name')
    setProducts(data || [])
  }

  const isDuplicateCode = (code: string) => {
    const normalized = code.trim().toLowerCase()
    return promoCodes.some((p) => p.id !== editing && p.code.toLowerCase() === normalized)
  }

  const handleFieldChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }))
  }

  const availableProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase()
    return products
      .filter((p) => !scopedProductIds.includes(p.id))
      .filter((p) => !query || p.name.toLowerCase().includes(query) || p.product_code.includes(query))
  }, [products, scopedProductIds, productSearch])

  const scopedProducts = useMemo(
    () => scopedProductIds.map((id) => products.find((p) => p.id === id)).filter((p): p is Product => !!p),
    [scopedProductIds, products]
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')

    const code = formData.code.trim()
    if (!code) return setFormError('Code is required')
    if (isDuplicateCode(code)) return setFormError('A code with this name already exists')

    const discountPercent = formData.discountPercent ? parseFloat(formData.discountPercent) : null
    const discountAmount = formData.discountAmount ? parseFloat(formData.discountAmount) : null

    if (formData.appliesTo === 'delivery') {
      if (!formData.freeDelivery && !discountPercent && !discountAmount) {
        return setFormError('Delivery offers need either free delivery or a discount percent/amount')
      }
    } else if (!discountPercent && !discountAmount) {
      return setFormError('A discount percent or discount amount is required')
    }

    setSaving(true)
    try {
      const payload = {
        code,
        label: formData.label.trim(),
        applies_to: formData.appliesTo,
        discount_percent: discountPercent,
        discount_amount: discountAmount,
        free_delivery: formData.freeDelivery,
        min_purchase_amount: formData.minPurchaseAmount ? parseFloat(formData.minPurchaseAmount) : null,
        min_quantity: formData.minQuantity ? parseInt(formData.minQuantity, 10) : null,
        max_discount_amount: formData.maxDiscountAmount ? parseFloat(formData.maxDiscountAmount) : null,
        max_usage: formData.maxUsage ? parseInt(formData.maxUsage, 10) : null,
        is_active: formData.isActive,
        expires_at: formData.expiresAt || null,
        productIds: scopedProductIds,
      }

      const response = editing
        ? await fetch(`/api/promo-codes/${editing}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/promo-codes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to save offer')

      resetForm()
      fetchPromoCodes()
    } catch (error) {
      console.error('Error:', error)
      setFormError(error instanceof Error ? error.message : 'Failed to save offer')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this offer?')) return

    try {
      const response = await fetch(`/api/promo-codes/${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to delete')
      fetchPromoCodes()
    } catch (error) {
      console.error('Error:', error)
      alert('Failed to delete offer')
    }
  }

  const handleEdit = (promo: PromoCode) => {
    setFormData({
      code: promo.code,
      label: promo.label || '',
      appliesTo: promo.applies_to,
      discountPercent: promo.discount_percent ? String(promo.discount_percent) : '',
      discountAmount: promo.discount_amount ? String(promo.discount_amount) : '',
      freeDelivery: promo.free_delivery,
      minPurchaseAmount: promo.min_purchase_amount ? String(promo.min_purchase_amount) : '',
      minQuantity: promo.min_quantity ? String(promo.min_quantity) : '',
      maxDiscountAmount: promo.max_discount_amount ? String(promo.max_discount_amount) : '',
      maxUsage: promo.max_usage ? String(promo.max_usage) : '',
      isActive: promo.is_active,
      expiresAt: promo.expires_at ? promo.expires_at.slice(0, 10) : '',
    })
    setScopedProductIds((promo.promo_code_products || []).map((s) => s.product_id))
    setEditing(promo.id)
    setFormError('')
    setProductSearch('')
    setShowForm(true)
  }

  const resetForm = () => {
    setFormData(emptyForm)
    setScopedProductIds([])
    setEditing(null)
    setFormError('')
    setProductSearch('')
    setShowForm(false)
  }

  const filteredPromoCodes = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return promoCodes
    return promoCodes.filter((p) => p.code.toLowerCase().includes(query))
  }, [promoCodes, search])

  const discountSummary = (promo: PromoCode) => {
    if (promo.applies_to === 'delivery' && promo.free_delivery) return 'Free delivery'
    if (promo.discount_percent) return `${promo.discount_percent}% off`
    if (promo.discount_amount) return `₹${promo.discount_amount} off`
    return '—'
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
            <h1 className="text-4xl font-bold">Offers</h1>
            <p className="text-gray-400">Total: {promoCodes.length}</p>
          </div>
          <button
            onClick={() => (showForm ? resetForm() : setShowForm(true))}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-semibold"
          >
            {showForm ? '✕ Cancel' : '+ Add Offer'}
          </button>
        </div>

        {showForm && (
          <div className="bg-gray-800 rounded-lg p-8 mb-8">
            <h2 className="text-2xl font-bold mb-6">{editing ? 'Edit Offer' : 'Add New Offer'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {formError && (
                <p className="text-sm text-red-400 bg-red-900/30 border border-red-800 rounded px-4 py-2">{formError}</p>
              )}

              <div className="grid md:grid-cols-2 gap-4">
                <input
                  type="text"
                  name="code"
                  placeholder="Code (e.g. CUBCLUB)"
                  value={formData.code}
                  onChange={handleFieldChange}
                  required
                  className="px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-green-500 focus:outline-none font-mono"
                />
                <input
                  type="text"
                  name="label"
                  placeholder="Display label (e.g. 20% off entire order)"
                  value={formData.label}
                  onChange={handleFieldChange}
                  className="px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-green-500 focus:outline-none"
                />
              </div>

              <select
                name="appliesTo"
                value={formData.appliesTo}
                onChange={handleFieldChange}
                className="w-full px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-green-500 focus:outline-none"
              >
                <option value="cart">Applies to: whole cart</option>
                <option value="item">Applies to: specific item(s)</option>
                <option value="delivery">Applies to: delivery fee</option>
              </select>

              {formData.appliesTo === 'delivery' && (
                <label className="flex items-center px-4 py-2 bg-gray-700 rounded border border-gray-600 cursor-pointer hover:bg-gray-600">
                  <input
                    type="checkbox"
                    name="freeDelivery"
                    checked={formData.freeDelivery}
                    onChange={handleFieldChange}
                    className="mr-2"
                  />
                  <span>Free delivery (overrides percent/amount below)</span>
                </label>
              )}

              <div className="grid md:grid-cols-2 gap-4">
                <input
                  type="number"
                  name="discountPercent"
                  placeholder="Discount %"
                  value={formData.discountPercent}
                  onChange={handleFieldChange}
                  step="0.01"
                  className="px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-green-500 focus:outline-none"
                />
                <input
                  type="number"
                  name="discountAmount"
                  placeholder="Or flat discount (₹)"
                  value={formData.discountAmount}
                  onChange={handleFieldChange}
                  step="0.01"
                  className="px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-green-500 focus:outline-none"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <input
                  type="number"
                  name="minPurchaseAmount"
                  placeholder="Min cart value (₹, optional)"
                  value={formData.minPurchaseAmount}
                  onChange={handleFieldChange}
                  className="px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-green-500 focus:outline-none"
                />
                <input
                  type="number"
                  name="minQuantity"
                  placeholder="Min total quantity (optional)"
                  value={formData.minQuantity}
                  onChange={handleFieldChange}
                  className="px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-green-500 focus:outline-none"
                />
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <input
                  type="number"
                  name="maxDiscountAmount"
                  placeholder="Max discount cap (₹, optional)"
                  value={formData.maxDiscountAmount}
                  onChange={handleFieldChange}
                  className="px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-green-500 focus:outline-none"
                />
                <input
                  type="number"
                  name="maxUsage"
                  placeholder="Max total uses (optional)"
                  value={formData.maxUsage}
                  onChange={handleFieldChange}
                  className="px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-green-500 focus:outline-none"
                />
                <input
                  type="date"
                  name="expiresAt"
                  value={formData.expiresAt}
                  onChange={handleFieldChange}
                  className="px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-green-500 focus:outline-none"
                />
              </div>

              <label className="flex items-center px-4 py-2 bg-gray-700 rounded border border-gray-600 cursor-pointer hover:bg-gray-600 w-fit">
                <input
                  type="checkbox"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleFieldChange}
                  className="mr-2"
                />
                <span>Active</span>
              </label>

              {formData.appliesTo === 'item' && (
                <div className="border border-gray-700 rounded-lg p-4">
                  <h3 className="font-semibold mb-3">
                    Scoped products <span className="text-xs text-gray-400">(none selected = applies to every item)</span>
                  </h3>

                  {scopedProducts.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {scopedProducts.map((p) => (
                        <span key={p.id} className="flex items-center gap-2 bg-gray-700 rounded px-3 py-1 text-sm">
                          {p.name} ({p.product_code})
                          <button
                            type="button"
                            onClick={() => setScopedProductIds((prev) => prev.filter((id) => id !== p.id))}
                            className="text-red-400 hover:text-red-300"
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <input
                    type="text"
                    placeholder="Find a product to scope this offer to..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-green-500 focus:outline-none mb-2"
                  />
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {availableProducts.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setScopedProductIds((prev) => [...prev, p.id])}
                        className="w-full text-left px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                      >
                        + {p.name} ({p.product_code})
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded font-semibold"
                >
                  {saving ? 'Saving...' : `${editing ? 'Update' : 'Create'} Offer`}
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
            placeholder="Find an offer by code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-md px-4 py-2 bg-gray-800 rounded border border-gray-700 focus:border-green-500 focus:outline-none"
          />
        </div>

        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-6 py-4 text-left">Code</th>
                <th className="px-6 py-4 text-left">Applies To</th>
                <th className="px-6 py-4 text-left">Discount</th>
                <th className="px-6 py-4 text-left">Minimums</th>
                <th className="px-6 py-4 text-left">Usage</th>
                <th className="px-6 py-4 text-left">Active</th>
                <th className="px-6 py-4 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {filteredPromoCodes.map((promo) => (
                <tr key={promo.id} className="hover:bg-gray-700 transition">
                  <td className="px-6 py-4">
                    <p className="font-mono font-semibold text-blue-300">{promo.code}</p>
                    {promo.label && <p className="text-xs text-gray-400">{promo.label}</p>}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-300 capitalize">{promo.applies_to}</td>
                  <td className="px-6 py-4">{discountSummary(promo)}</td>
                  <td className="px-6 py-4 text-sm text-gray-400">
                    {promo.min_purchase_amount ? `₹${promo.min_purchase_amount}` : ''}
                    {promo.min_purchase_amount && promo.min_quantity ? ' · ' : ''}
                    {promo.min_quantity ? `${promo.min_quantity} items` : ''}
                    {!promo.min_purchase_amount && !promo.min_quantity && '—'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400">
                    {promo.usage_count}
                    {promo.max_usage ? ` / ${promo.max_usage}` : ''}
                  </td>
                  <td className="px-6 py-4">{promo.is_active ? '✓' : '—'}</td>
                  <td className="px-6 py-4 space-x-2">
                    <button
                      onClick={() => handleEdit(promo)}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(promo.id)}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredPromoCodes.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <p>{search ? `No offers match "${search}"` : 'No offers yet. Create your first offer!'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
