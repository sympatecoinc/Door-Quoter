/**
 * Formula evaluation utility for Opening Presets
 *
 * Evaluates formulas with opening dimension variables:
 * - width, height (primary - maps to finished dimensions)
 * - finishedWidth, finishedHeight (legacy, still supported)
 * - roughWidth, roughHeight (legacy, still supported)
 *
 * Example: evaluatePresetFormula('height - 0.75', { ... })
 */

export interface PresetFormulaVariables {
  roughWidth: number
  roughHeight: number
  finishedWidth: number
  finishedHeight: number
  interiorWidth?: number
  interiorHeight?: number
  jambThickness?: number
}

/**
 * Safely evaluates a formula string with the given variables.
 * Only allows basic math operations and the defined variables.
 *
 * Supports both new (width, height) and legacy (finishedWidth, finishedHeight,
 * roughWidth, roughHeight) variable names. `width` maps to finishedWidth,
 * `height` maps to finishedHeight.
 *
 * @param formula - Formula string like "height - 0.75" or "finishedHeight * 2"
 * @param variables - Object with roughWidth, roughHeight, finishedWidth, finishedHeight
 * @returns Calculated result, or null if evaluation fails
 */
export function evaluatePresetFormula(
  formula: string | null | undefined,
  variables: PresetFormulaVariables
): number | null {
  if (!formula || formula.trim() === '') {
    return null
  }

  // Check if it's just a number
  const numericValue = parseFloat(formula)
  if (!isNaN(numericValue) && formula.trim() === String(numericValue)) {
    return numericValue
  }

  try {
    // Replace variable names with their values
    // Order matters: replace longer names first to avoid partial matches
    // (e.g., "finishedWidth" before "width")
    let evaluatedFormula = formula
      // Replace longer names first to avoid partial matches
      .replace(/interiorWidth/g, String(variables.interiorWidth ?? variables.finishedWidth))
      .replace(/interiorHeight/g, String(variables.interiorHeight ?? variables.finishedHeight))
      .replace(/jambThickness/g, String(variables.jambThickness ?? 0))
      .replace(/finishedWidth/g, String(variables.finishedWidth))
      .replace(/finishedHeight/g, String(variables.finishedHeight))
      .replace(/roughWidth/g, String(variables.roughWidth))
      .replace(/roughHeight/g, String(variables.roughHeight))
      .replace(/\bwidth\b/g, String(variables.finishedWidth))
      .replace(/\bheight\b/g, String(variables.finishedHeight))

    // Validate that the formula only contains safe characters
    // Allow: numbers, operators (+, -, *, /, %), parentheses, spaces, decimal points
    const safePattern = /^[\d\s+\-*/%.()]+$/
    if (!safePattern.test(evaluatedFormula)) {
      console.warn(`Invalid characters in formula: ${formula}`)
      return null
    }

    // Evaluate the formula using Function constructor (safer than eval)
    // eslint-disable-next-line no-new-func
    const result = new Function(`return (${evaluatedFormula})`)()

    if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) {
      console.warn(`Formula evaluation resulted in invalid number: ${formula} => ${result}`)
      return null
    }

    return result
  } catch (error) {
    console.warn(`Error evaluating formula: ${formula}`, error)
    return null
  }
}

/**
 * Validates a formula string without evaluating it.
 * Returns true if the formula appears to be valid.
 */
export function validatePresetFormula(formula: string | null | undefined): boolean {
  if (!formula || formula.trim() === '') {
    return true // Empty is valid (means no formula)
  }

  // Check if it's just a number
  const numericValue = parseFloat(formula)
  if (!isNaN(numericValue)) {
    return true
  }

  // Check that it only contains valid variable names and operators
  const validVariables = ['width', 'height', 'roughWidth', 'roughHeight', 'finishedWidth', 'finishedHeight', 'interiorWidth', 'interiorHeight', 'jambThickness']

  // Check used variables are valid
  const usedVariables = formula.match(/[a-zA-Z]+/g) || []
  for (const variable of usedVariables) {
    if (!validVariables.includes(variable)) {
      return false
    }
  }

  // Simple check: contains only valid characters
  const safeCharPattern = /^[\da-zA-Z\s+\-*/%.()]+$/
  return safeCharPattern.test(formula)
}

/**
 * Get a list of available formula variables with descriptions
 */
export function getFormulaVariables(): Array<{ name: string; description: string }> {
  return [
    { name: 'width', description: 'Opening finished width (inches)' },
    { name: 'height', description: 'Opening finished height (inches)' },
    { name: 'interiorWidth', description: 'Interior width after jamb deduction (inches)' },
    { name: 'interiorHeight', description: 'Interior height after jamb deduction (inches)' },
    { name: 'jambThickness', description: 'Frame jamb profile thickness (inches)' },
  ]
}
