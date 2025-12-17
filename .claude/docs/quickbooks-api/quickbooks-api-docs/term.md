# Term API Reference

QuickBooks Online API documentation for the Term entity.

---

## Base URL

```
https://quickbooks.api.intuit.com/v3/company/{realmId}
```

## Authentication

OAuth 2.0 Bearer Token required in Authorization header.

---

## Endpoints

### Term-Delete

Update a term object
Method : POST

Term object can't be deleted parmanently. It can only be deactived by setting the 'Active' attribute to false.

**Method:** `POST`

**Path:** `/term`

**Parameters:**

| Name | Location | Type | Required | Description |
|------|----------|------|----------|-------------|
| Body | body |  | ✓ |  |
| User-Agent | header | string | ✓ |  |
| Accept | header | string | ✓ |  |
| Content-Type | header | string | ✓ |  |

**Example Request:**

```http
POST /term
Content-Type: application/json
User-Agent: {{UserAgent}}
Accept: application/json
```

**Responses:**

- `200`: 

---

### Term-ReadById

Read a term object by Id
Method : Get



**Method:** `GET`

**Path:** `/term/8`

**Parameters:**

| Name | Location | Type | Required | Description |
|------|----------|------|----------|-------------|
| minorversion | query | string | ✓ |  |
| User-Agent | header | string | ✓ |  |
| Accept | header | string | ✓ |  |

**Example Request:**

```http
GET /term/8?minorversion={{minorversion}}
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

const createTerm = async (realmId, accessToken, data) => {
  const response = await axios.post(
    `https://quickbooks.api.intuit.com/v3/company/${realmId}/term`,
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
const getTerm = async (realmId, id, accessToken) => {
  const response = await axios.get(
    `https://quickbooks.api.intuit.com/v3/company/${realmId}/term/${id}`,
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
const queryTerms = async (realmId, accessToken) => {
  const query = "SELECT * FROM Term MAXRESULTS 100";

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
