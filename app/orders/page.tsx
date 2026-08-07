'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const STATUSES = [
  { value: 'order_received', label: 'Order Received' },
  { value: 'order_being_prepared', label: 'Order Being Prepared' },
  { value: 'order_ready_to_ship', label: 'Order Ready to Ship' },
  { value: 'order_shipped', label: 'Order Shipped' },
  { value: 'order_delivered', label: 'Order Delivered' },
] as const

const EMAIL_TYPES = [
  { value: 'order_placed', label: 'Order Placed' },
  { value: 'order_shipped', label: 'Order Shipped' },
  { value: 'order_delivered', label: 'Order Delivered' },
  { value: 'nps_survey', label: 'NPS Survey' },
] as const

const PAGE_SIZE = 25

interface Order {
  id: string
  order_number: string
  created_at: string
  customer_name: string
  customer_email: string | null
  customer_phone: string | null
  delivery_address_line: string
  delivery_landmark: string | null
  delivery_city: string | null
  delivery_state: string | null
  delivery_pincode: string
  subtotal: number
  discount_amount: number
  shipping_fee: number
  total_amount: number
  promo_code: string | null
  status: string
}

interface OrderItem {
  id: string
  product_code: string
  product_name: string
  image_url: string | null
  quantity: number
  unit_price: number
  line_total: number
}

interface OrderEmail {
  id: string
  email_type: string
  status: string
  triggered_at: string
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function statusLabel(value: string) {
  return STATUSES.find((s) => s.value === value)?.label || value
}

function formatAddress(order: Order) {
  return [order.delivery_address_line, order.delivery_landmark, order.delivery_city, order.delivery_state, order.delivery_pincode]
    .filter(Boolean)
    .join(', ')
}

function pageNumbers(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages = new Set([1, 2, total - 1, total, current - 1, current, current + 1])
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b)
  const result: (number | '…')[] = []
  sorted.forEach((p, i) => {
    if (i > 0 && p - (sorted[i - 1] as number) > 1) result.push('…')
    result.push(p)
  })
  return result
}

