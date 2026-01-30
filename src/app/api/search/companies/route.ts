import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Combined search endpoint for companies - searches both Customers and Prospect Projects
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 20)

    if (search.length < 2) {
      return NextResponse.json({ results: [] })
    }

    // Search customers with status Active or Lead
    const customers = await prisma.customer.findMany({
      where: {
        OR: [
          { companyName: { contains: search, mode: 'insensitive' } },
          { contactName: { contains: search, mode: 'insensitive' } }
        ],
        status: { in: ['Active', 'Lead'] }
      },
      select: {
        id: true,
        companyName: true,
        city: true,
        state: true,
        phone: true,
        address: true,
        zipCode: true,
        status: true
      },
      orderBy: { companyName: 'asc' },
      take: limit
    })

    // Search prospect projects (projects with prospectCompanyName but no customer)
    const prospectProjects = await prisma.project.findMany({
      where: {
        prospectCompanyName: { contains: search, mode: 'insensitive' },
        customerId: null
      },
      select: {
        id: true,
        prospectCompanyName: true,
        prospectCity: true,
        prospectState: true,
        prospectPhone: true,
        prospectAddress: true,
        prospectZipCode: true,
        name: true,
        status: true
      },
      orderBy: { prospectCompanyName: 'asc' },
      take: limit
    })

    // Transform and combine results
    const customerResults = customers.map(c => ({
      id: c.id,
      type: 'customer' as const,
      companyName: c.companyName,
      city: c.city,
      state: c.state,
      phone: c.phone,
      address: c.address,
      zipCode: c.zipCode,
      status: c.status
    }))

    const prospectResults = prospectProjects.map(p => ({
      id: p.id,
      type: 'prospect' as const,
      companyName: p.prospectCompanyName || '',
      city: p.prospectCity,
      state: p.prospectState,
      phone: p.prospectPhone,
      address: p.prospectAddress,
      zipCode: p.prospectZipCode,
      projectName: p.name,
      projectStatus: p.status
    }))

    // Combine results, customers first, then prospects
    // Deduplicate by company name (case-insensitive) to avoid showing same company from both sources
    const seenCompanyNames = new Set<string>()
    const combinedResults: Array<typeof customerResults[0] | typeof prospectResults[0]> = []

    for (const customer of customerResults) {
      const normalizedName = customer.companyName.toLowerCase().trim()
      if (!seenCompanyNames.has(normalizedName)) {
        seenCompanyNames.add(normalizedName)
        combinedResults.push(customer)
      }
    }

    for (const prospect of prospectResults) {
      const normalizedName = prospect.companyName.toLowerCase().trim()
      if (!seenCompanyNames.has(normalizedName)) {
        seenCompanyNames.add(normalizedName)
        combinedResults.push(prospect)
      }
    }

    // Limit total results
    const results = combinedResults.slice(0, limit)

    return NextResponse.json({ results })
  } catch (error) {
    console.error('Error searching companies:', error)
    return NextResponse.json(
      { error: 'Failed to search companies' },
      { status: 500 }
    )
  }
}
