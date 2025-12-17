# TaxCode API Reference

QuickBooks Online API documentation for the TaxCode entity.

---

## Base URL

```
https://quickbooks.api.intuit.com/v3/company/{realmId}
```

## Authentication

OAuth 2.0 Bearer Token required in Authorization header.

---

## Endpoints

### TaxCode-ReadById

Read a taxcode by Id
Method : POST


**Method:** `GET`

**Path:** `/taxcode/2`

**Parameters:**

| Name | Location | Type | Required | Description |
|------|----------|------|----------|-------------|
| minorversion | query | string | ✓ |  |
| User-Agent | header | string | ✓ |  |
| Accept | header | string | ✓ |  |
| Content-Type | header | string | ✓ |  |

**Example Request:**

```http
GET /taxcode/2?minorversion={{minorversion}}
User-Agent: {{UserAgent}}
Accept: application/json
Content-Type: application/text
```

**Responses:**

- `200`: 

---



## Code Examples

### Create (JavaScript/Node.js)

```javascript
const axios = require('axios');

const createTaxcode = async (realmId, accessToken, data) => {
  const response = await axios.post(
    `https://quickbooks.api.intuit.com/v3/company/${realmId}/taxcode`,
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
const getTaxcode = async (realmId, id, accessToken) => {
  const response = await axios.get(
    `https://quickbooks.api.intuit.com/v3/company/${realmId}/taxcode/${id}`,
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
const queryTaxcodes = async (realmId, accessToken) => {
  const query = "SELECT * FROM Taxcode MAXRESULTS 100";

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
