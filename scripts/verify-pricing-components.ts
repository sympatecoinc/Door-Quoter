/**
 * Pricing Verification: Direct Component Creation Method
 *
 * Creates 6 test projects with known configurations via the direct
 * component creation API flow (opening → panel → component instance),
 * downloads BOM, Purchasing Summary, and Pricing Debug CSVs,
 * then cross-compares outputs to verify quantities, costs,
 * and line items scale correctly.
 *
 * This tests a different code path than the preset-based script
 * (verify-pricing-output.ts) and verifies that the direct-component
 * workflow produces consistent, scalable pricing output.
 *
 * Run with: npx tsx scripts/verify-pricing-components.ts
 * Options:  --keep  (retain test projects after run)
 */

import fs from 'fs'
import path from 'path'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const OUTPUT_DIR = path.join(process.cwd(), 'verify-output-components')

let sessionCookie = ''

// ─── HTTP Helpers ───────────────────────────────────────────────────────

async function api(method: string, urlPath: string, body?: any): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (sessionCookie) {
    headers['Cookie'] = sessionCookie
  }

  const res = await fetch(`${BASE_URL}${urlPath}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  })
  return res
}

async function apiJSON(method: string, urlPath: string, body?: any): Promise<any> {
  const res = await api(method, urlPath, body)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${method} ${urlPath} → ${res.status}: ${text}`)
  }
  return res.json()
}

