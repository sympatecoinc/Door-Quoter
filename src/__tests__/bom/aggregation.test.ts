import {
  aggregateBomItems,
  aggregateCutListItems,
  getFrameDimensions,
  type BomItem,
  type Panel
} from '@/lib/bom/calculations'

describe('getFrameDimensions', () => {
  const makePanel = (id: number, width: number, height: number, productType?: string): Panel => ({
    id,
    width,
    height,
    componentInstance: productType ? {
      product: { productType }
    } : undefined
  })

  describe('basic dimension calculation', () => {
    it('should return sum of sibling widths and max height', () => {
      const panels = [
        makePanel(1, 36, 84),
        makePanel(2, 24, 84)
      ]
      const result = getFrameDimensions(panels, 1)
      // Excludes current panel (1), so only panel 2
      expect(result.width).toBe(24)
      expect(result.height).toBe(84)
    })

    it('should sum widths from all sibling panels', () => {
      const panels = [
        makePanel(1, 36, 84), // Current FRAME panel
        makePanel(2, 24, 84),
        makePanel(3, 30, 84)
      ]
      const result = getFrameDimensions(panels, 1)
      // Siblings: 24 + 30 = 54
      expect(result.width).toBe(54)
      expect(result.height).toBe(84)
    })

    it('should use max height when siblings have different heights', () => {
      const panels = [
        makePanel(1, 36, 84), // Current panel
        makePanel(2, 24, 80),
        makePanel(3, 30, 90)
      ]
      const result = getFrameDimensions(panels, 1)
      expect(result.height).toBe(90) // Max of 80, 90
    })
  })

  describe('FRAME product type filtering', () => {
    it('should exclude other FRAME type panels from calculation', () => {
      const panels = [
        makePanel(1, 36, 84, 'FRAME'), // Current FRAME panel
        makePanel(2, 24, 84, 'SLIDING'), // Regular panel
        makePanel(3, 30, 84, 'FRAME') // Another FRAME panel - should be excluded
      ]
      const result = getFrameDimensions(panels, 1)
      // Only panel 2 should be included
      expect(result.width).toBe(24)
    })

    it('should include non-FRAME panels only', () => {
      const panels = [
        makePanel(1, 36, 84, 'FRAME'),
        makePanel(2, 24, 84, 'FIXED'),
        makePanel(3, 30, 84, 'SLIDING')
      ]
      const result = getFrameDimensions(panels, 1)
      expect(result.width).toBe(54) // 24 + 30
    })
  })

  describe('edge cases', () => {
    it('should return 0,0 when only current panel exists', () => {
      const panels = [makePanel(1, 36, 84)]
      const result = getFrameDimensions(panels, 1)
      expect(result.width).toBe(0)
      expect(result.height).toBe(0)
    })

    it('should return 0,0 when all other panels are FRAME type', () => {
      const panels = [
        makePanel(1, 36, 84, 'FRAME'),
        makePanel(2, 24, 84, 'FRAME')
      ]
      const result = getFrameDimensions(panels, 1)
      expect(result.width).toBe(0)
      expect(result.height).toBe(0)
    })

    it('should handle panels with missing dimensions', () => {
      const panels: Panel[] = [
        { id: 1, width: 36, height: 84 },
        { id: 2 } // Missing width and height
      ]
      const result = getFrameDimensions(panels, 1)
      expect(result.width).toBe(0)
      expect(result.height).toBe(0)
    })

    it('should handle empty panels array', () => {
      const result = getFrameDimensions([], 1)
      expect(result.width).toBe(0)
      expect(result.height).toBe(0)
    })
  })
})

