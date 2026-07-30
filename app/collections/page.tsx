'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface Widget {
  id: string
  name: string
}

interface CollectionItem {
  widget_id: string
  widget_name: string
  display_order: number
}

interface Collection {
  id: string
  name: string
  slug: string
  collection_items: {
    id: string
    widget_id: string
    display_order: number
    widgets: { id: string; name: string } | null
  }[]
}

const emptyForm = { name: '', slug: '' }

export default function CollectionsManager() {
  const [collections, setCollections] = useState<Collection[]>([])
  const [allWidgets, setAllWidgets] = useState<Widget[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [formData, setFormData] = useState(emptyForm)
  const [items, setItems] = useState<CollectionItem[]>([])
  const [nameError, setNameError] = useState('')
  const [slugError, setSlugError] = useState('')
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [widgetSearch, setWidgetSearch] = useState('')

  useEffect(() => {
    fetchCollections()
    fetchWidgets()
  }, [])

  const fetchCollections = async () => {
    try {
      const { data, error } = await supabase
        .from('collections')
        .select('*, collection_items(id, widget_id, display_order, widgets(id, name))')
        .order('created_at', { ascending: false })
      if (error) throw error
      setCollections((data as unknown as Collection[]) || [])
    } catch (error) {
      console.error('Error:', error)
      alert('Failed to load collections')
    } finally {
      setLoading(false)
    }
  }

  const fetchWidgets = async () => {
    try {
      const { data, error } = await supabase.from('widgets').select('id, name').order('name')
      if (error) throw error
      setAllWidgets(data || [])
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const isDuplicateName = (name: string) => {
    const normalized = name.trim().toLowerCase()
    return collections.some((c) => c.id !== editing && c.name.toLowerCase() === normalized)
  }

  const isDuplicateSlug = (slug: string) => {
    const normalized = slug.trim().toLowerCase()
    return collections.some((c) => c.id !== editing && c.slug.toLowerCase() === normalized)
  }

  const slugify = (value: string) =>
    value
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]/g, '')

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setFormData((prev) => ({ ...prev, name: value, slug: slugify(value) }))
    setNameError(isDuplicateName(value) ? 'A collection with this name already exists' : '')
    setSlugError('')
  }

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = slugify(e.target.value)
    setFormData((prev) => ({ ...prev, slug: value }))
    setSlugError(isDuplicateSlug(value) ? 'A collection with this slug already exists' : '')
  }

  const nextAvailableRank = () => {
    const used = new Set(items.map((i) => i.display_order))
    for (let r = 0; r <= 99; r++) {
      if (!used.has(r)) return r
    }
    return -1
  }

  const availableWidgets = useMemo(() => {
    const addedIds = new Set(items.map((i) => i.widget_id))
    const query = widgetSearch.trim().toLowerCase()
    return allWidgets.filter((w) => !addedIds.has(w.id)).filter((w) => !query || w.name.toLowerCase().includes(query))
  }, [allWidgets, items, widgetSearch])

  const handleAddWidget = (widget: Widget) => {
    if (items.length >= 100) return
    const rank = nextAvailableRank()
    if (rank === -1) return
    setItems((prev) => [...prev, { widget_id: widget.id, widget_name: widget.name, display_order: rank }])
  }

  const handleRemoveWidget = (widgetId: string) => {
    setItems((prev) => prev.filter((i) => i.widget_id !== widgetId))
  }

  const handleRankChange = (widgetId: string, rank: number) => {
    setItems((prev) => prev.map((i) => (i.widget_id === widgetId ? { ...i, display_order: rank } : i)))
  }

  const rankConflict = useMemo(() => {
    const seen = new Map<number, number>()
    for (const item of items) {
      seen.set(item.display_order, (seen.get(item.display_order) || 0) + 1)
    }
    return items.some((i) => (seen.get(i.display_order) || 0) > 1)
  }, [items])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const name = formData.name.trim()
    const slug = formData.slug.trim()
    if (!name) {
      setNameError('Collection name is required')
      return
    }
    if (!slug) {
      setSlugError('Slug is required')
      return
    }
    if (isDuplicateName(name)) {
      setNameError('A collection with this name already exists')
      return
    }
    if (isDuplicateSlug(slug)) {
      setSlugError('A collection with this slug already exists')
      return
    }
    if (items.some((i) => i.display_order < 0 || i.display_order > 99)) {
      alert('Ranks must be between 0 and 99')
      return
    }
    if (rankConflict) {
      alert('Two widgets in this collection have the same rank — please fix before saving')
      return
    }

    setSaving(true)
    try {
      const payload = {
        name,
        slug,
        items: items.map((i) => ({ widget_id: i.widget_id, display_order: i.display_order })),
      }
      const response = editing
        ? await fetch(`/api/collections/${editing}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/collections', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to save collection')

      resetForm()
      fetchCollections()
    } catch (error) {
      console.error('Error:', error)
      alert(error instanceof Error ? error.message : 'Failed to save collection')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this collection? This will remove all its widget associations.')) return

    try {
      const response = await fetch(`/api/collections/${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to delete')
      fetchCollections()
    } catch (error) {
      console.error('Error:', error)
      alert('Failed to delete collection')
    }
  }

  const handleEdit = (collection: Collection) => {
    setFormData({ name: collection.name, slug: collection.slug })
    setItems(
      (collection.collection_items || [])
        .filter((ci) => ci.widgets)
        .map((ci) => ({ widget_id: ci.widget_id, widget_name: ci.widgets!.name, display_order: ci.display_order }))
        .sort((a, b) => a.display_order - b.display_order)
    )
    setEditing(collection.id)
    setNameError('')
    setSlugError('')
    setWidgetSearch('')
    setShowForm(true)
  }

  const resetForm = () => {
    setFormData(emptyForm)
    setItems([])
    setEditing(null)
    setNameError('')
    setSlugError('')
    setWidgetSearch('')
    setShowForm(false)
  }

  const filteredCollections = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return collections
    return collections.filter((c) => c.name.toLowerCase().includes(query))
  }, [collections, search])

  if (loading) return <div className="p-8 text-center text-white">Loading...</div>

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <Link href="/" className="text-blue-400 hover:text-blue-300 mb-4 inline-block">
              ← Back to Dashboard
            </Link>
            <h1 className="text-4xl font-bold">Collections</h1>
            <p className="text-gray-400">Total: {collections.length}</p>
          </div>
          <button
            onClick={() => (showForm ? resetForm() : setShowForm(true))}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-semibold"
          >
            {showForm ? '✕ Cancel' : '+ Create Collection'}
          </button>
        </div>

        {showForm && (
          <div className="bg-gray-800 rounded-lg p-8 mb-8">
            <h2 className="text-2xl font-bold mb-6">{editing ? 'Edit Collection' : 'Create New Collection'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <input
                  type="text"
                  placeholder="Collection Name"
                  value={formData.name}
                  onChange={handleNameChange}
                  required
                  className={`w-full px-4 py-2 bg-gray-700 rounded border focus:outline-none ${
                    nameError ? 'border-red-500' : 'border-gray-600 focus:border-green-500'
                  }`}
                />
                {nameError && <p className="text-sm text-red-400 mt-1">{nameError}</p>}
              </div>

              <div>
                <input
                  type="text"
                  placeholder="URL Slug"
                  value={formData.slug}
                  onChange={handleSlugChange}
                  required
                  className={`w-full px-4 py-2 bg-gray-700 rounded border focus:outline-none ${
                    slugError ? 'border-red-500' : 'border-gray-600 focus:border-green-500'
                  }`}
                />
                {slugError && <p className="text-sm text-red-400 mt-1">{slugError}</p>}
                {formData.slug && !slugError && (
                  <p className="text-xs text-gray-500 mt-1">cozzycub.com/collection/{formData.slug}</p>
                )}
              </div>

              <div className="border border-gray-700 rounded-lg p-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold">Widgets in this collection</h3>
                  <span className="text-xs text-gray-400">{items.length} / 100</span>
                </div>

                {items.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {[...items]
                      .sort((a, b) => a.display_order - b.display_order)
                      .map((item) => (
                        <div key={item.widget_id} className="flex items-center gap-3 bg-gray-700 rounded px-3 py-2">
                          <span className="flex-1 text-sm">{item.widget_name}</span>
                          <input
                            type="number"
                            min={0}
                            max={99}
                            value={item.display_order}
                            onChange={(e) => handleRankChange(item.widget_id, Number(e.target.value))}
                            className="w-16 px-2 py-1 bg-gray-800 rounded border border-gray-600 text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveWidget(item.widget_id)}
                            className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                  </div>
                )}
                {rankConflict && (
                  <p className="text-sm text-red-400 mb-3">Two widgets share the same rank — fix before saving</p>
                )}

                <input
                  type="text"
                  placeholder="Find a widget to add..."
                  value={widgetSearch}
                  onChange={(e) => setWidgetSearch(e.target.value)}
                  disabled={items.length >= 100}
                  className="w-full px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-green-500 focus:outline-none mb-2 disabled:opacity-50"
                />
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {availableWidgets.length === 0 && (
                    <p className="text-xs text-gray-500">
                      {allWidgets.length === 0 ? 'No widgets exist yet — create one first.' : 'No matching widgets.'}
                    </p>
                  )}
                  {availableWidgets.map((widget) => (
                    <button
                      key={widget.id}
                      type="button"
                      onClick={() => handleAddWidget(widget)}
                      disabled={items.length >= 100}
                      className="w-full text-left px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm disabled:opacity-50"
                    >
                      + {widget.name}
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
                  {saving ? 'Saving...' : `${editing ? 'Update' : 'Create'} Collection`}
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
            placeholder="Find a collection by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-md px-4 py-2 bg-gray-800 rounded border border-gray-700 focus:border-green-500 focus:outline-none"
          />
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCollections.map((collection) => (
            <div key={collection.id} className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-xl font-bold mb-1">{collection.name}</h3>
              <p className="text-xs text-gray-500 mb-2">/collection/{collection.slug}</p>
              <p className="text-sm text-gray-400 mb-4">
                {collection.collection_items?.length || 0} widget{collection.collection_items?.length === 1 ? '' : 's'}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(collection)}
                  className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(collection.id)}
                  className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 rounded text-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredCollections.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p>{search ? `No collections match "${search}"` : 'No collections yet. Create your first collection!'}</p>
          </div>
        )}
      </div>
    </div>
  )
}
