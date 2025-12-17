# QuickBooks Integration Assistant

You are helping develop a QuickBooks Online integration for the Door-Quoter ERP system.

## Documentation Location

QuickBooks API documentation is located in `.claude/docs/quickbooks-api/`. Before implementing any QuickBooks-related feature, read the relevant documentation files:

### Core Entities (read as needed based on task):
- `invoice.md` - Creating/managing invoices
- `estimate.md` - Quotes and estimates
- `customer.md` - Customer records
- `item.md` - Products and services
- `payment.md` - Payment processing
- `bill.md` - Vendor bills (AP)
- `vendor.md` - Vendor records
- `account.md` - Chart of accounts
- `purchaseorder.md` - Purchase orders

### Supporting Entities:
- `taxcode.md`, `taxrate.md`, `taxagency.md` - Tax handling
- `paymentmethod.md`, `term.md` - Payment terms/methods
- `deposit.md`, `transfer.md` - Banking transactions
- `creditmemo.md`, `refundreceipt.md` - Refunds/credits

## Integration Guidelines

1. **Always read the relevant doc file first** before writing integration code
2. **Match Door-Quoter data models** to QuickBooks entities appropriately
3. **Handle required vs optional fields** as specified in the docs
4. **Use proper QuickBooks references** (Id, SyncToken) for updates
5. **Implement proper error handling** for API responses

## User Request

$ARGUMENTS
