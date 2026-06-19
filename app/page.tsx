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
  })

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [w, c, p, cat] = await Promise.all([
          supabase.from('widgets').select('*', { count: 'exact', head: true }),
          supabase.from('collections').select('*', { count: 'exact', head: true }),
          supabase.from('products').select('*', { count: 'exact', head: true }),
          supabase.from('categories').select('*', { count: 'exact', head: true }),
        ])

        setStats({
          widgets: w.count || 0,
          collections: c.count || 0,
          products: p.count || 0,
          categories: cat.count || 0,
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
          <Link href="/widgets" className="bg-gray-800 p-8 rounded-lg hover:bg-gray-700 transition border-l-4 border-blue-500">
            <p className="text-gray-400 text-sm mb-2">Widgets</p>
            <p className="text-4xl font-bold">{stats.widgets}</p>
          </Link>

          <Link href="/collections" className="bg-gray-800 p-8 rounded-lg hover:bg-gray-700 transition border-l-4 border-green-500">
            <p className="text-gray-400 text-sm mb-2">Collections</p>
            <p className="text-4xl font-bold">{stats.collections}</p>
          </Link>

          <Link href="/products" className="bg-gray-800 p-8 rounded-lg hover:bg-gray-700 transition border-l-4 border-purple-500">
            <p className="text-gray-400 text-sm mb-2">Products</p>
            <p className="text-4xl font-bold">{stats.products}</p>
          </Link>

          <Link href="/categories" className="bg-gray-800 p-8 rounded-lg hover:bg-gray-700 transition border-l-4 border-orange-500">
            <p className="text-gray-400 text-sm mb-2">Categories</p>
            <p className="text-4xl font-bold">{stats.categories}</p>
          </Link>
        </div>

        <div className="bg-gray-800 rounded-lg p-8">
          <h2 className="text-2xl font-bold mb-6">Quick Start</h2>
          <ol className="space-y-3 text-gray-300">
            <li>1. Create categories first</li>
            <li>2. Add products to categories</li>
            <li>3. Create widgets for UI components</li>
            <li>4. Group widgets into collections</li>
            <li>5. Website updates in real-time!</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
