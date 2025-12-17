# Customer API Reference

## Description

Product: ALL Description: QBO: The Customer entityrepresents the consumer of the service or the product that your business offers. QBO allows categorizing the customers in a way that is meaningful to the business. For example, you can set up a category of customers to indicate which industry a customer represents, the geographic location of a customer, or how a customer came to know about the business. The categorization can be then used for reports or mails. Description: QBW: The Customer entity is a consumer of the service or product that your business offers. While creating a customer, avoid entering job data. If you enter a job data, the system can prevent you from adding more jobs for that customer. You must first create the customer, and then create a job using that customer as a parent. Business Rules: 
- The customer name must be unique.
- The customer name must not contain a colon (:).
- The e-mail address of the customer must contain "@" and "." (dot).
- The customer address field is mandatory.

## API Endpoint

```
POST /v3/company/{realmId}/customer
GET /v3/company/{realmId}/customer/{id}
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
| `Taxable` | `boolean` | No | Product: QBO only Description: True if the customer is taxable. |
| `BillAddr` | `PhysicalAddress` | No | Product: ALL Description: Default billing address. |
| `ShipAddr` | `PhysicalAddress` | No | Product: ALL Description: Default shipping address. |
| `OtherAddr` | `PhysicalAddress` | No | Product: QBW only. Description: An address other than default billing or shipping. |
| `ContactName` | `string` | No | Product: QBW Description: Name of the Customer contact. |
| `AltContactName` | `string` | No | Product: QBW Description: Name of the Alternate Customer contact. |
| `Notes` | `string` | No | Product: ALL Description: Free form text describing the Customer. Max. length: 1024 characters. |
| `Job` | `boolean` | No | Product: ALL Description: If true, this is a Job or sub-customer. If false or null, this is a top le... |
| `BillWithParent` | `boolean` | No | Product: ALL Description: If true, this Customer is billed with its parent. If false, or null the cu... |
| `RootCustomerRef` | `ReferenceType` | No | Product: QBO Description: The top level Customer in the hierarchy to which this Job or sub customer ... |
| `ParentRef` | `ReferenceType` | No | Product: ALL Description: The immediate parent of the Sub-Customer/Job in the hierarchical "Customer... |
| `Level` | `int` | No | Product: ALL Description: Specifies the level of the hirearchy in which the entity is located. Zero ... |
| `CustomerTypeRef` | `ReferenceType` | No | Product: ALL Description: Reference to a CustomerType associated with the Customer. |
| `SalesTermRef` | `ReferenceType` | No | Product: ALL Description: Reference to a SalesTerm associated with the Customer. |
| `SalesRepRef` | `ReferenceType` | No | Product: QBW Description: Reference to a SalesRep associated with the Customer. |
| `PaymentMethodRef` | `ReferenceType` | No | Product: ALL Description: Reference to a PaymentMethod associated with the Customer. |
| `CCDetail` | `CreditChargeInfo` | No | Product: ALL Description: Credit-card information to request a credit card payment from a merchant a... |
| `PriceLevelRef` | `ReferenceType` | No | Product: QBW Description: Reference to a PriceLevel associated with the Customer. |
| `Balance` | `decimal` | No | Product: ALL Description: Specifies the open balance amount or the amount unpaid by the customer. Fo... |
| `OpenBalanceDate` | `date` | No | Product: ALL Description: Date of the Open Balance for the create operation. |
| `BalanceWithJobs` | `decimal` | No | Product: QBW Description: Cumulative open balance amount for the Customer (or Job) and all its sub-j... |
| `CreditLimit` | `decimal` | No | Product: QBW Description: Specifies the maximum amount of an unpaid customer balance. |
| `AcctNum` | `string` | No | Product: QBW Description: Name or number of the account associated with this customer. Max. length: ... |
| `CurrencyRef` | `ReferenceType` | No | Product: ALL Description: Reference to the currency code for all the business transactions created f... |
| `OverDueBalance` | `decimal` | No | Product: QBW Description: Over-due balance amount. Cannot be written to QuickBooks. |
| `TotalRevenue` | `decimal` | No | Product: QBW Description: The total revenue amount from the Customer. Cannot be written to QuickBook... |
| `TotalExpense` | `decimal` | No | Product: QBW Description: The total expense amount for the Customer. Cannot be written to QuickBooks... |
| `PreferredDeliveryMethod` | `string` | No | Product: ALL Description: Preferred delivery method. Vales are Print, Email, or None. |
| `ResaleNum` | `string` | No | Product: ALL Description: Resale number or some additional info about the customer. |
| `JobInfo` | `JobInfo` | No | Product: ALL Description: Information about the job. Relevant only if the Customer represents the ac... |
| `TDSEnabled` | `boolean` | No | Product: QBO Description: True, if TDS (Tax Deducted at Source) is enabled for this customer. |
| `CustomerEx` | `IntuitAnyType` | No | Product: ALL Description: Internal use only: extension place holder for Customer. |
| `SecondaryTaxIdentifier` | `string` | No | Product: QBO Description: Specifies secondary Tax ID of the Person or Organization. Applicable for I... |
| `ARAccountRef` | `ReferenceType` | No | Product: QBO Description: The A/R account ID for the customer. This is applicable only in FR where e... |
| `PrimaryTaxIdentifier` | `string` | No | Product: QBO Description: Specifies primary Tax ID of the Person or Organization. |
| `TaxExemptionReasonId` | `string` | No | Product: QBO Description: Specifies tax exemption reason to be associated with Customer |
| `IsProject` | `boolean` | No | Product: QBO Description: Specifies whether this customer is a project. |
| `BusinessNumber` | `string` | No | Business Number of the Customer. Applicable to CA/UK/IN versions of QuickBooks. Referred to as PAN i... |
| `GSTIN` | `string` | No | GST Identification Number of the Customer. Applicable for IN region only. |
| `GSTRegistrationType` | `string` | No | GST registration type of the Customer. Applicable for IN region only. |
| `IsCISContractor` | `boolean` | No | Product: QBO only Description: True if the customer is CIS contractor |
| `ClientCompanyId` | `string` | No | Internal use only: Applicable only for Accountant companies, Not null represents associated QBO comp... |
| `ClientEntityId` | `string` | No | Internal use only: Applicable only for Accountant companies, External reference for Customer. (ReadO... |
| `Source` | `string` | No | Product: QBO Description: Originating source of the Customer. Valid values are defined in SourceType... |
| `TaxRegime` | `string` | No | Product: QBO Description: Tax regime of a customer which is required by CFDI4.0 in Mexico. Visit htt... |
| `TaxGroupCodeRef` | `ReferenceType` | No | Product: QBW Description: US-only, reference to a TaxCode entity where the group field of the refere... |
| `TaxRateRef` | `ReferenceType` | No | Product: QBW Description: US-only, reference to a TaxRate entity indicating the sales tax to apply b... |

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

### Taxable

**Type:** `boolean`

**Required:** No

Product: QBO only Description: True if the customer is taxable.

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

### ContactName

**Type:** `string`

**Required:** No

Product: QBW Description: Name of the Customer contact.

### AltContactName

**Type:** `string`

**Required:** No

Product: QBW Description: Name of the Alternate Customer contact.

### Notes

**Type:** `string`

**Required:** No

Product: ALL Description: Free form text describing the Customer.
Max. length: 1024 characters.

### Job

**Type:** `boolean`

**Required:** No

Product: ALL Description: If true, this is a Job or sub-customer. If false or null, this is a top level customer, not a Job or sub-customer.

### BillWithParent

**Type:** `boolean`

**Required:** No

Product: ALL Description: If true, this Customer is billed with its parent. If false, or null the customer is not to be billed with its parent. This property is valid only if this entity is a Job or sub Customer.

### RootCustomerRef

**Type:** `ReferenceType`

**Required:** No

Product: QBO Description: The top level Customer in the hierarchy to which this Job or sub customer belongs.

### ParentRef

**Type:** `ReferenceType`

**Required:** No

Product: ALL Description: The immediate parent of the Sub-Customer/Job in the hierarchical "Customer:Job" list.
Required for the create operation if the Customer is a sub-customer or Job.

### Level

**Type:** `int`

**Required:** No

Product: ALL Description: Specifies the level of the hirearchy in which the entity is located. Zero specifies the top level of the hierarchy; anything above will be level with respect to the parent.

### CustomerTypeRef

**Type:** `ReferenceType`

**Required:** No

Product: ALL Description: Reference to a CustomerType associated with the Customer.

### SalesTermRef

**Type:** `ReferenceType`

**Required:** No

Product: ALL Description: Reference to a SalesTerm associated with the Customer.

### SalesRepRef

**Type:** `ReferenceType`

**Required:** No

Product: QBW Description: Reference to a SalesRep associated with the Customer.

### PaymentMethodRef

**Type:** `ReferenceType`

**Required:** No

Product: ALL Description: Reference to a PaymentMethod associated with the Customer.

### CCDetail

**Type:** `CreditChargeInfo`

**Required:** No

Product: ALL Description: Credit-card information to request a credit card payment from a merchant account service.

### PriceLevelRef

**Type:** `ReferenceType`

**Required:** No

Product: QBW Description: Reference to a PriceLevel associated with the Customer.

### Balance

**Type:** `decimal`

**Required:** No

Product: ALL Description: Specifies the open balance amount or the amount unpaid by the customer. For the create operation, this represents the opening balance for the customer. When returned in response to the query request it represents the current open balance (unpaid amount) for that customer. Filterable: QBW Sortable: QBW

### OpenBalanceDate

**Type:** `date`

**Required:** No

Product: ALL Description: Date of the Open Balance for the create operation.

### BalanceWithJobs

**Type:** `decimal`

**Required:** No

Product: QBW Description: Cumulative open balance amount for the Customer (or Job) and all its sub-jobs. Cannot be written to QuickBooks. Product: QBO Description: Cumulative open balance amount for the Customer (or Job) and all its sub-jobs. Filterable: ALL Non-default: ALL

### CreditLimit

**Type:** `decimal`

**Required:** No

Product: QBW Description: Specifies the maximum amount of an unpaid customer balance.

### AcctNum

**Type:** `string`

**Required:** No

Product: QBW Description: Name or number of the account associated with this customer.
Max. length: 99 characters.

### CurrencyRef

**Type:** `ReferenceType`

**Required:** No

Product: ALL Description: Reference to the currency code for all the business transactions created for or received from the customer.

### OverDueBalance

**Type:** `decimal`

**Required:** No

Product: QBW Description: Over-due balance amount. Cannot be written to QuickBooks.

### TotalRevenue

**Type:** `decimal`

**Required:** No

Product: QBW Description: The total revenue amount from the Customer. Cannot be written to QuickBooks.

### TotalExpense

**Type:** `decimal`

**Required:** No

Product: QBW Description: The total expense amount for the Customer. Cannot be written to QuickBooks.

### PreferredDeliveryMethod

**Type:** `string`

**Required:** No

Product: ALL Description: Preferred delivery method. Vales are Print, Email, or None.

### ResaleNum

**Type:** `string`

**Required:** No

Product: ALL Description: Resale number or some additional info about the customer.

### JobInfo

**Type:** `JobInfo`

**Required:** No

Product: ALL Description: Information about the job. Relevant only if the Customer represents the actual task or project, not just a person or organization.

### TDSEnabled

**Type:** `boolean`

**Required:** No

Product: QBO Description: True, if TDS (Tax Deducted at Source) is enabled for this customer.

### CustomerEx

**Type:** `IntuitAnyType`

**Required:** No

Product: ALL Description: Internal use only: extension place holder for Customer.

### SecondaryTaxIdentifier

**Type:** `string`

**Required:** No

Product: QBO Description: Specifies secondary Tax ID of the Person or Organization. Applicable for IN companies for CST Registration No. and in future can be extended to other regions.

### ARAccountRef

**Type:** `ReferenceType`

**Required:** No

Product: QBO Description: The A/R account ID for the customer. This is applicable only in FR where each customer needs to have his own AR account.

### PrimaryTaxIdentifier

**Type:** `string`

**Required:** No

Product: QBO Description: Specifies primary Tax ID of the Person or Organization.

### TaxExemptionReasonId

**Type:** `string`

**Required:** No

Product: QBO Description: Specifies tax exemption reason to be associated with Customer

### IsProject

**Type:** `boolean`

**Required:** No

Product: QBO Description: Specifies whether this customer is a project.

### BusinessNumber

**Type:** `string`

**Required:** No

Business Number of the Customer. Applicable to CA/UK/IN versions of QuickBooks. Referred to as PAN in India.

### GSTIN

**Type:** `string`

**Required:** No

GST Identification Number of the Customer. Applicable for IN region only.

### GSTRegistrationType

**Type:** `string`

**Required:** No

GST registration type of the Customer. Applicable for IN region only.

### IsCISContractor

**Type:** `boolean`

**Required:** No

Product: QBO only Description: True if the customer is CIS contractor

### ClientCompanyId

**Type:** `string`

**Required:** No

Internal use only: Applicable only for Accountant companies, Not null represents associated QBO company id. (Readonly)

### ClientEntityId

**Type:** `string`

**Required:** No

Internal use only: Applicable only for Accountant companies, External reference for Customer. (ReadOnly)

### Source

**Type:** `string`

**Required:** No

Product: QBO Description: Originating source of the Customer. Valid values are defined in SourceTypeEnum

### TaxRegime

**Type:** `string`

**Required:** No

Product: QBO Description: Tax regime of a customer which is required by CFDI4.0 in Mexico. Visit http://omawww.sat.gob.mx/tramitesyservicios/Paginas/anexo_20_version3-3.htm and find the catalogues that contain the accepted values of TaxRegime.

### TaxGroupCodeRef

**Type:** `ReferenceType`

**Required:** No

Product: QBW Description: US-only, reference to a TaxCode entity where the group field of the referenced entity is true, that is, a TaxCode representing a list of tax rates that apply for the customer.

### TaxRateRef

**Type:** `ReferenceType`

**Required:** No

Product: QBW Description: US-only, reference to a TaxRate entity indicating the sales tax to apply by default for the customer.

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

### Create a Customer (JavaScript/Node.js)

```javascript
const axios = require('axios');

const createCustomer = async (realmId, accessToken) => {
  const customer = {
    "DisplayName": "Acme Corporation",
    "CompanyName": "Acme Corporation",
    "PrimaryEmailAddr": {
      "Address": "info@acme.com"
    },
    "PrimaryPhone": {
      "FreeFormNumber": "(555) 555-5555"
    },
    "BillAddr": {
      "Line1": "123 Main Street",
      "City": "Mountain View",
      "CountrySubDivisionCode": "CA",
      "PostalCode": "94043"
    }
  };

  const response = await axios.post(
    `https://quickbooks.api.intuit.com/v3/company/${realmId}/customer`,
    customer,
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

### Query Customers

```javascript
const queryCustomers = async (realmId, accessToken) => {
  const query = "SELECT * FROM Customer WHERE Active = true MAXRESULTS 100";

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
