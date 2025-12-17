# Preferences API Reference

## Description

Defines Preference strongly typed object with extensions

## API Endpoint

```
POST /v3/company/{realmId}/preferences
GET /v3/company/{realmId}/preferences/{id}
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
| `AccountingInfoPrefs` | `CompanyAccountingPrefs` | No | Accounting info Preferences |
| `AdvancedInventoryPrefs` | `AdvancedInventoryPrefs` | No | Accounting info Preferences |
| `ProductAndServicesPrefs` | `ProductAndServicesPrefs` | No | Product and Service Preferences |
| `SalesFormsPrefs` | `SalesFormsPrefs` | No | Sales Form Preferences |
| `EmailMessagesPrefs` | `EmailMessagesPrefs` | No | Email messages Preferences |
| `PrintDocumentPrefs` | `PrintDocumentPrefs` | No | Printable document preferences |
| `VendorAndPurchasesPrefs` | `VendorAndPurchasesPrefs` | No | Vendor and purchases Preferences |
| `TimeTrackingPrefs` | `TimeTrackingPrefs` | No | Vendor and purchases Preferences |
| `TaxPrefs` | `TaxPrefs` | No | Tax Preferences |
| `FinanceChargesPrefs` | `FinanceChargePrefs` | No | FinanceCharges Preferences |
| `CurrencyPrefs` | `CurrencyPrefs` | No | Currency Preferences |
| `ReportPrefs` | `ReportPrefs` | No | Report Preferences |
| `OtherPrefs` | `OtherPrefs` | No | Specifies extension of Preference entity to allow extension of Name-Value pair based extension at th... |

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

### AccountingInfoPrefs

**Type:** `CompanyAccountingPrefs`

**Required:** No

Accounting info Preferences

### AdvancedInventoryPrefs

**Type:** `AdvancedInventoryPrefs`

**Required:** No

Accounting info Preferences

### ProductAndServicesPrefs

**Type:** `ProductAndServicesPrefs`

**Required:** No

Product and Service Preferences

### SalesFormsPrefs

**Type:** `SalesFormsPrefs`

**Required:** No

Sales Form Preferences

### EmailMessagesPrefs

**Type:** `EmailMessagesPrefs`

**Required:** No

Email messages Preferences

### PrintDocumentPrefs

**Type:** `PrintDocumentPrefs`

**Required:** No

Printable document preferences

### VendorAndPurchasesPrefs

**Type:** `VendorAndPurchasesPrefs`

**Required:** No

Vendor and purchases Preferences

### TimeTrackingPrefs

**Type:** `TimeTrackingPrefs`

**Required:** No

Vendor and purchases Preferences

### TaxPrefs

**Type:** `TaxPrefs`

**Required:** No

Tax Preferences

### FinanceChargesPrefs

**Type:** `FinanceChargePrefs`

**Required:** No

FinanceCharges Preferences

### CurrencyPrefs

**Type:** `CurrencyPrefs`

**Required:** No

Currency Preferences

### ReportPrefs

**Type:** `ReportPrefs`

**Required:** No

Report Preferences

### OtherPrefs

**Type:** `OtherPrefs`

**Required:** No

Specifies extension of Preference entity to allow extension of Name-Value pair based extension at the top level

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

const createPreferences = async (realmId, accessToken, data) => {
  const response = await axios.post(
    `https://quickbooks.api.intuit.com/v3/company/${realmId}/preferences`,
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
const getPreferences = async (realmId, id, accessToken) => {
  const response = await axios.get(
    `https://quickbooks.api.intuit.com/v3/company/${realmId}/preferences/${id}`,
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
const queryPreferencess = async (realmId, accessToken) => {
  const query = "SELECT * FROM Preferences MAXRESULTS 100";

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
