import { describe, it, expect } from 'vitest'
import { aggregateBomItems } from '@/lib/bom-utils'
import {
  createMockBomItem,
  createMockExtrusionItem,
  createMockGlassItem,
  createMockHardwareWithLength,
  createMockOptionItem
} from '../fixtures/bom-fixtures'

describe('aggregateBomItems', () => {
  describe('Basic Aggregation', () => {
    it('should aggregate items with same part number', () => {
      const items = [
        createMockBomItem({ partNumber: 'HW-001', quantity: 2 }),
        createMockBomItem({ partNumber: 'HW-001', quantity: 3 }),
      ]

      const result = aggregateBomItems(items)

      expect(result).toHaveLength(1)
      expect(result[0].partNumber).toBe('HW-001')
      expect(result[0].totalQuantity).toBe(5)
    })

    it('should keep different part numbers separate', () => {
      const items = [
        createMockBomItem({ partNumber: 'HW-001', quantity: 2 }),
        createMockBomItem({ partNumber: 'HW-002', quantity: 3 }),
      ]

      const result = aggregateBomItems(items)

      expect(result).toHaveLength(2)
    })

    it('should return empty array for empty input', () => {
      const result = aggregateBomItems([])
      expect(result).toEqual([])
    })

    it('should handle single item', () => {
      const items = [createMockBomItem({ partNumber: 'HW-001', quantity: 5 })]

      const result = aggregateBomItems(items)

      expect(result).toHaveLength(1)
      expect(result[0].totalQuantity).toBe(5)
    })

    it('should default quantity to 1 when not specified', () => {
      const items = [
        createMockBomItem({ partNumber: 'HW-001', quantity: undefined }),
      ]

      const result = aggregateBomItems(items)

      expect(result[0].totalQuantity).toBe(1)
    })
  })

  describe('Glass Aggregation', () => {
    it('should group glass by part number AND dimensions', () => {
      const items = [
        createMockGlassItem({ partNumber: 'GLASS-CLEAR', glassWidth: 40, glassHeight: 106 }),
        createMockGlassItem({ partNumber: 'GLASS-CLEAR', glassWidth: 40, glassHeight: 106 }),
        createMockGlassItem({ partNumber: 'GLASS-CLEAR', glassWidth: 36, glassHeight: 96 }),
      ]

      const result = aggregateBomItems(items)

      // Should have 2 entries: one for 40x106, one for 36x96
      expect(result).toHaveLength(2)

      const group40x106 = result.find(r => r.glassWidth === 40 && r.glassHeight === 106)
      expect(group40x106?.totalQuantity).toBe(2)

      const group36x96 = result.find(r => r.glassWidth === 36 && r.glassHeight === 96)
      expect(group36x96?.totalQuantity).toBe(1)
    })

    it('should calculate total glass area', () => {
      const items = [
        createMockGlassItem({ partNumber: 'GLASS-CLEAR', glassWidth: 40, glassHeight: 106, glassArea: 29.44 }),
        createMockGlassItem({ partNumber: 'GLASS-CLEAR', glassWidth: 40, glassHeight: 106, glassArea: 29.44 }),
      ]

      const result = aggregateBomItems(items)

      expect(result[0].totalArea).toBeCloseTo(58.88, 2)
    })

    it('should collect glass dimensions', () => {
      const items = [
        createMockGlassItem({ glassWidth: 40, glassHeight: 106, glassArea: 29.44 }),
      ]

      const result = aggregateBomItems(items)

      expect(result[0].glassDimensions).toHaveLength(1)
      expect(result[0].glassDimensions[0]).toEqual({
        width: 40,
        height: 106,
        area: 29.44
      })
    })

    it('should handle glass with missing dimensions as same group', () => {
      const items = [
        createMockBomItem({ partNumber: 'GLASS-MISC', partType: 'Glass', glassWidth: null, glassHeight: null }),
        createMockBomItem({ partNumber: 'GLASS-MISC', partType: 'Glass', glassWidth: null, glassHeight: null }),
      ]

      const result = aggregateBomItems(items)

      expect(result).toHaveLength(1)
      expect(result[0].totalQuantity).toBe(2)
    })
  })

  describe('Extrusion Aggregation', () => {
    it('should collect cut lengths for extrusions', () => {
      const items = [
        createMockExtrusionItem({ partNumber: 'EXT-001', cutLength: 108, quantity: 2 }),
        createMockExtrusionItem({ partNumber: 'EXT-001', cutLength: 42, quantity: 2 }),
      ]

      const result = aggregateBomItems(items)

      expect(result[0].cutLengths).toHaveLength(4) // 2 + 2
      expect(result[0].cutLengths).toContain(108)
      expect(result[0].cutLengths).toContain(42)
    })

    it('should calculate stock optimization for extrusions', () => {
      const items = [
        createMockExtrusionItem({ partNumber: 'EXT-001', cutLength: 108, stockLength: 288, quantity: 2 }),
      ]

      const result = aggregateBomItems(items)

      expect(result[0].stockPiecesNeeded).toBe(1) // 2 x 108" fits in 288"
      expect(result[0].wastePercent).toBeDefined()
    })

    it('should calculate total cut length', () => {
      const items = [
        createMockExtrusionItem({ partNumber: 'EXT-001', cutLength: 100, quantity: 2 }),
        createMockExtrusionItem({ partNumber: 'EXT-001', cutLength: 50, quantity: 3 }),
      ]

      const result = aggregateBomItems(items)

      expect(result[0].totalCutLength).toBe(350) // (100*2) + (50*3)
    })

    it('should not calculate optimization without stock length', () => {
      const items = [
        createMockExtrusionItem({ partNumber: 'EXT-001', cutLength: 108, stockLength: null, quantity: 2 }),
      ]

      const result = aggregateBomItems(items)

      expect(result[0].stockPiecesNeeded).toBeNull()
      expect(result[0].wastePercent).toBeNull()
    })

    it('should handle extrusions without cut lengths', () => {
      const items = [
        createMockExtrusionItem({ partNumber: 'EXT-001', cutLength: null, quantity: 2 }),
      ]

      const result = aggregateBomItems(items)

      expect(result[0].cutLengths).toHaveLength(0)
      expect(result[0].totalCutLength).toBe(0)
    })
  })

  describe('Hardware with LF/IN Units', () => {
    it('should collect calculated lengths for hardware with LF unit', () => {
      const items = [
        createMockHardwareWithLength({
          partNumber: 'HW-GASKET',
          partType: 'Hardware',
          unit: 'LF',
          calculatedLength: 10.5,
          quantity: 2
        }),
      ]

      const result = aggregateBomItems(items)

      expect(result[0].calculatedLengths).toHaveLength(2)
      expect(result[0].totalCalculatedLength).toBe(21) // 10.5 * 2
    })

    it('should collect calculated lengths for hardware with IN unit', () => {
      const items = [
        createMockHardwareWithLength({
          partNumber: 'HW-TRIM',
          partType: 'Hardware',
          unit: 'IN',
          calculatedLength: 42,
          quantity: 4
        }),
      ]

      const result = aggregateBomItems(items)

      expect(result[0].calculatedLengths).toHaveLength(4)
      expect(result[0].totalCalculatedLength).toBe(168) // 42 * 4
    })

    it('should handle Fastener type with LF unit', () => {
      const items = [
        createMockBomItem({
          partNumber: 'FST-001',
          partType: 'Fastener',
          unit: 'LF',
          calculatedLength: 5,
          quantity: 3
        }),
      ]

      const result = aggregateBomItems(items)

      expect(result[0].totalCalculatedLength).toBe(15) // 5 * 3
    })

    it('should not collect lengths for hardware with EA unit', () => {
      const items = [
        createMockBomItem({
          partNumber: 'HW-HINGE',
          partType: 'Hardware',
          unit: 'EA',
          calculatedLength: 10,
          quantity: 3
        }),
      ]

      const result = aggregateBomItems(items)

      expect(result[0].calculatedLengths).toHaveLength(0)
      expect(result[0].totalCalculatedLength).toBe(0)
    })
  })

  describe('Sorting', () => {
    it('should sort by part type: Extrusion, Hardware, Glass, Option', () => {
      const items = [
        createMockOptionItem({ partNumber: 'OPT-001' }),
        createMockBomItem({ partNumber: 'HW-001', partType: 'Hardware' }),
        createMockGlassItem({ partNumber: 'GLASS-001' }),
        createMockExtrusionItem({ partNumber: 'EXT-001' }),
      ]

      const result = aggregateBomItems(items)

      expect(result[0].partType).toBe('Extrusion')
      expect(result[1].partType).toBe('Hardware')
      expect(result[2].partType).toBe('Glass')
      expect(result[3].partType).toBe('Option')
    })

    it('should sort by part number within same type', () => {
      const items = [
        createMockExtrusionItem({ partNumber: 'EXT-003' }),
        createMockExtrusionItem({ partNumber: 'EXT-001' }),
        createMockExtrusionItem({ partNumber: 'EXT-002' }),
      ]

      const result = aggregateBomItems(items)

      expect(result[0].partNumber).toBe('EXT-001')
      expect(result[1].partNumber).toBe('EXT-002')
      expect(result[2].partNumber).toBe('EXT-003')
    })

    it('should handle unknown part types at the end', () => {
      const items = [
        createMockBomItem({ partNumber: 'CUSTOM-001', partType: 'Custom' }),
        createMockExtrusionItem({ partNumber: 'EXT-001' }),
      ]

      const result = aggregateBomItems(items)

      expect(result[0].partType).toBe('Extrusion')
      expect(result[1].partType).toBe('Custom')
    })
  })

  describe('Preserving Original Properties', () => {
    it('should preserve unit from first item', () => {
      const items = [
        createMockBomItem({ partNumber: 'HW-001', unit: 'EA' }),
        createMockBomItem({ partNumber: 'HW-001', unit: 'EA' }),
      ]

      const result = aggregateBomItems(items)

      expect(result[0].unit).toBe('EA')
    })

    it('should preserve stock length from first item', () => {
      const items = [
        createMockExtrusionItem({ partNumber: 'EXT-001', stockLength: 288 }),
        createMockExtrusionItem({ partNumber: 'EXT-001', stockLength: 288 }),
      ]

      const result = aggregateBomItems(items)

      expect(result[0].stockLength).toBe(288)
    })

    it('should preserve part name from first item', () => {
      const items = [
        createMockBomItem({ partNumber: 'HW-001', partName: 'Door Hinge' }),
        createMockBomItem({ partNumber: 'HW-001', partName: 'Door Hinge' }),
      ]

      const result = aggregateBomItems(items)

      expect(result[0].partName).toBe('Door Hinge')
    })
  })

  describe('Complex Scenarios', () => {
    it('should handle mixed part types correctly', () => {
      const items = [
        createMockExtrusionItem({ partNumber: 'EXT-001', quantity: 2 }),
        createMockBomItem({ partNumber: 'HW-001', quantity: 4 }),
        createMockGlassItem({ partNumber: 'GLASS-001', quantity: 1 }),
        createMockExtrusionItem({ partNumber: 'EXT-001', quantity: 2 }),
        createMockBomItem({ partNumber: 'HW-001', quantity: 2 }),
      ]

      const result = aggregateBomItems(items)

      expect(result).toHaveLength(3)

      const extrusion = result.find(r => r.partNumber === 'EXT-001')
      expect(extrusion?.totalQuantity).toBe(4)

      const hardware = result.find(r => r.partNumber === 'HW-001')
      expect(hardware?.totalQuantity).toBe(6)

      const glass = result.find(r => r.partNumber === 'GLASS-001')
      expect(glass?.totalQuantity).toBe(1)
    })

    it('should handle a full door BOM correctly', () => {
      const items = [
        // Frame pieces
        createMockExtrusionItem({ partNumber: 'EXT-FRAME-V', cutLength: 108, quantity: 2 }),
        createMockExtrusionItem({ partNumber: 'EXT-FRAME-H', cutLength: 42, quantity: 2 }),
        // Hardware
        createMockBomItem({ partNumber: 'HW-HINGE', partType: 'Hardware', quantity: 3 }),
        createMockBomItem({ partNumber: 'HW-HANDLE', partType: 'Hardware', quantity: 1 }),
        // Glass
        createMockGlassItem({ partNumber: 'GLASS-CLEAR', glassWidth: 40, glassHeight: 106 }),
        // Weatherstrip
        createMockHardwareWithLength({
          partNumber: 'HW-WEATHER',
          unit: 'LF',
          calculatedLength: 25,
          quantity: 1
        }),
      ]

      const result = aggregateBomItems(items)

      // Should have 6 unique items
      expect(result).toHaveLength(6)

      // Verify extrusions have cut lengths
      const frameV = result.find(r => r.partNumber === 'EXT-FRAME-V')
      expect(frameV?.cutLengths).toEqual([108, 108])

      // Verify glass has dimensions
      const glass = result.find(r => r.partNumber === 'GLASS-CLEAR')
      expect(glass?.glassWidth).toBe(40)
      expect(glass?.glassHeight).toBe(106)

      // Verify weatherstrip has calculated length
      const weather = result.find(r => r.partNumber === 'HW-WEATHER')
      expect(weather?.totalCalculatedLength).toBe(25)
    })
  })
})
