# TaxAgency API Reference

## Description

Product: ALL Description: Represents a tax agency to whom sales/purchase/VAT taxes collected are paid

## API Endpoint

```
POST /v3/company/{realmId}/taxagency
GET /v3/company/{realmId}/taxagency/{id}
```

**Extends:** `Vendor`

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
| `ContactName` | `string` | No | Name of the contact within the vendor. Used by QBD only |
| `AltContactName` | `string` | No | Name of the Alternate contact within the vendor. Used by QBD only |
| `Notes` | `string` | No | Product: ALL Description: Free form text describing the Vendor. Max. length: 1024 characters. |
| `BillAddr` | `PhysicalAddress` | No | Product: ALL Description: Default billing address. |
| `ShipAddr` | `PhysicalAddress` | No | Product: ALL Description: Default shipping address. |
| `OtherAddr` | `PhysicalAddress` | No | Product: QBW only. Description: An address other than default billing or shipping. |
| `TaxCountry` | `string` | No | Product: QBW. Description: Country of Vendor. |
| `TaxIdentifier` | `string` | No | Specifies the Tax ID of the Person or Organization |
| `TaxIdEffectiveDate` | `date` | No | Product: QBO Description: Specifies the date of registeration of Supplier. Applicable for IN Region ... |
| `BusinessNumber` | `string` | No | Product: QBW. Description: Business Number of the Vendor. Applicable for CA/UK versions of QuickBook... |
| `ParentRef` | `ReferenceType` | No |  |
| `VendorTypeRef` | `ReferenceType` | No | Product: QBW. Description: Reference to the VendorType. |
| `TermRef` | `ReferenceType` | No |  |
| `PrefillAccountRef` | `ReferenceType` | No | Product: QBW. Description: Reference to the PrefillAccount. |
| `Balance` | `decimal` | No | Product: ALL Description: Specifies the open balance amount or the amount unpaid by the vendor. For ... |
| `BillRate` | `decimal` | No | BillRate can be set to specify this vendor's hourly billing rate. |
| `OpenBalanceDate` | `date` | No | Specifies the date of the Open Balance. Non QB-writable. |
| `CreditLimit` | `decimal` | No | Specifies the maximum amount of an unpaid vendor balance. |
| `AcctNum` | `string` | No | Name or number of the account associated with this vendor. Length Restriction: QBO: 15 QBD: 1024 |
| `Vendor1099` | `boolean` | No | The Vendor is an independent contractor, someone who is given a 1099-MISC form at the end of the yea... |
| `T4AEligible` | `boolean` | No | Product: QBW Description: True if vendor is T4A eligible. Applicable for CA/UK versions of quickbook... |
| `T5018Eligible` | `boolean` | No | Product: QBW Description: True if vendor is T5018 eligible. Applicable for CA/UK versions of quickbo... |
| `CurrencyRef` | `ReferenceType` | No | Reference to the currency all the business transactions created for or received from that vendor are... |
| `TDSEnabled` | `boolean` | No | Product: QBO Description: True, if TDS (Tax Deducted at Source) is enabled for this Vendor. If enabl... |
| `TDSEntityTypeId` | `int` | No | Product: QBO Description: Entity Type of the Vendor. |
| `TDSSectionTypeId` | `int` | No | Product: QBO Description: Default TDS section type for the vendor to be used in transaction. |
| `TDSOverrideThreshold` | `boolean` | No | Product: QBO Description: True, if TDS threshold calculation should be overriden. |
| `TaxReportingBasis` | `string` | No | Product: QBO Description: The tax reporting basis for the supplier. The applicable values are those ... |
| `APAccountRef` | `ReferenceType` | No | Product: QBO Description: The A/P account ID for the supplier. This is applicable only in FR where e... |
| `VendorEx` | `IntuitAnyType` | No | Internal use only: extension place holder for Vendor. |
| `GSTIN` | `string` | No | GST Identification Number of the Vendor. Applicable for IN region only. |
| `GSTRegistrationType` | `string` | No | GST registration type of the Vendor. Applicable for IN region only. |
| `IsSubContractor` | `boolean` | No | Product: QBO only Description: True if the vendor is subcontractor |
| `SubcontractorType` | `string` | No | Specifies the Subcontractor type. Applicable only for UK region, values are defined in the Subcontra... |
| `CISRate` | `string` | No | Specifies the CIS Rate. Applicable only for UK region, values are defined in the CISRateEnum. |
| `HasTPAR` | `boolean` | No | Product: QBO Only Description: True if the Vendor has TPAR. Applicable for AU region only. |
| `VendorPaymentBankDetail` | `VendorBankAccountDetail` | No | Product: QBO Only Description: Contains Bank Account details to enable Vendor Batch Payment. Applica... |
| `Source` | `string` | No | Product: QBO Description: Originating source of the Vendor. Valid values are defined in SourceTypeEn... |
| `CostRate` | `decimal` | No | Hourly cost rate of the Employee. QBO only. QBD Unsupporetd field. |
| `AgencyVerificationStatus` | `AgencyVerificationStatus` | No | Subcontractor's agency verification status for CIS |
| `AgencyVerificationStatusMsg` | `string` | No | Subcontractor's agency verification status detailed message for CIS |
| `AgencyVerificationTSUTC` | `dateTime` | No | Latest timestamp for subcontractor's agency verification for CIS |
| `CompanyRegistrationNumber` | `string` | No | Company registration number for CIS |
| `SalesTaxCodeRef` | `ReferenceType` | No |  |
| `SalesTaxCountry` | `string` | No | We'll need an Enum for the usual countries |
| `SalesTaxReturnRef` | `ReferenceType` | No |  |
| `TaxRegistrationNumber` | `string` | No |  |
| `ReportingPeriod` | `string` | No | We'll need an Enum for the reporting periods |
| `TaxTrackedOnPurchases` | `boolean` | No |  |
| `TaxOnPurchasesAccountRef` | `ReferenceType` | No |  |
| `TaxTrackedOnSales` | `boolean` | No |  |
| `TaxTrackedOnSalesAccountRef` | `ReferenceType` | No |  |
| `TaxOnTax` | `boolean` | No |  |
| `LastFileDate` | `date` | No | Product: QBO Description: This specifies the last filing date for this tax agency. InputType: QBO: R... |
| `TaxAgencyExt` | `IntuitAnyType` | No |  |
| `TaxAgencyConfig` | `string` | No | Product: QBO Description: Tax agency config. Identify if the agency is System generated or User crea... |

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

