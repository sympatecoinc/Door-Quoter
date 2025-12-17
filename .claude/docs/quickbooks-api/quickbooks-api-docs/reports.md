# Reports API Reference

QuickBooks Online API documentation for the Reports entity.

---

## Base URL

```
https://quickbooks.api.intuit.com/v3/company/{realmId}
```

## Authentication

OAuth 2.0 Bearer Token required in Authorization header.

---

## Endpoints

### Report-InventoryValuationSummary

Report - Inventory Valuation Summary
Method : GET

Docs - https://developer.intuit.com/docs/api/accounting/inventory%20valuation










**Method:** `GET`

**Path:** `/reports/InventoryValuationSummary`

**Parameters:**

| Name | Location | Type | Required | Description |
|------|----------|------|----------|-------------|
| minorversion | query | string | ✓ |  |
| User-Agent | header | string | ✓ |  |
| Accept | header | string | ✓ |  |

**Example Request:**

```http
GET /reports/InventoryValuationSummary?minorversion={{minorversion}}
User-Agent: {{UserAgent}}
Accept: application/json
```

**Responses:**

- `200`: 

---

### Report-CustomerBalanceDetail

Report - CustomerBalance Detail
Method : GET

The information below provides a reference on how to access the Customer Balance Detail report from the QuickBooks Online Report Service.











**Method:** `GET`

**Path:** `/reports/CustomerBalanceDetail`

**Parameters:**

| Name | Location | Type | Required | Description |
|------|----------|------|----------|-------------|
| minorversion | query | string | ✓ |  |
| User-Agent | header | string | ✓ |  |
| Accept | header | string | ✓ |  |

**Example Request:**

```http
GET /reports/CustomerBalanceDetail?minorversion={{minorversion}}
User-Agent: {{UserAgent}}
Accept: application/json
```

**Responses:**

- `200`: 

---

### Report-ProfitAndLossDetail

Report - Profit and Loss Detail
Method : GET

Docs - https://developer.intuit.com/docs/api/accounting/profit%20and%20loss%20detail










**Method:** `GET`

**Path:** `/reports/ProfitAndLossDetail`

**Parameters:**

| Name | Location | Type | Required | Description |
|------|----------|------|----------|-------------|
| minorversion | query | string | ✓ |  |
| User-Agent | header | string | ✓ |  |
| Accept | header | string | ✓ |  |

**Example Request:**

```http
GET /reports/ProfitAndLossDetail?minorversion={{minorversion}}
User-Agent: {{UserAgent}}
Accept: application/json
```

**Responses:**

- `200`: 

---

### Report-GeneralLedger

Report - General Ledger
Method : GET

Docs - https://developer.intuit.com/docs/api/accounting/general%20ledger










**Method:** `GET`

**Path:** `/reports/GeneralLedger`

**Parameters:**

| Name | Location | Type | Required | Description |
|------|----------|------|----------|-------------|
| minorversion | query | string | ✓ |  |
| User-Agent | header | string | ✓ |  |
| Accept | header | string | ✓ |  |

**Example Request:**

```http
GET /reports/GeneralLedger?minorversion={{minorversion}}
User-Agent: {{UserAgent}}
Accept: application/json
```

**Responses:**

- `200`: 

---

### Report-VendorBalance

Report - Vendor Balance 
Method : GET

Docs - https://developer.intuit.com/docs/api/accounting/vendor%20balance








**Method:** `GET`

**Path:** `/reports/VendorBalance`

**Parameters:**

| Name | Location | Type | Required | Description |
|------|----------|------|----------|-------------|
| minorversion | query | string | ✓ |  |
| User-Agent | header | string | ✓ |  |
| Accept | header | string | ✓ |  |

**Example Request:**

```http
GET /reports/VendorBalance?minorversion={{minorversion}}
User-Agent: {{UserAgent}}
Accept: application/json
```

**Responses:**

- `200`: 

---

### Report-ItemSales

Report - Item Sales
Method : GET

