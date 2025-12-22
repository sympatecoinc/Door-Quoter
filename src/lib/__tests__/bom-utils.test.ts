import { describe, it, expect, vi } from 'vitest'
import {
  calculateOptimizedStockPieces,
  evaluateFormula,
  aggregateBomItems,
  summaryToCSV,
  KERF_WIDTH,
  type BomItem,
  type AggregatedBomItem
} from '../bom-utils'

// Suppress console warnings during tests
vi.spyOn(console, 'warn').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

describe('calculateOptimizedStockPieces', () => {
  describe('edge cases', () => {
    it('returns 0 for empty cut list', () => {
      const result = calculateOptimizedStockPieces([], 96)
      expect(result.stockPiecesNeeded).toBe(0)
      expect(result.wastePercent).toBe(0)
      expect(result.totalStockLength).toBe(0)
      expect(result.wasteLength).toBe(0)
    })

    it('returns 0 for zero stock length', () => {
      const result = calculateOptimizedStockPieces([48], 0)
      expect(result.stockPiecesNeeded).toBe(0)
    })

    it('returns 0 for negative stock length', () => {
      const result = calculateOptimizedStockPieces([48], -10)
      expect(result.stockPiecesNeeded).toBe(0)
    })
  })

  describe('single cut scenarios', () => {
    it('fits single cut smaller than stock in one piece', () => {
      const result = calculateOptimizedStockPieces([48], 96)
      expect(result.stockPiecesNeeded).toBe(1)
    })

    it('fits single cut equal to stock in one piece', () => {
      const result = calculateOptimizedStockPieces([96], 96)
      expect(result.stockPiecesNeeded).toBe(1)
    })

    it('handles oversized cut gracefully', () => {
      const result = calculateOptimizedStockPieces([100], 96)
      expect(result.stockPiecesNeeded).toBe(1)
    })
  })

  describe('multiple cuts - fitting in one stock', () => {
    it('fits two small cuts in one stock', () => {
      // 45 + 45 + 0.125 kerf = 90.125 < 96
      const result = calculateOptimizedStockPieces([45, 45], 96)
      expect(result.stockPiecesNeeded).toBe(1)
    })

    it('fits three small cuts in one stock', () => {
      // 30 + 30 + 30 + (2 * 0.125 kerf) = 90.25 < 96
      const result = calculateOptimizedStockPieces([30, 30, 30], 96)
      expect(result.stockPiecesNeeded).toBe(1)
    })

    it('uses first-fit decreasing - largest cuts first', () => {
      // Should optimize: [60, 30, 20, 10] with kerf
      // 60 + 0.125 = 60.125 in bin 1, remaining 35.875
      // 30 fits in bin 1 (35.875 >= 30), remaining 5.75
      // 20 doesn't fit in bin 1, new bin 2 with remaining 75.875
      // 10 fits in bin 2, remaining 65.75
      const result = calculateOptimizedStockPieces([20, 10, 60, 30], 96)
      expect(result.stockPiecesNeeded).toBe(2)
    })
  })

  describe('multiple cuts - requiring multiple stocks', () => {
    it('requires two stocks when cuts exceed capacity', () => {
      // 50 + 50 = 100 > 96, needs 2 stocks
      const result = calculateOptimizedStockPieces([50, 50], 96)
      expect(result.stockPiecesNeeded).toBe(2)
    })

    it('calculates correct stock count for many cuts', () => {
      // 6 cuts of 30" each = 180" total
      // With kerf: each bin can fit 30 + 30 + 30 = 90.25, but need 35.625 for 3rd cut
      // 96 - 30 - 0.125 = 65.875, 65.875 - 30 - 0.125 = 35.75, 35.75 >= 30, so 3 fit
      // So 2 bins needed for 6 x 30" cuts
      const result = calculateOptimizedStockPieces([30, 30, 30, 30, 30, 30], 96)
      expect(result.stockPiecesNeeded).toBe(2)
    })
  })

  describe('kerf handling', () => {
    it('accounts for kerf width between cuts', () => {
      // With kerf=0.125, two 47.9375" cuts would be:
      // 47.9375 + 0.125 + 47.9375 = 96, exactly fits
      const result = calculateOptimizedStockPieces([47.9375, 47.9375], 96)
      expect(result.stockPiecesNeeded).toBe(1)
    })

    it('two cuts that just exceed capacity with kerf need two stocks', () => {
      // 48 + 48 + 0.125 = 96.125 > 96, needs 2 stocks
      const result = calculateOptimizedStockPieces([48, 48], 96)
      expect(result.stockPiecesNeeded).toBe(2)
    })

    it('accepts custom kerf value', () => {
      // With kerf=0, two 48" cuts would fit exactly
      const result = calculateOptimizedStockPieces([48, 48], 96, 0)
      expect(result.stockPiecesNeeded).toBe(1)
    })
  })

  describe('waste calculations', () => {
    it('calculates waste percentage correctly - 50% waste', () => {
      const result = calculateOptimizedStockPieces([48], 96)
      // Stock used: 96, cut: 48, waste: 48
      expect(result.wastePercent).toBeCloseTo(50, 0)
    })

    it('calculates waste length correctly', () => {
      const result = calculateOptimizedStockPieces([48], 96)
      expect(result.wasteLength).toBe(48)
      expect(result.totalStockLength).toBe(96)
    })

    it('rounds waste percentage to 1 decimal', () => {
      // Create a scenario with non-round waste
      const result = calculateOptimizedStockPieces([33], 96)
      // Waste: (96-33)/96 = 65.625%
      expect(result.wastePercent).toBeCloseTo(65.6, 1)
    })
  })
})

