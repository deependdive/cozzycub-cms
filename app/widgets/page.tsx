'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface Widget {
  id: string
  name: string
  json_data: unknown
  created_at: string
  updated_at: string
}

const emptyForm = { name: '', jsonText: '' }

export default function WidgetsManager() {
  const [widgets, setWidgets] = useState<Widget[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [formData, setFormData] = useState(emptyForm)
  const [nameError, setNameError] = useState('')
  const [jsonError, setJsonError] = useState('')
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchWidgets()
  }, [])

  const fetchWidgets = async () => {
    try {
      const { data, error } = await supabase.from('widgets').select('*').order('created_at', { ascending: false })
      if (error) throw error
      setWidgets(data || [])
    } catch (error) {
      console.error('Error:', error)
      alert('Failed to load widgets')
    } finally {
      setLoading(false)
    }
  }

  const isDuplicateName = (name: string) => {
    const normalized = name.trim().toLowerCase()
    return widgets.some((w) => w.id !== editing && w.name.toLowerCase() === normalized)
  }

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setFormData((prev) => ({ ...prev, name: value }))
    setNameError(isDuplicateName(value) ? 'A widget with this name already exists' : '')
  }

  const handleJsonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, jsonText: e.target.value }))
    if (jsonError) setJsonError('')
  }

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(formData.jsonText)
      setFormData((prev) => ({ ...prev, jsonText: JSON.stringify(parsed, null, 2) }))
      setJsonError('')
    } catch {
      setJsonError('Invalid JSON — fix syntax before formatting')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const name = formData.name.trim()
    if (!name) {
      setNameError('Widget name is required')
      return
    }
    if (isDuplicateName(name)) {
      setNameError('A widget with this name already exists')
      return
    }

    let jsonData: unknown
    try {
      jsonData = JSON.parse(formData.jsonText)
    } catch {
      setJsonError('Invalid JSON — please check syntax')
      return
    }

    setSaving(true)
    try {
      const payload = { name, json_data: jsonData }
      const response = editing
        ? await fetch(`/api/widgets/${editing}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/widgets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to save widget')

      resetForm()
      fetchWidgets()
    } catch (error) {
      console.error('Error:', error)
      alert(error instanceof Error ? error.message : 'Failed to save widget')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this widget?')) return

    try {
      const response = await fetch(`/api/widgets/${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to delete')
      fetchWidgets()
    } catch (error) {
      console.error('Error:', error)
      alert('Failed to delete widget')
    }
  }

  const handleEdit = (widget: Widget) => {
    setFormData({ name: widget.name, jsonText: JSON.stringify(widget.json_data, null, 2) })
    setEditing(widget.id)
    setNameError('')
    setJsonError('')
    setShowForm(true)
  }

  const resetForm = () => {
    setFormData(emptyForm)
    setEditing(null)
    setNameError('')
    setJsonError('')
    setShowForm(false)
  }

  const filteredWidgets = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return widgets
    return widgets.filter((w) => w.name.toLowerCase().includes(query))
  }, [widgets, search])

  if (loading) return <div className="p-8 text-center text-white">Loading...</div>

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <Link href="/" className="text-blue-400 hover:text-blue-300 mb-4 inline-block">
              ← Back to Dashboard
            </Link>
            <h1 className="text-4xl font-bold">Widgets</h1>
            <p className="text-gray-400">Total: {widgets.length}</p>
          </div>
          <button
            onClick={() => (showForm ? resetForm() : setShowForm(true))}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold"
          >
            {showForm ? '✕ Cancel' : '+ Create Widget'}
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <div className="bg-gray-800 rounded-lg p-8 mb-8">
            <h2 className="text-2xl font-bold mb-6">{editing ? 'Edit Widget' : 'Create New Widget'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <input
                  type="text"
                  name="name"
                  placeholder="Widget Name"
                  value={formData.name}
                  onChange={handleNameChange}
                  required
                  className={`w-full px-4 py-2 bg-gray-700 rounded border focus:outline-none ${
                    nameError ? 'border-red-500' : 'border-gray-600 focus:border-blue-500'
                  }`}
                />
                {nameError && <p className="text-sm text-red-400 mt-1">{nameError}</p>}
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-sm text-gray-400">Widget JSON</label>
                  <button
                    type="button"
                    onClick={handleFormatJson}
                    className="text-xs px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded"
                  >
                    Format JSON
                  </button>
                </div>
                <textarea
                  name="jsonText"
                  placeholder={'{\n  "type": "banner",\n  "title": "Hello"\n}'}
                  value={formData.jsonText}
                  onChange={handleJsonChange}
                  required
                  rows={12}
                  spellCheck={false}
                  className={`w-full px-4 py-2 bg-gray-700 rounded border font-mono text-sm focus:outline-none ${
                    jsonError ? 'border-red-500' : 'border-gray-600 focus:border-blue-500'
                  }`}
                />
                {jsonError && <p className="text-sm text-red-400 mt-1">{jsonError}</p>}
              </div>

              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded font-semibold"
                >
                  {saving ? 'Saving...' : `${editing ? 'Update' : 'Create'} Widget`}
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

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Find a widget by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-md px-4 py-2 bg-gray-800 rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* Widgets Table */}
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-6 py-4 text-left">Name</th>
                <th className="px-6 py-4 text-left">JSON Preview</th>
                <th className="px-6 py-4 text-left">Updated</th>
                <th className="px-6 py-4 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {filteredWidgets.map((widget) => (
                <tr key={widget.id} className="hover:bg-gray-700 transition">
                  <td className="px-6 py-4 font-semibold align-top">{widget.name}</td>
                  <td className="px-6 py-4 align-top">
                    <code className="text-xs text-gray-400 block max-w-md truncate">
                      {JSON.stringify(widget.json_data)}
                    </code>
                  </td>
                  <td className="px-6 py-4 align-top text-sm text-gray-400">
                    {new Date(widget.updated_at || widget.created_at).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 align-top space-x-2 whitespace-nowrap">
                    <button
                      onClick={() => handleEdit(widget)}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(widget.id)}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredWidgets.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <p>{search ? `No widgets match "${search}"` : 'No widgets yet. Create your first widget!'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
