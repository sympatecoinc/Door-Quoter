# ExchangeRate API Reference

QuickBooks Online API documentation for the ExchangeRate entity.

---

## Base URL

```
https://quickbooks.api.intuit.com/v3/company/{realmId}
```

## Authentication

OAuth 2.0 Bearer Token required in Authorization header.

---

## Endpoints

### ExchangeRate - GetDetails

Get ExchangeRate
Method : GET


**Method:** `GET`

**Path:** `/exchangerate`

**Parameters:**

| Name | Location | Type | Required | Description |
|------|----------|------|----------|-------------|
| sourcecurrencycode | query | string | ✓ |  |
| asofdate | query | string | ✓ |  |
| minorversion | query | string | ✓ |  |
| User-Agent | header | string | ✓ |  |
| Accept | header | string | ✓ |  |
| Content-Type | header | string | ✓ |  |

**Example Request:**

```http
GET /exchangerate?sourcecurrencycode=USD&asofdate=2017-04-25&minorversion={{minorversion}}
User-Agent: {{UserAgent}}
Accept: application/json
Content-Type: application/json
```

**Responses:**

- `200`: 

---



## Code Examples

### Create (JavaScript/Node.js)

```javascript
const axios = require('axios');

const createExchangerate = async (realmId, accessToken, data) => {
  const response = await axios.post(
    `https://quickbooks.api.intuit.com/v3/company/${realmId}/exchangerate`,
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
const getExchangerate = async (realmId, id, accessToken) => {
  const response = await axios.get(
    `https://quickbooks.api.intuit.com/v3/company/${realmId}/exchangerate/${id}`,
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
const queryExchangerates = async (realmId, accessToken) => {
  const query = "SELECT * FROM Exchangerate MAXRESULTS 100";

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
