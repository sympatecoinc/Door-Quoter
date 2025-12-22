import {
  calculateOptimizedStockPieces,
  findBestStockLengthRule,
  calculateStockOptimization,
  KERF_WIDTH,
  type StockLengthRule,
  type CutListItem
} from '@/lib/bom/calculations'

describe('calculateOptimizedStockPieces', () => {
  const STOCK_LENGTH = 144 // 12 foot stock (in inches)

  describe('basic functionality', () => {
    it('should return 0 for empty cut array', () => {
      const result = calculateOptimizedStockPieces([], STOCK_LENGTH)
      expect(result.stockPiecesNeeded).toBe(0)
      expect(result.totalStockLength).toBe(0)
      expect(result.wasteLength).toBe(0)
      expect(result.wastePercent).toBe(0)
    })

    it('should return 0 for zero stock length', () => {
      const result = calculateOptimizedStockPieces([36], 0)
      expect(result.stockPiecesNeeded).toBe(0)
    })

    it('should return 0 for negative stock length', () => {
      const result = calculateOptimizedStockPieces([36], -10)
      expect(result.stockPiecesNeeded).toBe(0)
    })

    it('should handle single cut that fits in stock', () => {
      const result = calculateOptimizedStockPieces([36], STOCK_LENGTH)
      expect(result.stockPiecesNeeded).toBe(1)
      expect(result.totalStockLength).toBe(144)
      expect(result.wasteLength).toBe(108) // 144 - 36
    })
  })

  describe('bin-packing optimization', () => {
    it('should fit multiple cuts in one stock when possible', () => {
      // 3 cuts of 36" = 108" + 0.375" kerf (3 kerfs) = 108.375"
      // Fits in 144" stock
      const result = calculateOptimizedStockPieces([36, 36, 36], STOCK_LENGTH)
      expect(result.stockPiecesNeeded).toBe(1)
    })

    it('should require two stocks when cuts dont fit in one', () => {
      // Two 80" cuts cannot fit in one 144" stock (80 + 0.125 + 80 = 160.125")
      const result = calculateOptimizedStockPieces([80, 80], STOCK_LENGTH)
      expect(result.stockPiecesNeeded).toBe(2)
    })

    it('should optimize using first-fit decreasing algorithm', () => {
      // Cuts: 70, 60, 40, 30 (unsorted input)
      // Sorted: 70, 60, 40, 30
      // Bin 1: 70 (remaining: 73.875 after kerf)
      //        60 (remaining: 13.75 after kerf) - 60 doesn't fit, try next
      //        40 (remaining: 33.75 after kerf) - 40 doesn't fit
      //        30 (remaining: 43.75 after kerf) - 30 fits!
      // Bin 2: 60 (remaining: 83.875)
      //        40 (remaining: 43.75) - 40 fits!
      // Result: 2 bins
      const result = calculateOptimizedStockPieces([70, 30, 60, 40], STOCK_LENGTH)
      expect(result.stockPiecesNeeded).toBe(2)
    })

    it('should handle cuts exactly equal to stock length', () => {
      const result = calculateOptimizedStockPieces([144], STOCK_LENGTH)
      expect(result.stockPiecesNeeded).toBe(1)
    })

    it('should handle cuts larger than stock length gracefully', () => {
      // Cut is larger than stock - still needs a bin (edge case handling)
      const result = calculateOptimizedStockPieces([150], STOCK_LENGTH)
      expect(result.stockPiecesNeeded).toBe(1) // Even oversized cuts get a bin
    })
  })

  describe('kerf handling', () => {
    it('should use default kerf width of 0.125"', () => {
      expect(KERF_WIDTH).toBe(0.125)
    })

    it('should account for kerf between cuts', () => {
      // Two 71" cuts with 0.125" kerf = 71 + 0.125 + 71 + 0.125 = 142.25"
      // This fits in 144"
      const result = calculateOptimizedStockPieces([71, 71], STOCK_LENGTH, 0.125)
      expect(result.stockPiecesNeeded).toBe(1)
    })

    it('should require extra stock when kerf pushes over limit', () => {
      // Two 72" cuts with 0.125" kerf = 72 + 0.125 + 72 + 0.125 = 144.25"
      // This exceeds 144" by a small amount
      const result = calculateOptimizedStockPieces([72, 72], STOCK_LENGTH, 0.125)
      expect(result.stockPiecesNeeded).toBe(2)
    })

    it('should allow custom kerf width', () => {
      const result = calculateOptimizedStockPieces([70, 70], STOCK_LENGTH, 0.5)
      // 70 + 0.5 + 70 + 0.5 = 141" - fits in 144"
      expect(result.stockPiecesNeeded).toBe(1)
    })

    it('should handle zero kerf', () => {
      // Two 72" cuts with 0 kerf = 144" exactly
      const result = calculateOptimizedStockPieces([72, 72], STOCK_LENGTH, 0)
      expect(result.stockPiecesNeeded).toBe(1)
    })
  })

  describe('waste calculations', () => {
    it('should calculate correct waste length', () => {
      const result = calculateOptimizedStockPieces([36], STOCK_LENGTH)
      expect(result.wasteLength).toBe(108) // 144 - 36 = 108
    })

    it('should calculate waste percentage correctly', () => {
      const result = calculateOptimizedStockPieces([72], STOCK_LENGTH)
      // Waste = 144 - 72 = 72
      // Waste % = (72 / 144) * 100 = 50%
      expect(result.wastePercent).toBe(50)
    })

    it('should round waste percentage to 1 decimal place', () => {
      const result = calculateOptimizedStockPieces([33], 100)
      // Waste = 100 - 33 = 67
      // Waste % = 67%
      expect(result.wastePercent).toBe(67)
    })

    it('should calculate total stock length correctly for multiple stocks', () => {
      const result = calculateOptimizedStockPieces([80, 80], STOCK_LENGTH)
      expect(result.stockPiecesNeeded).toBe(2)
      expect(result.totalStockLength).toBe(288) // 2 * 144
    })
  })

  describe('real-world scenarios', () => {
    it('should optimize door jamb cuts efficiently', () => {
      // 4 door jambs at 84" each
      // 144" stock: 1 cut per stock (84 + kerf leaves ~59.875")
      // Second cut would need 84" but only ~59.875" available
      const result = calculateOptimizedStockPieces([84, 84, 84, 84], STOCK_LENGTH)
      expect(result.stockPiecesNeeded).toBe(4)
    })

    it('should optimize header and sill cuts together', () => {
      // 4 cuts of 36" with 0.125" kerf
      // First cut: 144 - 36 - 0.125 = 107.875 remaining
      // Second cut: 107.875 - 36 - 0.125 = 71.75 remaining
      // Third cut: 71.75 - 36 - 0.125 = 35.625 remaining
      // Fourth cut needs 36", but only 35.625 available - needs new stock
      const result = calculateOptimizedStockPieces([36, 36, 36, 36], STOCK_LENGTH)
      expect(result.stockPiecesNeeded).toBe(2)
    })

    it('should handle mixed cut sizes typical of a door opening', () => {
      // Typical door BOM: 2 jambs (84"), 1 header (38"), 1 sill (36")
      const result = calculateOptimizedStockPieces([84, 84, 38, 36], STOCK_LENGTH)
      // Sorted: 84, 84, 38, 36
      // Bin 1: 84 (remaining 59.875), 38 (remaining 21.75)
      // Bin 2: 84 (remaining 59.875), 36 (remaining 23.75)
      expect(result.stockPiecesNeeded).toBe(2)
    })
  })
})