describe('evaluateFormula', () => {
  describe('basic arithmetic', () => {
    it('evaluates simple addition', () => {
      expect(evaluateFormula('width + 10', { width: 42 })).toBe(52)
    })

    it('evaluates subtraction', () => {
      expect(evaluateFormula('height - 0.5', { height: 96 })).toBe(95.5)
    })

    it('evaluates multiplication', () => {
      expect(evaluateFormula('width * 2', { width: 42 })).toBe(84)
    })

    it('evaluates division', () => {
      expect(evaluateFormula('width / 2', { width: 42 })).toBe(21)
    })

    it('evaluates complex expressions', () => {
      expect(evaluateFormula('(width + height) * 2', { width: 42, height: 10 })).toBe(104)
    })
  })

  describe('variable handling', () => {
    it('handles case-insensitive variables', () => {
      expect(evaluateFormula('Width * 2', { width: 42 })).toBe(84)
    })

    it('handles uppercase variables', () => {
      expect(evaluateFormula('WIDTH * 2', { width: 42 })).toBe(84)
    })

    it('handles multiple variables', () => {
      expect(evaluateFormula('width + height', { width: 42, height: 96 })).toBe(138)
    })

    it('handles mixed case in formula', () => {
      expect(evaluateFormula('Width + HEIGHT', { width: 42, height: 96 })).toBe(138)
    })
  })

  describe('edge cases', () => {
    it('returns 0 for empty formula', () => {
      expect(evaluateFormula('', { width: 42 })).toBe(0)
    })

    it('returns 0 for null formula', () => {
      expect(evaluateFormula(null as any, { width: 42 })).toBe(0)
    })

    it('returns 0 for undefined formula', () => {
      expect(evaluateFormula(undefined as any, { width: 42 })).toBe(0)
    })

    it('returns 0 for whitespace-only formula', () => {
      expect(evaluateFormula('   ', { width: 42 })).toBe(0)
    })

    it('returns 0 for invalid formula', () => {
      expect(evaluateFormula('invalid stuff', { width: 42 })).toBe(0)
    })

    it('returns 0 for formula resulting in NaN', () => {
      expect(evaluateFormula('0/0', {})).toBe(0)
    })

    it('clamps negative results to 0', () => {
      expect(evaluateFormula('width - 100', { width: 42 })).toBe(0)
    })
  })

  describe('decimal handling', () => {
    it('handles decimal values in variables', () => {
      expect(evaluateFormula('width - 0.5', { width: 42.75 })).toBe(42.25)
    })

    it('handles decimal values in formula', () => {
      expect(evaluateFormula('width * 1.5', { width: 42 })).toBe(63)
    })
  })
})

