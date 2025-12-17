# Employee API Reference

## Description

Describes the Party as a Employee Role view

## API Endpoint

```
POST /v3/company/{realmId}/employee
GET /v3/company/{realmId}/employee/{id}
```

**Extends:** `NameBase`

## Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `Id` | `id` | No | Product: ALL Description: Unique Identifier for an Intuit entity (object).  Required for the update ... |
| `SyncToken` | `string` | No | Product: ALL Description: Version number of the entity. The SyncToken is used to lock the entity for... |
| `MetaData` | `ModificationMetaData` | No | Product: ALL Description: Descriptive information about the entity. The MetaData values are set by D... |
| `CustomField` | `CustomField` | No | Product: QBW Description: Custom field (or data extension). Filterable: QBW |
| `AttachableRef` | `AttachableRef` | No | Specifies entity name of the attachment from where the attachment was requested |
| `IntuitId` | `string` | No | Product: QBO Description: IntuitId represents the realm id, authid or an entity id. An entity is a n... |
| `Organization` | `boolean` | No | Product: QBW Description: True if the entity represents an organization; otherwise the entity repres... |
| `Title` | `string` | No | Product: ALL Description: QBW: Title of the person. The person can have zero or more titles. Descrip... |
| `GivenName` | `string` | No | Product: QBW Description: Given name or first name of a person. Max. length: 25 characters. At least... |
| `MiddleName` | `string` | No | Product: QBW Description: Middle name of the person. The person can have zero or more middle names. ... |
| `FamilyName` | `string` | No | Product: QBW Description: Family name or the last name of the person. Max. length: 25 characters. At... |
| `Suffix` | `string` | No | Product: QBO Description: Suffix appended to the name of a person. For example, Senior, Junior, etc.... |
| `FullyQualifiedName` | `string` | No | Product: ALL Description: Fully qualified name of the entity. The fully qualified name prepends the ... |
| `CompanyName` | `string` | No | Product: ALL Description: The name of the company associated with the person or organization. |
| `DisplayName` | `string` | No | Product: QBO Description: The name of the person or organization as displayed. If not provided, this... |
| `PrintOnCheckName` | `string` | No | Product: ALL Description: Name of the person or organization as printed on a check. If not provided,... |
| `UserId` | `string` | No | Product: QBW Description: The ID of the Intuit user associated with this name. Note: this is NOT the... |
| `Active` | `boolean` | No | Product: ALL Description: If true, this entity is currently enabled for use by QuickBooks. The defau... |
| `V4IDPseudonym` | `string` | No | Auto generated Public ID when a new customer/vendor/employee is added to QBO. (ReadOnly) |
| `PrimaryPhone` | `TelephoneNumber` | No | Product: ALL Description: Primary phone number. |
| `AlternatePhone` | `TelephoneNumber` | No | Product: ALL Description: Alternate phone number. |
| `Mobile` | `TelephoneNumber` | No | Product: ALL Description: Mobile phone number. |
| `Fax` | `TelephoneNumber` | No | Product: ALL Description: Fax number. |
| `PrimaryEmailAddr` | `EmailAddress` | No | Product: ALL Description: Primary email address. |
| `WebAddr` | `WebSiteAddress` | No | Product: ALL Description: Website address (URI). |
| `OtherContactInfo` | `ContactInfo` | No | Product: QBW Description: List of ContactInfo entities of any contact info type. The ContactInfo Typ... |
| `DefaultTaxCodeRef` | `ReferenceType` | No | Product: ALL Description: Reference to the tax code associated with the Customer or Vendor by defaul... |
| `EmployeeType` | `string` | No | Specifies the Employee type. For QuickBooks Desktop the valid values are defined in the EmployeeType... |
| `EmployeeNumber` | `string` | No | Specifies the number of the employee (or account) in the employer's directory. Length Restriction: Q... |
| `SSN` | `string` | No | Specifies the SSN of the employee. Length Restriction: QBO: 15 QBD: 1024 |
| `PrimaryAddr` | `PhysicalAddress` | No | Represents primary PhysicalAddress list |
| `OtherAddr` | `PhysicalAddress` | No | Represents other PhysicalAddress list |
| `BillableTime` | `boolean` | No | BillableTime should be true if this employee’s hours are typically billed to customers. QBO only. QB... |
| `BillRate` | `decimal` | No | If BillableTime is true, BillRate can be set to specify this employee’s hourly billing rate. QBO onl... |
| `BirthDate` | `date` | No | Employee birth date |
| `Gender` | `gender` | No | Gender details |
| `HiredDate` | `date` | No | Employee hired date |
| `ReleasedDate` | `date` | No | Date at which employee was releaved from the company |
| `UseTimeEntry` | `TimeEntryUsedForPaychecksEnum` | No | Specifies whether the Time Entry (time sheets) should be used to create paychecks for the employee. |
| `EmployeeEx` | `IntuitAnyType` | No | Internal use only: extension place holder for Employee. |
| `CostRate` | `decimal` | No | Hourly cost rate of the Employee. QBO only. QBD Unsupporetd field. |
| `Notes` | `string` | No | Product: ALL Description: Free form text describing the Employee. Max. length: 4000 characters. |

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

