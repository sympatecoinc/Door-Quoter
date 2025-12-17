# JournalEntry API Reference

## Description

Accounting transaction, consists of journal lines, each of which is either a debit or a credit. The total of the debits must equal the total of the credits.

## API Endpoint

```
POST /v3/company/{realmId}/journalentry
GET /v3/company/{realmId}/journalentry/{id}
```

**Extends:** `Transaction`

## Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `Id` | `id` | No | Product: ALL Description: Unique Identifier for an Intuit entity (object).  Required for the update ... |
| `SyncToken` | `string` | No | Product: ALL Description: Version number of the entity. The SyncToken is used to lock the entity for... |
| `MetaData` | `ModificationMetaData` | No | Product: ALL Description: Descriptive information about the entity. The MetaData values are set by D... |
| `CustomField` | `CustomField` | No | Product: QBW Description: Custom field (or data extension). Filterable: QBW |
| `AttachableRef` | `AttachableRef` | No | Specifies entity name of the attachment from where the attachment was requested |
| `DocNumber` | `string` | No | Product: ALL Description: QBO: Reference number for the transaction. If DocNumber is not provided, a... |
| `TxnDate` | `date` | No | Product: ALL Description: QBO: The date entered by the user when this transaction occurred.  Often, ... |
| `DepartmentRef` | `ReferenceType` | No | Product: QBO Description: Location of the transaction, as defined using location tracking in QuickBo... |
| `CurrencyRef` | `ReferenceType` | No | Product: ALL Description: Reference to the Currency in which all amounts on the associated transacti... |
| `ExchangeRate` | `decimal` | No | Product: ALL Description: Currency exchange rate. Valid only if the company file is set up to use Mu... |
| `PrivateNote` | `string` | No | Product: ALL Description: User entered, organization-private note about the transaction. This note w... |
| `TxnStatus` | `string` | No | Product: ALL Description: QBW: The status of the transaction. Depending on the transaction type it m... |
| `LinkedTxn` | `LinkedTxn` | No | Product: ALL Description: A linked (related) transaction. More than one transaction can be linked. |
| `Line` | `Line` | No | Product: QBW Description: A line item of a transaction. Product: QBO Description: A line item of a t... |
| `TxnTaxDetail` | `TxnTaxDetail` | No | Product: ALL Description: Details of taxes charged on the transaction as a whole. For US versions of... |
| `TxnSource` | `string` | No | Product: QBO Description: Originating source of the Transaction. Valid values are defined in TxnSour... |
| `TaxFormType` | `string` | No | Description: refer TaxFormTypeEnum. Tax Form Type holds data related to Tax Information, values base... |
| `TaxFormNum` | `string` | No | Description: Tax Form Num holds data related to Tax Information based on Regional compliance laws.Th... |
| `TransactionLocationType` | `string` | No | Product: QBO Description: Location of the purchase or sale transaction. The applicable values are th... |
| `Tag` | `Tag` | No | Product: QBO Descripton: List of tags used to identify the transaction. |
| `TxnApprovalInfo` | `TxnApprovalInfo` | No | Product: QBO Description: Details of the Approval Status for current transaction in QBO workflows. |
| `RecurDataRef` | `ReferenceType` | No | Product: QBO Description: Reference to the RecurTemplate which was used to create the Transaction In... |
| `RecurringInfo` | `RecurringInfo` | No | Product: QBO Description: The Recurring Schedule information for the Transaction |
| `ProjectRef` | `ReferenceType` | No | Product: ALL Description: Project identifier References to the project this transaction is associate... |
| `TotalCostAmount` | `decimal` | No | Product: ALL Description: Project Estimate identifier The amount or equivalent paid or charged for a... |
| `HomeTotalCostAmount` | `decimal` | No | Product: ALL Description: Project Estimate identifier The amount or equivalent paid or charged for a... |
| `Adjustment` | `boolean` | No | Indicates that the Journal Entry is after-the-fact entry to make changes to specific accounts. |
| `HomeCurrencyAdjustment` | `boolean` | No | Valid only if the company file is set up to use Multi-Currency feature. [b]QuickBooks Notes[/b]  At ... |
| `EnteredInHomeCurrency` | `boolean` | No | Valid only if the company file is set up to use Multi-Currency feature. [b]QuickBooks Notes[/b]  Amo... |
| `GlobalTaxCalculation` | `GlobalTaxCalculationEnum` | No | Product: QBO Description: Indicates the GlobalTax model if the model inclusive of tax, exclusive of ... |
| `TotalAmt` | `decimal` | No | Product: All Description: Indicates the total amount of the transaction. This includes the total of ... |
| `HomeTotalAmt` | `decimal` | No | Product: ALL Description: Total amount of the transaction in the home currency for multi-currency en... |
| `JournalEntryEx` | `IntuitAnyType` | No | Internal use only: extension place holder for JournalEntry |

## Property Details

### Id

**Type:** `id`

**Required:** No

Product: ALL Description: Unique Identifier for an Intuit entity (object). 
Required for the update operation. Required: ALL Filterable: ALL

### SyncToken

**Type:** `string`

