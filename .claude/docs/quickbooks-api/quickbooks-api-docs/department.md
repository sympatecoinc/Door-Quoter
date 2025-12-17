# Department API Reference

QuickBooks Online API documentation for the Department entity.

---

## Base URL

```
https://quickbooks.api.intuit.com/v3/company/{realmId}
```

## Authentication

OAuth 2.0 Bearer Token required in Authorization header.

---

## Endpoints

### Department-Create

Create a department object
Method : POST

**Method:** `POST`

**Path:** `/department`

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
POST /department?minorversion={{minorversion}}
Content-Type: application/json
User-Agent: {{UserAgent}}
Accept: application/json
```

**Responses:**

- `200`: 

---

### Department-ReadById

Read a department object
Method : GET

**Method:** `GET`

**Path:** `/department/1`

**Parameters:**

| Name | Location | Type | Required | Description |
|------|----------|------|----------|-------------|
| minorversion | query | string | ✓ |  |
| User-Agent | header | string | ✓ |  |
| Accept | header | string | ✓ |  |

**Example Request:**

```http
GET /department/1?minorversion={{minorversion}}
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

const createDepartment = async (realmId, accessToken, data) => {
  const response = await axios.post(
    `https://quickbooks.api.intuit.com/v3/company/${realmId}/department`,
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
const getDepartment = async (realmId, id, accessToken) => {
  const response = await axios.get(
    `https://quickbooks.api.intuit.com/v3/company/${realmId}/department/${id}`,
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
const queryDepartments = async (realmId, accessToken) => {
  const query = "SELECT * FROM Department MAXRESULTS 100";

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