describe('aggregateBomItems', () => {
  describe('quantity aggregation', () => {
    it('sums quantities for same part number', () => {
      const items: BomItem[] = [
        { partNumber: 'EXT-001', partName: 'Frame', partType: 'Extrusion', quantity: 1, unit: 'IN', cutLength: 48, stockLength: 96 },
        { partNumber: 'EXT-001', partName: 'Frame', partType: 'Extrusion', quantity: 1, unit: 'IN', cutLength: 42, stockLength: 96 }
      ]
      const result = aggregateBomItems(items)
      expect(result).toHaveLength(1)
      expect(result[0].totalQuantity).toBe(2)
    })

    it('handles items with quantity > 1', () => {
      const items: BomItem[] = [
        { partNumber: 'EXT-001', partName: 'Frame', partType: 'Extrusion', quantity: 3, unit: 'IN', cutLength: 48, stockLength: 96 }
      ]
      const result = aggregateBomItems(items)
      expect(result[0].totalQuantity).toBe(3)
    })

    it('handles items without quantity (defaults to 1)', () => {
      const items: BomItem[] = [
        { partNumber: 'EXT-001', partName: 'Frame', partType: 'Extrusion', unit: 'IN', cutLength: 48, stockLength: 96 }
      ]
      const result = aggregateBomItems(items)
      expect(result[0].totalQuantity).toBe(1)
    })
  })

  describe('extrusion handling', () => {
    it('collects cut lengths for extrusions', () => {
      const items: BomItem[] = [
        { partNumber: 'EXT-001', partName: 'Frame', partType: 'Extrusion', quantity: 1, unit: 'IN', cutLength: 48, stockLength: 96 },
        { partNumber: 'EXT-001', partName: 'Frame', partType: 'Extrusion', quantity: 1, unit: 'IN', cutLength: 42, stockLength: 96 }
      ]
      const result = aggregateBomItems(items)
      expect(result[0].cutLengths).toEqual([48, 42])
      expect(result[0].totalCutLength).toBe(90)
    })

    it('repeats cut lengths for quantity > 1', () => {
      const items: BomItem[] = [
        { partNumber: 'EXT-001', partName: 'Frame', partType: 'Extrusion', quantity: 2, unit: 'IN', cutLength: 48, stockLength: 96 }
      ]
      const result = aggregateBomItems(items)
      expect(result[0].cutLengths).toEqual([48, 48])
      expect(result[0].totalCutLength).toBe(96)
    })

    it('calculates stock pieces needed for extrusions', () => {
      const items: BomItem[] = [
        { partNumber: 'EXT-001', partName: 'Frame', partType: 'Extrusion', quantity: 1, unit: 'IN', cutLength: 50, stockLength: 96 },
        { partNumber: 'EXT-001', partName: 'Frame', partType: 'Extrusion', quantity: 1, unit: 'IN', cutLength: 50, stockLength: 96 }
      ]
      const result = aggregateBomItems(items)
      expect(result[0].stockPiecesNeeded).toBe(2)
      expect(result[0].wastePercent).toBeGreaterThan(0)
    })
  })

  describe('glass handling', () => {
    it('groups glass by dimensions', () => {
      const items: BomItem[] = [
        { partNumber: 'GLASS-CLEAR', partName: 'Clear Glass', partType: 'Glass', quantity: 1, unit: 'SQ FT', glassWidth: 24, glassHeight: 48, glassArea: 8 },
        { partNumber: 'GLASS-CLEAR', partName: 'Clear Glass', partType: 'Glass', quantity: 1, unit: 'SQ FT', glassWidth: 24, glassHeight: 48, glassArea: 8 },
        { partNumber: 'GLASS-CLEAR', partName: 'Clear Glass', partType: 'Glass', quantity: 1, unit: 'SQ FT', glassWidth: 36, glassHeight: 72, glassArea: 18 }
      ]
      const result = aggregateBomItems(items)
      // Should have 2 entries: one for 24x48, one for 36x72
      expect(result).toHaveLength(2)
      expect(result.find(r => r.glassWidth === 24)?.totalQuantity).toBe(2)
      expect(result.find(r => r.glassWidth === 36)?.totalQuantity).toBe(1)
    })

    it('accumulates total area for glass', () => {
      const items: BomItem[] = [
        { partNumber: 'GLASS-CLEAR', partName: 'Clear Glass', partType: 'Glass', quantity: 1, unit: 'SQ FT', glassWidth: 24, glassHeight: 48, glassArea: 8 },
        { partNumber: 'GLASS-CLEAR', partName: 'Clear Glass', partType: 'Glass', quantity: 1, unit: 'SQ FT', glassWidth: 24, glassHeight: 48, glassArea: 8 }
      ]
      const result = aggregateBomItems(items)
      expect(result[0].totalArea).toBe(16)
    })
  })

  describe('hardware LF/IN handling', () => {
    it('accumulates calculated lengths for LF hardware', () => {
      const items: BomItem[] = [
        { partNumber: 'HW-001', partName: 'Weatherstrip', partType: 'Hardware', quantity: 1, unit: 'LF', calculatedLength: 12.5 },
        { partNumber: 'HW-001', partName: 'Weatherstrip', partType: 'Hardware', quantity: 1, unit: 'LF', calculatedLength: 8.0 }
      ]
      const result = aggregateBomItems(items)
      expect(result[0].totalCalculatedLength).toBe(20.5)
      expect(result[0].calculatedLengths).toEqual([12.5, 8.0])
    })

    it('accumulates calculated lengths for IN hardware', () => {
      const items: BomItem[] = [
        { partNumber: 'HW-002', partName: 'Fastener', partType: 'Hardware', quantity: 2, unit: 'IN', calculatedLength: 6 }
      ]
      const result = aggregateBomItems(items)
      expect(result[0].totalCalculatedLength).toBe(12)
      expect(result[0].calculatedLengths).toEqual([6, 6])
    })
  })

  describe('sorting', () => {
    it('sorts by type: Extrusion > Hardware > Glass > Option', () => {
      const items: BomItem[] = [
        { partNumber: 'OPT-001', partName: 'Option', partType: 'Option', quantity: 1, unit: 'EA' },
        { partNumber: 'GLASS-001', partName: 'Glass', partType: 'Glass', quantity: 1, unit: 'SQ FT', glassWidth: 24, glassHeight: 48, glassArea: 8 },
        { partNumber: 'EXT-001', partName: 'Extrusion', partType: 'Extrusion', quantity: 1, unit: 'IN', cutLength: 48, stockLength: 96 },
        { partNumber: 'HW-001', partName: 'Hardware', partType: 'Hardware', quantity: 1, unit: 'EA' }
      ]
      const result = aggregateBomItems(items)
      expect(result.map(r => r.partType)).toEqual(['Extrusion', 'Hardware', 'Glass', 'Option'])
    })

    it('sorts alphabetically by part number within same type', () => {
      const items: BomItem[] = [
        { partNumber: 'HW-003', partName: 'Hardware C', partType: 'Hardware', quantity: 1, unit: 'EA' },
        { partNumber: 'HW-001', partName: 'Hardware A', partType: 'Hardware', quantity: 1, unit: 'EA' },
        { partNumber: 'HW-002', partName: 'Hardware B', partType: 'Hardware', quantity: 1, unit: 'EA' }
      ]
      const result = aggregateBomItems(items)
      expect(result.map(r => r.partNumber)).toEqual(['HW-001', 'HW-002', 'HW-003'])
    })
  })

  describe('empty input', () => {
    it('returns empty array for empty input', () => {
      const result = aggregateBomItems([])
      expect(result).toEqual([])
    })
  })
})

