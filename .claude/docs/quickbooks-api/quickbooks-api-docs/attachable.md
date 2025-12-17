# Attachable API Reference

QuickBooks Online API documentation for the Attachable entity.

---

## Base URL

```
https://quickbooks.api.intuit.com/v3/company/{realmId}
```

## Authentication

OAuth 2.0 Bearer Token required in Authorization header.

---

## Endpoints

### Upload-Attachments

Uploading and linking new attachments

https://developer.intuit.com/docs/0100_quickbooks_online/0200_dev_guides/accounting/attachments#Uploading_and_linking_new_attachments

If the attachment is not in the Attachment list already, it's possible to upload it and link it to the object in one multipart operation.

Operation:      POST https://quickbooks.api.intuit.com/v3/company/companyID/upload
Content type: multipart/form-data

Request body

The following sample code shows the multipart request body for uploading a file and its supporting Attachable metatdata object, with the result of it being both added to the Attachment list and added to the object.

The Attachable object accompanying this request supplies metadata and object information to which the attachment is linked. 
Each part of the multipart request is separated by a boundary.  In the sample below, the string  --YOjcLaTlykb6OxfYJx4O07j1MweeMFem is used.  You can use any random and unique string.
The file to be uploaded and its Attachable object are paired together via the name parameter in the part header for each one.
The name parameter for the file part is of the form file_content_nn, where nn is a unique index number among the set of files being uploaded.
The name parameter for the Attachable object is of the form file_metadata_nn, where nn corresponds to the file index number used with the content .
The file or files are stored in the Attachment list with the name specified by the filename parameter.
If the data supplied with the Attachable object cannot be validated, an error is returned and the file is not uploaded.

**Method:** `POST`

**Path:** `/upload`

**Parameters:**

| Name | Location | Type | Required | Description |
|------|----------|------|----------|-------------|
| User-Agent | header | string | ✓ |  |
| Content-Type | header | string | ✓ |  |
| Accept | header | string | ✓ |  |

**Example Request:**

```http
POST /upload
User-Agent: {{UserAgent}}
Content-Type: multipart/form-data;boundary=37a1965f87babd849241a530ad71e169
Accept: application/json
```

**Responses:**

- `200`: 

---

### Attachable-Create

Create an attachable object
Conent-Type:application/json
Method - POST

**Method:** `POST`

**Path:** `/attachable`

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
POST /attachable?minorversion={{minorversion}}
Content-Type: application/json
User-Agent: {{UserAgent}}
Accept: application/json
```

**Responses:**

- `200`: 

---

### Attachable-ReadById

Retrieve an attachable object by Id
Accept:application/json
Method - GET

**Method:** `GET`

**Path:** `/attachable/5000000000000029383`

**Parameters:**

| Name | Location | Type | Required | Description |
|------|----------|------|----------|-------------|
| minorversion | query | string | ✓ |  |
| User-Agent | header | string | ✓ |  |
| Accept | header | string | ✓ |  |
| Content-Type | header | string | ✓ |  |

**Example Request:**

```http
GET /attachable/5000000000000029383?minorversion={{minorversion}}
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

const createAttachable = async (realmId, accessToken, data) => {
  const response = await axios.post(
    `https://quickbooks.api.intuit.com/v3/company/${realmId}/attachable`,
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
const getAttachable = async (realmId, id, accessToken) => {
  const response = await axios.get(
    `https://quickbooks.api.intuit.com/v3/company/${realmId}/attachable/${id}`,
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
const queryAttachables = async (realmId, accessToken) => {
  const query = "SELECT * FROM Attachable MAXRESULTS 100";

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
