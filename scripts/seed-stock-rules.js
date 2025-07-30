const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function seedStockLengthRules() {
  try {
    // Check if rules already exist
    const existingRules = await prisma.stockLengthRule.findMany()
    
    if (existingRules.length > 0) {
      console.log(`Stock length rules already exist (${existingRules.length} rules)`)
      return
    }

    // Create the initial stock length rules
    const initialRules = [
      {
        name: "Short Height Doors/Panels",
        description: "For 7' and 8' doors and panels",
        minHeight: 84,  // 7 feet in inches
        maxHeight: 96,  // 8 feet in inches
        stockLength: 99,
        appliesTo: "height",
        partType: "Extrusion",
        isActive: true
      },
      {
        name: "Tall Height Doors/Panels", 
        description: "For 9' and 10' doors and panels",
        minHeight: 108, // 9 feet in inches
        maxHeight: 120, // 10 feet in inches
        stockLength: 123,
        appliesTo: "height",
        partType: "Extrusion",
        isActive: true
      },
      {
        name: "Standard Width",
        description: "Standard stock length for all widths",
        minHeight: null,
        maxHeight: null,
        stockLength: 120,
        appliesTo: "width",
        partType: "Extrusion", 
        isActive: true
      }
    ]

    const createdRules = await prisma.stockLengthRule.createMany({
      data: initialRules
    })

    console.log(`Successfully created ${createdRules.count} stock length rules`)
  } catch (error) {
    console.error('Error seeding stock length rules:', error)
  } finally {
    await prisma.$disconnect()
  }
}

seedStockLengthRules()