### IntuitId

**Type:** `string`

**Required:** No

Product: QBO Description: IntuitId represents the realm id, authid or an entity id. An entity is a new type of IAM identity that represents a person or a business which has no Intuit authentication context

### Organization

**Type:** `boolean`

**Required:** No

Product: QBW Description: True if the entity represents an organization; otherwise the entity represents a person. Default is NULL or False, representing a person.

### Title

**Type:** `string`

**Required:** No

Product: ALL Description: QBW: Title of the person. The person can have zero or more titles. Description: QBO: Title of the person. The person can have zero or more titles. InputType: ReadWrite ValidRange: QBW: Min=0, Max=15 ValidationRules: QBW: At least one of the name elements is required: Title, GivenName, MiddleName, or FamilyName. ValidationRules: QBO: At least one of the name elements is required: Title, GivenName, MiddleName, FamilyName, or Suffix. I18n: ALL

### GivenName

**Type:** `string`

**Required:** No

Product: QBW Description: Given name or first name of a person.
Max. length: 25 characters.
At least one of the name elements is required: Title, GivenName, MiddleName, or FamilyName. Product: QBO Description: Given name or first name of a person.
Max. length: 25 characters.
At least one of the name elements is required: Title, GivenName, MiddleName, FamilyName, or Suffix. Filterable: ALL Sortable: ALL

### MiddleName

**Type:** `string`

**Required:** No

Product: QBW Description: Middle name of the person. The person can have zero or more middle names.
Max. length: 5 characters.
At least one of the name elements is required: Title, GivenName, MiddleName, or FamilyName. Product: QBO Description: Middle name of the person. The person can have zero or more middle names.
Max. length: 15 characters.
At least one of the name elements is required: Title, GivenName, MiddleName, FamilyName, or Suffix. Filterable: ALL Sortable: ALL

### FamilyName

**Type:** `string`

**Required:** No

Product: QBW Description: Family name or the last name of the person.
Max. length: 25 characters.
At least one of the name elements is required: Title, GivenName, MiddleName, or FamilyName. Product: QBO Description: Family name or the last name of the person.
Max. length: 15 characters.
At least one of the name elements is required: Title, GivenName, MiddleName, FamilyName, or Suffix. Filterable: ALL Sortable: ALL

### Suffix

**Type:** `string`

**Required:** No

Product: QBO Description: Suffix appended to the name of a person. For example, Senior, Junior, etc. QBO only field.
Max. length: 15 characters.
At least one of the name elements is required: Title, GivenName, MiddleName, FamilyName, or Suffix.

### FullyQualifiedName

**Type:** `string`

**Required:** No

Product: ALL Description: Fully qualified name of the entity. The fully qualified name prepends the topmost parent, followed by each sub element separated by colons. Takes the form of Parent:Customer:Job:Sub-job. Limited to 5 levels.
Max. length: 41 characters (single name) or 209 characters (fully qualified name).

### CompanyName

**Type:** `string`

**Required:** No

Product: ALL Description: The name of the company associated with the person or organization.

### DisplayName

**Type:** `string`

**Required:** No

Product: QBO Description: The name of the person or organization as displayed. If not provided, this is populated from FullName. Product: QBW Description: The name of the person or organization as displayed. Required: ALL Filterable: QBW

### PrintOnCheckName

