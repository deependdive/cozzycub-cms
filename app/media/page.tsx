'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useDropzone, type FileRejection } from 'react-dropzone'
import { supabase } from '@/lib/supabase'

interface MediaAsset {
  id: string
  filename: string
  url: string
  size: number
  content_type: string
  created_at: string
}

export default function MediaManager() {
  const [media, setMedia] = useState<MediaAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    fetchMedia()
  }, [])

  const fetchMedia = async () => {
    try {
      const { data, error } = await supabase.from('media_assets').select('*').order('created_at', { ascending: false })
      if (error) throw error
      setMedia(data || [])
    } catch (error) {
      console.error('Error:', error)
      alert('Failed to load media')
    } finally {
      setLoading(false)
    }
  }

  const uploadFile = async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch('/api/media', { method: 'POST', body: formData })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Upload failed')
    return data.media as MediaAsset
  }

  const onDrop = useCallback(async (acceptedFiles: File[], fileRejections: FileRejection[]) => {
    for (const rejection of fileRejections) {
      if (rejection.errors.some((e) => e.code === 'file-too-large')) {
        alert(
          `File is too large. Maximum size is 2MB. "${rejection.file.name}" is ${(rejection.file.size / 1024 / 1024).toFixed(2)}MB`
        )
      }
    }

    setUploading(true)
    try {
      for (const file of acceptedFiles) {
        const asset = await uploadFile(file)
        setMedia((prev) => [asset, ...prev])
      }
    } catch (error) {
      console.error('Error:', error)
      alert(error instanceof Error ? error.message : 'Failed to upload image')
    } finally {
      setUploading(false)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    maxSize: 2 * 1024 * 1024,
    disabled: uploading,
  })

  const handleCopy = async (asset: MediaAsset) => {
    await navigator.clipboard.writeText(asset.url)
    setCopiedId(asset.id)
    setTimeout(() => setCopiedId((current) => (current === asset.id ? null : current)), 1500)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this image? Any widget referencing its URL will break.')) return

    try {
      const response = await fetch(`/api/media/${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to delete')
      setMedia((prev) => prev.filter((m) => m.id !== id))
    } catch (error) {
      console.error('Error:', error)
      alert('Failed to delete image')
    }
  }

  if (loading) return <div className="p-8 text-center text-white">Loading...</div>

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Link href="/" className="text-blue-400 hover:text-blue-300 mb-4 inline-block">
            ← Back to Dashboard
          </Link>
          <h1 className="text-4xl font-bold">Media</h1>
          <p className="text-gray-400">Total: {media.length}</p>
        </div>

        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-12 mb-8 text-center cursor-pointer transition ${
            isDragActive ? 'border-blue-500 bg-blue-500/10' : 'border-gray-600 bg-gray-800/30 hover:bg-gray-800/60'
          } ${uploading ? 'opacity-50 cursor-wait' : ''}`}
        >
          <input {...getInputProps()} />
          <p className="text-lg font-semibold mb-1">
            {uploading ? '⏳ Uploading...' : isDragActive ? 'Drop images here' : '📸 Drag & drop images, or click to select'}
          </p>
          <p className="text-sm text-gray-400">Max 2MB per image • JPG, PNG, WebP</p>
        </div>

        <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {media.map((asset) => (
            <div key={asset.id} className="bg-gray-800 rounded-lg overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset.url} alt={asset.filename} className="w-full h-40 object-cover bg-gray-700" />
              <div className="p-4">
                <p className="font-semibold truncate" title={asset.filename}>
                  {asset.filename}
                </p>
                <p className="text-xs text-gray-500 mb-3">{(asset.size / 1024).toFixed(1)} KB</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCopy(asset)}
                    className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm"
                  >
                    {copiedId === asset.id ? '✓ Copied' : 'Copy URL'}
                  </button>
                  <button
                    onClick={() => handleDelete(asset.id)}
                    className="px-3 py-2 bg-red-600 hover:bg-red-700 rounded text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {media.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p>No images yet. Upload your first image!</p>
          </div>
        )}
      </div>
    </div>
  )
}