describe('summaryToCSV', () => {
  describe('headers', () => {
    it('generates correct headers', () => {
      const csv = summaryToCSV('Test Project', [])
      const headers = csv.split('\n')[0]
      expect(headers).toContain('Part Number')
      expect(headers).toContain('Part Name')
      expect(headers).toContain('Type')
      expect(headers).toContain('Size (WxH)')
      expect(headers).toContain('Pieces')
      expect(headers).toContain('Unit')
      expect(headers).toContain('Stock Length')
      expect(headers).toContain('Stock Pieces to Order')
      expect(headers).toContain('Waste %')
      expect(headers).toContain('Area (SQ FT)')
    })
  })

  describe('data escaping', () => {
    it('escapes quotes in data', () => {
      const items: AggregatedBomItem[] = [{
        partNumber: 'TEST-"001"',
        partName: 'Test "Part"',
        partType: 'Hardware',
        totalQuantity: 1,
        unit: 'EA',
        stockLength: null,
        cutLengths: [],
        totalCutLength: 0,
        calculatedLengths: [],
        totalCalculatedLength: 0,
        glassDimensions: [],
        totalArea: 0,
        glassWidth: null,
        glassHeight: null,
        stockPiecesNeeded: null,
        wastePercent: null
      }]
      const csv = summaryToCSV('Test', items)
      expect(csv).toContain('""001""')
      expect(csv).toContain('""Part""')
    })
  })

  describe('glass formatting', () => {
    it('shows glass dimensions', () => {
      const items: AggregatedBomItem[] = [{
        partNumber: 'GLASS-001',
        partName: 'Clear Glass',
        partType: 'Glass',
        totalQuantity: 1,
        unit: 'SQ FT',
        stockLength: null,
        cutLengths: [],
        totalCutLength: 0,
        calculatedLengths: [],
        totalCalculatedLength: 0,
        glassDimensions: [{ width: 24.5, height: 48.25, area: 8.2 }],
        totalArea: 8.2,
        glassWidth: 24.5,
        glassHeight: 48.25,
        stockPiecesNeeded: null,
        wastePercent: null
      }]
      const csv = summaryToCSV('Test', items)
      // In CSV, quotes are escaped as "", so 24.50" x 48.25" becomes 24.50"" x 48.25""
      expect(csv).toContain('24.50"" x 48.25""')
      expect(csv).toContain('8.20')
    })
  })

  describe('extrusion formatting', () => {
    it('shows unique cut lengths for extrusions', () => {
      const items: AggregatedBomItem[] = [{
        partNumber: 'EXT-001',
        partName: 'Frame',
        partType: 'Extrusion',
        totalQuantity: 3,
        unit: 'IN',
        stockLength: 96,
        cutLengths: [48, 48, 42],
        totalCutLength: 138,
        calculatedLengths: [],
        totalCalculatedLength: 0,
        glassDimensions: [],
        totalArea: 0,
        glassWidth: null,
        glassHeight: null,
        stockPiecesNeeded: 2,
        wastePercent: 28.1
      }]
      const csv = summaryToCSV('Test', items)
      expect(csv).toContain('48.00')
      expect(csv).toContain('42.00')
      expect(csv).toContain('28.1%')
    })

    it('shows stock pieces to order', () => {
      const items: AggregatedBomItem[] = [{
        partNumber: 'EXT-001',
        partName: 'Frame',
        partType: 'Extrusion',
        totalQuantity: 2,
        unit: 'IN',
        stockLength: 96,
        cutLengths: [50, 50],
        totalCutLength: 100,
        calculatedLengths: [],
        totalCalculatedLength: 0,
        glassDimensions: [],
        totalArea: 0,
        glassWidth: null,
        glassHeight: null,
        stockPiecesNeeded: 2,
        wastePercent: 47.9
      }]
      const csv = summaryToCSV('Test', items)
      // Check that stock pieces to order is present
      const lines = csv.split('\n')
      expect(lines[1]).toContain('"2"')
    })
  })

  describe('hardware LF/IN formatting', () => {
    it('shows total calculated length for LF hardware', () => {
      const items: AggregatedBomItem[] = [{
        partNumber: 'HW-001',
        partName: 'Weatherstrip',
        partType: 'Hardware',
        totalQuantity: 2,
        unit: 'LF',
        stockLength: null,
        cutLengths: [],
        totalCutLength: 0,
        calculatedLengths: [12.5, 8.0],
        totalCalculatedLength: 20.5,
        glassDimensions: [],
        totalArea: 0,
        glassWidth: null,
        glassHeight: null,
        stockPiecesNeeded: null,
        wastePercent: null
      }]
      const csv = summaryToCSV('Test', items)
      expect(csv).toContain('20.50 LF')
    })
  })
})
