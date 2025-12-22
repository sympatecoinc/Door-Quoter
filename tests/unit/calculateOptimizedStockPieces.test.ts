import { describe, it, expect } from 'vitest'
import { calculateOptimizedStockPieces, KERF_WIDTH } from '@/lib/bom-utils'

describe('calculateOptimizedStockPieces', () => {
  describe('Edge Cases', () => {
    it('should return zeros for empty cut list', () => {
      const result = calculateOptimizedStockPieces([], 288)
      expect(result).toEqual({
        stockPiecesNeeded: 0,
        totalStockLength: 0,
        wasteLength: 0,
        wastePercent: 0
      })
    })

    it('should return zeros for zero stock length', () => {
      const result = calculateOptimizedStockPieces([48, 36], 0)
      expect(result).toEqual({
        stockPiecesNeeded: 0,
        totalStockLength: 0,
        wasteLength: 0,
        wastePercent: 0
      })
    })

    it('should return zeros for negative stock length', () => {
      const result = calculateOptimizedStockPieces([48, 36], -100)
      expect(result).toEqual({
        stockPiecesNeeded: 0,
        totalStockLength: 0,
        wasteLength: 0,
        wastePercent: 0
      })
    })
  })

  describe('Single Cut Scenarios', () => {
    it('should require 1 stock piece for single cut that fits', () => {
      const result = calculateOptimizedStockPieces([48], 288)
      expect(result.stockPiecesNeeded).toBe(1)
      expect(result.totalStockLength).toBe(288)
      expect(result.wasteLength).toBe(240) // 288 - 48
    })

    it('should handle cut exactly equal to stock length', () => {
      const result = calculateOptimizedStockPieces([288], 288)
      expect(result.stockPiecesNeeded).toBe(1)
      expect(result.wasteLength).toBe(0)
      expect(result.wastePercent).toBe(0)
    })
  })

  describe('First-Fit Decreasing Algorithm', () => {
    it('should optimize two cuts that fit in one stock piece', () => {
      // 100 + 100 + kerf = 200.125, fits in 288
      const result = calculateOptimizedStockPieces([100, 100], 288)
      expect(result.stockPiecesNeeded).toBe(1)
    })

    it('should require two stock pieces when cuts cannot fit together', () => {
      // 200 + 100 + kerf = 300.125 > 288
      const result = calculateOptimizedStockPieces([200, 100], 288)
      expect(result.stockPiecesNeeded).toBe(2)
    })

    it('should optimize multiple cuts using first-fit decreasing', () => {
      // Cuts: 100, 80, 60, 40, 30 = 310 total
      // Stock length: 200
      // FFD: Sort descending: 100, 80, 60, 40, 30
      // Bin 1: 100 + kerf, remaining ~99.875
      // Bin 1: + 80 + kerf = remaining ~19.75
      // Bin 2: 60 + kerf, remaining ~139.875
      // Bin 2: + 40 + kerf = remaining ~99.75
      // Bin 2: + 30 + kerf = remaining ~69.625
      const result = calculateOptimizedStockPieces([30, 60, 100, 40, 80], 200)
      expect(result.stockPiecesNeeded).toBe(2)
    })

    it('should sort cuts descending before packing', () => {
      // Same input in different order should give same result
      const result1 = calculateOptimizedStockPieces([100, 80, 60, 40, 30], 200)
      const result2 = calculateOptimizedStockPieces([30, 40, 60, 80, 100], 200)
      expect(result1.stockPiecesNeeded).toBe(result2.stockPiecesNeeded)
    })
  })

  describe('Kerf Handling', () => {
    it('should use default kerf value', () => {
      expect(KERF_WIDTH).toBe(0.125)
    })

    it('should account for kerf between cuts in same bin', () => {
      // Without kerf: 144 + 144 = 288 (fits exactly)
      // With kerf: 144 + 0.125 + 144 = 288.125 (doesn't fit)
      const result = calculateOptimizedStockPieces([144, 144], 288)
      expect(result.stockPiecesNeeded).toBe(2)
    })

    it('should accept custom kerf value', () => {
      // With zero kerf, 144 + 144 = 288 fits in one piece
      const result = calculateOptimizedStockPieces([144, 144], 288, 0)
      expect(result.stockPiecesNeeded).toBe(1)
    })

    it('should handle larger custom kerf', () => {
      // With 1" kerf: 143 + 1 + 143 = 287, still fits
      const result = calculateOptimizedStockPieces([143, 143], 288, 1)
      expect(result.stockPiecesNeeded).toBe(1)
    })
  })

  describe('Oversized Cuts', () => {
    it('should handle cut larger than stock length', () => {
      const result = calculateOptimizedStockPieces([300], 288)
      expect(result.stockPiecesNeeded).toBe(1)
      // Oversized cuts still consume one bin
    })

    it('should handle mix of oversized and normal cuts', () => {
      const result = calculateOptimizedStockPieces([300, 100, 50], 288)
      // 300 needs its own bin, 100+50 = 150 fits in another
      expect(result.stockPiecesNeeded).toBe(2)
    })
  })

  describe('Waste Percentage Calculation', () => {
    it('should calculate waste percentage correctly', () => {
      // 1 cut of 48", stock of 288"
      // Waste = 288 - 48 = 240
      // Waste % = 240/288 * 100 = 83.33...%
      const result = calculateOptimizedStockPieces([48], 288)
      expect(result.wastePercent).toBeCloseTo(83.3, 1)
    })

    it('should round waste percentage to 1 decimal place', () => {
      const result = calculateOptimizedStockPieces([100], 288)
      // wastePercent should be a number with at most 1 decimal
      const decimalPart = result.wastePercent.toString().split('.')[1]
      expect(decimalPart?.length || 0).toBeLessThanOrEqual(1)
    })

    it('should calculate zero waste when cuts fill stock exactly', () => {
      const result = calculateOptimizedStockPieces([288], 288)
      expect(result.wastePercent).toBe(0)
    })
  })

  describe('Real-World Door Frame Scenarios', () => {
    it('should optimize vertical pieces for 10 doors (42x108)', () => {
      // 10 doors, each needs 2 vertical pieces at 108"
      // Stock length: 288" (24 feet)
      // 2 x 108" + kerf = 216.125" fits in 288"
      // So 20 cuts of 108" should need 10 stock pieces
      const verticalCuts = Array(20).fill(108)
      const result = calculateOptimizedStockPieces(verticalCuts, 288)
      expect(result.stockPiecesNeeded).toBe(10)
    })

    it('should optimize horizontal pieces for 10 doors (42x108)', () => {
      // 10 doors, each needs 2 horizontal pieces at 42"
      // Stock length: 288"
      // 6 x 42" = 252" + 5*kerf = 252.625" fits in 288"
      // So 20 cuts of 42" should need 4 stock pieces (5+5+5+5)
      const horizontalCuts = Array(20).fill(42)
      const result = calculateOptimizedStockPieces(horizontalCuts, 288)
      expect(result.stockPiecesNeeded).toBeLessThanOrEqual(4)
    })

    it('should handle mixed cut lengths efficiently', () => {
      // Mixed vertical and horizontal: 4x108" + 4x42"
      // Best packing:
      // Bin 1: 108 + 108 + kerf = 216.125
      // Bin 2: 108 + 108 + kerf = 216.125
      // Bin 3: 42 + 42 + 42 + 42 = 168 + kerfs
      // Or similar optimization
      const mixedCuts = [108, 108, 108, 108, 42, 42, 42, 42]
      const result = calculateOptimizedStockPieces(mixedCuts, 288)
      expect(result.stockPiecesNeeded).toBeLessThanOrEqual(3)
    })
  })

  describe('Waste Length Calculation', () => {
    it('should calculate total waste length', () => {
      const result = calculateOptimizedStockPieces([100], 288)
      expect(result.wasteLength).toBe(188) // 288 - 100
    })

    it('should calculate cumulative waste for multiple bins', () => {
      // 2 cuts of 200" each need 2 stock pieces of 288"
      const result = calculateOptimizedStockPieces([200, 200], 288)
      expect(result.stockPiecesNeeded).toBe(2)
      expect(result.totalStockLength).toBe(576) // 2 * 288
      expect(result.wasteLength).toBe(176) // 576 - 400
    })
  })
})