**Required:** No

Product: ALL Description: Version number of the entity. The SyncToken is used to lock the entity for use by one application at a time. As soon as an application modifies an entity, its SyncToken is incremented; another application's request to modify the entity with the same SyncToken will fail. Only the latest version of the entity is maintained by Data Services. An attempt to modify an entity specifying an older SyncToken will fail. 
Required for the update operation. Required: ALL

### MetaData

**Type:** `ModificationMetaData`

**Required:** No

Product: ALL Description: Descriptive information about the entity. The MetaData values are set by Data Services and are read only for all applications.

### CustomField

**Type:** `CustomField`

**Required:** No

Product: QBW Description: Custom field (or data extension). Filterable: QBW

### AttachableRef

**Type:** `AttachableRef`

**Required:** No

Specifies entity name of the attachment from where the attachment was requested

### DocNumber

**Type:** `string`

**Required:** No

Product: ALL Description: QBO: Reference number for the transaction. If DocNumber is not provided, and the Custom Transaction Number is set to "Off", QBO assigns a document number using the next-in-sequence algorithm for Sales transactions. Otherwise the value will remaing null. Alternatively, you can also pass in "AUTO_GENERATE" in this field to force QBO to auto-sequence the document number for Invoices, Estimates and Sales Receipt.
The maximum length for DocNumber is 21 characters. The default value is an empty String. Filter support not provided for Payment. Description: QBW: The primary document number for this transaction. DocNumber is exposed to end users.
If it is not provided, QuickBooks business logic will assign the document number using the "next in sequence" algorithm.
Max. length is 11 characters for Payment, Bill, ItemReceipt and VendorCredit. Max. length is 20 characters for other entities. Filterable: QBO InputType: ReadWrite ValidRange: QBW: max=11 ValidRange: QBO: max=21

### TxnDate

**Type:** `date`

**Required:** No

Product: ALL Description: QBO: The date entered by the user when this transaction occurred. 
Often, it is the date when the transaction is created in the system. 
For "posting" transactions, this is the posting date that affects the financial statements. If the date is not supplied, the current date on the server is used. Description: QBW: The nominal, user entered, date of the transaction. 
Often, but not required to be, the date the transaction was created in the system. 
For "posting" transactions, this is the posting date that affects financial statements. Filterable: ALL Sortable: ALL InputType: ReadWrite

### DepartmentRef

**Type:** `ReferenceType`

**Required:** No

Product: QBO Description: Location of the transaction, as defined using location tracking in QuickBooks Online.

### CurrencyRef

**Type:** `ReferenceType`

**Required:** No

Product: ALL Description: Reference to the Currency in which all amounts on the associated transaction are expressed.
 InputType: ReadWrite

### ExchangeRate

**Type:** `decimal`

**Required:** No

Product: ALL Description: Currency exchange rate. Valid only if the company file is set up to use Multi-Currency feature. In QuickBooks, exchange rates are always recorded as the number of home currency units it takes to equal one foreign currency unit. The foreign unit is always 1 and the amount of home units that equal that 1 foreign unit is what QuickBooks uses as the exchange rate. InputType: ReadWrite

### PrivateNote

**Type:** `string`

**Required:** No

Product: ALL Description: User entered, organization-private note about the transaction. This note will not appear on the transaction records by default. InputType: ReadWrite

### TxnStatus

**Type:** `string`

**Required:** No

Product: ALL Description: QBW: The status of the transaction. Depending on the transaction type it may have different values.
For Sales Transactions acceptable values are defined in PaymentStatusEnum. For Estimate, the values accepted are defined in EstimateStatusEnum. Description: QBO: The status of the transaction. Depending on the transaction type it may have different values.
For Sales Transactions acceptable values are defined in PaymentStatusEnum. For Estimate, the values accepted are defined in QboEstimateStatusEnum. Filterable:QBW

### LinkedTxn

**Type:** `LinkedTxn`

**Required:** No

Product: ALL Description: A linked (related) transaction. More than one transaction can be linked.

### Line

**Type:** `Line`

**Required:** No

Product: QBW Description: A line item of a transaction. Product: QBO Description: A line item of a transaction. QuickBooks Online does not support tax lines in the main transaction body, only in the TxnTaxDetail section.

### TxnTaxDetail

**Type:** `TxnTaxDetail`

**Required:** No

Product: ALL Description: Details of taxes charged on the transaction as a whole. For US versions of QuickBooks, tax rates used in the detail section must not be used in any tax line appearing in the main transaction body. For international versions of QuickBooks, the TxnTaxDetail should provide the details of all taxes (sales or purchase) calculated for the transaction based on the tax codes referenced by the transaction. This can be calculated by QuickBooks business logic or you may supply it when adding a transaction. For US versions of QuickBooks you need only supply the tax code for the customer and the tax code (in the case of multiple rates) or tax rate (for a single rate) to apply for the transaction as a whole.
See [a href="http://ipp.developer.intuit.com/0010_Intuit_Partner_Platform/0060_Financial_Management_Services_(v3)/01100_Global_Tax_Model"]Global Tax Model[/a].

### TxnSource

