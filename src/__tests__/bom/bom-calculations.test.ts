import { describe, it, expect } from 'vitest'
import {
  KERF_WIDTH,
  calculateOptimizedStockPieces,
  evaluateFormula,
  getFrameDimensions,
  calculateRequiredPartLength,
  findBestStockLengthRule,
  aggregateBomItems,
  aggregateCutListItems,
  calculateStockOptimization,
  cutlistToCSV,
  summaryToCSV,
  type PanelForFrameCalc,
  type StockLengthRule,
  type BomItem,
  type BOMItemForCutList
} from '@/lib/bom-utils'

describe('evaluateFormula', () => {
  it('should return 0 for empty formula', () => {
    expect(evaluateFormula('', { width: 10, height: 20 })).toBe(0)
  })

  it('should return 0 for null/undefined formula', () => {
    expect(evaluateFormula(null as any, { width: 10, height: 20 })).toBe(0)
    expect(evaluateFormula(undefined as any, { width: 10, height: 20 })).toBe(0)
  })

  it('should evaluate basic addition', () => {
    expect(evaluateFormula('width + height', { width: 10, height: 20 })).toBe(30)
  })

  it('should evaluate multiplication (perimeter calculation)', () => {
    expect(evaluateFormula('width * 2 + height * 2', { width: 42, height: 108 })).toBe(300)
  })

  it('should evaluate negative offsets (glass calculation)', () => {
    expect(evaluateFormula('width - 0.5', { width: 42, height: 108 })).toBe(41.5)
    expect(evaluateFormula('height - 0.5', { width: 42, height: 108 })).toBe(107.5)
  })

  it('should be case insensitive for variable names', () => {
    expect(evaluateFormula('Width + Height', { width: 10, height: 20 })).toBe(30)
    expect(evaluateFormula('WIDTH + HEIGHT', { width: 10, height: 20 })).toBe(30)
  })

  it('should evaluate division (convert to feet)', () => {
    expect(evaluateFormula('width / 12', { width: 48, height: 108 })).toBe(4)
  })

  it('should return 0 for invalid formula (graceful error handling)', () => {
    expect(evaluateFormula('invalid formula xyz', { width: 10, height: 20 })).toBe(0)
  })

  it('should return 0 for negative results (floor to 0)', () => {
    expect(evaluateFormula('width - 100', { width: 10, height: 20 })).toBe(0)
  })

  it('should handle complex expressions', () => {
    expect(evaluateFormula('(width + height) * 2', { width: 10, height: 20 })).toBe(60)
  })

  it('should handle quantity variable', () => {
    expect(evaluateFormula('quantity * 2', { width: 10, height: 20, quantity: 4 })).toBe(8)
  })
})

describe('calculateOptimizedStockPieces', () => {
  it('should return 0 for empty cuts array', () => {
    const result = calculateOptimizedStockPieces([], 96)
    expect(result.stockPiecesNeeded).toBe(0)
    expect(result.totalStockLength).toBe(0)
    expect(result.wasteLength).toBe(0)
    expect(result.wastePercent).toBe(0)
  })

  it('should return 0 for invalid stock length', () => {
    const result = calculateOptimizedStockPieces([48], 0)
    expect(result.stockPiecesNeeded).toBe(0)
  })

  it('should fit single cut in one stock piece', () => {
    const result = calculateOptimizedStockPieces([48], 96)
    expect(result.stockPiecesNeeded).toBe(1)
    expect(result.totalStockLength).toBe(96)
    expect(result.wasteLength).toBe(48)
  })

  it('should use bin-packing for multiple cuts that fit in one stock', () => {
    // Two 40" cuts should fit in one 96" stock
    const result = calculateOptimizedStockPieces([40, 40], 96)
    expect(result.stockPiecesNeeded).toBe(1)
    expect(result.totalStockLength).toBe(96)
  })

  it('should require multiple stock pieces when cuts exceed capacity', () => {
    // Three 40" cuts can't fit in one 96" stock (40+40=80, but 40+40+40=120)
    const result = calculateOptimizedStockPieces([40, 40, 40], 96)
    expect(result.stockPiecesNeeded).toBe(2)
    expect(result.totalStockLength).toBe(192)
  })

  it('should account for kerf width in bin-packing', () => {
    // Two 47.9" cuts with 0.125" kerf: 47.9 + 0.125 + 47.9 = 95.925, should fit in 96"
    const result = calculateOptimizedStockPieces([47.9, 47.9], 96)
    expect(result.stockPiecesNeeded).toBe(1)
  })

  it('should handle oversized cuts gracefully', () => {
    // Cut that exceeds stock length
    const result = calculateOptimizedStockPieces([100], 96)
    expect(result.stockPiecesNeeded).toBe(1)
  })

  it('should calculate waste percentage correctly', () => {
    // 48" cut from 96" stock = 50% waste
    const result = calculateOptimizedStockPieces([48], 96)
    expect(result.wastePercent).toBe(50)
  })

  it('should handle cuts exactly equal to stock length', () => {
    const result = calculateOptimizedStockPieces([96], 96)
    expect(result.stockPiecesNeeded).toBe(1)
    expect(result.wastePercent).toBe(0)
  })

  it('should use first-fit decreasing algorithm (larger cuts placed first)', () => {
    // [80, 40, 30, 20] should be sorted to [80, 40, 30, 20]
    // 80 goes in bin 1, 40+30+20 = 90 could go in bin 2, but after kerf may need adjustment
    const result = calculateOptimizedStockPieces([20, 30, 40, 80], 96)
    expect(result.stockPiecesNeeded).toBeLessThanOrEqual(2)
  })

  it('should allow custom kerf width', () => {
    // Two 47.5" cuts with no kerf should fit in 95"
    const result = calculateOptimizedStockPieces([47.5, 47.5], 95, 0)
    expect(result.stockPiecesNeeded).toBe(1)
  })
})

