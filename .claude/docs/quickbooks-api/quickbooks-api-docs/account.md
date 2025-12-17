# Account API Reference

## Description

Account is a component of a Chart Of Accounts, and is part of a Ledger. Used to record a total monetary amount allocated against a specific use. Accounts are one of five basic types: asset, liability, revenue (income), expenses, or equity.

## API Endpoint

```
POST /v3/company/{realmId}/account
GET /v3/company/{realmId}/account/{id}
```

**Extends:** `IntuitEntity`

## Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `Id` | `id` | No | Product: ALL Description: Unique Identifier for an Intuit entity (object).  Required for the update ... |
| `SyncToken` | `string` | No | Product: ALL Description: Version number of the entity. The SyncToken is used to lock the entity for... |
| `MetaData` | `ModificationMetaData` | No | Product: ALL Description: Descriptive information about the entity. The MetaData values are set by D... |
| `CustomField` | `CustomField` | No | Product: QBW Description: Custom field (or data extension). Filterable: QBW |
| `AttachableRef` | `AttachableRef` | No | Specifies entity name of the attachment from where the attachment was requested |
| `Name` | `string` | No | User recognizable name for the Account.  Product: ALL Required: ALL Filterable: QBW ValidRange: QBW:... |
| `SubAccount` | `boolean` | No | Product: ALL Description: Specifies the Account is a SubAccount or Not. True if subaccount, false or... |
| `ParentRef` | `ReferenceType` | No | Product: ALL Description: Specifies the Parent AccountId if this represents a SubAccount. Else null ... |
| `Description` | `string` | No | Product: ALL Description: User entered description for the account, which may include user entered i... |
| `FullyQualifiedName` | `string` | No | Product: ALL Description: Fully qualified name of the entity. The fully qualified name prepends the ... |
| `AccountAlias` | `string` | No | Product: ALL Description: Display Name of the account that will be shown in Transaction Forms based ... |
| `TxnLocationType` | `string` | No | Product: ALL Description: Location Type for the Transaction. ValidRange: QBO: Max=50 |
| `Active` | `boolean` | No | Product: ALL Description: Whether or not active inactive accounts may be hidden from most display pu... |
| `Classification` | `AccountClassificationEnum` | No | Product: ALL Description: 5 types of classification an account classified. Suggested examples of acc... |
| `AccountType` | `AccountTypeEnum` | No | Product: ALL Description: Type is a detailed account classification that specifies the use of this a... |
| `AccountSubType` | `string` | No | Product: QBO Description: AccountSubTypeEnum specificies QBO on detail type. If not specified defaul... |
| `AccountPurposes` | `ReferenceType` | No | Product: QBO Description: Internal use only: Account purpose indicates the mapping of the chart-of-a... |
| `AcctNum` | `string` | No | Product: ALL Description: User entered/specified account number to help the user in identifying the ... |
| `AcctNumExtn` | `string` | No | Product: QBO Description: An extension to the base account number that can be added to Customer A/R ... |
| `BankNum` | `string` | No | Product: QBW Description: Bank Account Number, should include routing number whatever else depending... |
| `OpeningBalance` | `decimal` | No | Product: ALL Description: Specifies the Opening Balance amount when creating a new Balance Sheet acc... |
| `OpeningBalanceDate` | `date` | No | Product: ALL Description: Specifies the Date of the Opening Balance amount when creating a new Balan... |
| `CurrentBalance` | `decimal` | No | Product: ALL Description: Specifies the balance amount for the current Account. Valid for Balance Sh... |
| `CurrentBalanceWithSubAccounts` | `decimal` | No | Product: ALL Description: Specifies the cumulative balance amount for the current Account and all it... |
| `CurrencyRef` | `ReferenceType` | No | Product: ALL Description: Reference to the Currency that this account will hold the amounts in. |
| `TaxAccount` | `boolean` | No | Product: ALL Description: Describes if the account is taxable |
| `TaxCodeRef` | `ReferenceType` | No | Product: QBW Description: If the account is taxable, refers to taxcode reference if applicable I18n:... |
| `OnlineBankingEnabled` | `boolean` | No | Product: ALL Description: Indicates if the Account is linked with Online Banking feature (automatica... |
| `FIName` | `string` | No | Product: ALL Description: Indicates the name of financial institution name if Account is linked with... |
| `JournalCodeRef` | `ReferenceType` | No | Product: QBO Description: The Journal Code that is associated with the account. This is required onl... |
| `AccountEx` | `IntuitAnyType` | No | Product: ALL Description: extension place holder for Account. |

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

### Name

**Type:** `string`

**Required:** No

User recognizable name for the Account.
 Product: ALL Required: ALL Filterable: QBW ValidRange: QBW: Max=31 ValidRange: QBO: Max=100

### SubAccount

**Type:** `boolean`

**Required:** No

Product: ALL Description: Specifies the Account is a SubAccount or Not. True if subaccount, false or null if it is top-level account

### ParentRef

**Type:** `ReferenceType`

**Required:** No

Product: ALL Description: Specifies the Parent AccountId if this represents a SubAccount. Else null or empty

### Description

**Type:** `string`

**Required:** No

Product: ALL Description: User entered description for the account, which may include user entered information to guide bookkeepers/accountants in deciding what journal entries to post to the account. ValidRange: QBW: Max=200 ValidRange: QBO: Max=100

### FullyQualifiedName

**Type:** `string`

**Required:** No

Product: ALL Description: Fully qualified name of the entity. The fully qualified name prepends the topmost parent, followed by each sub element separated by colons. Takes the form of: 
 Parent:Account1:SubAccount1:SubAccount2 InputType: ReadOnly

### AccountAlias

**Type:** `string`

**Required:** No

Product: ALL Description: Display Name of the account that will be shown in Transaction Forms based on Account Category ValidRange: QBO: Max=100

### TxnLocationType

**Type:** `string`

**Required:** No

Product: ALL Description: Location Type for the Transaction. ValidRange: QBO: Max=50

### Active

**Type:** `boolean`

**Required:** No

Product: ALL Description: Whether or not active inactive accounts may be hidden from most display purposes and may not be posted to. Filterable: QBW

### Classification

**Type:** `AccountClassificationEnum`

**Required:** No

Product: ALL Description: 5 types of classification an account classified. Suggested examples of account type are Asset, Equity, Expense, Liability, Revenue Filterable: QBW

### AccountType

**Type:** `AccountTypeEnum`

**Required:** No

Product: ALL Description: Type is a detailed account classification that specifies the use of this account. 16 type of account subtypes available in AccountTypeEnum Filterable: QBW Required: ALL

### AccountSubType

**Type:** `string`

**Required:** No

Product: QBO Description: AccountSubTypeEnum specificies QBO on detail type. If not specified default value are listed for each SubType

### AccountPurposes

**Type:** `ReferenceType`

**Required:** No

Product: QBO Description: Internal use only: Account purpose indicates the mapping of the chart-of-account to a purpose (eg: DEFAULT_QB_CASH_CHECKING_ACCOUNT). A chart-of-account can have multiple account purpose mapping.

### AcctNum

**Type:** `string`

**Required:** No

Product: ALL Description: User entered/specified account number to help the user in identifying the account within the chart-of-accounts and in deciding what should be posted to the account.

### AcctNumExtn

**Type:** `string`

**Required:** No

Product: QBO Description: An extension to the base account number that can be added to Customer A/R or Supplier A/P accounts.

### BankNum

**Type:** `string`

**Required:** No

Product: QBW Description: Bank Account Number, should include routing number whatever else depending upon the context, this may be the credit card number or the checking account number, etc. ValidRange: QBW: max=25

### OpeningBalance

**Type:** `decimal`

**Required:** No

Product: ALL Description: Specifies the Opening Balance amount when creating a new Balance Sheet account.

### OpeningBalanceDate

**Type:** `date`

**Required:** No

Product: ALL Description: Specifies the Date of the Opening Balance amount when creating a new Balance Sheet account.

### CurrentBalance

**Type:** `decimal`

**Required:** No

Product: ALL Description: Specifies the balance amount for the current Account. Valid for Balance Sheet accounts. InputType: QBW: ReadOnly

### CurrentBalanceWithSubAccounts

**Type:** `decimal`

**Required:** No

Product: ALL Description: Specifies the cumulative balance amount for the current Account and all its sub-accounts. InputType: QBW: ReadOnly

### CurrencyRef

**Type:** `ReferenceType`

**Required:** No

Product: ALL Description: Reference to the Currency that this account will hold the amounts in.

### TaxAccount

**Type:** `boolean`

**Required:** No

Product: ALL Description: Describes if the account is taxable

### TaxCodeRef

**Type:** `ReferenceType`

**Required:** No

Product: QBW Description: If the account is taxable, refers to taxcode reference if applicable I18n: QBW: GlobalOnly

### OnlineBankingEnabled

**Type:** `boolean`

**Required:** No

Product: ALL Description: Indicates if the Account is linked with Online Banking feature (automatically download transactions) of QuickBooks Online or QuickBooks Desktop. Null or false indicates not linked with online banking. True if Online banking based download is enabled for this account. InputType: ALL: ReadOnly

### FIName

**Type:** `string`

**Required:** No

Product: ALL Description: Indicates the name of financial institution name if Account is linked with Online banking. Valid only if account is online banking enabled. This is optional and read-only. InputType: ALL: ReadOnly

### JournalCodeRef

**Type:** `ReferenceType`

**Required:** No

Product: QBO Description: The Journal Code that is associated with the account. This is required only for Bank accounts. This is applicable only in FR. InputType: ALL: ReadOnly

### AccountEx

**Type:** `IntuitAnyType`

**Required:** No

Product: ALL Description: extension place holder for Account.

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

### Create an Account (JavaScript/Node.js)

```javascript
const axios = require('axios');

const createAccount = async (realmId, accessToken) => {
  const account = {
    "Name": "Inventory Asset",
    "AccountType": "Other Current Asset",
    "AccountSubType": "Inventory"
  };

  const response = await axios.post(
    `https://quickbooks.api.intuit.com/v3/company/${realmId}/account`,
    account,
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

### Query Accounts

```javascript
const queryAccounts = async (realmId, accessToken) => {
  const query = "SELECT * FROM Account WHERE AccountType = 'Bank' MAXRESULTS 100";

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
