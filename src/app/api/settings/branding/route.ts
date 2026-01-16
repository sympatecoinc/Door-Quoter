import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir, unlink } from 'fs/promises'
import path from 'path'
import { existsSync } from 'fs'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'branding')
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp']
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

// GET - Fetch branding settings
export async function GET() {
  try {
    const brandingKeys = ['company_logo', 'primary_color', 'secondary_color']

    const settings = await prisma.globalSetting.findMany({
      where: {
        key: { in: brandingKeys }
      }
    })

    // Convert to object for easier consumption
    const branding: Record<string, string> = {}
    settings.forEach(s => {
      branding[s.key] = s.value
    })

    return NextResponse.json({
      logo: branding.company_logo || null,
      primaryColor: branding.primary_color || '#2563eb',
      secondaryColor: branding.secondary_color || '#1e40af'
    })
  } catch (error) {
    console.error('Error fetching branding settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch branding settings' },
      { status: 500 }
    )
  }
}

// POST - Upload logo
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('logo') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: PNG, JPG, SVG, WebP' },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB' },
        { status: 400 }
      )
    }

    // Ensure upload directory exists
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true })
    }

    // Delete old logo if exists
    const existingSetting = await prisma.globalSetting.findUnique({
      where: { key: 'company_logo' }
    })

    if (existingSetting?.value) {
      const oldPath = path.join(process.cwd(), 'public', existingSetting.value)
      if (existsSync(oldPath)) {
        try {
          await unlink(oldPath)
        } catch (e) {
          console.warn('Could not delete old logo:', e)
        }
      }
    }

    // Generate unique filename
    const ext = path.extname(file.name) || '.png'
    const filename = `logo-${Date.now()}${ext}`
    const filePath = path.join(UPLOAD_DIR, filename)
    const publicPath = `/uploads/branding/${filename}`

    // Write file
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // Upsert the setting
    await prisma.globalSetting.upsert({
      where: { key: 'company_logo' },
      update: { value: publicPath },
      create: {
        key: 'company_logo',
        value: publicPath,
        dataType: 'string',
        category: 'branding',
        description: 'Company logo for quotes and documents'
      }
    })

    return NextResponse.json({
      success: true,
      logo: publicPath
    })
  } catch (error) {
    console.error('Error uploading logo:', error)
    return NextResponse.json(
      { error: 'Failed to upload logo' },
      { status: 500 }
    )
  }
}

// PUT - Update colors
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { primaryColor, secondaryColor } = body

    const updates: Promise<any>[] = []

    if (primaryColor) {
      updates.push(
        prisma.globalSetting.upsert({
          where: { key: 'primary_color' },
          update: { value: primaryColor },
          create: {
            key: 'primary_color',
            value: primaryColor,
            dataType: 'string',
            category: 'branding',
            description: 'Primary brand color'
          }
        })
      )
    }

    if (secondaryColor) {
      updates.push(
        prisma.globalSetting.upsert({
          where: { key: 'secondary_color' },
          update: { value: secondaryColor },
          create: {
            key: 'secondary_color',
            value: secondaryColor,
            dataType: 'string',
            category: 'branding',
            description: 'Secondary brand color'
          }
        })
      )
    }

    await Promise.all(updates)

    return NextResponse.json({
      success: true,
      primaryColor: primaryColor || null,
      secondaryColor: secondaryColor || null
    })
  } catch (error) {
    console.error('Error updating branding colors:', error)
    return NextResponse.json(
      { error: 'Failed to update branding colors' },
      { status: 500 }
    )
  }
}

// DELETE - Remove logo
export async function DELETE() {
  try {
    const setting = await prisma.globalSetting.findUnique({
      where: { key: 'company_logo' }
    })

    if (setting?.value) {
      const filePath = path.join(process.cwd(), 'public', setting.value)
      if (existsSync(filePath)) {
        await unlink(filePath)
      }

      await prisma.globalSetting.delete({
        where: { key: 'company_logo' }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting logo:', error)
    return NextResponse.json(
      { error: 'Failed to delete logo' },
      { status: 500 }
    )
  }
}