describe('getFrameDimensions', () => {
  it('should return {0, 0} for empty siblings', () => {
    const panels: PanelForFrameCalc[] = [
      { id: 1, width: 42, height: 108, componentInstance: { product: { productType: 'FRAME' } } }
    ]
    const result = getFrameDimensions(panels, 1)
    expect(result.width).toBe(0)
    expect(result.height).toBe(0)
  })

  it('should sum sibling widths and take max height', () => {
    const panels: PanelForFrameCalc[] = [
      { id: 1, width: 0, height: 0, componentInstance: { product: { productType: 'FRAME' } } },
      { id: 2, width: 42, height: 108 },
      { id: 3, width: 30, height: 100 }
    ]
    const result = getFrameDimensions(panels, 1)
    expect(result.width).toBe(72) // 42 + 30
    expect(result.height).toBe(108) // max of 108, 100
  })

  it('should exclude FRAME product types from siblings', () => {
    const panels: PanelForFrameCalc[] = [
      { id: 1, componentInstance: { product: { productType: 'FRAME' } } },
      { id: 2, width: 42, height: 108, componentInstance: { product: { productType: 'FRAME' } } },
      { id: 3, width: 30, height: 100 }
    ]
    const result = getFrameDimensions(panels, 1)
    expect(result.width).toBe(30)
    expect(result.height).toBe(100)
  })

  it('should handle single sibling', () => {
    const panels: PanelForFrameCalc[] = [
      { id: 1, componentInstance: { product: { productType: 'FRAME' } } },
      { id: 2, width: 42, height: 108 }
    ]
    const result = getFrameDimensions(panels, 1)
    expect(result.width).toBe(42)
    expect(result.height).toBe(108)
  })

  it('should handle undefined widths/heights gracefully', () => {
    const panels: PanelForFrameCalc[] = [
      { id: 1, componentInstance: { product: { productType: 'FRAME' } } },
      { id: 2, width: undefined, height: undefined }
    ]
    const result = getFrameDimensions(panels, 1)
    expect(result.width).toBe(0)
    expect(result.height).toBe(0)
  })
})

describe('calculateRequiredPartLength', () => {
  it('should evaluate formula when present', () => {
    const bom = { formula: 'width * 2', partType: 'Extrusion' }
    const result = calculateRequiredPartLength(bom, { width: 42, height: 108 })
    expect(result).toBe(84)
  })

  it('should return max dimension for extrusions without formula', () => {
    const bom = { partType: 'Extrusion' }
    const result = calculateRequiredPartLength(bom, { width: 42, height: 108 })
    expect(result).toBe(108)
  })

  it('should return quantity for non-extrusions without formula', () => {
    const bom = { partType: 'Hardware', quantity: 4 }
    const result = calculateRequiredPartLength(bom, { width: 42, height: 108 })
    expect(result).toBe(4)
  })

  it('should return 0 for non-extrusions without formula or quantity', () => {
    const bom = { partType: 'Hardware' }
    const result = calculateRequiredPartLength(bom, { width: 42, height: 108 })
    expect(result).toBe(0)
  })
})

