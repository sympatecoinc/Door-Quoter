# CompanyInfo API Reference

## Description

Describes Company information

## API Endpoint

```
POST /v3/company/{realmId}/companyinfo
GET /v3/company/{realmId}/companyinfo/{id}
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
| `CompanyName` | `string` | No | Product: ALL Description: Name of the company. Max. length: 1024 characters. |
| `LegalName` | `string` | No | LegalName if different from the CompanyName |
| `CompanyAddr` | `PhysicalAddress` | No | Company Address as described in preference |
| `CustomerCommunicationAddr` | `PhysicalAddress` | No | Address of the company as given to th customer, sometimes the address given to the customer mail add... |
| `LegalAddr` | `PhysicalAddress` | No | Legal Address given to the government for any government communication |
| `CompanyEmailAddr` | `EmailAddress` | No | CompanyEmail Address |
| `CustomerCommunicationEmailAddr` | `EmailAddress` | No | Email Address published to customer for communication if different from CompanyEmailAddress |
| `CompanyURL` | `WebSiteAddress` | No | Company URL |
| `PrimaryPhone` | `TelephoneNumber` | No | Primary Phone number |
| `OtherContactInfo` | `ContactInfo` | No | Product: QBW Description: List of ContactInfo entities of any contact info type. The ContactInfo Typ... |
| `CompanyFileName` | `string` | No | Product: QBW Description: QuickBooks company file name. Data Services max. length: 512 characters. |
| `FlavorStratum` | `string` | No | Product: QBW Description: QB software flavor being used on the file on the PC. Data Services max. le... |
| `SampleFile` | `boolean` | No | Product: QBW Description: if the QB desktop file is a sample file. |
| `CompanyUserId` | `string` | No | Product: QBW Description: IAM or QBN admin users id sequence number to group many external realms fo... |
| `CompanyUserAdminEmail` | `string` | No | Product: QBW Description: IAM or QBN admin users email. Data Services max. length: 100 characters. |
| `CompanyStartDate` | `date` | No | Product: ALL Description: DateTime when the company file was created. |
| `EmployerId` | `string` | No | Product: ALL Description: Employer identifier (EID). |
| `FiscalYearStartMonth` | `MonthEnum` | No | Product: ALL Description: Starting month of the company's fiscal year. |
| `TaxYearStartMonth` | `MonthEnum` | No | Product: ALL Description: Starting month of the company's fiscal year. |
| `QBVersion` | `string` | No | Product: ALL Description: QuickBooks company file latest version. The format reports the major relea... |
| `Country` | `string` | No | Product: ALL Description: Country name to which the company belongs for fiancial calculations. |
| `ShipAddr` | `PhysicalAddress` | No | Product: ALL Description: Default shipping address. |
| `OtherAddr` | `PhysicalAddress` | No | Product: ALL Description: Other company addresses. |
| `Mobile` | `TelephoneNumber` | No | Product: ALL Description: Default mobile phone number of the company. |
| `Fax` | `TelephoneNumber` | No | Product: ALL Description: Default fax number. |
| `Email` | `EmailAddress` | No | Product: ALL Description: Default email address. |
| `WebAddr` | `WebSiteAddress` | No | Product: ALL Description: Default company web site address. |
| `LastImportedTime` | `dateTime` | No | Product: ALL Description: Specifies last imported time. |
| `LastSyncTime` | `dateTime` | No | Product: QBW Description: Specifies last sync time. |
| `SupportedLanguages` | `string` | No | Comma separated list of languages |
| `DefaultTimeZone` | `string` | No | Default time zone for the company |
| `MultiByteCharsSupported` | `boolean` | No | Specifies if the company support multibyte or not |
| `NameValue` | `NameValue` | No | Any other preference not covered in base is covered as name value pair, for detailed explanation loo... |
| `FifoCalculationStatus` | `FifoCalculationStatus` | No | Product: QBO Description: Status of the Inventory Lots and Accounts Calculation for STQ imported com... |
| `CompanyInfoEx` | `IntuitAnyType` | No | Product: ALL Description: Internal use only: extension place holder for Company. |

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

### CompanyName

**Type:** `string`

**Required:** No

Product: ALL Description: Name of the company.
Max. length: 1024 characters.

### LegalName

**Type:** `string`

**Required:** No

LegalName if different from the CompanyName

### CompanyAddr

**Type:** `PhysicalAddress`

**Required:** No

Company Address as described in preference

### CustomerCommunicationAddr

**Type:** `PhysicalAddress`

**Required:** No

Address of the company as given to th customer, sometimes the address given to the customer mail address is different from Company address

### LegalAddr

**Type:** `PhysicalAddress`

**Required:** No

Legal Address given to the government for any government communication

### CompanyEmailAddr

**Type:** `EmailAddress`

**Required:** No

CompanyEmail Address

### CustomerCommunicationEmailAddr

**Type:** `EmailAddress`

**Required:** No

Email Address published to customer for communication if different from CompanyEmailAddress

### CompanyURL

**Type:** `WebSiteAddress`

**Required:** No

Company URL

### PrimaryPhone

**Type:** `TelephoneNumber`

**Required:** No

Primary Phone number

### OtherContactInfo

**Type:** `ContactInfo`

**Required:** No

Product: QBW Description: List of ContactInfo entities of any contact info type. The ContactInfo Type values are defined in the ContactTypeEnum.

### CompanyFileName

**Type:** `string`

**Required:** No

Product: QBW Description: QuickBooks company file name.
Data Services max. length: 512 characters.

### FlavorStratum

**Type:** `string`

**Required:** No

Product: QBW Description: QB software flavor being used on the file on the PC.
Data Services max. length: 512 characters.

### SampleFile

**Type:** `boolean`

**Required:** No

Product: QBW Description: if the QB desktop file is a sample file.

### CompanyUserId

**Type:** `string`

**Required:** No

Product: QBW Description: IAM or QBN admin users id sequence number to group many external realms for this user under his id number.
Data Services max. length: 512 characters.

### CompanyUserAdminEmail

**Type:** `string`

**Required:** No

Product: QBW Description: IAM or QBN admin users email.
Data Services max. length: 100 characters.

### CompanyStartDate

**Type:** `date`

**Required:** No

Product: ALL Description: DateTime when the company file was created.

### EmployerId

**Type:** `string`

**Required:** No

Product: ALL Description: Employer identifier (EID).

### FiscalYearStartMonth

**Type:** `MonthEnum`

**Required:** No

Product: ALL Description: Starting month of the company's fiscal year.

### TaxYearStartMonth

**Type:** `MonthEnum`

**Required:** No

Product: ALL Description: Starting month of the company's fiscal year.

### QBVersion

**Type:** `string`

**Required:** No

Product: ALL Description: QuickBooks company file latest version. The format reports the major release in the first number, the minor release in the second number (always a zero), the release update (slipstream or "R") in the third number, and the build number in the final number.
Max. length: 512 characters.

### Country

**Type:** `string`

**Required:** No

Product: ALL Description: Country name to which the company belongs for fiancial calculations.

### ShipAddr

**Type:** `PhysicalAddress`

**Required:** No

Product: ALL Description: Default shipping address.

### OtherAddr

**Type:** `PhysicalAddress`

**Required:** No

Product: ALL Description: Other company addresses.

### Mobile

**Type:** `TelephoneNumber`

**Required:** No

Product: ALL Description: Default mobile phone number of the company.

### Fax

**Type:** `TelephoneNumber`

**Required:** No

Product: ALL Description: Default fax number.

### Email

**Type:** `EmailAddress`

**Required:** No

Product: ALL Description: Default email address.

### WebAddr

**Type:** `WebSiteAddress`

**Required:** No

Product: ALL Description: Default company web site address.

### LastImportedTime

**Type:** `dateTime`

**Required:** No

Product: ALL Description: Specifies last imported time.

### LastSyncTime

**Type:** `dateTime`

**Required:** No

Product: QBW Description: Specifies last sync time.

### SupportedLanguages

**Type:** `string`

**Required:** No

Comma separated list of languages

### DefaultTimeZone

**Type:** `string`

**Required:** No

Default time zone for the company

### MultiByteCharsSupported

**Type:** `boolean`

**Required:** No

Specifies if the company support multibyte or not

### NameValue

**Type:** `NameValue`

**Required:** No

Any other preference not covered in base is covered as name value pair, for detailed explanation look at the document

### FifoCalculationStatus

**Type:** `FifoCalculationStatus`

**Required:** No

Product: QBO Description: Status of the Inventory Lots and Accounts Calculation for STQ imported company.

### CompanyInfoEx

**Type:** `IntuitAnyType`

**Required:** No

Product: ALL Description: Internal use only: extension place holder for Company.

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

const createCompanyinfo = async (realmId, accessToken, data) => {
  const response = await axios.post(
    `https://quickbooks.api.intuit.com/v3/company/${realmId}/companyinfo`,
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
const getCompanyinfo = async (realmId, id, accessToken) => {
  const response = await axios.get(
    `https://quickbooks.api.intuit.com/v3/company/${realmId}/companyinfo/${id}`,
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
const queryCompanyinfos = async (realmId, accessToken) => {
  const query = "SELECT * FROM Companyinfo MAXRESULTS 100";

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
