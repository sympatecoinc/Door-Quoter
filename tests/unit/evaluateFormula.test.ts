import { describe, it, expect } from 'vitest'
import { evaluateFormula } from '@/lib/bom-utils'

describe('evaluateFormula', () => {
  describe('Basic Variable Substitution', () => {
    it('should evaluate simple width variable', () => {
      expect(evaluateFormula('width', { width: 42, height: 108 })).toBe(42)
    })

    it('should evaluate simple height variable', () => {
      expect(evaluateFormula('height', { width: 42, height: 108 })).toBe(108)
    })

    it('should handle multiple variables', () => {
      expect(evaluateFormula('width', { width: 42, height: 108, quantity: 2 })).toBe(42)
    })
  })

  describe('Basic Math Operations', () => {
    it('should evaluate addition', () => {
      expect(evaluateFormula('width + 10', { width: 42, height: 108 })).toBe(52)
    })

    it('should evaluate subtraction', () => {
      expect(evaluateFormula('width - 5', { width: 42, height: 108 })).toBe(37)
    })

    it('should evaluate multiplication', () => {
      expect(evaluateFormula('width * 2', { width: 42, height: 108 })).toBe(84)
    })

    it('should evaluate division', () => {
      expect(evaluateFormula('width / 2', { width: 42, height: 108 })).toBe(21)
    })
  })

  describe('Complex Formulas', () => {
    it('should handle combined operations', () => {
      expect(evaluateFormula('width * 2 + height', { width: 42, height: 108 })).toBe(192)
    })

    it('should handle parentheses', () => {
      expect(evaluateFormula('(width + height) / 2', { width: 42, height: 108 })).toBe(75)
    })

    it('should handle multiple variable occurrences', () => {
      expect(evaluateFormula('width + width', { width: 42, height: 108 })).toBe(84)
    })

    it('should respect operator precedence', () => {
      // 2 + 3 * 4 = 14 (not 20)
      expect(evaluateFormula('width + height * 2', { width: 10, height: 5 })).toBe(20)
    })

    it('should handle nested parentheses', () => {
      expect(evaluateFormula('((width + height) * 2) / 4', { width: 10, height: 10 })).toBe(10)
    })
  })

  describe('Case Insensitivity', () => {
    it('should replace Width with width value', () => {
      expect(evaluateFormula('Width', { width: 42, height: 108 })).toBe(42)
    })

    it('should replace HEIGHT with height value', () => {
      expect(evaluateFormula('HEIGHT', { width: 42, height: 108 })).toBe(108)
    })

    it('should handle mixed case formulas', () => {
      expect(evaluateFormula('Width + Height', { width: 42, height: 108 })).toBe(150)
    })

    it('should handle all caps variables', () => {
      expect(evaluateFormula('WIDTH * HEIGHT', { width: 10, height: 20 })).toBe(200)
    })

    it('should handle camelCase in formula', () => {
      expect(evaluateFormula('Width + height', { width: 42, height: 108 })).toBe(150)
    })
  })

  describe('Edge Cases - Empty/Invalid Input', () => {
    it('should return 0 for empty formula', () => {
      expect(evaluateFormula('', { width: 42, height: 108 })).toBe(0)
    })

    it('should return 0 for whitespace-only formula', () => {
      expect(evaluateFormula('   ', { width: 42, height: 108 })).toBe(0)
    })

    it('should return 0 for null formula', () => {
      expect(evaluateFormula(null as unknown as string, { width: 42, height: 108 })).toBe(0)
    })

    it('should return 0 for undefined formula', () => {
      expect(evaluateFormula(undefined as unknown as string, { width: 42, height: 108 })).toBe(0)
    })

    it('should return 0 for invalid expression syntax', () => {
      expect(evaluateFormula('invalid syntax +++', { width: 42, height: 108 })).toBe(0)
    })

    it('should return 0 for non-string formula', () => {
      expect(evaluateFormula(123 as unknown as string, { width: 42, height: 108 })).toBe(0)
    })
  })

  describe('Negative Result Handling', () => {
    it('should not return negative values', () => {
      // width - 100 = 42 - 100 = -58, should be clamped to 0
      expect(evaluateFormula('width - 100', { width: 42, height: 108 })).toBe(0)
    })

    it('should return 0 when result is negative', () => {
      expect(evaluateFormula('10 - 50', { width: 42, height: 108 })).toBe(0)
    })

    it('should return positive result when formula yields positive', () => {
      expect(evaluateFormula('100 - width', { width: 42, height: 108 })).toBe(58)
    })
  })

  describe('Decimal Precision', () => {
    it('should handle decimal input values', () => {
      expect(evaluateFormula('width', { width: 42.5, height: 108.25 })).toBe(42.5)
    })

    it('should handle decimal results', () => {
      const result = evaluateFormula('width / 3', { width: 10, height: 108 })
      expect(result).toBeCloseTo(3.333, 2)
    })

    it('should preserve decimal precision in calculations', () => {
      expect(evaluateFormula('width * 0.5', { width: 42, height: 108 })).toBe(21)
    })
  })

  describe('Real-World Door Formulas', () => {
    it('should calculate frame vertical (height only)', () => {
      expect(evaluateFormula('height', { width: 42, height: 108 })).toBe(108)
    })

    it('should calculate frame horizontal (width only)', () => {
      expect(evaluateFormula('width', { width: 42, height: 108 })).toBe(42)
    })

    it('should calculate perimeter', () => {
      // Perimeter = 2 * (width + height)
      expect(evaluateFormula('2 * (width + height)', { width: 42, height: 108 })).toBe(300)
    })

    it('should calculate glass width with clearance', () => {
      // Glass is typically smaller than frame opening
      expect(evaluateFormula('width - 0.5', { width: 42, height: 108 })).toBe(41.5)
    })

    it('should calculate glass height with clearance', () => {
      expect(evaluateFormula('height - 0.5', { width: 42, height: 108 })).toBe(107.5)
    })

    it('should calculate diagonal', () => {
      // For 3-4-5 triangle: sqrt(3^2 + 4^2) = 5
      const result = evaluateFormula('Math.sqrt(width * width + height * height)', { width: 3, height: 4 })
      expect(result).toBe(5)
    })
  })

  describe('Special Characters and Whitespace', () => {
    it('should handle formulas with extra whitespace', () => {
      expect(evaluateFormula('  width  +  height  ', { width: 42, height: 108 })).toBe(150)
    })

    it('should handle tabs in formula', () => {
      expect(evaluateFormula('width\t+\theight', { width: 42, height: 108 })).toBe(150)
    })
  })

  describe('Constants in Formulas', () => {
    it('should handle formulas with only constants', () => {
      expect(evaluateFormula('2 * 3', { width: 42, height: 108 })).toBe(6)
    })

    it('should handle mixed variables and constants', () => {
      expect(evaluateFormula('width + 10 + height', { width: 42, height: 108 })).toBe(160)
    })
  })
})