Docs - https://developer.intuit.com/docs/api/accounting/sales%20by%20product










**Method:** `GET`

**Path:** `/reports/ItemSales`

**Parameters:**

| Name | Location | Type | Required | Description |
|------|----------|------|----------|-------------|
| minorversion | query | string | ✓ |  |
| User-Agent | header | string | ✓ |  |
| Accept | header | string | ✓ |  |

**Example Request:**

```http
GET /reports/ItemSales?minorversion={{minorversion}}
User-Agent: {{UserAgent}}
Accept: application/json
```

**Responses:**

- `200`: 

---

### Report-VendorExpense

Report - Vendor Expense
Method : GET

Docs - https://developer.intuit.com/docs/api/accounting/expenses%20by%20vendor







**Method:** `GET`

**Path:** `/reports/VendorExpenses`

**Parameters:**

| Name | Location | Type | Required | Description |
|------|----------|------|----------|-------------|
| minorversion | query | string | ✓ |  |
| User-Agent | header | string | ✓ |  |
| Accept | header | string | ✓ |  |

**Example Request:**

```http
GET /reports/VendorExpenses?minorversion={{minorversion}}
User-Agent: {{UserAgent}}
Accept: application/json
```

**Responses:**

- `200`: 

---

### Report-DepartmentSales

Report - Department Sales
Method : GET












**Method:** `GET`

**Path:** `/reports/DepartmentSales`

**Parameters:**

| Name | Location | Type | Required | Description |
|------|----------|------|----------|-------------|
| minorversion | query | string | ✓ |  |
| User-Agent | header | string | ✓ |  |
| Accept | header | string | ✓ |  |

**Example Request:**

```http
GET /reports/DepartmentSales?minorversion={{minorversion}}
User-Agent: {{UserAgent}}
Accept: application/json
```

**Responses:**

- `200`: 

---

### Report-AgedPayables

Report - AgedPayable aging summary
Method : GET

The information below provides a reference on how to access the AP Aging summary report from the QuickBooks Online Report Service.






**Method:** `GET`

**Path:** `/reports/AgedPayables`

**Parameters:**

| Name | Location | Type | Required | Description |
|------|----------|------|----------|-------------|
| minorversion | query | string | ✓ |  |
| User-Agent | header | string | ✓ |  |
| Accept | header | string | ✓ |  |

**Example Request:**

```http
GET /reports/AgedPayables?minorversion={{minorversion}}
User-Agent: {{UserAgent}}
Accept: application/json
```

**Responses:**

- `200`: 

---

### Report-AccountList

Report - Account list detail
Method : GET

The information below provides a reference on how to access the account list detail report from the QuickBooks Online Report Service.



**Method:** `GET`

**Path:** `/reports/AccountList`

**Parameters:**

| Name | Location | Type | Required | Description |
|------|----------|------|----------|-------------|
| minorversion | query | string | ✓ |  |
| User-Agent | header | string | ✓ |  |
| Accept | header | string | ✓ |  |

**Example Request:**

```http
GET /reports/AccountList?minorversion={{minorversion}}
User-Agent: {{UserAgent}}
Accept: application/json
```

**Responses:**

- `200`: 

---

### Report-AgedReceivables

Report - AgedReceivable aging summary
Method : GET

The information below provides a reference on how to access the AR Aging Summary report from the QuickBooks Online Report Service.







**Method:** `GET`

**Path:** `/reports/AgedReceivables`

**Parameters:**

| Name | Location | Type | Required | Description |
|------|----------|------|----------|-------------|
| minorversion | query | string | ✓ |  |
| User-Agent | header | string | ✓ |  |
| Accept | header | string | ✓ |  |

**Example Request:**

```http
GET /reports/AgedReceivables?minorversion={{minorversion}}
User-Agent: {{UserAgent}}
Accept: application/json
```

**Responses:**

- `200`: 

---

### Report-CashFlow

Report - CashFlow
Method : GET

The information below provides a reference on how to access the cash flow report from the QuickBooks Online Report Service.








**Method:** `GET`