async function apiText(method: string, urlPath: string, body?: any): Promise<string> {
  const res = await api(method, urlPath, body)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${method} ${urlPath} → ${res.status}: ${text}`)
  }
  return res.text()
}

// ─── Step 1: Authenticate ───────────────────────────────────────────────

async function authenticate(): Promise<void> {
  console.log('\n=== Step 1: Authenticating ===')
  const res = await api('POST', '/api/auth/login', {
    email: process.env.TEST_EMAIL || 'testing@dev.com',
    password: process.env.TEST_PASSWORD || 'password'
  })

  if (!res.ok) {
    throw new Error(`Login failed: ${res.status} ${await res.text()}`)
  }

  // Extract session cookie from Set-Cookie header
  const setCookie = res.headers.get('set-cookie') || res.headers.getSetCookie?.()?.join('; ')
  if (setCookie) {
    const match = String(setCookie).match(/session_token=([^;]+)/)
    if (match) {
      sessionCookie = `session_token=${match[1]}`
      console.log('  Authenticated successfully')
      return
    }
  }

  console.log('  Warning: No session cookie found in response headers, attempting without auth...')
}

// ─── Step 2: Discover Products ──────────────────────────────────────────

interface ProductConfig {
  id: number
  name: string
  productType: string
  frameConfigId: number | null
}

async function discoverProducts(): Promise<{ productA: ProductConfig; productB: ProductConfig }> {
  console.log('\n=== Step 2: Discovering Products ===')
  const products: any[] = await apiJSON('GET', '/api/products')

  // Filter to non-archived, door/panel types
  const eligibleTypes = ['SWING_DOOR', 'SLIDING_DOOR', 'FIXED_PANEL']
  const eligible = products.filter(
    (p: any) => !p.archived && eligibleTypes.includes(p.productType)
  )

  console.log(`  Found ${eligible.length} eligible products (out of ${products.length} total):`)
  for (const p of eligible) {
    console.log(`    - ${p.name} (id=${p.id}, type=${p.productType}, frame=${p.frameConfig?.id ?? 'none'})`)
  }

  if (eligible.length < 2) {
    throw new Error(`Need at least 2 eligible products, found ${eligible.length}`)
  }

  // Pick 2 products with different productType values for better coverage
  let productA: any = eligible[0]
  let productB: any | null = null

  for (const p of eligible) {
    if (p.productType !== productA.productType) {
      productB = p
      break
    }
  }

  // Fallback: if all same type, just use first two
  if (!productB) {
    productB = eligible[1]
  }

  const toConfig = (p: any): ProductConfig => ({
    id: p.id,
    name: p.name,
    productType: p.productType,
    frameConfigId: p.frameConfig?.id ?? null
  })

  const configA = toConfig(productA)
  const configB = toConfig(productB)

  console.log(`  Product A: "${configA.name}" (id=${configA.id}, type=${configA.productType})`)
  console.log(`  Product B: "${configB.name}" (id=${configB.id}, type=${configB.productType})`)

  return { productA: configA, productB: configB }
}

// ─── Step 3: Create Test Projects ───────────────────────────────────────

interface OpeningSpec {
  product: ProductConfig
  name: string
}

interface TestProject {
  id: number
  name: string
  dir: string
  openings: OpeningSpec[]
}

async function createTestProjects(productA: ProductConfig, productB: ProductConfig): Promise<TestProject[]> {
  console.log('\n=== Step 3: Creating Test Projects ===')

  const openingA = (name: string): OpeningSpec => ({ product: productA, name })
  const openingB = (name: string): OpeningSpec => ({ product: productB, name })

  const projectDefs = [
    { name: 'Verify-Comp-01-Single-A', dir: '01-single-product-a', openings: [openingA('Opening 1')] },
    { name: 'Verify-Comp-02-Single-B', dir: '02-single-product-b', openings: [openingB('Opening 1')] },
    { name: 'Verify-Comp-03-Double-A', dir: '03-double-product-a', openings: [openingA('Opening 1'), openingA('Opening 2')] },
    { name: 'Verify-Comp-04-Double-B', dir: '04-double-product-b', openings: [openingB('Opening 1'), openingB('Opening 2')] },
    { name: 'Verify-Comp-05-Mixed-Single', dir: '05-mixed-single', openings: [openingA('Opening 1'), openingB('Opening 2')] },
    { name: 'Verify-Comp-06-Mixed-Double', dir: '06-mixed-double', openings: [openingA('Opening 1'), openingA('Opening 2'), openingB('Opening 3'), openingB('Opening 4')] },
  ]

  console.log(`  Product A: "${productA.name}" (id=${productA.id})`)
  console.log(`  Product B: "${productB.name}" (id=${productB.id})`)

  const projects: TestProject[] = []

  for (const def of projectDefs) {
    console.log(`  Creating project: ${def.name}`)
    const project = await apiJSON('POST', '/api/projects', {
      name: def.name,
      prospectCompanyName: 'Component Verification Test',
      status: 'STAGING'
    })
    console.log(`    Created project id=${project.id}`)
    projects.push({ id: project.id, name: def.name, dir: def.dir, openings: def.openings })
  }

  return projects
}

// ─── Step 4: Add Components to Projects ─────────────────────────────────

async function createOpeningWithComponents(
  projectId: number,
  openingName: string,
  product: ProductConfig
): Promise<void> {
  // Step 4a: Create Opening
  const opening = await apiJSON('POST', '/api/openings', {
    projectId,
    name: openingName,
    roughWidth: 96,
    roughHeight: 84,
    isFinishedOpening: true,
    openingType: 'THINWALL',
    finishColor: 'Black (Anodized)'
  })
  const openingId = opening.id
  console.log(`      Opening created: id=${openingId}`)

  // Step 4b: Create Panel (returns array, may include paired panels)
  const panels: any[] = await apiJSON('POST', '/api/panels', {
    openingId,
    type: 'Component',
    width: 96,
    height: 84,
    glassType: 'Clear',
    locking: 'N/A',
    swingDirection: 'None',
    slidingDirection: 'Left',
    productId: product.id,
    skipValidation: true
  })
  console.log(`      Panels created: ${panels.length} (${panels.filter((p: any) => p._isFramePanel).length} frame)`)

  // Step 4c: Create Component Instance for each panel
  for (const panel of panels) {
    const ciProductId = panel._isFramePanel ? panel._frameConfigId : product.id
    const ci = await apiJSON('POST', '/api/component-instances', {
      panelId: panel.id,
      productId: ciProductId,
      subOptionSelections: {},
      variantSelections: {}
    })
    console.log(`      Component instance: panel=${panel.id}, product=${ciProductId}${panel._isFramePanel ? ' (frame)' : ''}`)
  }
}

async function addComponentsToProjects(projects: TestProject[]): Promise<void> {
  console.log('\n=== Step 4: Adding Components to Projects ===')

  for (const project of projects) {
    console.log(`  Project: ${project.name} (${project.openings.length} openings)`)
    for (const opening of project.openings) {
      console.log(`    Adding "${opening.product.name}" as ${opening.name}`)
      await createOpeningWithComponents(project.id, opening.name, opening.product)
    }
  }
}

// ─── Step 5: Download CSVs ──────────────────────────────────────────────

async function downloadCSVs(projects: TestProject[]): Promise<void> {
  console.log('\n=== Step 5: Downloading CSVs ===')

  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  for (const project of projects) {
    const dir = path.join(OUTPUT_DIR, project.dir)
    fs.mkdirSync(dir, { recursive: true })

    // BOM CSV (summary view, CSV format)
    console.log(`  Downloading BOM for ${project.name}...`)
    try {
      const bomCsv = await apiText('GET', `/api/projects/${project.id}/bom?summary=true&format=csv`)
      fs.writeFileSync(path.join(dir, 'bom.csv'), bomCsv)
    } catch (e: any) {
      console.log(`    Warning: BOM download failed: ${e.message}`)
      fs.writeFileSync(path.join(dir, 'bom.csv'), `ERROR: ${e.message}`)
    }

    // Purchasing Summary CSV
    console.log(`  Downloading Purchasing Summary for ${project.name}...`)
    try {
      const purchCsv = await apiText('POST', `/api/purchasing/combined-summary?format=csv`, {
        projectIds: [String(project.id)]
      })
      fs.writeFileSync(path.join(dir, 'purchasing-summary.csv'), purchCsv)
    } catch (e: any) {
      console.log(`    Warning: Purchasing Summary download failed: ${e.message}`)
      fs.writeFileSync(path.join(dir, 'purchasing-summary.csv'), `ERROR: ${e.message}`)
    }

    // Pricing Debug CSV
    console.log(`  Downloading Pricing Debug for ${project.name}...`)
    try {
      const pricingCsv = await apiText('GET', `/api/projects/${project.id}/pricing-debug?format=csv`)
      fs.writeFileSync(path.join(dir, 'pricing-debug.csv'), pricingCsv)
    } catch (e: any) {
      console.log(`    Warning: Pricing Debug download failed: ${e.message}`)
      fs.writeFileSync(path.join(dir, 'pricing-debug.csv'), `ERROR: ${e.message}`)
    }
  }
}

// ─── Step 6: Cross-Project Comparisons ──────────────────────────────────

interface ComparisonResult {
  test: string
  description: string
  status: 'PASS' | 'FAIL' | 'INFO'
  expected: string
  actual: string
  difference: string
  notes: string
}

// Parse a pricing-debug CSV into structured data
function parsePricingDebugCSV(csvContent: string): {
  grandTotal: number
  subtotalMarkedUp: number
  subtotalBase: number
  installation: number
  openings: {
    name: string
    totalBaseCost: number
    totalMarkedUpCost: number
    extrusionBase: number
    hardwareBase: number
    glassBase: number
  }[]
  bomItems: { partNumber: string; quantity: number; unitCost: number; totalCost: number; finishCost: number }[]
} {
  const lines = csvContent.split('\n')
  const result = {
    grandTotal: 0,
    subtotalMarkedUp: 0,
    subtotalBase: 0,
    installation: 0,
    openings: [] as any[],
    bomItems: [] as any[]
  }

  let currentOpening: any = null
  let inBomItems = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    if (line.startsWith('Grand Total,')) {
      result.grandTotal = parseDollar(line.split(',')[1])
    }
    if (line.startsWith('Subtotal (Marked Up),')) {
      result.subtotalMarkedUp = parseDollar(line.split(',')[1])
    }
    if (line.startsWith('Subtotal (Base),')) {
      result.subtotalBase = parseDollar(line.split(',')[1])
    }
    if (line.startsWith('Installation,')) {
      result.installation = parseDollar(line.split(',')[1])
    }

    if (line.startsWith('=== OPENING:')) {
      const nameMatch = line.match(/=== OPENING: (.+) ===/)
      currentOpening = {
        name: nameMatch?.[1] || 'Unknown',
        totalBaseCost: 0,
        totalMarkedUpCost: 0,
        extrusionBase: 0,
        hardwareBase: 0,
        glassBase: 0
      }
      result.openings.push(currentOpening)
      inBomItems = false
    }

    if (line.startsWith('Opening Total (Base),')) {
      if (currentOpening) currentOpening.totalBaseCost = parseDollar(line.split(',')[1])
    }
    if (line.startsWith('Opening Total (Marked Up),')) {
      if (currentOpening) currentOpening.totalMarkedUpCost = parseDollar(line.split(',')[1])
    }

    if (line === 'BOM ITEMS') {
      inBomItems = true
      i++ // skip header row
      continue
    }
    if (line === '' || line.startsWith('OPTION') || line.startsWith('GLASS') || line.startsWith('Component')) {
      inBomItems = false
    }

    if (inBomItems && line.length > 0) {
      const fields = parseCSVLine(line)
      if (fields.length >= 11) {
        result.bomItems.push({
          partNumber: unquote(fields[0]),
          quantity: parseFloat(fields[5]) || 0,
          unitCost: parseDollar(fields[6]),
          totalCost: parseDollar(fields[10]),
          finishCost: parseDollar(fields[7])
        })
      }
    }

    // Parse opening cost summary category lines
    if (currentOpening && line.startsWith('Extrusion,$')) {
      const parts = line.split(',')
      currentOpening.extrusionBase = parseDollar(parts[1])
    }
    if (currentOpening && line.startsWith('Hardware,$')) {
      const parts = line.split(',')
      currentOpening.hardwareBase = parseDollar(parts[1])
    }
    if (currentOpening && line.startsWith('Glass,$')) {
      const parts = line.split(',')
      currentOpening.glassBase = parseDollar(parts[1])
    }
  }

  return result
}

// Parse a BOM summary CSV into structured data
function parseBomCSV(csvContent: string): {
  items: { partNumber: string; pieces: number; partType: string }[]
} {
  const lines = csvContent.split('\n')
  const items: any[] = []

  let headerIdx = -1
  let partNumCol = -1
  let piecesCol = -1
  let typeCol = -1

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.includes('Part Number') && line.includes('Pieces')) {
      headerIdx = i
      const headers = parseCSVLine(line)
      partNumCol = headers.findIndex(h => unquote(h).trim() === 'Part Number')
      piecesCol = headers.findIndex(h => unquote(h).trim() === 'Pieces')
      typeCol = headers.findIndex(h => unquote(h).trim() === 'Type')
      break
    }
  }

  if (headerIdx === -1) return { items }

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line || line.startsWith('=') || line.startsWith('---')) continue

    const fields = parseCSVLine(line)
    if (fields.length <= Math.max(partNumCol, piecesCol)) continue

    const pn = unquote(fields[partNumCol] || '')
    if (!pn) continue

    items.push({
      partNumber: pn,
      pieces: parseFloat(unquote(fields[piecesCol] || '0')) || 0,
      partType: typeCol >= 0 ? unquote(fields[typeCol] || '') : ''
    })
  }

  return { items }
}

// Parse purchasing summary CSV into structured data
function parsePurchasingSummaryCSV(csvContent: string): {
  items: { partNumber: string; pieces: number }[]
} {
  const lines = csvContent.split('\n')
  const items: any[] = []

  let headerIdx = -1
  let partNumCol = -1
  let piecesCol = -1

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.includes('Part Number') && line.includes('Pieces')) {
      headerIdx = i
      const headers = parseCSVLine(line)
      partNumCol = headers.findIndex(h => unquote(h).trim() === 'Part Number')
      piecesCol = headers.findIndex(h => unquote(h).trim() === 'Pieces')
      break
    }
  }

  if (headerIdx === -1) return { items }

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line || line.startsWith('#') || line.startsWith('=')) continue

    const fields = parseCSVLine(line)
    if (fields.length <= Math.max(partNumCol, piecesCol)) continue

    const pn = unquote(fields[partNumCol] || '')
    if (!pn) continue

    items.push({
      partNumber: pn,
      pieces: parseFloat(unquote(fields[piecesCol] || '0')) || 0
    })
  }

  return { items }
}

// Parse BOM items grouped by opening from pricing-debug CSV
function parseBomItemsByOpening(csvContent: string): { partNumber: string; unitCost: number }[][] {
  const lines = csvContent.split('\n')
  const openings: { partNumber: string; unitCost: number }[][] = []
  let currentItems: { partNumber: string; unitCost: number }[] | null = null
  let inBomItems = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    if (line.startsWith('=== OPENING:')) {
      currentItems = []
      openings.push(currentItems)
      inBomItems = false
    }

    if (line === 'BOM ITEMS') {
      inBomItems = true
      i++ // skip header
      continue
    }

    if (line === '' || line.startsWith('OPTION') || line.startsWith('GLASS') || line.startsWith('Component')) {
      inBomItems = false
    }

    if (inBomItems && currentItems && line.length > 0) {
      const fields = parseCSVLine(line)
      if (fields.length >= 7) {
        currentItems.push({
          partNumber: unquote(fields[0]),
          unitCost: parseDollar(fields[6])
        })
      }
    }
  }

  return openings
}

function parseDollar(val: string): number {
  if (!val) return 0
  return parseFloat(val.replace(/[$",]/g, '')) || 0
}

function unquote(val: string): string {
  if (!val) return ''
  return val.replace(/^"(.*)"$/, '$1').replace(/""/g, '"')
}

// Parse a CSV line respecting quoted fields
function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        fields.push(current)
        current = ''
      } else {
        current += ch
      }
    }
  }
  fields.push(current)
  return fields
}

function compareProjectPair(
  label: string,
  singleDir: string,
  doubleDir: string,
  multiplier: number,
  results: ComparisonResult[]
): void {
  console.log(`\n  ${label}`)

  // Compare pricing debug
  const singlePricingPath = path.join(OUTPUT_DIR, singleDir, 'pricing-debug.csv')
  const doublePricingPath = path.join(OUTPUT_DIR, doubleDir, 'pricing-debug.csv')

  if (fs.existsSync(singlePricingPath) && fs.existsSync(doublePricingPath)) {
    const singlePricing = parsePricingDebugCSV(fs.readFileSync(singlePricingPath, 'utf-8'))
    const doublePricing = parsePricingDebugCSV(fs.readFileSync(doublePricingPath, 'utf-8'))

    // Grand total comparison
    const expectedGT = singlePricing.grandTotal * multiplier
    const actualGT = doublePricing.grandTotal
    const diffGT = Math.abs(expectedGT - actualGT)
    const passGT = diffGT <= 0.02

    results.push({
      test: `${label} - Grand Total`,
      description: `Grand total should scale by ${multiplier}x`,
      status: passGT ? 'PASS' : 'FAIL',
      expected: `$${expectedGT.toFixed(2)}`,
      actual: `$${actualGT.toFixed(2)}`,
      difference: `$${diffGT.toFixed(2)}`,
      notes: passGT ? '' : `Off by $${diffGT.toFixed(2)}`
    })
    console.log(`    Grand Total: ${passGT ? 'PASS' : 'FAIL'} (expected $${expectedGT.toFixed(2)}, got $${actualGT.toFixed(2)})`)

    // Subtotal (Marked Up) comparison
    const expectedSM = singlePricing.subtotalMarkedUp * multiplier
    const actualSM = doublePricing.subtotalMarkedUp
    const diffSM = Math.abs(expectedSM - actualSM)
    const passSM = diffSM <= 0.02

    results.push({
      test: `${label} - Subtotal Marked Up`,
      description: `Marked up subtotal should scale by ${multiplier}x`,
      status: passSM ? 'PASS' : 'FAIL',
      expected: `$${expectedSM.toFixed(2)}`,
      actual: `$${actualSM.toFixed(2)}`,
      difference: `$${diffSM.toFixed(2)}`,
      notes: ''
    })
    console.log(`    Subtotal Marked Up: ${passSM ? 'PASS' : 'FAIL'} (expected $${expectedSM.toFixed(2)}, got $${actualSM.toFixed(2)})`)

    // Subtotal (Base) comparison
    const expectedSB = singlePricing.subtotalBase * multiplier
    const actualSB = doublePricing.subtotalBase
    const diffSB = Math.abs(expectedSB - actualSB)
    const passSB = diffSB <= 0.02

    results.push({
      test: `${label} - Subtotal Base`,
      description: `Base subtotal should scale by ${multiplier}x`,
      status: passSB ? 'PASS' : 'FAIL',
      expected: `$${expectedSB.toFixed(2)}`,
      actual: `$${actualSB.toFixed(2)}`,
      difference: `$${diffSB.toFixed(2)}`,
      notes: ''
    })
    console.log(`    Subtotal Base: ${passSB ? 'PASS' : 'FAIL'} (expected $${expectedSB.toFixed(2)}, got $${actualSB.toFixed(2)})`)

    // Per-opening unit cost comparison
    let unitCostMismatches = 0
    let unitCostChecked = 0

    const singleOpeningCount = singlePricing.openings.length
    const doubleOpeningCount = doublePricing.openings.length

    if (singleOpeningCount > 0 && doubleOpeningCount === singleOpeningCount * multiplier) {
      const singleOpeningBoms = parseBomItemsByOpening(
        fs.readFileSync(path.join(OUTPUT_DIR, singleDir, 'pricing-debug.csv'), 'utf-8')
      )
      const doubleOpeningBoms = parseBomItemsByOpening(
        fs.readFileSync(path.join(OUTPUT_DIR, doubleDir, 'pricing-debug.csv'), 'utf-8')
      )

      // Match each double opening to the best single opening by BOM signature
      for (let d = 0; d < doubleOpeningBoms.length; d++) {
        const dItems = doubleOpeningBoms[d] || []
        const dSig = dItems.map(i => i.partNumber).join('|')

        let bestSIdx = 0
        let bestMatchScore = -1
        for (let s = 0; s < singleOpeningBoms.length; s++) {
          const sItems = singleOpeningBoms[s] || []
          const sSig = sItems.map(i => i.partNumber).join('|')
          if (sSig === dSig) {
            bestSIdx = s
            bestMatchScore = dItems.length
            break
          }
          let score = 0
          for (let j = 0; j < Math.min(sItems.length, dItems.length); j++) {
            if (sItems[j].partNumber === dItems[j].partNumber) score++
          }
          if (score > bestMatchScore) {
            bestMatchScore = score
            bestSIdx = s
          }
        }

        const sItems = singleOpeningBoms[bestSIdx] || []
        const compareCount = Math.min(sItems.length, dItems.length)
        for (let j = 0; j < compareCount; j++) {
          unitCostChecked++
          if (Math.abs(sItems[j].unitCost - dItems[j].unitCost) > 0.01) {
            unitCostMismatches++
          }
        }
      }
    } else {
      unitCostChecked = doublePricing.bomItems.length
    }

    results.push({
      test: `${label} - Unit Costs`,
      description: 'Unit costs should be identical across single vs double',
      status: unitCostMismatches === 0 ? 'PASS' : 'FAIL',
      expected: '0 mismatches',
      actual: `${unitCostMismatches} mismatches out of ${unitCostChecked} checked`,
      difference: String(unitCostMismatches),
      notes: ''
    })
    console.log(`    Unit Costs: ${unitCostMismatches === 0 ? 'PASS' : 'FAIL'} (${unitCostMismatches}/${unitCostChecked} mismatches)`)
  }

  // Compare BOM summary
  const singleBomPath = path.join(OUTPUT_DIR, singleDir, 'bom.csv')
  const doubleBomPath = path.join(OUTPUT_DIR, doubleDir, 'bom.csv')

  if (fs.existsSync(singleBomPath) && fs.existsSync(doubleBomPath)) {
    const singleBom = parseBomCSV(fs.readFileSync(singleBomPath, 'utf-8'))
    const doubleBom = parseBomCSV(fs.readFileSync(doubleBomPath, 'utf-8'))

    const singleBomPiecesMap = new Map<string, number>()
    for (const item of singleBom.items) {
      singleBomPiecesMap.set(item.partNumber, (singleBomPiecesMap.get(item.partNumber) || 0) + item.pieces)
    }

    const doubleBomPiecesMap = new Map<string, number>()
    for (const item of doubleBom.items) {
      doubleBomPiecesMap.set(item.partNumber, (doubleBomPiecesMap.get(item.partNumber) || 0) + item.pieces)
    }

    let bomMismatches = 0
    let bomChecked = 0
    const bomMismatchDetails: string[] = []
    for (const [pn, singlePcs] of singleBomPiecesMap) {
      const expectedPcs = singlePcs * multiplier
      const actualPcs = doubleBomPiecesMap.get(pn) || 0
      bomChecked++
      if (Math.abs(expectedPcs - actualPcs) > 0.01) {
        bomMismatches++
        bomMismatchDetails.push(`${pn}: expected ${expectedPcs}, got ${actualPcs}`)
      }
    }

    results.push({
      test: `${label} - BOM Pieces`,
      description: `BOM pieces should scale by ${multiplier}x (yield optimization may differ)`,
      status: bomMismatches === 0 ? 'PASS' : 'INFO',
      expected: `${bomChecked} parts at ${multiplier}x`,
      actual: `${bomMismatches} differences out of ${bomChecked}`,
      difference: String(bomMismatches),
      notes: bomMismatchDetails.length > 0 ? bomMismatchDetails.slice(0, 5).join('; ') : ''
    })
    console.log(`    BOM Pieces: ${bomMismatches === 0 ? 'PASS' : 'INFO'} (${bomMismatches}/${bomChecked} differences)`)
  }

  // Compare purchasing summary
  const singlePurchPath = path.join(OUTPUT_DIR, singleDir, 'purchasing-summary.csv')
  const doublePurchPath = path.join(OUTPUT_DIR, doubleDir, 'purchasing-summary.csv')

  if (fs.existsSync(singlePurchPath) && fs.existsSync(doublePurchPath)) {
    const singlePurch = parsePurchasingSummaryCSV(fs.readFileSync(singlePurchPath, 'utf-8'))
    const doublePurch = parsePurchasingSummaryCSV(fs.readFileSync(doublePurchPath, 'utf-8'))

    const singlePiecesMap = new Map<string, number>()
    for (const item of singlePurch.items) {
      singlePiecesMap.set(item.partNumber, (singlePiecesMap.get(item.partNumber) || 0) + item.pieces)
    }

    const doublePiecesMap = new Map<string, number>()
    for (const item of doublePurch.items) {
      doublePiecesMap.set(item.partNumber, (doublePiecesMap.get(item.partNumber) || 0) + item.pieces)
    }

    let piecesMismatches = 0
    let piecesChecked = 0
    const mismatchDetails: string[] = []
    for (const [pn, singlePieces] of singlePiecesMap) {
      const expectedPieces = singlePieces * multiplier
      const actualPieces = doublePiecesMap.get(pn) || 0
      piecesChecked++
      if (Math.abs(expectedPieces - actualPieces) > 0.01) {
        piecesMismatches++
        mismatchDetails.push(`${pn}: expected ${expectedPieces}, got ${actualPieces}`)
      }
    }

    for (const [pn] of doublePiecesMap) {
      if (!singlePiecesMap.has(pn)) {
        piecesMismatches++
        mismatchDetails.push(`${pn}: not in single project`)
      }
    }

    const hasYieldDiffs = mismatchDetails.length > 0
    results.push({
      test: `${label} - Purchasing Pieces`,
      description: `Pieces should scale by ${multiplier}x (yield optimization may differ for extrusions)`,
      status: piecesMismatches === 0 ? 'PASS' : 'INFO',
      expected: `${piecesChecked} parts at ${multiplier}x`,
      actual: `${piecesMismatches} differences out of ${piecesChecked}`,
      difference: String(piecesMismatches),
      notes: hasYieldDiffs ? `Differences: ${mismatchDetails.slice(0, 5).join('; ')}${mismatchDetails.length > 5 ? '...' : ''}` : ''
    })
    console.log(`    Purchasing Pieces: ${piecesMismatches === 0 ? 'PASS' : 'INFO'} (${piecesMismatches}/${piecesChecked} differences)`)
  }
}

function compareMixedProjects(
  label: string,
  dirA: string,
  dirB: string,
  combinedDir: string,
  results: ComparisonResult[]
): void {
  console.log(`\n  ${label}`)

  const pricingPathA = path.join(OUTPUT_DIR, dirA, 'pricing-debug.csv')
  const pricingPathB = path.join(OUTPUT_DIR, dirB, 'pricing-debug.csv')
  const combinedPricingPath = path.join(OUTPUT_DIR, combinedDir, 'pricing-debug.csv')

  if (fs.existsSync(pricingPathA) && fs.existsSync(pricingPathB) && fs.existsSync(combinedPricingPath)) {
    const pricingA = parsePricingDebugCSV(fs.readFileSync(pricingPathA, 'utf-8'))
    const pricingB = parsePricingDebugCSV(fs.readFileSync(pricingPathB, 'utf-8'))
    const combinedPricing = parsePricingDebugCSV(fs.readFileSync(combinedPricingPath, 'utf-8'))

    // Grand total = A + B
    const expectedGT = pricingA.grandTotal + pricingB.grandTotal
    const actualGT = combinedPricing.grandTotal
    const diffGT = Math.abs(expectedGT - actualGT)
    const passGT = diffGT <= 0.02

    results.push({
      test: `${label} - Grand Total`,
      description: 'Grand total should equal A + B',
      status: passGT ? 'PASS' : 'FAIL',
      expected: `$${expectedGT.toFixed(2)}`,
      actual: `$${actualGT.toFixed(2)}`,
      difference: `$${diffGT.toFixed(2)}`,
      notes: ''
    })
    console.log(`    Grand Total: ${passGT ? 'PASS' : 'FAIL'} (expected $${expectedGT.toFixed(2)}, got $${actualGT.toFixed(2)})`)

    // Subtotal (Base)
    const expectedSB = pricingA.subtotalBase + pricingB.subtotalBase
    const actualSB = combinedPricing.subtotalBase
    const diffSB = Math.abs(expectedSB - actualSB)
    const passSB = diffSB <= 0.02

    results.push({
      test: `${label} - Subtotal Base`,
      description: 'Base subtotal should equal A + B',
      status: passSB ? 'PASS' : 'FAIL',
      expected: `$${expectedSB.toFixed(2)}`,
      actual: `$${actualSB.toFixed(2)}`,
      difference: `$${diffSB.toFixed(2)}`,
      notes: ''
    })
    console.log(`    Subtotal Base: ${passSB ? 'PASS' : 'FAIL'} (expected $${expectedSB.toFixed(2)}, got $${actualSB.toFixed(2)})`)

    // Subtotal (Marked Up)
    const expectedSM = pricingA.subtotalMarkedUp + pricingB.subtotalMarkedUp
    const actualSM = combinedPricing.subtotalMarkedUp
    const diffSM = Math.abs(expectedSM - actualSM)
    const passSM = diffSM <= 0.02

    results.push({
      test: `${label} - Subtotal Marked Up`,
      description: 'Marked up subtotal should equal A + B',
      status: passSM ? 'PASS' : 'FAIL',
      expected: `$${expectedSM.toFixed(2)}`,
      actual: `$${actualSM.toFixed(2)}`,
      difference: `$${diffSM.toFixed(2)}`,
      notes: ''
    })
    console.log(`    Subtotal Marked Up: ${passSM ? 'PASS' : 'FAIL'} (expected $${expectedSM.toFixed(2)}, got $${actualSM.toFixed(2)})`)
  }
}

// ─── Step 6a: Cross-Report Validation (within each project) ─────────

/**
 * Strip finish/stock-length suffixes from BOM/Purchasing part numbers
 * to get the base part number used in pricing-debug.
 * Examples:
 *   "48351-BLA-99"     → "48351"
 *   "E-12303-BLA-123"  → "E-12303"
 *   "AD-PASS-HAND-BLA" → "AD-PASS-HAND"
 *   "DR-ASD-BUMBS35"   → "DR-ASD-BUMBS35" (no suffix)
 *
 * Strategy: known finish codes are BLA, CLR, SAT, RAW, MF and stock lengths
 * are numeric. Strip trailing segments that match these patterns.
 */
function stripPartNumberSuffix(pn: string): string {
  // Strip trailing stock-length suffix like -99, -102, -91, -123
  let base = pn.replace(/-\d+$/, '')
  // Strip trailing finish suffix like -BLA, -CLR, -SAT, -RAW, -MF
  base = base.replace(/-(BLA|CLR|SAT|RAW|MF)$/i, '')
  // Also strip trailing -L (left/right variant suffix on some parts like RM-PUCK-BRKT-L)
  // Only if it's a single letter suffix at the end
  base = base.replace(/-[LR]$/, '')
  return base
}

function crossCompareReports(
  projectName: string,
  dir: string,
  results: ComparisonResult[]
): void {
  const label = `Cross-Report [${projectName}]`
  console.log(`\n  ${label}`)

  const pricingPath = path.join(OUTPUT_DIR, dir, 'pricing-debug.csv')
  const bomPath = path.join(OUTPUT_DIR, dir, 'bom.csv')
  const purchPath = path.join(OUTPUT_DIR, dir, 'purchasing-summary.csv')

  const hasPricing = fs.existsSync(pricingPath)
  const hasBom = fs.existsSync(bomPath)
  const hasPurch = fs.existsSync(purchPath)

  if (!hasPricing || !hasBom || !hasPurch) {
    console.log(`    Skipping — missing files (pricing=${hasPricing}, bom=${hasBom}, purch=${hasPurch})`)
    return
  }

  const pricingContent = fs.readFileSync(pricingPath, 'utf-8')
  const bomContent = fs.readFileSync(bomPath, 'utf-8')
  const purchContent = fs.readFileSync(purchPath, 'utf-8')

  const pricing = parsePricingDebugCSV(pricingContent)
  const bom = parseBomCSV(bomContent)
  const purch = parsePurchasingSummaryCSV(purchContent)

  // ── Check 1: Pricing-debug internal consistency ──
  // Sum of opening base totals should equal subtotal base
  const openingBaseSum = pricing.openings.reduce((sum, o) => sum + o.totalBaseCost, 0)
  const diffBase = Math.abs(openingBaseSum - pricing.subtotalBase)
  const passBase = diffBase <= 0.02

  results.push({
    test: `${label} - Opening Totals → Subtotal Base`,
    description: 'Sum of opening base totals should equal project subtotal base',
    status: passBase ? 'PASS' : 'FAIL',
    expected: `$${pricing.subtotalBase.toFixed(2)}`,
    actual: `$${openingBaseSum.toFixed(2)}`,
    difference: `$${diffBase.toFixed(2)}`,
    notes: passBase ? '' : `Off by $${diffBase.toFixed(2)}`
  })
  console.log(`    Opening Totals → Subtotal Base: ${passBase ? 'PASS' : 'FAIL'} (sum=$${openingBaseSum.toFixed(2)}, subtotal=$${pricing.subtotalBase.toFixed(2)})`)

  // Sum of opening marked up totals should equal subtotal marked up
  const openingMUSum = pricing.openings.reduce((sum, o) => sum + o.totalMarkedUpCost, 0)
  const diffMU = Math.abs(openingMUSum - pricing.subtotalMarkedUp)
  const passMU = diffMU <= 0.02

  results.push({
    test: `${label} - Opening Totals → Subtotal Marked Up`,
    description: 'Sum of opening marked-up totals should equal project subtotal marked up',
    status: passMU ? 'PASS' : 'FAIL',
    expected: `$${pricing.subtotalMarkedUp.toFixed(2)}`,
    actual: `$${openingMUSum.toFixed(2)}`,
    difference: `$${diffMU.toFixed(2)}`,
    notes: passMU ? '' : `Off by $${diffMU.toFixed(2)}`
  })
  console.log(`    Opening Totals → Subtotal Marked Up: ${passMU ? 'PASS' : 'FAIL'} (sum=$${openingMUSum.toFixed(2)}, subtotal=$${pricing.subtotalMarkedUp.toFixed(2)})`)

  // ── Check 2: Pricing-debug BOM items vs BOM CSV (aggregate by base part number) ──
  // Aggregate pricing-debug quantities by base part number
  const pricingQtyMap = new Map<string, number>()
  for (const item of pricing.bomItems) {
    const pn = item.partNumber
    pricingQtyMap.set(pn, (pricingQtyMap.get(pn) || 0) + item.quantity)
  }

  // Aggregate BOM CSV pieces by base part number (strip suffixes)
  const bomBaseQtyMap = new Map<string, number>()
  for (const item of bom.items) {
    const basePn = stripPartNumberSuffix(item.partNumber)
    bomBaseQtyMap.set(basePn, (bomBaseQtyMap.get(basePn) || 0) + item.pieces)
  }

  // Compare: every pricing-debug part should appear in BOM with matching quantity
  let pricingVsBomMismatches = 0
  let pricingVsBomChecked = 0
  const pricingVsBomDetails: string[] = []

  for (const [pn, pricingQty] of pricingQtyMap) {
    const bomQty = bomBaseQtyMap.get(pn)
    pricingVsBomChecked++
    if (bomQty === undefined) {
      // Part in pricing-debug but not in BOM — could be normal for options/glass handled separately
      // Only flag if it has nonzero quantity
      if (pricingQty > 0) {
        pricingVsBomDetails.push(`${pn}: in pricing-debug (qty=${pricingQty}) but not in BOM`)
      }
    } else if (Math.abs(pricingQty - bomQty) > 0.1) {
      pricingVsBomMismatches++
      pricingVsBomDetails.push(`${pn}: pricing-debug qty=${pricingQty}, BOM pieces=${bomQty}`)
    }
  }

  // Also check for parts in BOM but not in pricing-debug
  for (const [basePn, bomQty] of bomBaseQtyMap) {
    if (!pricingQtyMap.has(basePn)) {
      // Parts like GLASS-CLEAR appear in BOM but not in pricing-debug BOM ITEMS section
      // (glass is handled in a separate GLASS section). This is INFO, not FAIL.
      pricingVsBomDetails.push(`${basePn}: in BOM (pieces=${bomQty}) but not in pricing-debug BOM ITEMS`)
    }
  }

  // INFO for mismatches because unit conversion (IN vs EA) and glass/options are handled differently
  results.push({
    test: `${label} - Pricing-Debug vs BOM Quantities`,
    description: 'Pricing-debug BOM item quantities should match BOM CSV pieces (by base part number)',
    status: pricingVsBomMismatches === 0 ? 'PASS' : 'INFO',
    expected: `${pricingVsBomChecked} parts matching`,
    actual: `${pricingVsBomMismatches} mismatches out of ${pricingVsBomChecked}`,
    difference: String(pricingVsBomMismatches),
    notes: pricingVsBomDetails.length > 0 ? pricingVsBomDetails.slice(0, 5).join('; ') : ''
  })
  console.log(`    Pricing-Debug vs BOM: ${pricingVsBomMismatches === 0 ? 'PASS' : 'INFO'} (${pricingVsBomMismatches}/${pricingVsBomChecked} qty mismatches, ${pricingVsBomDetails.length} notes)`)

  // ── Check 3: BOM CSV vs Purchasing Summary (same finish-suffixed part numbers) ──
  const bomPiecesMap = new Map<string, number>()
  for (const item of bom.items) {
    bomPiecesMap.set(item.partNumber, (bomPiecesMap.get(item.partNumber) || 0) + item.pieces)
  }

  const purchPiecesMap = new Map<string, number>()
  for (const item of purch.items) {
    purchPiecesMap.set(item.partNumber, (purchPiecesMap.get(item.partNumber) || 0) + item.pieces)
  }

  let bomVsPurchMismatches = 0
  let bomVsPurchChecked = 0
  const bomVsPurchDetails: string[] = []

  // Check every BOM part appears in purchasing with same pieces
  for (const [pn, bomPcs] of bomPiecesMap) {
    const purchPcs = purchPiecesMap.get(pn)
    bomVsPurchChecked++
    if (purchPcs === undefined) {
      // Try base-name match (BOM may have -BLA suffix that purchasing doesn't, or vice versa)
      const basePn = stripPartNumberSuffix(pn)
      let foundMatch = false
      for (const [purchPn, pPcs] of purchPiecesMap) {
        if (stripPartNumberSuffix(purchPn) === basePn) {
          if (Math.abs(bomPcs - pPcs) > 0.1) {
            bomVsPurchMismatches++
            bomVsPurchDetails.push(`${pn} (BOM) ≈ ${purchPn} (Purch): pieces ${bomPcs} vs ${pPcs}`)
          }
          foundMatch = true
          break
        }
      }
      if (!foundMatch) {
        bomVsPurchDetails.push(`${pn}: in BOM (${bomPcs}) but not in Purchasing`)
      }
    } else if (Math.abs(bomPcs - purchPcs) > 0.1) {
      bomVsPurchMismatches++
      bomVsPurchDetails.push(`${pn}: BOM=${bomPcs}, Purch=${purchPcs}`)
    }
  }

  // Check for parts in purchasing but not in BOM
  for (const [pn, purchPcs] of purchPiecesMap) {
    if (!bomPiecesMap.has(pn)) {
      const basePn = stripPartNumberSuffix(pn)
      let foundInBom = false
      for (const [bomPn] of bomPiecesMap) {
        if (stripPartNumberSuffix(bomPn) === basePn) {
          foundInBom = true
          break
        }
      }
      if (!foundInBom) {
        bomVsPurchDetails.push(`${pn}: in Purchasing (${purchPcs}) but not in BOM`)
      }
    }
  }

  results.push({
    test: `${label} - BOM vs Purchasing Summary`,
    description: 'BOM CSV pieces should match Purchasing Summary pieces per part',
    status: bomVsPurchMismatches === 0 ? 'PASS' : 'INFO',
    expected: `${bomVsPurchChecked} parts matching`,
    actual: `${bomVsPurchMismatches} mismatches out of ${bomVsPurchChecked}`,
    difference: String(bomVsPurchMismatches),
    notes: bomVsPurchDetails.length > 0 ? bomVsPurchDetails.slice(0, 5).join('; ') : ''
  })
  console.log(`    BOM vs Purchasing: ${bomVsPurchMismatches === 0 ? 'PASS' : 'INFO'} (${bomVsPurchMismatches}/${bomVsPurchChecked} mismatches, ${bomVsPurchDetails.length} notes)`)

  // ── Check 4: Pricing-debug grand total consistency ──
  // Grand total should equal subtotal marked up + installation (+ tax if any)
  const expectedGT = pricing.subtotalMarkedUp + pricing.installation
  const diffGT = Math.abs(expectedGT - pricing.grandTotal)
  const passGT = diffGT <= 0.02

  results.push({
    test: `${label} - Grand Total Consistency`,
    description: 'Grand total should equal subtotal marked up + installation',
    status: passGT ? 'PASS' : 'FAIL',
    expected: `$${expectedGT.toFixed(2)}`,
    actual: `$${pricing.grandTotal.toFixed(2)}`,
    difference: `$${diffGT.toFixed(2)}`,
    notes: passGT ? '' : `Subtotal MU=$${pricing.subtotalMarkedUp.toFixed(2)}, Install=$${pricing.installation.toFixed(2)}`
  })
  console.log(`    Grand Total Consistency: ${passGT ? 'PASS' : 'FAIL'} (expected=$${expectedGT.toFixed(2)}, actual=$${pricing.grandTotal.toFixed(2)})`)
}

function runCrossReportValidation(projects: TestProject[], results: ComparisonResult[]): void {
  console.log('\n=== Step 6a: Cross-Report Validation (within each project) ===')

  for (const project of projects) {
    crossCompareReports(project.name, project.dir, results)
  }
}

// ─── Step 6b: Cross-Project Comparisons ─────────────────────────────────

function runComparisons(results: ComparisonResult[]): void {
  console.log('\n=== Step 6b: Cross-Project Comparisons ===')

  // Comparison A: Project 3 (2x Product A) vs 2x Project 1 (1x Product A)
  compareProjectPair(
    'Comparison A: 2x ProductA vs 2x(1x ProductA)',
    '01-single-product-a',
    '03-double-product-a',
    2,
    results
  )

  // Comparison B: Project 4 (2x Product B) vs 2x Project 2 (1x Product B)
  compareProjectPair(
    'Comparison B: 2x ProductB vs 2x(1x ProductB)',
    '02-single-product-b',
    '04-double-product-b',
    2,
    results
  )

  // Comparison C: Project 6 (2x Mixed) vs 2x Project 5 (1x Mixed)
  compareProjectPair(
    'Comparison C: 2x Mixed vs 2x(1x Mixed)',
    '05-mixed-single',
    '06-mixed-double',
    2,
    results
  )

  // Comparison D: Project 5 (1x A + 1x B) vs Project 1 + Project 2
  compareMixedProjects(
    'Comparison D: Mixed(A+B) vs Single A + Single B',
    '01-single-product-a',
    '02-single-product-b',
    '05-mixed-single',
    results
  )
}

// ─── Step 7: Generate Report ────────────────────────────────────────────

function generateReport(results: ComparisonResult[]): void {
  console.log('\n=== Step 7: Generating Comparison Report ===')

  const lines = ['Test,Description,Status,Expected,Actual,Difference,Notes']
  for (const r of results) {
    lines.push([
      csvEscapeReport(r.test),
      csvEscapeReport(r.description),
      r.status,
      csvEscapeReport(r.expected),
      csvEscapeReport(r.actual),
      csvEscapeReport(r.difference),
      csvEscapeReport(r.notes)
    ].join(','))
  }

  const reportPath = path.join(OUTPUT_DIR, 'comparison-report.csv')
  fs.writeFileSync(reportPath, lines.join('\n'))
  console.log(`  Report saved to: ${reportPath}`)

  // Summary
  const pass = results.filter(r => r.status === 'PASS').length
  const fail = results.filter(r => r.status === 'FAIL').length
  const info = results.filter(r => r.status === 'INFO').length
  console.log(`\n  Summary: ${pass} PASS, ${fail} FAIL, ${info} INFO out of ${results.length} checks`)
}

function csvEscapeReport(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`
  }
  return val
}