describe('findBestStockLengthRule', () => {
  const rules: StockLengthRule[] = [
    { isActive: true, minHeight: null, maxHeight: null, stockLength: 96 }, // Default rule
    { isActive: true, minHeight: 48, maxHeight: 96, stockLength: 120 },    // Medium rule
    { isActive: true, minHeight: 96, maxHeight: 144, stockLength: 144 },   // Large rule
    { isActive: false, minHeight: 0, maxHeight: 48, stockLength: 72 }      // Inactive rule
  ]

  it('should return null for empty rules array', () => {
    const result = findBestStockLengthRule([], 50)
    expect(result).toBeNull()
  })

  it('should return default rule when no constraints match', () => {
    const result = findBestStockLengthRule(rules, 30)
    expect(result?.stockLength).toBe(96)
  })

  it('should return most specific matching rule', () => {
    const result = findBestStockLengthRule(rules, 60)
    expect(result?.stockLength).toBe(120) // Medium rule is most specific
  })

  it('should ignore inactive rules', () => {
    const result = findBestStockLengthRule(rules, 30)
    expect(result?.stockLength).not.toBe(72) // Inactive rule
  })

  it('should handle null min/max heights', () => {
    const rulesWithNulls: StockLengthRule[] = [
      { isActive: true, minHeight: null, maxHeight: 50, stockLength: 72 },
      { isActive: true, minHeight: 50, maxHeight: null, stockLength: 144 }
    ]
    expect(findBestStockLengthRule(rulesWithNulls, 30)?.stockLength).toBe(72)
    expect(findBestStockLengthRule(rulesWithNulls, 80)?.stockLength).toBe(144)
  })
})

describe('aggregateBomItems', () => {
  it('should group items by part number', () => {
    const items: BomItem[] = [
      { partNumber: 'EXTR-001', partName: 'Rail', partType: 'Extrusion', quantity: 1, unit: 'EA', stockLength: 96, cutLength: 42 },
      { partNumber: 'EXTR-001', partName: 'Rail', partType: 'Extrusion', quantity: 1, unit: 'EA', stockLength: 96, cutLength: 42 }
    ]
    const result = aggregateBomItems(items)
    expect(result.length).toBe(1)
    expect(result[0].totalQuantity).toBe(2)
  })

  it('should group glass by dimensions', () => {
    const items: BomItem[] = [
      { partNumber: 'GLASS-CLEAR', partName: 'Clear Glass', partType: 'Glass', unit: 'SQ FT', glassWidth: 41.5, glassHeight: 107.5, glassArea: 30.97 },
      { partNumber: 'GLASS-CLEAR', partName: 'Clear Glass', partType: 'Glass', unit: 'SQ FT', glassWidth: 29.5, glassHeight: 99.5, glassArea: 20.37 }
    ]
    const result = aggregateBomItems(items)
    // Different dimensions should create separate entries
    expect(result.length).toBe(2)
  })

  it('should collect cut lengths for extrusions', () => {
    const items: BomItem[] = [
      { partNumber: 'EXTR-001', partName: 'Rail', partType: 'Extrusion', quantity: 2, unit: 'EA', stockLength: 96, cutLength: 42 }
    ]
    const result = aggregateBomItems(items)
    expect(result[0].cutLengths.length).toBe(2)
    expect(result[0].totalCutLength).toBe(84)
  })

  it('should calculate stock optimization for extrusions', () => {
    const items: BomItem[] = [
      { partNumber: 'EXTR-001', partName: 'Rail', partType: 'Extrusion', quantity: 2, unit: 'EA', stockLength: 96, cutLength: 42 }
    ]
    const result = aggregateBomItems(items)
    expect(result[0].stockPiecesNeeded).toBe(1)
    expect(result[0].wastePercent).toBeDefined()
  })

  it('should sort by part type order (Extrusion, Hardware, Glass, Option)', () => {
    const items: BomItem[] = [
      { partNumber: 'OPT-001', partName: 'Handle', partType: 'Option', unit: 'EA' },
      { partNumber: 'GLASS-001', partName: 'Glass', partType: 'Glass', unit: 'SQ FT' },
      { partNumber: 'HW-001', partName: 'Screw', partType: 'Hardware', unit: 'EA' },
      { partNumber: 'EXTR-001', partName: 'Rail', partType: 'Extrusion', unit: 'EA' }
    ]
    const result = aggregateBomItems(items)
    expect(result[0].partType).toBe('Extrusion')
    expect(result[1].partType).toBe('Hardware')
    expect(result[2].partType).toBe('Glass')
    expect(result[3].partType).toBe('Option')
  })

  it('should aggregate calculated lengths for hardware with LF units', () => {
    const items: BomItem[] = [
      { partNumber: 'HW-001', partName: 'Weatherstrip', partType: 'Hardware', quantity: 1, unit: 'LF', calculatedLength: 10 },
      { partNumber: 'HW-001', partName: 'Weatherstrip', partType: 'Hardware', quantity: 1, unit: 'LF', calculatedLength: 10 }
    ]
    const result = aggregateBomItems(items)
    expect(result[0].totalCalculatedLength).toBe(20)
    expect(result[0].calculatedLengths.length).toBe(2)
  })
})