**Type:** `string`

**Required:** No

Product: QBO Description: Originating source of the Transaction. Valid values are defined in TxnSourceEnum: QBMobile.

### TaxFormType

**Type:** `string`

**Required:** No

Description: refer TaxFormTypeEnum. Tax Form Type holds data related to Tax Information, values based on regional compliance laws. Applicable for IN Region and can be extended for other Regions.

### TaxFormNum

**Type:** `string`

**Required:** No

Description: Tax Form Num holds data related to Tax Information based on Regional compliance laws.This is applicable for IN region and can be extended to other regions in future.

### TransactionLocationType

**Type:** `string`

**Required:** No

Product: QBO Description: Location of the purchase or sale transaction. The applicable values are those exposed through the TransactionLocationTypeEnum. This is currently applicable only for the FR region.

### Tag

**Type:** `Tag`

**Required:** No

Product: QBO Descripton: List of tags used to identify the transaction.

### TxnApprovalInfo

**Type:** `TxnApprovalInfo`

**Required:** No

Product: QBO Description: Details of the Approval Status for current transaction in QBO workflows.

### RecurDataRef

**Type:** `ReferenceType`

**Required:** No

Product: QBO Description: Reference to the RecurTemplate which was used to create the Transaction InputType: Read

### RecurringInfo

**Type:** `RecurringInfo`

**Required:** No

Product: QBO Description: The Recurring Schedule information for the Transaction

### ProjectRef

**Type:** `ReferenceType`

**Required:** No

Product: ALL Description: Project identifier References to the project this transaction is associated with

### TotalCostAmount

**Type:** `decimal`

**Required:** No

Product: ALL Description: Project Estimate identifier The amount or equivalent paid or charged for a product/service

### HomeTotalCostAmount

**Type:** `decimal`

**Required:** No

Product: ALL Description: Project Estimate identifier The amount or equivalent paid or charged for a product/service when using multi-currency

### Adjustment

**Type:** `boolean`

**Required:** No

Indicates that the Journal Entry is after-the-fact entry to make changes to specific accounts.

### HomeCurrencyAdjustment

**Type:** `boolean`

**Required:** No

Valid only if the company file is set up to use Multi-Currency feature. [b]QuickBooks Notes[/b]
 At the end of a reporting period, when financial reports need to reflect a current home currency value of the foreign balances, enter a home currency adjustment. Until the home currency value of the foreign balances is recalculated using current exchange rates, reports reflect the home currency value based on the exchange rates used at the time of each transaction.

### EnteredInHomeCurrency

**Type:** `boolean`

**Required:** No

Valid only if the company file is set up to use Multi-Currency feature. [b]QuickBooks Notes[/b]
 Amounts are always entered in home currency for a HomeCurrencyAdjustment JournalEntry.

### GlobalTaxCalculation

**Type:** `GlobalTaxCalculationEnum`

**Required:** No

Product: QBO Description: Indicates the GlobalTax model if the model inclusive of tax, exclusive of taxes or not applicable

### TotalAmt

**Type:** `decimal`

**Required:** No

Product: All Description: Indicates the total amount of the transaction. This includes the total of all the charges, allowances and taxes. By default, this is recalculated based on sub items total and overridden. Product: QBW Description: Indicates the total amount of the transaction. This includes the total of all the charges, allowances and taxes.
Calculated by QuickBooks business logic; cannot be written to QuickBooks. Filterable: QBW Sortable: QBW

### HomeTotalAmt

**Type:** `decimal`

**Required:** No

Product: ALL Description: Total amount of the transaction in the home currency for multi-currency enabled companies. Single currency companies will not have this field. Includes the total of all the charges, allowances and taxes. Calculated by QuickBooks business logic. Cannot be written to QuickBooks.

### JournalEntryEx

**Type:** `IntuitAnyType`

**Required:** No

Internal use only: extension place holder for JournalEntry

## Example Request Body

```json
{
  "Id": "value",
  "SyncToken": "value",
  "MetaData": "value",
  "CustomField": "value",
  "AttachableRef": {
    "value": "123"
  }
}
```



## Code Examples

### Create (JavaScript/Node.js)

```javascript
const axios = require('axios');

const createJournalentry = async (realmId, accessToken, data) => {
  const response = await axios.post(
    `https://quickbooks.api.intuit.com/v3/company/${realmId}/journalentry`,
    data,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      params: { minorversion: 65 }
    }
  );

  return response.data;
};
```

### Read by ID

```javascript
const getJournalentry = async (realmId, id, accessToken) => {
  const response = await axios.get(
    `https://quickbooks.api.intuit.com/v3/company/${realmId}/journalentry/${id}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      },
      params: { minorversion: 65 }
    }
  );

  return response.data;
};
```

### Query

```javascript
const queryJournalentrys = async (realmId, accessToken) => {
  const query = "SELECT * FROM Journalentry MAXRESULTS 100";

  const response = await axios.get(
    `https://quickbooks.api.intuit.com/v3/company/${realmId}/query`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      },
      params: {
        query: query,
        minorversion: 65
      }
    }
  );

  return response.data;
};
```
