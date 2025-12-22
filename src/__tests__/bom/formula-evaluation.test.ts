import { evaluateFormula, calculateRequiredPartLength } from '@/lib/bom/calculations'

describe('evaluateFormula', () => {
  describe('basic variable substitution', () => {
    it('should return width value for simple width formula', () => {
      expect(evaluateFormula('width', { width: 36, height: 84 })).toBe(36)
    })

    it('should return height value for simple height formula', () => {
      expect(evaluateFormula('height', { width: 36, height: 84 })).toBe(84)
    })

    it('should return quantity value for simple quantity formula', () => {
      expect(evaluateFormula('quantity', { width: 36, height: 84, quantity: 4 })).toBe(4)
    })
  })

  describe('arithmetic operations', () => {
    it('should handle subtraction', () => {
      expect(evaluateFormula('width - 2', { width: 36, height: 84 })).toBe(34)
    })

    it('should handle addition', () => {
      expect(evaluateFormula('height + 1.5', { width: 36, height: 84 })).toBe(85.5)
    })

    it('should handle multiplication', () => {
      expect(evaluateFormula('width * 2', { width: 36, height: 84 })).toBe(72)
    })

    it('should handle division', () => {
      expect(evaluateFormula('width / 2', { width: 36, height: 84 })).toBe(18)
    })

    it('should handle complex expressions with parentheses', () => {
      expect(evaluateFormula('(width + height) * 2', { width: 36, height: 84 })).toBe(240)
    })

    it('should handle mixed operations', () => {
      expect(evaluateFormula('width + height - 10', { width: 36, height: 84 })).toBe(110)
    })

    it('should handle decimal results', () => {
      expect(evaluateFormula('width / 4', { width: 37, height: 84 })).toBe(9.25)
    })
  })

  describe('case insensitivity', () => {
    it('should handle uppercase WIDTH', () => {
      expect(evaluateFormula('WIDTH', { width: 36, height: 84 })).toBe(36)
    })

    it('should handle uppercase HEIGHT', () => {
      expect(evaluateFormula('HEIGHT', { width: 36, height: 84 })).toBe(84)
    })

    it('should handle mixed case Width', () => {
      expect(evaluateFormula('Width + Height', { width: 36, height: 84 })).toBe(120)
    })

    it('should handle mixed case in expressions', () => {
      // Note: evaluateFormula enforces minimum of 0, so negative results become 0
      expect(evaluateFormula('HEIGHT - width', { width: 36, height: 84 })).toBe(48)
    })
  })

  describe('edge cases', () => {
    it('should return 0 for empty string formula', () => {
      expect(evaluateFormula('', { width: 36, height: 84 })).toBe(0)
    })

    it('should return 0 for whitespace-only formula', () => {
      expect(evaluateFormula('   ', { width: 36, height: 84 })).toBe(0)
    })

    it('should return 0 for null formula', () => {
      expect(evaluateFormula(null as unknown as string, { width: 36, height: 84 })).toBe(0)
    })

    it('should return 0 for undefined formula', () => {
      expect(evaluateFormula(undefined as unknown as string, { width: 36, height: 84 })).toBe(0)
    })

    it('should return 0 for non-string formula', () => {
      expect(evaluateFormula(123 as unknown as string, { width: 36, height: 84 })).toBe(0)
    })

    it('should handle formula with extra whitespace', () => {
      expect(evaluateFormula('  width + height  ', { width: 36, height: 84 })).toBe(120)
    })

    it('should return 0 for invalid expression', () => {
      expect(evaluateFormula('invalid_var', { width: 36, height: 84 })).toBe(0)
    })

    it('should return 0 and not throw for malformed expressions', () => {
      expect(evaluateFormula('width +', { width: 36, height: 84 })).toBe(0)
    })

    it('should return 0 for negative results (enforced minimum)', () => {
      expect(evaluateFormula('width - 100', { width: 36, height: 84 })).toBe(0)
    })
  })

  describe('real-world formulas', () => {
    // Common door/window extrusion formulas
    it('should calculate header length (width + 2.25)', () => {
      expect(evaluateFormula('width + 2.25', { width: 36, height: 84 })).toBe(38.25)
    })

    it('should calculate jamb length (height - 0.5)', () => {
      expect(evaluateFormula('height - 0.5', { width: 36, height: 84 })).toBe(83.5)
    })

    it('should calculate perimeter formula', () => {
      expect(evaluateFormula('2 * (width + height)', { width: 36, height: 84 })).toBe(240)
    })

    it('should calculate glass width (width - 1.75)', () => {
      expect(evaluateFormula('width - 1.75', { width: 36, height: 84 })).toBe(34.25)
    })

    it('should calculate glass height (height - 2.5)', () => {
      expect(evaluateFormula('height - 2.5', { width: 36, height: 84 })).toBe(81.5)
    })
  })
})

describe('calculateRequiredPartLength', () => {
  describe('with formula', () => {
    it('should use formula when provided', () => {
      const bom = { formula: 'width + 2', partType: 'Extrusion' }
      expect(calculateRequiredPartLength(bom, { width: 36, height: 84 })).toBe(38)
    })

    it('should evaluate height formula', () => {
      const bom = { formula: 'height - 1', partType: 'Extrusion' }
      expect(calculateRequiredPartLength(bom, { width: 36, height: 84 })).toBe(83)
    })
  })

  describe('extrusion without formula', () => {
    it('should return max(width, height) for extrusion without formula', () => {
      const bom = { partType: 'Extrusion' }
      expect(calculateRequiredPartLength(bom, { width: 36, height: 84 })).toBe(84)
    })

    it('should return width when width > height', () => {
      const bom = { partType: 'Extrusion' }
      expect(calculateRequiredPartLength(bom, { width: 100, height: 50 })).toBe(100)
    })

    it('should handle missing dimensions', () => {
      const bom = { partType: 'Extrusion' }
      expect(calculateRequiredPartLength(bom, {})).toBe(0)
    })
  })

  describe('non-extrusion parts', () => {
    it('should return quantity for hardware parts', () => {
      const bom = { partType: 'Hardware', quantity: 4 }
      expect(calculateRequiredPartLength(bom, { width: 36, height: 84 })).toBe(4)
    })

    it('should return 0 for parts without formula or quantity', () => {
      const bom = { partType: 'Hardware' }
      expect(calculateRequiredPartLength(bom, { width: 36, height: 84 })).toBe(0)
    })
  })
})
