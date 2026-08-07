import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

const EMAIL_TYPES = ['order_placed', 'order_shipped', 'order_delivered', 'nps_survey'] as const

// No email provider is wired up yet (no Resend/SendGrid/etc. configured).
// This just logs the trigger so the CMS can show "sent" state — swap in a
// real provider call here once one is chosen.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = (await request.json()) as { type?: string }

    if (!body.type || !EMAIL_TYPES.includes(body.type as (typeof EMAIL_TYPES)[number])) {
      return NextResponse.json({ error: 'Invalid email type' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('order_emails')
      .insert({ order_id: id, email_type: body.type, status: 'logged' })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      email: data,
      warning: 'No email provider is configured yet — this trigger was logged but no email was actually sent.',
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Failed to log email trigger' }, { status: 500 })
  }
}
