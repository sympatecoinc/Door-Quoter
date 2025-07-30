# Pricing Issue Investigation Report

## Issue Summary
**User Report**: "When adding a second extrusion to the product, pricing calculation shows $40 total for both extrusions but then adds an extra $1, making it $41 instead of $40."

## Investigation Results

### ✅ Confirmed: The Calculation is Mathematically Correct

The pricing system is working exactly as designed. Here's the breakdown:

**Current Configuration (36" width panel):**
- Bottom Channel (AD-48347-MF): $15 (from stock rule)
- Top Trim (AD-48420-BL): $26 (formula: width-10 = 36-10)
- **Total: $41**

### 🔍 Root Cause Analysis

The "extra $1" issue stems from a **dimension expectation mismatch**:

**User expects**: $40 total
**System calculates**: $41 total  
**Difference**: $1 extra

### 🧪 Test Results

I tested multiple scenarios and found that:

1. **With 35" width panel**: Total = $40 ✅
   - Bottom Channel: $15
   - Top Trim: 35-10 = $25
   - Total: $15 + $25 = $40

2. **With 36" width panel**: Total = $41 ❌
   - Bottom Channel: $15  
   - Top Trim: 36-10 = $26
   - Total: $15 + $26 = $41

### 📊 Where the Extra $1 Comes From

The extra $1 = (36-10) - (35-10) = $26 - $25 = **$1**

This is purely due to the Top Trim formula `width-10` being applied to a 36" wide panel instead of a 35" wide panel.

## Possible Explanations

### Scenario 1: Panel Width Mismatch
- User tested with 35" width panels (giving $40)
- Current system has 36" width panels (giving $41)
- User expectation based on previous test configuration

### Scenario 2: Formula Issue  
- Top Trim formula might be incorrect
- Should be `width-11` instead of `width-10`
- With `width-11`: 36-11 = $25, giving total of $40

### Scenario 3: Test Data Inconsistency
- User's test environment had different dimensions
- Production/current environment has different panel size

## Solutions

### Option 1: Verify Panel Dimensions
- Confirm if panel should be 35" or 36" wide
- If 35" is correct, update panel data

### Option 2: Verify Formula
- Confirm if Top Trim formula should be `width-10` or `width-11`
- Check business requirements for Top Trim pricing

### Option 3: No Action Required
- If current calculation is correct, explain to user why 36" width gives $41

## Files Used in Investigation

- `/src/app/api/openings/[id]/calculate-price/route.ts` - Main pricing API
- `debug-extra-dollar.js` - Manual calculation verification
- `demonstrate-pricing-scenarios.js` - Scenario testing
- `find-one-dollar-issue.js` - Formula analysis

## Recommendation

**Immediate Action**: Verify with the user what panel width they expect for their test case. If they expect 35", update the test data. If they expect 36", verify that the Top Trim formula `width-10` is correct according to business rules.

The pricing calculation engine is working correctly - this is a data/expectation alignment issue, not a code bug.