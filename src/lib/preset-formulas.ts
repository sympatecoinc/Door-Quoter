/**
 * Formula evaluation utility for Opening Presets
 *
 * Evaluates formulas with opening dimension variables:
 * - roughWidth, roughHeight
 * - finishedWidth, finishedHeight
 *
 * Example: evaluatePresetFormula('finishedHeight * 2 + finishedWidth', { ... })
 */

export interface PresetFormulaVariables {
  roughWidth: number
  roughHeight: number
  finishedWidth: number
  finishedHeight: number
}

/**
 * Safely evaluates a formula string with the given variables.
 * Only allows basic math operations and the defined variables.
 *
 * @param formula - Formula string like "finishedHeight * 2 + finishedWidth"
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
    let evaluatedFormula = formula
      .replace(/roughWidth/g, String(variables.roughWidth))
      .replace(/roughHeight/g, String(variables.roughHeight))
      .replace(/finishedWidth/g, String(variables.finishedWidth))
      .replace(/finishedHeight/g, String(variables.finishedHeight))

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
  const validVariables = ['roughWidth', 'roughHeight', 'finishedWidth', 'finishedHeight']
  const variablePattern = validVariables.join('|')
  const validPattern = new RegExp(
    `^[\\s()]*(?:${variablePattern}|\\d+\\.?\\d*)[\\s()]*(?:[+\\-*/%][\\s()]*(?:${variablePattern}|\\d+\\.?\\d*)[\\s()]*)*$`,
    'i'
  )

  // First, check if formula uses valid variable names
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
    { name: 'roughWidth', description: 'Rough opening width (inches)' },
    { name: 'roughHeight', description: 'Rough opening height (inches)' },
    { name: 'finishedWidth', description: 'Finished opening width (inches)' },
    { name: 'finishedHeight', description: 'Finished opening height (inches)' },
  ]
}