export default function OrdersManager() {
  const [orders, setOrders] = useState<Order[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [addressPopover, setAddressPopover] = useState<{ id: string; top: number; left: number } | null>(null)
  const [statusSaving, setStatusSaving] = useState<string | null>(null)
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null)

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchOrders()
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, 300)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, fromDate, toDate, page])

  const fetchOrders = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (search.trim()) params.set('search', search.trim())
      if (fromDate) params.set('from', fromDate)
      if (toDate) params.set('to', toDate)

      const response = await fetch(`/api/orders?${params.toString()}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to load orders')
      setOrders(data.orders || [])
      setTotal(data.total || 0)
    } catch (error) {
      console.error('Error:', error)
      alert('Failed to load orders')
    } finally {
      setLoading(false)
    }
  }

  const resetToFirstPage = () => {
    if (page !== 1) setPage(1)
  }

  const handleStatusChange = async (orderId: string, status: string) => {
    setStatusSaving(orderId)
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to update status')
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)))
    } catch (error) {
      console.error('Error:', error)
      alert(error instanceof Error ? error.message : 'Failed to update status')
    } finally {
      setStatusSaving(null)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  if (loading && orders.length === 0) return <div className="p-8 text-center text-white">Loading...</div>

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Link href="/" className="text-blue-400 hover:text-blue-300 mb-4 inline-block">
            ← Back to Dashboard
          </Link>
          <h1 className="text-4xl font-bold">Orders</h1>
          <p className="text-gray-400">Total: {total}</p>
        </div>

        <div className="flex flex-wrap gap-4 mb-6">
          <input
            type="text"
            placeholder="Search by order ID or customer name..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              resetToFirstPage()
            }}
            className="flex-1 min-w-[240px] px-4 py-2 bg-gray-800 rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
          />
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400">From</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value)
                resetToFirstPage()
              }}
              className="px-3 py-2 bg-gray-800 rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400">To</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value)
                resetToFirstPage()
              }}
              className="px-3 py-2 bg-gray-800 rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
            />
          </div>
          {(search || fromDate || toDate) && (
            <button
              onClick={() => {
                setSearch('')
                setFromDate('')
                setToDate('')
                resetToFirstPage()
              }}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
            >
              Clear filters
            </button>
          )}
        </div>

        <div className="bg-gray-800 rounded-lg overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-6 py-4 text-left">Order ID</th>
                <th className="px-6 py-4 text-left">Placed On</th>
                <th className="px-6 py-4 text-left">Customer</th>
                <th className="px-6 py-4 text-left">Pincode</th>
                <th className="px-6 py-4 text-left">Address</th>
                <th className="px-6 py-4 text-left">Status</th>
                <th className="px-6 py-4 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-700 transition">
                  <td className="px-6 py-4 font-mono text-sm text-blue-300">{order.order_number}</td>
                  <td className="px-6 py-4 text-sm text-gray-300 whitespace-nowrap">{formatDate(order.created_at)}</td>
                  <td className="px-6 py-4 font-semibold">{order.customer_name}</td>
                  <td className="px-6 py-4 text-sm font-mono">{order.delivery_pincode}</td>
                  <td className="px-6 py-4">
                    <button
                      onClick={(e) => {
                        if (addressPopover?.id === order.id) {
                          setAddressPopover(null)
                          return
                        }
                        const rect = e.currentTarget.getBoundingClientRect()
                        setAddressPopover({ id: order.id, top: rect.bottom + 8, left: rect.left })
                      }}
                      className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                    >
                      View address
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <select
                      value={order.status}
                      disabled={statusSaving === order.id}
                      onChange={(e) => handleStatusChange(order.id, e.target.value)}
                      className="px-3 py-2 bg-gray-700 rounded border border-gray-600 text-sm focus:border-blue-500 focus:outline-none disabled:opacity-50"
                    >
                      {STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => setActiveOrderId(order.id)}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
                    >
                      Take Action
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!loading && orders.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <p>{search || fromDate || toDate ? 'No orders match your filters' : 'No orders yet.'}</p>
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-6">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 rounded text-sm"
            >
              Prev
            </button>
            {pageNumbers(page, totalPages).map((p, i) =>
              p === '…' ? (
                <span key={`ellipsis-${i}`} className="px-2 text-gray-500">
                  …
                </span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`px-3 py-2 rounded text-sm ${
                    p === page ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'
                  }`}
                >
                  {p}
                </button>
              )
            )}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 rounded text-sm"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {addressPopover && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAddressPopover(null)} />
          <div
            className="fixed z-50 w-72 bg-gray-900 border border-gray-600 rounded-lg p-4 shadow-xl text-sm text-gray-200"
            style={{ top: addressPopover.top, left: addressPopover.left }}
          >
            {formatAddress(orders.find((o) => o.id === addressPopover.id)!)}
          </div>
        </>
      )}

      {activeOrderId && (
        <OrderActionSidebar
          orderId={activeOrderId}
          statuses={STATUSES}
          onClose={() => setActiveOrderId(null)}
          onStatusChange={(status) => {
            setOrders((prev) => prev.map((o) => (o.id === activeOrderId ? { ...o, status } : o)))
          }}
        />
      )}
    </div>
  )
}

function OrderActionSidebar({
  orderId,
  statuses,
  onClose,
  onStatusChange,
}: {
  orderId: string
  statuses: readonly { value: string; label: string }[]
  onClose: () => void
  onStatusChange: (status: string) => void
}) {
  const [order, setOrder] = useState<Order | null>(null)
  const [items, setItems] = useState<OrderItem[]>([])
  const [emails, setEmails] = useState<OrderEmail[]>([])
  const [loading, setLoading] = useState(true)
  const [savingStatus, setSavingStatus] = useState(false)
  const [sendingType, setSendingType] = useState<string | null>(null)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    fetchDetail()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId])

  const fetchDetail = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/orders/${orderId}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to load order')
      setOrder(data.order)
      setItems(data.items || [])
      setEmails(data.emails || [])
    } catch (error) {
      console.error('Error:', error)
      alert('Failed to load order details')
      onClose()
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (status: string) => {
    setSavingStatus(true)
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to update status')
      setOrder((prev) => (prev ? { ...prev, status } : prev))
      onStatusChange(status)
    } catch (error) {
      console.error('Error:', error)
      alert(error instanceof Error ? error.message : 'Failed to update status')
    } finally {
      setSavingStatus(false)
    }
  }

  const handleSendEmail = async (type: string) => {
    setSendingType(type)
    setNotice('')
    try {
      const response = await fetch(`/api/orders/${orderId}/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to trigger email')
      setEmails((prev) => [data.email, ...prev])
      setNotice(data.warning || 'Triggered.')
    } catch (error) {
      console.error('Error:', error)
      alert(error instanceof Error ? error.message : 'Failed to trigger email')
    } finally {
      setSendingType(null)
    }
  }

  const lastSentFor = (type: string) => emails.find((e) => e.email_type === type)

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-gray-800 z-50 shadow-2xl overflow-y-auto">
        <div className="p-6 border-b border-gray-700 flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold">{order?.order_number || 'Order'}</h2>
            {order && <p className="text-sm text-gray-400">{formatDate(order.created_at)}</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">
            ✕
          </button>
        </div>

        {loading || !order ? (
          <div className="p-6 text-gray-400">Loading...</div>
        ) : (
          <div className="p-6 space-y-8">
            <div>
              <h3 className="font-semibold mb-2 text-gray-300">Customer</h3>
              <p>{order.customer_name}</p>
              {order.customer_email && <p className="text-sm text-gray-400">{order.customer_email}</p>}
              {order.customer_phone && <p className="text-sm text-gray-400">{order.customer_phone}</p>}
              <p className="text-sm text-gray-400 mt-2">{formatAddress(order)}</p>
            </div>

            <div>
              <h3 className="font-semibold mb-2 text-gray-300">Items</h3>
              <div className="space-y-2">
                {items.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span>
                      {item.product_name} × {item.quantity}
                    </span>
                    <span>₹{item.line_total}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-700 mt-3 pt-3 text-sm space-y-1">
                <div className="flex justify-between text-gray-400">
                  <span>Subtotal</span>
                  <span>₹{order.subtotal}</span>
                </div>
                {order.discount_amount > 0 && (
                  <div className="flex justify-between text-gray-400">
                    <span>Discount{order.promo_code ? ` (${order.promo_code})` : ''}</span>
                    <span>−₹{order.discount_amount}</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-400">
                  <span>Shipping</span>
                  <span>₹{order.shipping_fee}</span>
                </div>
                <div className="flex justify-between font-semibold text-white">
                  <span>Total</span>
                  <span>₹{order.total_amount}</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2 text-gray-300">Status</h3>
              <select
                value={order.status}
                disabled={savingStatus}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none disabled:opacity-50"
              >
                {statuses.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <h3 className="font-semibold mb-2 text-gray-300">Send Email</h3>
              <p className="text-xs text-gray-500 mb-3">
                No email provider is connected yet — triggers below are logged for this order but no email is actually sent.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {EMAIL_TYPES.map((et) => {
                  const last = lastSentFor(et.value)
                  return (
                    <button
                      key={et.value}
                      onClick={() => handleSendEmail(et.value)}
                      disabled={sendingType === et.value}
                      className="px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded text-sm text-left"
                    >
                      <div>{et.label}</div>
                      {last && (
                        <div className="text-xs text-green-400 mt-1">Logged {formatDate(last.triggered_at)}</div>
                      )}
                    </button>
                  )
                })}
              </div>
              {notice && <p className="text-xs text-gray-400 mt-3">{notice}</p>}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