**Type:** `string`

**Required:** No

Product: ALL Description: Name of the person or organization as printed on a check. If not provided, this is populated from FullName.

### UserId

**Type:** `string`

**Required:** No

Product: QBW Description: The ID of the Intuit user associated with this name. Note: this is NOT the Intuit AuthID of the user.

### Active

**Type:** `boolean`

**Required:** No

Product: ALL Description: If true, this entity is currently enabled for use by QuickBooks. The default value is true. Filterable: QBW

### V4IDPseudonym

**Type:** `string`

**Required:** No

Auto generated Public ID when a new customer/vendor/employee is added to QBO. (ReadOnly)

### PrimaryPhone

**Type:** `TelephoneNumber`

**Required:** No

Product: ALL Description: Primary phone number.

### AlternatePhone

**Type:** `TelephoneNumber`

**Required:** No

Product: ALL Description: Alternate phone number.

### Mobile

**Type:** `TelephoneNumber`

**Required:** No

Product: ALL Description: Mobile phone number.

### Fax

**Type:** `TelephoneNumber`

**Required:** No

Product: ALL Description: Fax number.

### PrimaryEmailAddr

**Type:** `EmailAddress`

**Required:** No

Product: ALL Description: Primary email address.

### WebAddr

**Type:** `WebSiteAddress`

**Required:** No

Product: ALL Description: Website address (URI).

### OtherContactInfo

**Type:** `ContactInfo`

**Required:** No

Product: QBW Description: List of ContactInfo entities of any contact info type. The ContactInfo Type values are defined in the ContactTypeEnum.

### DefaultTaxCodeRef

**Type:** `ReferenceType`

**Required:** No

Product: ALL Description: Reference to the tax code associated with the Customer or Vendor by default for sales or purchase taxes.

### EmployeeType

**Type:** `string`

**Required:** No

Specifies the Employee type. For QuickBooks Desktop the valid values are defined in the EmployeeTypeEnum.

### EmployeeNumber

**Type:** `string`

**Required:** No

Specifies the number of the employee (or account) in the employer's directory. Length Restriction: QBO: 15 QBD: 99

### SSN

**Type:** `string`

**Required:** No

Specifies the SSN of the employee. Length Restriction: QBO: 15 QBD: 1024

### PrimaryAddr

**Type:** `PhysicalAddress`

**Required:** No

Represents primary PhysicalAddress list

### OtherAddr

**Type:** `PhysicalAddress`

**Required:** No

Represents other PhysicalAddress list

### BillableTime

**Type:** `boolean`

**Required:** No

BillableTime should be true if this employee’s hours are typically billed to customers. QBO only. QBD Unsupported field.

### BillRate

**Type:** `decimal`

**Required:** No

If BillableTime is true, BillRate can be set to specify this employee’s hourly billing rate. QBO only. QBD Unsupported field.

### BirthDate

**Type:** `date`

**Required:** No

Employee birth date

### Gender

**Type:** `gender`

**Required:** No

Gender details

### HiredDate

**Type:** `date`

**Required:** No

Employee hired date

### ReleasedDate

**Type:** `date`

**Required:** No

Date at which employee was releaved from the company

### UseTimeEntry

**Type:** `TimeEntryUsedForPaychecksEnum`

**Required:** No

Specifies whether the Time Entry (time sheets) should be used to create paychecks for the employee.

### EmployeeEx

**Type:** `IntuitAnyType`

**Required:** No

Internal use only: extension place holder for Employee.

### CostRate

**Type:** `decimal`

**Required:** No

Hourly cost rate of the Employee. QBO only. QBD Unsupporetd field.

### Notes

**Type:** `string`

**Required:** No

Product: ALL Description: Free form text describing the Employee.
Max. length: 4000 characters.

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

const createEmployee = async (realmId, accessToken, data) => {
  const response = await axios.post(
    `https://quickbooks.api.intuit.com/v3/company/${realmId}/employee`,
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
const getEmployee = async (realmId, id, accessToken) => {
  const response = await axios.get(
    `https://quickbooks.api.intuit.com/v3/company/${realmId}/employee/${id}`,
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
const queryEmployees = async (realmId, accessToken) => {
  const query = "SELECT * FROM Employee MAXRESULTS 100";

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
