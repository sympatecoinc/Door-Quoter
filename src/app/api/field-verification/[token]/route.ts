import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    // Find project by field verification token
    const project = await prisma.project.findUnique({
      where: { fieldVerificationToken: token },
      select: {
        id: true,
        name: true,
        customer: {
          select: { companyName: true }
        },
        fieldVerificationUploads: {
          select: {
            id: true,
            originalName: true,
            uploadedAt: true
          },
          orderBy: { uploadedAt: 'desc' }
        }
      }
    })

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found or link expired' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      id: project.id,
      name: project.name,
      customerName: project.customer?.companyName || null,
      uploads: project.fieldVerificationUploads.map(upload => ({
        id: upload.id,
        originalName: upload.originalName,
        uploadedAt: upload.uploadedAt.toISOString()
      }))
    })
  } catch (error) {
    console.error('Error fetching field verification project:', error)
    return NextResponse.json(
      { error: 'Failed to fetch project' },
      { status: 500 }
    )
  }
}
