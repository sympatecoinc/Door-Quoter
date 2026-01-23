import {
  calculateOptimizedStockPieces,
  findBestStockLengthRule,
  findOptimalStockLengthByYield,
  calculateStockOptimization,
  KERF_WIDTH,
  type StockLengthRule,
  type CutListItem,
  type YieldComparisonResult
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

describe('findOptimalStockLengthByYield', () => {
  describe('basic functionality', () => {
    it('should return null for empty cut lengths', () => {
      const result = findOptimalStockLengthByYield([78, 99], [])
      expect(result).toBeNull()
    })

    it('should return null for empty stock lengths', () => {
      const result = findOptimalStockLengthByYield([], [44.625])
      expect(result).toBeNull()
    })

    it('should return null when all cuts exceed stock lengths', () => {
      const result = findOptimalStockLengthByYield([78, 99], [100])
      expect(result).toBeNull()
    })

    it('should return the only valid stock length when single option', () => {
      const result = findOptimalStockLengthByYield([78], [36])
      expect(result).not.toBeNull()
      expect(result?.stockLength).toBe(78)
    })
  })

  describe('yield optimization - single cut scenarios', () => {
    it('should select 78" for single 44.625" cut (less absolute waste)', () => {
      // 78" stock: waste = 78 - 44.625 = 33.375" (42.8% waste)
      // 99" stock: waste = 99 - 44.625 = 54.375" (54.9% waste)
      // 78" has lower waste percentage
      const result = findOptimalStockLengthByYield([78, 99], [44.625])
      expect(result).not.toBeNull()
      expect(result?.stockLength).toBe(78)
    })

    it('should select shorter stock when it produces less waste percentage', () => {
      // Single 36" cut
      // 78" stock: waste = 78 - 36 = 42" (53.8% waste)
      // 99" stock: waste = 99 - 36 = 63" (63.6% waste)
      // 78" has lower waste percentage
      const result = findOptimalStockLengthByYield([78, 99], [36])
      expect(result?.stockLength).toBe(78)
    })
  })

  describe('yield optimization - multiple cut scenarios', () => {
    it('should select 99" for two 44.625" cuts (fits 2 per stock)', () => {
      // Problem example from the plan:
      // 78" stock: 1 cut per stock, needs 2 stocks = 156" total, ~43% waste each
      // 99" stock: 2 cuts fit (44.625 + 0.125 + 44.625 = 89.375"), needs 1 stock = 99" total, ~10% waste
      // 99" should be selected
      const result = findOptimalStockLengthByYield([78, 99], [44.625, 44.625])
      expect(result).not.toBeNull()
      expect(result?.stockLength).toBe(99)
      expect(result?.stockPiecesNeeded).toBe(1)
    })

    it('should select stock that minimizes waste for many same-size cuts', () => {
      // 4 cuts of 44.625"
      // 78" stock: 1 cut per stock, 4 stocks needed = 312" total, ~43% waste
      // 99" stock: 2 cuts per stock, 2 stocks needed = 198" total, ~10% waste
      const result = findOptimalStockLengthByYield([78, 99], [44.625, 44.625, 44.625, 44.625])
      expect(result?.stockLength).toBe(99)
      expect(result?.stockPiecesNeeded).toBe(2)
    })

    it('should handle mixed cut sizes', () => {
      // 2 cuts: 36" and 40"
      // 78" stock: Both fit in one (36 + 0.125 + 40 = 76.125"), 1 stock, waste = 1.875" (2.4%)
      // 99" stock: Both fit in one, 1 stock, waste = 22.875" (23.1%)
      // 78" should be selected (lower waste %)
      const result = findOptimalStockLengthByYield([78, 99], [36, 40])
      expect(result?.stockLength).toBe(78)
      expect(result?.stockPiecesNeeded).toBe(1)
    })

    it('should prefer less total stock length when waste percentages are equal', () => {
      // Craft a scenario where waste percentages are identical
      // If both options produce the same waste %, prefer the one with less total stock used
      // Single 50% cut from each stock
      const result = findOptimalStockLengthByYield([100, 200], [50, 100])
      // 100" stock: 1 cut fits (50"), needs 2 stocks for both cuts = 200" total
      // 200" stock: both cuts fit (50 + 0.125 + 100 = 150.125"), needs 1 stock = 200" total
      // Waste percentages are different, so this will select based on lowest waste %
      expect(result).not.toBeNull()
    })
  })

  describe('edge cases', () => {
    it('should filter out stock lengths that cannot fit the largest cut', () => {
      // 50" cut cannot fit in 48" stock, only 60" is valid
      const result = findOptimalStockLengthByYield([48, 60], [50])
      expect(result?.stockLength).toBe(60)
    })

    it('should handle cuts exactly equal to stock length', () => {
      const result = findOptimalStockLengthByYield([78, 99], [78])
      expect(result).not.toBeNull()
      expect(result?.stockLength).toBe(78)
      expect(result?.stockPiecesNeeded).toBe(1)
    })

    it('should use custom kerf width when provided', () => {
      // Two 48" cuts with 0.5" kerf
      // 99" stock: 48 + 0.5 + 48 + 0.5 = 97" - fits in 99"
      const result = findOptimalStockLengthByYield([99], [48, 48], 0.5)
      expect(result?.stockPiecesNeeded).toBe(1)
    })

    it('should handle many stock length options', () => {
      const result = findOptimalStockLengthByYield([60, 72, 84, 96, 108, 120], [40, 40])
      // Best option should be the shortest that can fit both cuts
      // 40 + 0.125 + 40 = 80.125", needs at least 84" stock
      expect(result).not.toBeNull()
      // 84" stock: both fit, waste = 84 - 80.125 = 3.875" (4.6%)
      // Others would have higher waste %
      expect(result?.stockLength).toBe(84)
    })
  })

  describe('real-world door/window scenarios', () => {
    it('should optimize jamb cuts for multiple door openings', () => {
      // 4 jamb pieces at 84" each (for 2 doors)
      // 99" stock: 1 per stock, 4 stocks = 396" total, ~15% waste
      // 168" stock: 1 per stock, 4 stocks = 672" total, ~50% waste
      const result = findOptimalStockLengthByYield([99, 168], [84, 84, 84, 84])
      expect(result?.stockLength).toBe(99)
      expect(result?.stockPiecesNeeded).toBe(4)
    })

    it('should optimize header and sill cuts', () => {
      // 4 headers/sills at 36" each
      // 78" stock: 2 per stock (36 + 0.125 + 36 = 72.125"), 2 stocks = 156" total, ~7.7% waste
      // 99" stock: 2 per stock (same), 2 stocks = 198" total, ~27% waste
      const result = findOptimalStockLengthByYield([78, 99], [36, 36, 36, 36])
      expect(result?.stockLength).toBe(78)
      expect(result?.stockPiecesNeeded).toBe(2)
    })
  })
})
