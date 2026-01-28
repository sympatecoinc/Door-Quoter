/**
 * Portal Seed Script
 *
 * Seeds the initial portal configurations for subdomain-based access.
 * Run with: npx ts-node prisma/seed-portals.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const portals = [
  {
    subdomain: 'purchasing',
    name: 'Purchasing Portal',
    description: 'Portal for purchasing department - manage vendors, POs, and inventory',
    defaultTab: 'purchasingDashboard',
    headerTitle: 'Purchasing Portal',
    tabs: ['purchasingDashboard', 'vendors', 'purchaseOrders', 'inventory', 'masterParts'],
    isActive: true
  },
  {
    subdomain: 'shipping',
    name: 'Shipping Portal',
    description: 'Portal for shipping/logistics - manage shipments, projects, and production',
    defaultTab: 'logistics',
    headerTitle: 'Shipping Portal',
    tabs: ['logistics', 'projects', 'production', 'inventory'],
    isActive: true
  },
  {
    subdomain: 'receiving',
    name: 'Receiving Portal',
    description: 'Portal for receiving department - receive POs and manage inventory',
    defaultTab: 'receiving',
    headerTitle: 'Receiving Portal',
    tabs: ['receiving', 'inventory', 'purchaseOrders', 'vendors'],
    isActive: true
  },
  {
    subdomain: 'sales',
    name: 'Sales Portal',
    description: 'Portal for sales team - manage customers, leads, projects, and quotes',
    defaultTab: 'dashboard',
    headerTitle: 'Sales Portal',
    tabs: ['dashboard', 'customers', 'crm', 'projects', 'salesOrders', 'invoices', 'quoteDocuments'],
    isActive: true
  },
  {
    subdomain: 'admin',
    name: 'Admin Portal',
    description: 'Administration portal - manage users, portals, QuickBooks, and system settings',
    defaultTab: 'settings',
    headerTitle: 'Admin Portal',
    tabs: ['settings', 'accounting'],
    isActive: true
  }
]

async function main() {
  console.log('Seeding portals...')

  for (const portal of portals) {
    const existing = await prisma.portal.findUnique({
      where: { subdomain: portal.subdomain }
    })

    if (existing) {
      console.log(`  Portal '${portal.subdomain}' already exists, updating...`)
      await prisma.portal.update({
        where: { subdomain: portal.subdomain },
        data: portal
      })
    } else {
      console.log(`  Creating portal '${portal.subdomain}'...`)
      await prisma.portal.create({
        data: portal
      })
    }
  }

  console.log('Portal seeding complete!')
}

main()
  .catch((e) => {
    console.error('Error seeding portals:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
