import { NextResponse } from 'next/server'
import { getStoredRealmId, fetchExpenseAccounts } from '@/lib/quickbooks'

// GET - Fetch all expense accounts from QuickBooks
// Used for selecting vendor default expense accounts
export async function GET() {
  try {
    const realmId = await getStoredRealmId()
    if (!realmId) {
      return NextResponse.json(
        { error: 'QuickBooks not connected' },
        { status: 400 }
      )
    }

    const accounts = await fetchExpenseAccounts(realmId)

    // Sort by AccountType (COGS first) then by Name
    const sortedAccounts = accounts.sort((a, b) => {
      // COGS accounts first
      if (a.AccountType === 'Cost of Goods Sold' && b.AccountType !== 'Cost of Goods Sold') return -1
      if (b.AccountType === 'Cost of Goods Sold' && a.AccountType !== 'Cost of Goods Sold') return 1
      // Then alphabetically by name
      return a.Name.localeCompare(b.Name)
    })

    return NextResponse.json({
      accounts: sortedAccounts.map(a => ({
        id: a.Id,
        name: a.Name,
        type: a.AccountType
      }))
    })
  } catch (error) {
    console.error('Error fetching expense accounts:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch expense accounts' },
      { status: 500 }
    )
  }
}