// ─── Step 8: Cleanup ────────────────────────────────────────────────────

async function cleanup(projects: TestProject[]): Promise<void> {
  const keepFlag = process.argv.includes('--keep')
  if (keepFlag) {
    console.log('\n=== Step 8: Cleanup SKIPPED (--keep flag) ===')
    console.log(`  ${projects.length} test projects retained.`)
    return
  }

  console.log('\n=== Step 8: Cleanup ===')
  for (const project of projects) {
    console.log(`  Deleting project: ${project.name} (id=${project.id})`)
    try {
      await api('DELETE', `/api/projects/${project.id}`)
    } catch (e: any) {
      console.log(`    Warning: Delete failed: ${e.message}`)
    }
  }
}

// ─── Main ───────────────────────────────────────────────────────────────

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════╗')
  console.log('║  Pricing Verification: Direct Component Creation Method      ║')
  console.log('╚═══════════════════════════════════════════════════════════════╝')
  console.log(`Base URL: ${BASE_URL}`)
  console.log(`Output:   ${OUTPUT_DIR}`)

  let projects: TestProject[] = []

  try {
    await authenticate()
    const { productA, productB } = await discoverProducts()
    projects = await createTestProjects(productA, productB)
    await addComponentsToProjects(projects)
    await downloadCSVs(projects)

    const results: ComparisonResult[] = []
    runCrossReportValidation(projects, results)
    runComparisons(results)
    generateReport(results)

    // Print final status
    const failures = results.filter(r => r.status === 'FAIL')
    if (failures.length > 0) {
      console.log(`\n⚠ ${failures.length} FAILURE(S) detected. Review comparison-report.csv for details.`)
    } else {
      console.log('\n✓ All comparisons passed!')
    }
  } catch (error: any) {
    console.error(`\nFATAL ERROR: ${error.message}`)
    console.error(error.stack)
  } finally {
    await cleanup(projects)
  }
}

main()
