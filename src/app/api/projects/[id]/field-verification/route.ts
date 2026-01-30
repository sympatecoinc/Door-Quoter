import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { createFieldVerificationPDF, FieldVerificationOpening } from '@/lib/field-verification-pdf-generator'
import crypto from 'crypto'

// Helper function to get company logo from branding settings
async function getCompanyLogo(): Promise<string | null> {
  try {
    const logoSetting = await prisma.globalSetting.findUnique({
      where: { key: 'company_logo' }
    })
    return logoSetting?.value || null
  } catch (error) {
    console.error('Error fetching company logo:', error)
    return null
  }
}

// Natural sort comparison for opening names (handles "2" before "10", "Office 1" before "Office 10")
function naturalSortCompare(a: string, b: string): number {
  const aParts = a.split(/(\d+)/)
  const bParts = b.split(/(\d+)/)

  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aPart = aParts[i] || ''
    const bPart = bParts[i] || ''

    const aNum = parseInt(aPart, 10)
    const bNum = parseInt(bPart, 10)

    if (!isNaN(aNum) && !isNaN(bNum)) {
      if (aNum !== bNum) return aNum - bNum
    } else {
      const cmp = aPart.localeCompare(bPart, undefined, { sensitivity: 'base' })
      if (cmp !== 0) return cmp
    }
  }
  return 0
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const projectId = parseInt(id)

    if (isNaN(projectId)) {
      return NextResponse.json(
        { error: 'Invalid project ID' },
        { status: 400 }
      )
    }

    // Fetch project with openings and panels (for calculating dimensions)
    let project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        customer: {
          select: { companyName: true }
        },
        openings: {
          include: {
            panels: {
              select: {
                width: true,
                height: true
              },
              orderBy: { displayOrder: 'asc' }
            }
          }
        }
      }
    })

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    // Generate field verification token if it doesn't exist
    if (!project.fieldVerificationToken) {
      project = await prisma.project.update({
        where: { id: projectId },
        data: { fieldVerificationToken: crypto.randomUUID() },
        include: {
          customer: {
            select: { companyName: true }
          },
          openings: {
            include: {
              panels: {
                select: {
                  width: true,
                  height: true
                },
                orderBy: { displayOrder: 'asc' }
              }
            }
          }
        }
      })
    }

    // Build verification URL
    const headersList = await headers()
    const host = headersList.get('host') || 'localhost:3000'
    const protocol = host.includes('localhost') ? 'http' : 'https'
    const verificationUrl = `${protocol}://${host}/field-verification/${project.fieldVerificationToken}`

    // Sort openings by name using natural sort
    const sortedOpenings = [...project.openings].sort((a, b) =>
      naturalSortCompare(a.name || '', b.name || '')
    )

    // Map openings to the format expected by the PDF generator
    // Calculate dimensions from panels if rough/finished dimensions are not set
    const openings: FieldVerificationOpening[] = sortedOpenings.map(opening => {
      // Calculate frame dimensions from panels: width = sum of widths, height = max height
      const calculatedWidth = opening.panels.length > 0
        ? opening.panels.reduce((sum, p) => sum + p.width, 0)
        : null
      const calculatedHeight = opening.panels.length > 0
        ? Math.max(...opening.panels.map(p => p.height))
        : null

      return {
        name: opening.name,
        // Use stored rough dimensions, or fall back to calculated from panels
        roughWidth: opening.roughWidth ?? calculatedWidth,
        roughHeight: opening.roughHeight ?? calculatedHeight,
        // Use stored finished dimensions, or fall back to calculated from panels
        finishedWidth: opening.finishedWidth ?? calculatedWidth,
        finishedHeight: opening.finishedHeight ?? calculatedHeight
      }
    })

    // Get company logo
    const companyLogo = await getCompanyLogo()

    // Generate PDF
    const pdfBuffer = await createFieldVerificationPDF({
      projectName: project.name,
      customerName: project.customer?.companyName,
      companyLogo,
      openings,
      generatedDate: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      verificationUrl
    })

    // Generate filename
    const safeProjectName = project.name.replace(/[^a-zA-Z0-9]/g, '-')
    const filename = `${safeProjectName}-field-verification.pdf`

    // Return PDF response
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString()
      }
    })
  } catch (error) {
    console.error('Error generating field verification PDF:', error)
    return NextResponse.json(
      { error: 'Failed to generate field verification PDF' },
      { status: 500 }
    )
  }
}
