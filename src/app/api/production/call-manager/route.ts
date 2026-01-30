import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface CallManagerRequest {
  station: string
  issueType: 'URGENT' | 'MATERIAL' | 'EQUIPMENT' | 'QUALITY' | 'OTHER'
  message: string
  workOrderId?: string | null
}

const ISSUE_TYPE_LABELS: Record<string, string> = {
  URGENT: 'Urgent - Needs immediate attention',
  MATERIAL: 'Material Issue - Shortage or quality issue',
  EQUIPMENT: 'Equipment Problem - Malfunction or maintenance needed',
  QUALITY: 'Quality Concern - Quality issue with product',
  OTHER: 'Other - General assistance needed'
}

export async function POST(request: NextRequest) {
  try {
    const body: CallManagerRequest = await request.json()
    const { station, issueType, message, workOrderId } = body

    // Validate required fields
    if (!station || !issueType || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: station, issueType, and message are required' },
        { status: 400 }
      )
    }

    // Fetch all users with MANAGER or ADMIN role
    const managers = await prisma.user.findMany({
      where: {
        role: {
          in: ['MANAGER', 'ADMIN']
        },
        isActive: true
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true
      }
    })

    if (managers.length === 0) {
      console.warn('[CallManager] No managers found to notify')
      return NextResponse.json(
        { error: 'No managers configured to receive notifications' },
        { status: 404 }
      )
    }

    // Get work order details if provided
    let workOrderDetails = null
    if (workOrderId) {
      const workOrder = await prisma.workOrder.findUnique({
        where: { id: workOrderId },
        include: {
          project: {
            select: {
              id: true,
              name: true,
              customer: {
                select: {
                  companyName: true
                }
              }
            }
          }
        }
      })
      if (workOrder) {
        workOrderDetails = {
          id: workOrder.id,
          batchNumber: workOrder.batchNumber,
          projectName: workOrder.project.name,
          customerName: workOrder.project.customer?.companyName || 'No Customer'
        }
      }
    }

    // Build notification content
    const issueTypeLabel = ISSUE_TYPE_LABELS[issueType] || issueType
    const timestamp = new Date().toLocaleString('en-US', {
      timeZone: 'America/Chicago', // Adjust to your timezone
      dateStyle: 'short',
      timeStyle: 'short'
    })

    const notificationContent = {
      timestamp,
      station,
      issueType,
      issueTypeLabel,
      message,
      workOrder: workOrderDetails,
      recipients: managers.map(m => ({
        id: m.id,
        name: m.name,
        email: m.email,
        role: m.role
      }))
    }

    // MOCK: Log the notification (replace with actual email service later)
    console.log('='.repeat(60))
    console.log('[CallManager] NOTIFICATION TO PRODUCTION MANAGERS')
    console.log('='.repeat(60))
    console.log(`Time: ${timestamp}`)
    console.log(`Station: ${station}`)
    console.log(`Issue Type: ${issueTypeLabel}`)
    console.log(`Message: ${message}`)
    if (workOrderDetails) {
      console.log(`Work Order: Batch ${workOrderDetails.batchNumber} - ${workOrderDetails.projectName} (${workOrderDetails.customerName})`)
    }
    console.log('-'.repeat(60))
    console.log('Recipients:')
    managers.forEach(m => {
      console.log(`  - ${m.name} (${m.email}) [${m.role}]`)
    })
    console.log('='.repeat(60))

    // TODO: Replace with actual email service implementation
    // Example structure for email integration:
    // await sendEmail({
    //   to: managers.map(m => m.email),
    //   subject: `[${issueType}] Production Alert - ${station} Station`,
    //   template: 'production-alert',
    //   data: notificationContent
    // })

    return NextResponse.json({
      success: true,
      message: `Notification sent to ${managers.length} manager(s)`,
      recipients: managers.map(m => m.email),
      notification: notificationContent
    })
  } catch (error) {
    console.error('[CallManager] Error sending notification:', error)
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    )
  }
}