### ContactName

**Type:** `string`

**Required:** No

Name of the contact within the vendor. Used by QBD only

### AltContactName

**Type:** `string`

**Required:** No

Name of the Alternate contact within the vendor. Used by QBD only

### Notes

**Type:** `string`

**Required:** No

Product: ALL Description: Free form text describing the Vendor.
Max. length: 1024 characters.

### BillAddr

**Type:** `PhysicalAddress`

**Required:** No

Product: ALL Description: Default billing address.

### ShipAddr

**Type:** `PhysicalAddress`

**Required:** No

Product: ALL Description: Default shipping address.

### OtherAddr

**Type:** `PhysicalAddress`

**Required:** No

Product: QBW only. Description: An address other than default billing or shipping.

### TaxCountry

**Type:** `string`

**Required:** No

Product: QBW. Description: Country of Vendor.

### TaxIdentifier

**Type:** `string`

**Required:** No

Specifies the Tax ID of the Person or Organization

### TaxIdEffectiveDate

**Type:** `date`

**Required:** No

Product: QBO Description: Specifies the date of registeration of Supplier. Applicable for IN Region and in future can be extended to other regions.

### BusinessNumber

**Type:** `string`

**Required:** No

Product: QBW. Description: Business Number of the Vendor. Applicable for CA/UK versions of QuickBooks.

### VendorTypeRef

**Type:** `ReferenceType`

**Required:** No

Product: QBW. Description: Reference to the VendorType.

### PrefillAccountRef

**Type:** `ReferenceType`

**Required:** No

Product: QBW. Description: Reference to the PrefillAccount.

### Balance

**Type:** `decimal`

**Required:** No

Product: ALL Description: Specifies the open balance amount or the amount unpaid by the vendor. For the create operation, this represents the opening balance for the vendor. When returned in response to the query request it represents the current open balance (unpaid amount) for that vendor. Filterable: QBW Sortable: QBW

### BillRate

**Type:** `decimal`

**Required:** No

BillRate can be set to specify this vendor's hourly billing rate.

### OpenBalanceDate

**Type:** `date`

**Required:** No

Specifies the date of the Open Balance. Non QB-writable.

### CreditLimit

**Type:** `decimal`

**Required:** No

Specifies the maximum amount of an unpaid vendor balance.

### AcctNum

**Type:** `string`

**Required:** No

Name or number of the account associated with this vendor. Length Restriction: QBO: 15 QBD: 1024

### Vendor1099

**Type:** `boolean`

**Required:** No

The Vendor is an independent contractor, someone who is given a 1099-MISC form at the end of the year. The "1099 Vendor" is paid with regular checks, and taxes are not withhold on their behalf.