describe('aggregateCutListItems', () => {
  it('should filter to extrusions only', () => {
    const items: BOMItemForCutList[] = [
      { partNumber: 'EXTR-001', partType: 'Extrusion', productName: 'Door', panelId: 1, panelWidth: 42, panelHeight: 108, cutLength: 42 },
      { partNumber: 'HW-001', partType: 'Hardware', productName: 'Door', panelId: 1, panelWidth: 42, panelHeight: 108 }
    ]
    const result = aggregateCutListItems(items)
    expect(result.length).toBe(1)
    expect(result[0].partNumber).toBe('EXTR-001')
  })

  it('should group by product + size + part number + cut length', () => {
    const items: BOMItemForCutList[] = [
      { partNumber: 'EXTR-001', partType: 'Extrusion', productName: 'Door', panelId: 1, panelWidth: 42, panelHeight: 108, cutLength: 42, quantity: 2 },
      { partNumber: 'EXTR-001', partType: 'Extrusion', productName: 'Door', panelId: 2, panelWidth: 42, panelHeight: 108, cutLength: 42, quantity: 2 }
    ]
    const result = aggregateCutListItems(items)
    expect(result.length).toBe(1)
    expect(result[0].qtyPerUnit).toBe(2)
    expect(result[0].unitCount).toBe(2)
    expect(result[0].totalQty).toBe(4)
  })

  it('should calculate qtyPerUnit correctly', () => {
    const items: BOMItemForCutList[] = [
      { partNumber: 'EXTR-001', partType: 'Extrusion', productName: 'Door', panelId: 1, panelWidth: 42, panelHeight: 108, cutLength: 42, quantity: 4 }
    ]
    const result = aggregateCutListItems(items)
    expect(result[0].qtyPerUnit).toBe(4)
    expect(result[0].unitCount).toBe(1)
  })

  it('should sort by product name, size, part number, cut length', () => {
    const items: BOMItemForCutList[] = [
      { partNumber: 'EXTR-002', partType: 'Extrusion', productName: 'Window', panelId: 2, panelWidth: 30, panelHeight: 60, cutLength: 30 },
      { partNumber: 'EXTR-001', partType: 'Extrusion', productName: 'Door', panelId: 1, panelWidth: 42, panelHeight: 108, cutLength: 42 }
    ]
    const result = aggregateCutListItems(items)
    expect(result[0].productName).toBe('Door')
    expect(result[1].productName).toBe('Window')
  })
})

describe('calculateStockOptimization', () => {
  it('should group by part number and stock length', () => {
    const cutListItems = [
      { partNumber: 'EXTR-001-96', partName: 'Rail', sizeKey: '42x108', stockLength: 96, cutLength: 42, totalQty: 2 },
      { partNumber: 'EXTR-001-96', partName: 'Rail', sizeKey: '30x60', stockLength: 96, cutLength: 30, totalQty: 2 }
    ]
    const result = calculateStockOptimization(cutListItems as any)
    expect(result.length).toBe(1)
    expect(result[0].totalCuts).toBe(4)
  })

  it('should calculate stock pieces needed correctly', () => {
    const cutListItems = [
      { partNumber: 'EXTR-001-96', partName: 'Rail', sizeKey: '42x108', stockLength: 96, cutLength: 42, totalQty: 4 }
    ]
    const result = calculateStockOptimization(cutListItems as any)
    expect(result[0].stockPiecesNeeded).toBe(2) // 4 x 42" cuts need 2 x 96" stock
  })

  it('should skip items without stockLength or cutLength', () => {
    const cutListItems = [
      { partNumber: 'EXTR-001', partName: 'Rail', sizeKey: '42x108', stockLength: null, cutLength: 42, totalQty: 2 }
    ]
    const result = calculateStockOptimization(cutListItems as any)
    expect(result.length).toBe(0)
  })
})