describe('findBestStockLengthRule', () => {
  const makeRule = (overrides: Partial<StockLengthRule>): StockLengthRule => ({
    isActive: true,
    minHeight: null,
    maxHeight: null,
    stockLength: 144,
    ...overrides
  })

  describe('basic matching', () => {
    it('should return rule with no constraints when length matches', () => {
      const rules = [makeRule({ stockLength: 144 })]
      const result = findBestStockLengthRule(rules, 36)
      expect(result).not.toBeNull()
      expect(result?.stockLength).toBe(144)
    })

    it('should return null for empty rules array', () => {
      const result = findBestStockLengthRule([], 36)
      expect(result).toBeNull()
    })

    it('should skip inactive rules', () => {
      const rules = [
        makeRule({ isActive: false, stockLength: 144 }),
        makeRule({ isActive: true, stockLength: 168 })
      ]
      const result = findBestStockLengthRule(rules, 36)
      expect(result?.stockLength).toBe(168)
    })
  })

  describe('height range matching', () => {
    it('should match when length is within minHeight and maxHeight', () => {
      const rules = [makeRule({ minHeight: 80, maxHeight: 96, stockLength: 168 })]
      const result = findBestStockLengthRule(rules, 84)
      expect(result).not.toBeNull()
      expect(result?.stockLength).toBe(168)
    })

    it('should not match when length is below minHeight', () => {
      const rules = [makeRule({ minHeight: 80, maxHeight: 96, stockLength: 168 })]
      const result = findBestStockLengthRule(rules, 72)
      expect(result).toBeNull()
    })

    it('should not match when length is above maxHeight', () => {
      const rules = [makeRule({ minHeight: 80, maxHeight: 96, stockLength: 168 })]
      const result = findBestStockLengthRule(rules, 100)
      expect(result).toBeNull()
    })

    it('should match at exact minHeight boundary', () => {
      const rules = [makeRule({ minHeight: 80, maxHeight: 96, stockLength: 168 })]
      const result = findBestStockLengthRule(rules, 80)
      expect(result).not.toBeNull()
    })

    it('should match at exact maxHeight boundary', () => {
      const rules = [makeRule({ minHeight: 80, maxHeight: 96, stockLength: 168 })]
      const result = findBestStockLengthRule(rules, 96)
      expect(result).not.toBeNull()
    })
  })

  describe('specificity selection', () => {
    it('should prefer rule with both min and max over rule with neither', () => {
      const rules = [
        makeRule({ stockLength: 144 }), // No constraints
        makeRule({ minHeight: 80, maxHeight: 96, stockLength: 168 }) // Both constraints
      ]
      const result = findBestStockLengthRule(rules, 84)
      expect(result?.stockLength).toBe(168)
    })

    it('should prefer rule with minHeight only over rule with neither', () => {
      const rules = [
        makeRule({ stockLength: 144 }), // No constraints
        makeRule({ minHeight: 80, stockLength: 168 }) // minHeight only
      ]
      const result = findBestStockLengthRule(rules, 84)
      expect(result?.stockLength).toBe(168)
    })

    it('should prefer rule with maxHeight only over rule with neither', () => {
      const rules = [
        makeRule({ stockLength: 144 }), // No constraints
        makeRule({ maxHeight: 90, stockLength: 168 }) // maxHeight only
      ]
      const result = findBestStockLengthRule(rules, 84)
      expect(result?.stockLength).toBe(168)
    })

    it('should fall back to less specific rule when specific rule doesnt match', () => {
      const rules = [
        makeRule({ stockLength: 144 }), // No constraints - always matches
        makeRule({ minHeight: 90, maxHeight: 100, stockLength: 168 }) // Specific - doesn't match 84
      ]
      const result = findBestStockLengthRule(rules, 84)
      expect(result?.stockLength).toBe(144)
    })
  })
})