**Path:** `/reports/CashFlow`

**Parameters:**

| Name | Location | Type | Required | Description |
|------|----------|------|----------|-------------|
| minorversion | query | string | ✓ |  |
| User-Agent | header | string | ✓ |  |
| Accept | header | string | ✓ |  |

**Example Request:**

```http
GET /reports/CashFlow?minorversion={{minorversion}}
User-Agent: {{UserAgent}}
Accept: application/json
```

**Responses:**

- `200`: 

---

### Report-BalanceSheet

Report - BalanceSheet
Method : GET

The information below provides a reference on how to query the Balance Sheet report from the QuickBooks Online Report Service.








**Method:** `GET`

**Path:** `/reports/BalanceSheet`

**Parameters:**

| Name | Location | Type | Required | Description |
|------|----------|------|----------|-------------|
| minorversion | query | string | ✓ |  |
| User-Agent | header | string | ✓ |  |
| Accept | header | string | ✓ |  |

**Example Request:**

```http
GET /reports/BalanceSheet?minorversion={{minorversion}}
User-Agent: {{UserAgent}}
Accept: application/json
```

**Responses:**

- `200`: 

---

### Report-CustomerIncome

Report - Customer Income
Method : GET












**Method:** `GET`

**Path:** `/reports/CustomerIncome`

**Parameters:**

| Name | Location | Type | Required | Description |
|------|----------|------|----------|-------------|
| minorversion | query | string | ✓ |  |
| User-Agent | header | string | ✓ |  |
| Accept | header | string | ✓ |  |

**Example Request:**

```http
GET /reports/CustomerIncome?minorversion={{minorversion}}
User-Agent: {{UserAgent}}
Accept: application/json
```

**Responses:**

- `200`: 

---

### Report-AgedReceivableDetail

Report - AgedReceivableDetail aging detail
Method : GET

The information below provides a reference on how to access the AR Aging Detail report from the QuickBooks Online Report Service.






**Method:** `GET`

**Path:** `/reports/AgedReceivableDetail`

**Parameters:**

| Name | Location | Type | Required | Description |
|------|----------|------|----------|-------------|
| minorversion | query | string | ✓ |  |
| User-Agent | header | string | ✓ |  |
| Accept | header | string | ✓ |  |

**Example Request:**

```http
GET /reports/AgedReceivableDetail?minorversion={{minorversion}}
User-Agent: {{UserAgent}}
Accept: application/json
```

**Responses:**

- `200`: 

---

### Report-CustomerBalance

Report - CustomerBalance
Method : GET









**Method:** `GET`

**Path:** `/reports/CustomerBalance`

**Parameters:**

| Name | Location | Type | Required | Description |
|------|----------|------|----------|-------------|
| minorversion | query | string | ✓ |  |
| User-Agent | header | string | ✓ |  |
| Accept | header | string | ✓ |  |

**Example Request:**

```http
GET /reports/CustomerBalance?minorversion={{minorversion}}
User-Agent: {{UserAgent}}
Accept: application/json
```

**Responses:**

- `200`: 

---

### Report-TransactionList

Report - Trial List 
Method : GET

Docs - https://developer.intuit.com/docs/api/accounting/transaction%20list









**Method:** `GET`

**Path:** `/reports/TransactionList`

**Parameters:**

| Name | Location | Type | Required | Description |
|------|----------|------|----------|-------------|
| minorversion | query | string | ✓ |  |
| User-Agent | header | string | ✓ |  |
| Accept | header | string | ✓ |  |

**Example Request:**

```http
GET /reports/TransactionList?minorversion={{minorversion}}
User-Agent: {{UserAgent}}
Accept: application/json
```

**Responses:**

- `200`: 

---

### Report-TrialBalance

Report - Trial Balance 
Method : GET

Docs - https://developer.intuit.com/docs/api/accounting/trial%20balance









**Method:** `GET`

**Path:** `/reports/TrialBalance`

**Parameters:**