describe('cutlistToCSV', () => {
  it('should generate valid CSV headers', () => {
    const items = [
      { productName: 'Door', panelWidth: 42, panelHeight: 108, partNumber: 'EXTR-001', partName: 'Rail', stockLength: 96, cutLength: 42, qtyPerUnit: 2, unitCount: 1, totalQty: 2, color: 'Black' }
    ]
    const csv = cutlistToCSV('Test Project', items as any)
    expect(csv).toContain('Product')
    expect(csv).toContain('Part Number')
    expect(csv).toContain('Cut Length')
  })

  it('should escape special characters in CSV', () => {
    const items = [
      { productName: 'Door "Special"', panelWidth: 42, panelHeight: 108, partNumber: 'EXTR-001', partName: 'Rail', stockLength: 96, cutLength: 42, qtyPerUnit: 2, unitCount: 1, totalQty: 2 }
    ]
    const csv = cutlistToCSV('Test Project', items as any)
    expect(csv).toContain('Door ""Special""') // Double quotes should be escaped
  })

  it('should include batch information when provided', () => {
    const items = [
      { productName: 'Door', panelWidth: 42, panelHeight: 108, partNumber: 'EXTR-001', partName: 'Rail', stockLength: 96, cutLength: 42, qtyPerUnit: 2, unitCount: 5, totalQty: 10 }
    ]
    const batchInfo = { totalUnits: 5, batchSize: 2, remainder: 1 }
    const csv = cutlistToCSV('Test Project', items as any, batchInfo)
    expect(csv).toContain('BATCH INFORMATION')
    expect(csv).toContain('Total Units:')
    expect(csv).toContain('Remainder Units:')
  })

  it('should indicate when batches divide evenly', () => {
    const items = [
      { productName: 'Door', panelWidth: 42, panelHeight: 108, partNumber: 'EXTR-001', partName: 'Rail', stockLength: 96, cutLength: 42, qtyPerUnit: 2, unitCount: 4, totalQty: 8 }
    ]
    const batchInfo = { totalUnits: 4, batchSize: 2, remainder: 0 }
    const csv = cutlistToCSV('Test Project', items as any, batchInfo)
    expect(csv).toContain('None - batches divide evenly')
  })
})

describe('summaryToCSV', () => {
  it('should generate valid CSV headers', () => {
    const items = [
      { partNumber: 'EXTR-001', partName: 'Rail', partType: 'Extrusion', totalQuantity: 4, unit: 'EA', stockLength: 96, cutLengths: [42, 42, 42, 42], totalCutLength: 168, stockPiecesNeeded: 2, wastePercent: 12.5, glassDimensions: [], totalArea: 0, calculatedLengths: [], totalCalculatedLength: 0, glassWidth: null, glassHeight: null }
    ]
    const csv = summaryToCSV('Test Project', items as any)
    expect(csv).toContain('Part Number')
    expect(csv).toContain('Stock Pieces to Order')
    expect(csv).toContain('Waste %')
  })

  it('should show unique cut lengths for extrusions', () => {
    const items = [
      { partNumber: 'EXTR-001', partName: 'Rail', partType: 'Extrusion', totalQuantity: 4, unit: 'EA', stockLength: 96, cutLengths: [42, 42, 30, 30], totalCutLength: 144, stockPiecesNeeded: 2, wastePercent: 25, glassDimensions: [], totalArea: 0, calculatedLengths: [], totalCalculatedLength: 0, glassWidth: null, glassHeight: null }
    ]
    const csv = summaryToCSV('Test Project', items as any)
    expect(csv).toContain('42.00')
    expect(csv).toContain('30.00')
  })

  it('should show glass dimensions for glass items', () => {
    const items = [
      { partNumber: 'GLASS-CLEAR', partName: 'Clear Glass', partType: 'Glass', totalQuantity: 1, unit: 'SQ FT', stockLength: null, cutLengths: [], totalCutLength: 0, stockPiecesNeeded: null, wastePercent: null, glassDimensions: [{ width: 41.5, height: 107.5 }], totalArea: 30.97, glassWidth: 41.5, glassHeight: 107.5, calculatedLengths: [], totalCalculatedLength: 0 }
    ]
    const csv = summaryToCSV('Test Project', items as any)
    expect(csv).toContain('41.50')
    expect(csv).toContain('107.50')
    expect(csv).toContain('30.97')
  })
})

describe('KERF_WIDTH constant', () => {
  it('should be 0.125 inches', () => {
    expect(KERF_WIDTH).toBe(0.125)
  })
})