describe('aggregateBomItems', () => {
  const makeItem = (overrides: Partial<BomItem>): BomItem => ({
    partNumber: 'TEST-001',
    partName: 'Test Part',
    partType: 'Extrusion',
    quantity: 1,
    unit: 'EA',
    stockLength: 144,
    cutLength: 36,
    ...overrides
  })

  describe('basic aggregation', () => {
    it('should return empty array for empty input', () => {
      const result = aggregateBomItems([])
      expect(result).toEqual([])
    })

    it('should aggregate items with same part number', () => {
      const items = [
        makeItem({ partNumber: 'ABC-123', quantity: 1 }),
        makeItem({ partNumber: 'ABC-123', quantity: 1 }),
        makeItem({ partNumber: 'ABC-123', quantity: 1 })
      ]
      const result = aggregateBomItems(items)

      expect(result.length).toBe(1)
      expect(result[0].partNumber).toBe('ABC-123')
      expect(result[0].totalQuantity).toBe(3)
    })

    it('should keep different part numbers separate', () => {
      const items = [
        makeItem({ partNumber: 'ABC-123', quantity: 2 }),
        makeItem({ partNumber: 'XYZ-789', quantity: 3 })
      ]
      const result = aggregateBomItems(items)

      expect(result.length).toBe(2)
    })
  })

  describe('extrusion aggregation', () => {
    it('should collect cut lengths for extrusions', () => {
      const items = [
        makeItem({ partType: 'Extrusion', cutLength: 36, quantity: 2 }),
        makeItem({ partType: 'Extrusion', cutLength: 48, quantity: 1 })
      ]
      const result = aggregateBomItems(items)

      expect(result[0].cutLengths).toContain(36)
      expect(result[0].cutLengths).toContain(48)
      // Should have 36 twice (qty 2) and 48 once
      expect(result[0].cutLengths.filter(l => l === 36).length).toBe(2)
    })

    it('should calculate total cut length', () => {
      const items = [
        makeItem({ partType: 'Extrusion', cutLength: 36, quantity: 2 }),
        makeItem({ partType: 'Extrusion', cutLength: 48, quantity: 1 })
      ]
      const result = aggregateBomItems(items)

      // Total: 36*2 + 48*1 = 120
      expect(result[0].totalCutLength).toBe(120)
    })

    it('should calculate stock optimization for extrusions', () => {
      const items = [
        makeItem({ partType: 'Extrusion', stockLength: 144, cutLength: 36, quantity: 4 })
      ]
      const result = aggregateBomItems(items)

      expect(result[0].stockPiecesNeeded).not.toBeNull()
      expect(result[0].wastePercent).not.toBeNull()
    })
  })

  describe('glass aggregation', () => {
    it('should group glass by part number AND dimensions', () => {
      const items = [
        makeItem({ partType: 'Glass', partNumber: 'GLASS-001', glassWidth: 34.25, glassHeight: 81.5, quantity: 1 }),
        makeItem({ partType: 'Glass', partNumber: 'GLASS-001', glassWidth: 34.25, glassHeight: 81.5, quantity: 1 }),
        makeItem({ partType: 'Glass', partNumber: 'GLASS-001', glassWidth: 22.25, glassHeight: 81.5, quantity: 1 })
      ]
      const result = aggregateBomItems(items)

      // Should be 2 groups: same part but different sizes
      expect(result.length).toBe(2)
    })

    it('should track glass dimensions in aggregated result', () => {
      const items = [
        makeItem({
          partType: 'Glass',
          partNumber: 'GLASS-001',
          glassWidth: 34.25,
          glassHeight: 81.5,
          glassArea: 19.38
        })
      ]
      const result = aggregateBomItems(items)

      expect(result[0].glassWidth).toBe(34.25)
      expect(result[0].glassHeight).toBe(81.5)
    })

    it('should sum glass area', () => {
      const items = [
        makeItem({ partType: 'Glass', glassWidth: 34, glassHeight: 81, glassArea: 19.0, quantity: 1 }),
        makeItem({ partType: 'Glass', glassWidth: 34, glassHeight: 81, glassArea: 19.0, quantity: 1 })
      ]
      const result = aggregateBomItems(items)

      expect(result[0].totalArea).toBe(38)
    })
  })

  describe('hardware aggregation', () => {
    it('should sum hardware quantities', () => {
      const items = [
        makeItem({ partType: 'Hardware', partNumber: 'HW-001', quantity: 4 }),
        makeItem({ partType: 'Hardware', partNumber: 'HW-001', quantity: 4 })
      ]
      const result = aggregateBomItems(items)

      expect(result[0].totalQuantity).toBe(8)
    })

    it('should collect calculated lengths for LF hardware', () => {
      const items = [
        makeItem({
          partType: 'Hardware',
          unit: 'LF',
          calculatedLength: 7,
          quantity: 2
        })
      ]
      const result = aggregateBomItems(items)

      expect(result[0].calculatedLengths.length).toBe(2)
      expect(result[0].totalCalculatedLength).toBe(14)
    })

    it('should collect calculated lengths for IN hardware', () => {
      const items = [
        makeItem({
          partType: 'Hardware',
          unit: 'IN',
          calculatedLength: 84,
          quantity: 1
        })
      ]
      const result = aggregateBomItems(items)

      expect(result[0].calculatedLengths).toContain(84)
    })
  })

  describe('sorting', () => {
    it('should sort by part type then part number', () => {
      const items = [
        makeItem({ partType: 'Glass', partNumber: 'Z-GLASS' }),
        makeItem({ partType: 'Hardware', partNumber: 'A-HARDWARE' }),
        makeItem({ partType: 'Extrusion', partNumber: 'B-EXTRUSION' }),
        makeItem({ partType: 'Option', partNumber: 'C-OPTION' })
      ]
      const result = aggregateBomItems(items)

      // Order should be: Extrusion, Hardware, Glass, Option
      expect(result[0].partType).toBe('Extrusion')
      expect(result[1].partType).toBe('Hardware')
      expect(result[2].partType).toBe('Glass')
      expect(result[3].partType).toBe('Option')
    })

    it('should sort alphabetically within same part type', () => {
      const items = [
        makeItem({ partType: 'Extrusion', partNumber: 'Z-001' }),
        makeItem({ partType: 'Extrusion', partNumber: 'A-001' }),
        makeItem({ partType: 'Extrusion', partNumber: 'M-001' })
      ]
      const result = aggregateBomItems(items)

      expect(result[0].partNumber).toBe('A-001')
      expect(result[1].partNumber).toBe('M-001')
      expect(result[2].partNumber).toBe('Z-001')
    })
  })
})

