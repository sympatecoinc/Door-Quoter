import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const categoryId = searchParams.get('categoryId')

    const where = categoryId ? { categoryId: parseInt(categoryId) } : {}

    const options = await prisma.individualOption.findMany({
      where,
      include: {
        category: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(options)
  } catch (error) {
    console.error('Error fetching options:', error)
    return NextResponse.json(
      { error: 'Failed to fetch options' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { categoryId, name, description, price = 0, partNumber, addToPackingList = false, addFinishToPartNumber = false } = await request.json()

    if (!name || !categoryId) {
      return NextResponse.json(
        { error: 'Name and category ID are required' },
        { status: 400 }
      )
    }

    // Check if option with same part number already exists in this category
    if (partNumber) {
      const existingOption = await prisma.individualOption.findFirst({
        where: {
          categoryId: parseInt(categoryId),
          partNumber: partNumber
        }
      })

      if (existingOption) {
        return NextResponse.json(
          { error: `Option with part number "${partNumber}" already exists in this category` },
          { status: 409 }
        )
      }
    }

    const option = await prisma.individualOption.create({
      data: {
        categoryId: parseInt(categoryId),
        name,
        description,
        price: parseFloat(price),
        partNumber: partNumber || null,
        addToPackingList: Boolean(addToPackingList),
        addFinishToPartNumber: Boolean(addFinishToPartNumber)
      },
      include: {
        category: true
      }
    })

    return NextResponse.json(option, { status: 201 })
  } catch (error) {
    console.error('Error creating option:', error)
    return NextResponse.json(
      { error: 'Failed to create option' },
      { status: 500 }
    )
  }
}