### T4AEligible

**Type:** `boolean`

**Required:** No

Product: QBW Description: True if vendor is T4A eligible. Applicable for CA/UK versions of quickbooks.

### T5018Eligible

**Type:** `boolean`

**Required:** No

Product: QBW Description: True if vendor is T5018 eligible. Applicable for CA/UK versions of quickbooks.

### CurrencyRef

**Type:** `ReferenceType`

**Required:** No

Reference to the currency all the business transactions created for or received from that vendor are created in.

### TDSEnabled

**Type:** `boolean`

**Required:** No

Product: QBO Description: True, if TDS (Tax Deducted at Source) is enabled for this Vendor. If enabled, TDS metadata needs to be passsed in VendorEx field.

### TDSEntityTypeId

**Type:** `int`

**Required:** No

Product: QBO Description: Entity Type of the Vendor.

### TDSSectionTypeId

**Type:** `int`

**Required:** No

Product: QBO Description: Default TDS section type for the vendor to be used in transaction.

### TDSOverrideThreshold

**Type:** `boolean`

**Required:** No

Product: QBO Description: True, if TDS threshold calculation should be overriden.

### TaxReportingBasis

**Type:** `string`

**Required:** No

Product: QBO Description: The tax reporting basis for the supplier. The applicable values are those exposed through the TaxReportBasisTypeEnum. This is applicable only in FR.

### APAccountRef

**Type:** `ReferenceType`

**Required:** No

Product: QBO Description: The A/P account ID for the supplier. This is applicable only in FR where each supplier needs to have his own AP account.

### VendorEx

**Type:** `IntuitAnyType`

**Required:** No

Internal use only: extension place holder for Vendor.

### GSTIN

**Type:** `string`

**Required:** No

GST Identification Number of the Vendor. Applicable for IN region only.

### GSTRegistrationType

**Type:** `string`

**Required:** No

GST registration type of the Vendor. Applicable for IN region only.

### IsSubContractor

**Type:** `boolean`

**Required:** No

Product: QBO only Description: True if the vendor is subcontractor

### SubcontractorType

**Type:** `string`

**Required:** No

Specifies the Subcontractor type. Applicable only for UK region, values are defined in the SubcontractorTypeEnum.

### CISRate

**Type:** `string`

**Required:** No

Specifies the CIS Rate. Applicable only for UK region, values are defined in the CISRateEnum.

### HasTPAR

**Type:** `boolean`

**Required:** No

Product: QBO Only Description: True if the Vendor has TPAR. Applicable for AU region only.

### VendorPaymentBankDetail

**Type:** `VendorBankAccountDetail`

**Required:** No

Product: QBO Only Description: Contains Bank Account details to enable Vendor Batch Payment. Applicable for AU region only.

### Source

**Type:** `string`

**Required:** No

Product: QBO Description: Originating source of the Vendor. Valid values are defined in SourceTypeEnum

### CostRate

**Type:** `decimal`

**Required:** No

Hourly cost rate of the Employee. QBO only. QBD Unsupporetd field.

### AgencyVerificationStatus

**Type:** `AgencyVerificationStatus`

**Required:** No

Subcontractor's agency verification status for CIS

### AgencyVerificationStatusMsg

**Type:** `string`

**Required:** No

Subcontractor's agency verification status detailed message for CIS

### AgencyVerificationTSUTC

**Type:** `dateTime`

**Required:** No

Latest timestamp for subcontractor's agency verification for CIS

### CompanyRegistrationNumber

**Type:** `string`

**Required:** No

Company registration number for CIS

### SalesTaxCountry

**Type:** `string`

**Required:** No

We'll need an Enum for the usual countries

### ReportingPeriod

**Type:** `string`

**Required:** No

We'll need an Enum for the reporting periods

### LastFileDate

**Type:** `date`

**Required:** No

Product: QBO Description: This specifies the last filing date for this tax agency. InputType: QBO: ReadOnly

### TaxAgencyConfig

**Type:** `string`

**Required:** No

Product: QBO Description: Tax agency config. Identify if the agency is System generated or User created.

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

const createTaxagency = async (realmId, accessToken, data) => {
  const response = await axios.post(
    `https://quickbooks.api.intuit.com/v3/company/${realmId}/taxagency`,
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
const getTaxagency = async (realmId, id, accessToken) => {
  const response = await axios.get(
    `https://quickbooks.api.intuit.com/v3/company/${realmId}/taxagency/${id}`,
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
const queryTaxagencys = async (realmId, accessToken) => {
  const query = "SELECT * FROM Taxagency MAXRESULTS 100";

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