describe('calculateStockOptimization', () => {
  const makeCutListItem = (overrides: Partial<CutListItem>): CutListItem => ({
    productName: 'Test Product',
    panelWidth: 36,
    panelHeight: 84,
    sizeKey: '36x84',
    partNumber: 'TEST-001',
    partName: 'Test Part',
    stockLength: 144,
    cutLength: 36,
    qtyPerUnit: 2,
    unitCount: 1,
    totalQty: 2,
    color: 'Black',
    ...overrides
  })

  it('should return empty array for empty input', () => {
    const result = calculateStockOptimization([])
    expect(result).toEqual([])
  })

  it('should skip items without stock length', () => {
    const items = [makeCutListItem({ stockLength: null })]
    const result = calculateStockOptimization(items)
    expect(result).toEqual([])
  })

  it('should skip items without cut length', () => {
    const items = [makeCutListItem({ cutLength: null })]
    const result = calculateStockOptimization(items)
    expect(result).toEqual([])
  })

  it('should calculate optimization for single item', () => {
    const items = [makeCutListItem({ cutLength: 36, stockLength: 144, totalQty: 4 })]
    const result = calculateStockOptimization(items)

    expect(result.length).toBe(1)
    expect(result[0].partNumber).toBe('TEST-001')
    expect(result[0].totalCuts).toBe(4)
    expect(result[0].stockPiecesNeeded).toBeGreaterThanOrEqual(1)
  })

  it('should group items by part number and stock length', () => {
    const items = [
      makeCutListItem({ partNumber: 'PART-A', stockLength: 144, cutLength: 36, totalQty: 2 }),
      makeCutListItem({ partNumber: 'PART-A', stockLength: 144, cutLength: 48, totalQty: 2 }),
      makeCutListItem({ partNumber: 'PART-B', stockLength: 144, cutLength: 36, totalQty: 2 })
    ]
    const result = calculateStockOptimization(items)

    // Should have 2 groups: PART-A|144 and PART-B|144
    expect(result.length).toBe(2)
  })

  it('should sort results by part number', () => {
    const items = [
      makeCutListItem({ partNumber: 'Z-PART', stockLength: 144, totalQty: 1 }),
      makeCutListItem({ partNumber: 'A-PART', stockLength: 144, totalQty: 1 })
    ]
    const result = calculateStockOptimization(items)

    expect(result[0].partNumber).toBe('A-PART')
    expect(result[1].partNumber).toBe('Z-PART')
  })
})
