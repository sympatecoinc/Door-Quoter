import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// GET /api/products/[id]/documents - Get all documents associated with a product
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const productId = parseInt(id)

    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
    })

    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      )
    }

    // Get all documents associated with this product
    const associations = await prisma.productQuoteDocument.findMany({
      where: { productId },
      include: {
        quoteDocument: true,
      },
      orderBy: {
        quoteDocument: {
          displayOrder: 'asc',
        },
      },
    })

    const documents = associations.map(assoc => assoc.quoteDocument)

    return NextResponse.json({ success: true, documents })
  } catch (error) {
    console.error('Error fetching product documents:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch product documents' },
      { status: 500 }
    )
  }
}

// POST /api/products/[id]/documents - Associate a document with a product
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const productId = parseInt(id)
    const body = await request.json()
    const { quoteDocumentId } = body

    if (!quoteDocumentId) {
      return NextResponse.json(
        { success: false, error: 'quoteDocumentId is required' },
        { status: 400 }
      )
    }

    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
    })

    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      )
    }

    // Verify document exists
    const document = await prisma.quoteDocument.findUnique({
      where: { id: quoteDocumentId },
    })

    if (!document) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      )
    }

    // Check if association already exists
    const existing = await prisma.productQuoteDocument.findUnique({
      where: {
        productId_quoteDocumentId: {
          productId,
          quoteDocumentId,
        },
      },
    })

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Document is already associated with this product' },
        { status: 400 }
      )
    }

    // Create association
    const association = await prisma.productQuoteDocument.create({
      data: {
        productId,
        quoteDocumentId,
      },
      include: {
        quoteDocument: true,
      },
    })

    return NextResponse.json({ success: true, association })
  } catch (error) {
    console.error('Error associating document with product:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to associate document with product' },
      { status: 500 }
    )
  }
}

// DELETE /api/products/[id]/documents - Remove a document association from a product
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const productId = parseInt(id)
    const { searchParams } = new URL(request.url)
    const quoteDocumentId = parseInt(searchParams.get('quoteDocumentId') || '')

    if (!quoteDocumentId) {
      return NextResponse.json(
        { success: false, error: 'quoteDocumentId is required' },
        { status: 400 }
      )
    }

    // Find and delete the association
    const association = await prisma.productQuoteDocument.findUnique({
      where: {
        productId_quoteDocumentId: {
          productId,
          quoteDocumentId,
        },
      },
    })

    if (!association) {
      return NextResponse.json(
        { success: false, error: 'Association not found' },
        { status: 404 }
      )
    }

    await prisma.productQuoteDocument.delete({
      where: {
        id: association.id,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing document association:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to remove document association' },
      { status: 500 }
    )
  }
}
