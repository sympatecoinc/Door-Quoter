# PaymentMethod API Reference

QuickBooks Online API documentation for the PaymentMethod entity.

---

## Base URL

```
https://quickbooks.api.intuit.com/v3/company/{realmId}
```

## Authentication

OAuth 2.0 Bearer Token required in Authorization header.

---

## Endpoints

### PaymentMethod-Update

Update a payment method
Method : POST


**Method:** `POST`

**Path:** `/paymentmethod`

**Parameters:**

| Name | Location | Type | Required | Description |
|------|----------|------|----------|-------------|
| minorversion | query | string | ✓ |  |
| Body | body |  | ✓ |  |
| User-Agent | header | string | ✓ |  |
| Accept | header | string | ✓ |  |
| Content-Type | header | string | ✓ |  |

**Example Request:**

```http
POST /paymentmethod?minorversion={{minorversion}}
Content-Type: application/json
User-Agent: {{UserAgent}}
Accept: application/json
```

**Responses:**

- `200`: 

---

### PaymentMethod-ReadById

Read a payment method
Method : GET


**Method:** `GET`

**Path:** `/paymentmethod/8`

**Parameters:**

| Name | Location | Type | Required | Description |
|------|----------|------|----------|-------------|
| minorversion | query | string | ✓ |  |
| User-Agent | header | string | ✓ |  |
| Accept | header | string | ✓ |  |

**Example Request:**

```http
GET /paymentmethod/8?minorversion={{minorversion}}
User-Agent: {{UserAgent}}
Accept: application/json
```

**Responses:**

- `200`: 

---



## Code Examples

### Create (JavaScript/Node.js)

```javascript
const axios = require('axios');

const createPaymentmethod = async (realmId, accessToken, data) => {
  const response = await axios.post(
    `https://quickbooks.api.intuit.com/v3/company/${realmId}/paymentmethod`,
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
const getPaymentmethod = async (realmId, id, accessToken) => {
  const response = await axios.get(
    `https://quickbooks.api.intuit.com/v3/company/${realmId}/paymentmethod/${id}`,
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
const queryPaymentmethods = async (realmId, accessToken) => {
  const query = "SELECT * FROM Paymentmethod MAXRESULTS 100";

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
