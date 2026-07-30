'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function Dashboard() {
  const [stats, setStats] = useState({
    widgets: 0,
    collections: 0,
    products: 0,
    categories: 0,
    media: 0,
    video: 0,
  })

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [w, c, p, cat, m, v] = await Promise.all([
          supabase.from('widgets').select('*', { count: 'exact', head: true }),
          supabase.from('collections').select('*', { count: 'exact', head: true }),
          supabase.from('products').select('*', { count: 'exact', head: true }),
          supabase.from('categories').select('*', { count: 'exact', head: true }),
          supabase.from('media_assets').select('*', { count: 'exact', head: true }),
          supabase.from('video_assets').select('*', { count: 'exact', head: true }),
        ])

        setStats({
          widgets: w.count || 0,
          collections: c.count || 0,
          products: p.count || 0,
          categories: cat.count || 0,
          media: m.count || 0,
          video: v.count || 0,
        })
      } catch (error) {
        console.error('Error:', error)
      }
    }

    fetchStats()
  }, [])

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-2">Cozzy Cub CMS</h1>
        <p className="text-gray-400 mb-12">Content Management System</p>

        <div className="grid md:grid-cols-4 gap-6 mb-12">
          <Link href="/widgets" className="bg-gray-800 p-8 rounded-lg hover:bg-gray-700 transition border-l-4 border-blue-500 cursor-pointer">
            <p className="text-gray-400 text-sm mb-2">Widgets</p>
            <p className="text-4xl font-bold">{stats.widgets}</p>
            <p className="text-xs text-gray-500 mt-2">✓ Active</p>
          </Link>

          <Link href="/collections" className="bg-gray-800 p-8 rounded-lg hover:bg-gray-700 transition border-l-4 border-green-500 cursor-pointer">
            <p className="text-gray-400 text-sm mb-2">Collections</p>
            <p className="text-4xl font-bold">{stats.collections}</p>
            <p className="text-xs text-gray-500 mt-2">Coming soon</p>
          </Link>

          <Link href="/products" className="bg-gray-800 p-8 rounded-lg hover:bg-gray-700 transition border-l-4 border-purple-500 cursor-pointer">
            <p className="text-gray-400 text-sm mb-2">Products</p>
            <p className="text-4xl font-bold">{stats.products}</p>
            <p className="text-xs text-gray-500 mt-2">✓ Active</p>
          </Link>

          <Link href="/categories" className="bg-gray-800 p-8 rounded-lg hover:bg-gray-700 transition border-l-4 border-orange-500 cursor-pointer">
            <p className="text-gray-400 text-sm mb-2">Categories</p>
            <p className="text-4xl font-bold">{stats.categories}</p>
            <p className="text-xs text-gray-500 mt-2">✓ Active</p>
          </Link>
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-6">Media</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <Link href="/media" className="bg-gray-800 p-8 rounded-lg hover:bg-gray-700 transition border-l-4 border-pink-500 cursor-pointer text-center">
              <p className="text-2xl font-bold mb-2">🖼️ Image</p>
              <p className="text-4xl font-bold">{stats.media}</p>
              <p className="text-xs text-gray-500 mt-2">✓ Active</p>
            </Link>

            <Link href="/video" className="bg-gray-800 p-8 rounded-lg hover:bg-gray-700 transition border-l-4 border-cyan-500 cursor-pointer text-center">
              <p className="text-2xl font-bold mb-2">🎬 Video</p>
              <p className="text-4xl font-bold">{stats.video}</p>
              <p className="text-xs text-gray-500 mt-2">✓ Active</p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
