import sqlite3 from 'sqlite3'
import { PrismaClient } from '@prisma/client'
import path from 'path'

const prisma = new PrismaClient()

// Path to the original SQLite database
const originalDbPath = path.join(process.cwd(), '..', 'quoting_tool.db')

interface OldProject {
  ID: number
  Name: string
  Status: string
}

interface OldOpening {
  ID: number
  Project_ID: number
  Name: string
  Rough_Width: number
  Rough_Height: number
  Finished_Width: number
  Finished_Height: number
  Price: number
}

interface OldPanel {
  ID: number
  Opening_ID: number
  Type: string
  Width: number
  Height: number
  Glass_Type: string
  Locking: string
  Swing_Direction?: string
}

interface OldProduct {
  ID: number
  Name: string
  Description?: string
  Type: string
}

interface OldSubOptionCategory {
  ID: number
  Name: string
  Description?: string
}

interface OldIndividualOption {
  ID: number
  Category_ID: number
  Name: string
  Description?: string
  Price: number
}

interface OldBOM {
  ID: number
  Project_ID: number
  Material_Type: string
  Part_Name: string
  Quantity: number
  Unit: string
}

async function migrateData() {
  console.log('Starting data migration...')

  try {
    // Open the original database
    const db = new sqlite3.Database(originalDbPath)

    // Migrate Projects
    console.log('Migrating projects...')
    const projects = await new Promise<OldProject[]>((resolve, reject) => {
      db.all('SELECT * FROM Projects', (err, rows) => {
        if (err) reject(err)
        else resolve(rows as OldProject[])
      })
    })

    const projectIdMap = new Map<number, number>()
    for (const project of projects) {
      const newProject = await prisma.project.create({
        data: {
          name: project.Name,
          status: project.Status || 'Draft'
        }
      })
      projectIdMap.set(project.ID, newProject.id)
      console.log(`Migrated project: ${project.Name}`)
    }

    // Migrate Openings
    console.log('Migrating openings...')
    const openings = await new Promise<OldOpening[]>((resolve, reject) => {
      db.all('SELECT * FROM Openings', (err, rows) => {
        if (err) reject(err)
        else resolve(rows as OldOpening[])
      })
    })

    const openingIdMap = new Map<number, number>()
    for (const opening of openings) {
      const newProjectId = projectIdMap.get(opening.Project_ID)
      if (newProjectId) {
        const newOpening = await prisma.opening.create({
          data: {
            projectId: newProjectId,
            name: opening.Name,
            roughWidth: opening.Rough_Width,
            roughHeight: opening.Rough_Height,
            finishedWidth: opening.Finished_Width,
            finishedHeight: opening.Finished_Height,
            price: opening.Price
          }
        })
        openingIdMap.set(opening.ID, newOpening.id)
        console.log(`Migrated opening: ${opening.Name}`)
      }
    }

    // Migrate Panels
    console.log('Migrating panels...')
    const panels = await new Promise<OldPanel[]>((resolve, reject) => {
      db.all('SELECT * FROM Panels', (err, rows) => {
        if (err) reject(err)
        else resolve(rows as OldPanel[])
      })
    })

    for (const panel of panels) {
      const newOpeningId = openingIdMap.get(panel.Opening_ID)
      if (newOpeningId) {
        await prisma.panel.create({
          data: {
            openingId: newOpeningId,
            type: panel.Type,
            width: panel.Width,
            height: panel.Height,
            glassType: panel.Glass_Type,
            locking: panel.Locking,
            swingDirection: panel.Swing_Direction || 'None'
          }
        })
        console.log(`Migrated panel: ${panel.Type}`)
      }
    }

    // Migrate Products
    console.log('Migrating products...')
    const products = await new Promise<OldProduct[]>((resolve, reject) => {
      db.all('SELECT * FROM Products WHERE Type = "Product" OR Type IS NULL', (err, rows) => {
        if (err) reject(err)
        else resolve(rows as OldProduct[])
      })
    })

    const productIdMap = new Map<number, number>()
    for (const product of products) {
      const newProduct = await prisma.product.create({
        data: {
          name: product.Name,
          description: product.Description,
          type: product.Type || 'Product'
        }
      })
      productIdMap.set(product.ID, newProduct.id)
      console.log(`Migrated product: ${product.Name}`)
    }

    // Migrate Sub-Option Categories
    console.log('Migrating sub-option categories...')
    const categories = await new Promise<OldSubOptionCategory[]>((resolve, reject) => {
      db.all('SELECT * FROM SubOptionCategories', (err, rows) => {
        if (err) reject(err)
        else resolve(rows as OldSubOptionCategory[])
      })
    })

    const categoryIdMap = new Map<number, number>()
    for (const category of categories) {
      const newCategory = await prisma.subOptionCategory.create({
        data: {
          name: category.Name,
          description: category.Description
        }
      })
      categoryIdMap.set(category.ID, newCategory.id)
      console.log(`Migrated category: ${category.Name}`)
    }

    // Migrate Individual Options
    console.log('Migrating individual options...')
    const options = await new Promise<OldIndividualOption[]>((resolve, reject) => {
      db.all('SELECT * FROM IndividualOptions', (err, rows) => {
        if (err) reject(err)
        else resolve(rows as OldIndividualOption[])
      })
    })

    for (const option of options) {
      const newCategoryId = categoryIdMap.get(option.Category_ID)
      if (newCategoryId) {
        await prisma.individualOption.create({
          data: {
            categoryId: newCategoryId,
            name: option.Name,
            description: option.Description,
            price: option.Price || 0
          }
        })
        console.log(`Migrated option: ${option.Name}`)
      }
    }

    // Migrate BOMs
    console.log('Migrating BOMs...')
    const boms = await new Promise<OldBOM[]>((resolve, reject) => {
      db.all('SELECT * FROM BOMs', (err, rows) => {
        if (err) reject(err)
        else resolve(rows as OldBOM[])
      })
    })

    for (const bom of boms) {
      const newProjectId = projectIdMap.get(bom.Project_ID)
      if (newProjectId) {
        await prisma.bOM.create({
          data: {
            projectId: newProjectId,
            materialType: bom.Material_Type,
            partName: bom.Part_Name,
            quantity: bom.Quantity,
            unit: bom.Unit
          }
        })
        console.log(`Migrated BOM item: ${bom.Part_Name}`)
      }
    }

    // Close the original database
    db.close()

    console.log('Data migration completed successfully!')
    console.log(`Migrated:`)
    console.log(`- ${projects.length} projects`)
    console.log(`- ${openings.length} openings`)
    console.log(`- ${panels.length} panels`)
    console.log(`- ${products.length} products`)
    console.log(`- ${categories.length} categories`)
    console.log(`- ${options.length} options`)
    console.log(`- ${boms.length} BOM items`)

  } catch (error) {
    console.error('Migration failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the migration
migrateData()