describe('aggregateCutListItems', () => {
  const makeItem = (overrides: Partial<BomItem>): BomItem => ({
    partNumber: 'EXT-001',
    partName: 'Test Extrusion',
    partType: 'Extrusion',
    quantity: 2,
    unit: 'EA',
    stockLength: 144,
    cutLength: 36,
    productName: 'Test Product',
    panelWidth: 36,
    panelHeight: 84,
    panelId: 1,
    color: 'Black',
    ...overrides
  })

  describe('basic filtering', () => {
    it('should return empty array for empty input', () => {
      const result = aggregateCutListItems([])
      expect(result).toEqual([])
    })

    it('should only include extrusions', () => {
      const items = [
        makeItem({ partType: 'Extrusion' }),
        makeItem({ partType: 'Hardware' }),
        makeItem({ partType: 'Glass' })
      ]
      const result = aggregateCutListItems(items)

      expect(result.length).toBe(1)
      expect(result[0].partNumber).toBe('EXT-001')
    })
  })

  describe('grouping by product + size + cut length', () => {
    it('should group same part/size/cutLength together', () => {
      const items = [
        makeItem({ panelId: 1, productName: 'Product A', panelWidth: 36, panelHeight: 84, cutLength: 36 }),
        makeItem({ panelId: 2, productName: 'Product A', panelWidth: 36, panelHeight: 84, cutLength: 36 })
      ]
      const result = aggregateCutListItems(items)

      expect(result.length).toBe(1)
      expect(result[0].unitCount).toBe(2) // 2 unique panels
    })

    it('should separate different products', () => {
      const items = [
        makeItem({ productName: 'Product A', panelId: 1 }),
        makeItem({ productName: 'Product B', panelId: 2 })
      ]
      const result = aggregateCutListItems(items)

      expect(result.length).toBe(2)
    })

    it('should separate different sizes', () => {
      const items = [
        makeItem({ productName: 'Product A', panelWidth: 36, panelHeight: 84, panelId: 1 }),
        makeItem({ productName: 'Product A', panelWidth: 48, panelHeight: 84, panelId: 2 })
      ]
      const result = aggregateCutListItems(items)

      expect(result.length).toBe(2)
    })

    it('should separate different cut lengths', () => {
      const items = [
        makeItem({ cutLength: 36, panelId: 1 }),
        makeItem({ cutLength: 48, panelId: 1 })
      ]
      const result = aggregateCutListItems(items)

      expect(result.length).toBe(2)
    })
  })

  describe('quantity calculations', () => {
    it('should calculate qtyPerUnit from first panel', () => {
      const items = [
        makeItem({ panelId: 1, quantity: 2 }),
        makeItem({ panelId: 2, quantity: 2 })
      ]
      const result = aggregateCutListItems(items)

      expect(result[0].qtyPerUnit).toBe(2)
    })

    it('should calculate total qty as qtyPerUnit * unitCount', () => {
      const items = [
        makeItem({ panelId: 1, quantity: 2 }),
        makeItem({ panelId: 2, quantity: 2 }),
        makeItem({ panelId: 3, quantity: 2 })
      ]
      const result = aggregateCutListItems(items)

      expect(result[0].unitCount).toBe(3)
      expect(result[0].totalQty).toBe(6) // 2 * 3
    })
  })

  describe('sorting', () => {
    it('should sort by product name first', () => {
      const items = [
        makeItem({ productName: 'Z Product', panelId: 1 }),
        makeItem({ productName: 'A Product', panelId: 2 })
      ]
      const result = aggregateCutListItems(items)

      expect(result[0].productName).toBe('A Product')
      expect(result[1].productName).toBe('Z Product')
    })

    it('should sort by size within same product', () => {
      const items = [
        makeItem({ productName: 'Product', panelWidth: 48, panelHeight: 84, panelId: 1, sizeKey: '48x84' }),
        makeItem({ productName: 'Product', panelWidth: 36, panelHeight: 84, panelId: 2, sizeKey: '36x84' })
      ]
      const result = aggregateCutListItems(items)

      expect(result[0].sizeKey).toBe('36x84')
      expect(result[1].sizeKey).toBe('48x84')
    })

    it('should sort by part number within same product and size', () => {
      const items = [
        makeItem({ productName: 'Product', panelWidth: 36, panelHeight: 84, partNumber: 'Z-001', panelId: 1 }),
        makeItem({ productName: 'Product', panelWidth: 36, panelHeight: 84, partNumber: 'A-001', panelId: 1 })
      ]
      const result = aggregateCutListItems(items)

      expect(result[0].partNumber).toBe('A-001')
      expect(result[1].partNumber).toBe('Z-001')
    })

    it('should sort by cut length within same product, size, and part', () => {
      const items = [
        makeItem({ cutLength: 84, panelId: 1 }),
        makeItem({ cutLength: 36, panelId: 1 })
      ]
      const result = aggregateCutListItems(items)

      expect(result[0].cutLength).toBe(36)
      expect(result[1].cutLength).toBe(84)
    })
  })
})
