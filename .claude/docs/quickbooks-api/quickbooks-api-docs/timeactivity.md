# TimeActivity API Reference

QuickBooks Online API documentation for the TimeActivity entity.

---

## Base URL

```
https://quickbooks.api.intuit.com/v3/company/{realmId}
```

## Authentication

OAuth 2.0 Bearer Token required in Authorization header.

---

## Endpoints

### TimeActivity-Create

Create a term object
Method : POST



**Method:** `POST`

**Path:** `/timeactivity`

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
POST /timeactivity?minorversion={{minorversion}}
Content-Type: application/json
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

const createTimeactivity = async (realmId, accessToken, data) => {
  const response = await axios.post(
    `https://quickbooks.api.intuit.com/v3/company/${realmId}/timeactivity`,
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
const getTimeactivity = async (realmId, id, accessToken) => {
  const response = await axios.get(
    `https://quickbooks.api.intuit.com/v3/company/${realmId}/timeactivity/${id}`,
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
const queryTimeactivitys = async (realmId, accessToken) => {
  const query = "SELECT * FROM Timeactivity MAXRESULTS 100";

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