| Name | Location | Type | Required | Description |
|------|----------|------|----------|-------------|
| minorversion | query | string | ✓ |  |
| User-Agent | header | string | ✓ |  |
| Accept | header | string | ✓ |  |

**Example Request:**

```http
GET /reports/TrialBalance?minorversion={{minorversion}}
User-Agent: {{UserAgent}}
Accept: application/json
```

**Responses:**

- `200`: 

---

### Report-CustomerSales

Report - Customer Sales
Method : GET












**Method:** `GET`

**Path:** `/reports/CustomerSales`

**Parameters:**

| Name | Location | Type | Required | Description |
|------|----------|------|----------|-------------|
| minorversion | query | string | ✓ |  |
| User-Agent | header | string | ✓ |  |
| Accept | header | string | ✓ |  |

**Example Request:**

```http
GET /reports/CustomerSales?minorversion={{minorversion}}
User-Agent: {{UserAgent}}
Accept: application/json
```

**Responses:**

- `200`: 

---

### Report-AgedPayableDetail

Report - AgedPayable aging detail
Method : GET

The information below provides a reference on how to access the AP Aging summary report from the QuickBooks Online Report Service.





**Method:** `GET`

**Path:** `/reports/AgedPayableDetail`

**Parameters:**

| Name | Location | Type | Required | Description |
|------|----------|------|----------|-------------|
| minorversion | query | string | ✓ |  |
| User-Agent | header | string | ✓ |  |
| Accept | header | string | ✓ |  |

**Example Request:**

```http
GET /reports/AgedPayableDetail?minorversion={{minorversion}}
User-Agent: {{UserAgent}}
Accept: application/json
```

**Responses:**

- `200`: 

---

### Report-CashSales

Report - CashSales
Method : GET









**Method:** `GET`

**Path:** `/reports/ClassSales`

**Parameters:**

| Name | Location | Type | Required | Description |
|------|----------|------|----------|-------------|
| minorversion | query | string | ✓ |  |
| User-Agent | header | string | ✓ |  |
| Accept | header | string | ✓ |  |

**Example Request:**

```http
GET /reports/ClassSales?minorversion={{minorversion}}
User-Agent: {{UserAgent}}
Accept: application/json
```

**Responses:**

- `200`: 

---

### Report-VendorBalanceDetail

Report - Vendor Balance Detail
Method : GET

Docs - https://developer.intuit.com/docs/api/accounting/vendor%20balance%20detail







**Method:** `GET`

**Path:** `/reports/VendorBalanceDetail`

**Parameters:**

| Name | Location | Type | Required | Description |
|------|----------|------|----------|-------------|
| minorversion | query | string | ✓ |  |
| User-Agent | header | string | ✓ |  |
| Accept | header | string | ✓ |  |

**Example Request:**

```http
GET /reports/VendorBalanceDetail?minorversion={{minorversion}}
User-Agent: {{UserAgent}}
Accept: application/json
```

**Responses:**

- `200`: 

---

### Report-ProfitAndLoss

Report - Profit and Loss
Method : GET

Docs - https://developer.intuit.com/docs/api/accounting/profit%20and%20loss










**Method:** `GET`

**Path:** `/reports/ProfitAndLoss`

**Parameters:**

| Name | Location | Type | Required | Description |
|------|----------|------|----------|-------------|
| minorversion | query | string | ✓ |  |
| User-Agent | header | string | ✓ |  |
| Accept | header | string | ✓ |  |

**Example Request:**

```http
GET /reports/ProfitAndLoss?minorversion={{minorversion}}
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

const createReports = async (realmId, accessToken, data) => {
  const response = await axios.post(
    `https://quickbooks.api.intuit.com/v3/company/${realmId}/reports`,
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
const getReports = async (realmId, id, accessToken) => {
  const response = await axios.get(
    `https://quickbooks.api.intuit.com/v3/company/${realmId}/reports/${id}`,
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
const queryReportss = async (realmId, accessToken) => {
  const query = "SELECT * FROM Reports MAXRESULTS 100";

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
