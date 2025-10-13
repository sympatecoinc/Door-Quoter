# optiCutter API Documentation

Please [contact us](https://www.opticutter.com/#contact) if something is unclear or you need more information. We are ready to help you.

## Introduction

Welcome to the optiCutter API documentation. Our API provides programmatic access to optiCutter solver engine, allowing developers to integrate our solver into client's enterprise systems. 

To use the optiCutter API, you need a [customer account](https://www.opticutter.com/sign-up). Once you have the account, you can get an [API token](https://www.opticutter.com/api-status) and begin making calls to the API.

## Environments

We provide two different environments for our customers: development and production. Development environment is suitable for developing and debugging API clients. This environment specification is exactly the same as the current production environment. All API calls to development environment are free and all solutions are only fake. They are syntactically correct, but the data obtained do not contain a workable solution. The development environment also includes all required API call validations, so when your API client is able to call our development APIs, your client code is fully compatible with our production APIs as well.

### Development
- Suitable for API client development
- Free of charge
- Returns fake solutions
- API host name: `sandbox.api.opticutter.com`

### Production
- Suitable for production usage
- All API calls are billed - based on subscription package
- Returns real solutions
- API host name: `api.opticutter.com`

## API Structure

Our API is based on JSON data format and only HTTP `POST` method is supported. We provide 3 endpoints:

- `/linear` - for access to linear solver
- `/panel` - for access to panel/sheet solver
- `/status` - for access to account status information

All API calls must also contain an API version. The current version of the API is 1.0 (`/v1/`). With the new features, we'll release a new version of the API, but the previous versions will remain intact, so our customers don't have to upgrade their clients to the new version, if they want to stay with the older version.

### Example API URLs

- `https://api.opticutter.com/v1/linear` - production API call version 1 to linear solver endpoint
- `https://sandbox.api.opticutter.com/v1/linear` - development API call version 1 to linear solver endpoint
- `https://sandbox.api.opticutter.com/v1/status` - development API call version 1 to account status endpoint

Because optiCutter API supports JSON format only, all API calls must contain `"Content-type: application/json"` HTTP header.

## Authentication

All API calls must contain HTTP header named `Authorization` which contains bearer authorization token.

```bash
curl -H "Content-type: application/json" \
-H "Authorization: Bearer <TOKEN>" \
-X POST http://sandbox.api.opticutter.com/v1/status
```

Authorization token is available in [API status](https://www.opticutter.com/api-status) section in optiCutter online application.

## Your First API Call

Now, it's time to test if everything is set up correctly. API call below will return your current account status. Please, do not forget to use your current API token, instead of `<TOKEN>` placeholder.

```bash
curl -H "Content-type: application/json" \
-H "Authorization: Bearer <TOKEN>" \
-X POST http://sandbox.api.opticutter.com/v1/status
```

You should receive this response:

```json
{
  "message": "OK",
  "remaining": 0
}
```

Because API call used development environment (`sandbox.api.opticutter.com`) the JSON response contains `"remaining":0` as how many API calls remains for this billing period. If you used production environment (`api.opticutter.com`), the response would contain the actual number of calls remaining.

## Endpoints

### Linear

Solves linear cutting plans.

#### Request

Request object contains array of `stocks`, array of `requirements` and a single `settings` object and it's structure is very similar to the form used in our online application.

##### Request Object Description

**stocks** (array, required)

Array of all available stocks. Every child object contains two fields: length and count.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `length` | string | required | Length of the stock. |
| `count` | integer | optional | Number of available stocks. Empty or unspecified means an unlimited number of resources. |
| `priority` | string | optional | Flag indicates if stock usage is preferred. Default value is empty (all stocks have equal priority). Allowed value is `y`. |
| `price` | string | optional | Stock price per piece. Required if costMinimization feature is used. |

**requirements** (array, required)

Array of all required parts. Every child object must contain two mandatory fields length, count and can contain one optional field label.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `length` | string | required | Length of the single required part. |
| `count` | integer | required | Number of required parts. |
| `label` | string | optional | Label of the required part (for easier identification in response). |

**settings** (object, optional)

Can contain fields: kerf, leftTrim, rightTrim, minimizeNumberOfCuttingLayouts, costMinimization.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `kerf` | string | optional | Width of kerf used for cutting. (Blade thickness) |
| `leftTrim` | string | optional | Trim/crop on the left side. |
| `rightTrim` | string | optional | Trim/crop on the right side. |
| `minimizeNumberOfCuttingLayouts` | string | optional | Sometimes it is more appropriate to prefer a solution with a slightly larger amount of used material, but with a smaller number of different cutting layouts. Flag indicates if solution with smaller number of different cutting layouts is required. Allowed value is `y`. |
| `costMinimization` | string | optional | Our solver minimizes waste primarily based on the length of the material. If you prefer to minimize material costs, use costMinimization flag. Flag indicates if solution with minimum material costs (based on the price of the material) is required. Allowed value is `y`. |

**layoutImages** (string, optional)

Flag indicates if layout images in SVG format (base64 encoded) are required in response object. Default value is empty (no images in response). Allowed value is `y`.

##### Example Request

```bash
curl -H "Content-type: application/json" \
-H "Authorization: Bearer <TOKEN>" \
-X POST -d '{
  "stocks": [{
    "length": "300",
    "count": 10
  }],
  "requirements": [{
    "length": "100",
    "count": 4
  }, {
    "length": "40",
    "count": 3
  }],
  "settings": {
    "kerf": "1"
  }
}' https://api.opticutter.com/v1/linear
```

#### Response

Response object contains a single `solution` object, which contains three inner child elements: `totalRequiredStocks` field, array of `requiredStocks` and array of `layouts` objects. Again, `solution` object is very similar to linear cutting plan solution from our online application. Take a short look at the linear cutting plan results in online application first to understand its concept.

##### Response Object Description

For the sake of clarity, the table below does not contain `solution` wrapper object.

**totalRequiredStocks** (integer, required)

Total sum of all required stocks.

**requiredStocks** (array, required)

Array of all required stocks and its counts. Every child object contains three fields: index, length and count.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `index` | integer | required | Order index of stock element from request's stocks array. |
| `length` | string | required | Length of the relevant stock. Additional information only. |
| `count` | integer | required | Number of required stocks. |
| `price` | decimal | optional | Stock price per piece. Additional information only. |

**layouts** (array, required)

Array of all cut layouts. Every child object contains four objects: count field, stock object, parts array and waste object.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `count` | integer | required | Number of repetitions of this layout. ("Repetition" value in online application) |
| `stock` | object | required | Stock element used in this layout. Contains `index` (integer, required) and `length` (string, required). |
| `parts` | array | required | A list of all parts that can be cut in this layout. Every child object contains: `index` (integer, required), `length` (string, required), `count` (integer, required), and `label` (string, optional). |
| `waste` | object | required | Information object. Holds info about cut and material waste for this layout. Contains `cut` (string, optional) - waste after cutting (including trim cuts if provided), and `material` (string, required) - material left after cutting. |
| `cuts` | object | required | Information object. Holds info about cut count for this layout. Contains `count` (integer, required) - the number of cuts in this layout. |

##### Example Response

```json
{
  "solution": {
    "totalRequiredStocks": 2,
    "requiredStocks": [
      {
        "index": 0,
        "length": "300",
        "count": 2
      }
    ],
    "layouts": [
      {
        "count": 1,
        "stock": {
          "index": 0,
          "length": "300"
        },
        "parts": [
          {
            "index": 0,
            "length": "100",
            "count": 2
          },
          {
            "index": 1,
            "length": "40",
            "count": 2
          }
        ],
        "waste": {
          "cut": "4",
          "material": "16"
        },
        "cuts": {
          "count": 4
        }
      },
      {
        "count": 1,
        "stock": {
          "index": 0,
          "length": "300"
        },
        "parts": [
          {
            "index": 0,
            "length": "100",
            "count": 2
          },
          {
            "index": 1,
            "length": "40",
            "count": 1
          }
        ],
        "waste": {
          "cut": "3",
          "material": "57"
        },
        "cuts": {
          "count": 3
        }
      }
    ]
  }
}
```

### Panel

Solves panel/sheet cutting plans.

#### Request

Request object contains array of `stocks`, array of `requirements` and a single `settings` object and it's structure is very similar to the form used in our online application.

##### Request Object Description

**stocks** (array, required)

Array of all available stocks. Every child object contains three fields: length, width, count and grainDirection.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `length` | string | required | Length of the stock. |
| `width` | string | required | Width of the stock. |
| `count` | integer | optional | Number of available stocks. Empty or unspecified means an unlimited number of resources. |
| `grainDirection` | char | optional | Stock's grain direction. Empty or unspecified means grain direction is not considered for corresponding stock. Allowed values are `h` for horizontal grain direction and `v` for vertical grain direction. Horizontal grain direction is parallel with stock's edge entered as length. Vertical grain direction is parallel with stock's edge entered as width. |
| `priority` | string | optional | Flag indicates if stock usage is preferred. Default value is empty (all stocks have equal priority). Allowed value is `y`. |
| `price` | string | optional | Stock price per piece. Required if costMinimization feature is used. |

**requirements** (array, required)

Array of all required panels. Every child object contains four mandatory fields length, width, count, grainDirection and can contain one optional field label.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `length` | string | required | Length of the single required panel. |
| `width` | string | required | Width of the single required panel. |
| `count` | integer | required | Number of required panels. |
| `grainDirection` | char | optional | Required panel's grain direction. Empty or unspecified means grain direction is not considered for corresponding panel. Allowed values are `h` for horizontal grain direction and `v` for vertical grain direction. Horizontal grain direction is parallel with stock's edge entered as length. Vertical grain direction is parallel with stock's edge entered as width. |
| `label` | string | optional | Label of the required panel (for easier identification in response). |

**settings** (object, optional)

Can contain fields: kerf, leftTrim, rightTrim, topTrim, bottomTrim, costMinimization and rollMaterial.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `kerf` | string | optional | Width of kerf used for cutting. (Blade thickness) |
| `leftTrim` | string | optional | Trim/crop on the left side. |
| `rightTrim` | string | optional | Trim/crop on the right side. |
| `topTrim` | string | optional | Trim/crop on the top side. |
| `bottomTrim` | string | optional | Trim/crop on the bottom side. |
| `costMinimization` | string | optional | Our solver minimizes waste primarily based on the area of the material. If you prefer to minimize material costs, use costMinimization flag. Flag indicates if solution with minimum material costs (based on the price of the material) is required. Allowed value is `y`. |
| `rollMaterial` | string | optional | This feature forces the algorithm to place the panels to the left edge, which is a suitable placement strategy if you are working with materials stored in rolls and need to know how long of a piece of the roll should be cut off. Flag indicates if roll material solution is required. Allowed value is `y`. |

**layoutImages** (string, optional)

Flag indicates if layout images in SVG format (base64 encoded) are required in response object. Default value is empty (no images in response). Allowed value is `y`.

##### Example Request

```bash
curl -H "Content-type: application/json" \
-H "Authorization: Bearer <TOKEN>" \
-X POST -d '{
  "stocks": [{
    "length": "60",
    "width": "40",
    "count": "10",
    "grainDirection": null
  }, {
    "length": "40",
    "width": "35",
    "grainDirection": null
  }],
  "requirements": [{
    "length": "30",
    "width": "20",
    "count": "8",
    "grainDirection": null
  }, {
    "width": "20",
    "length": "20",
    "count": "3",
    "grainDirection": null
  }],
  "settings": {
    "kerf": "0"
  }
}' https://api.opticutter.com/v1/panel
```

#### Response

Response object contains a single `solution` object, which contains three inner child elements: `totalRequiredStocks` field, array of `requiredStocks` and array of `layouts` objects. Again, `solution` object is very similar to sheet/panel cutting plan solution from our online application. Take a short look at the sheet cutting plan results in online application first to understand its concept.

##### Response Object Description

For the sake of clarity, the table below does not contain `solution` wrapper object.

**totalRequiredStocks** (integer, required)

Total sum of all required stocks.

**requiredStocks** (array, required)

Array of all required stocks and its counts. Every child object contains four fields: index, length, width and count.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `index` | integer | required | Order index of stock panel from request's stocks array. |
| `length` | string | required | Length of the relevant stock panel. Additional information only. |
| `width` | string | required | Width of the relevant stock panel. Additional information only. |
| `count` | integer | required | Number of required stocks. |
| `price` | decimal | optional | Stock price per piece. Additional information only. |

**layouts** (array, required)

Array of all cut layouts. Every child object contains four objects: count field, stock object, panels array and remainders object.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `count` | integer | required | Number of repetitions of this layout. ("Repetition" value in online application) |
| `stock` | object | required | Stock element used in this layout. Contains `index` (integer, required), `length` (string, required), and `width` (string, required). |
| `panels` | array | required | A list of all panels that can be cut in this layout. Every child object contains: `index` (integer, required), `length` (string, required), `width` (string, required), `x` (string, required) - X-coordinate (horizontal axis) of the panel's location on the stock sheet, `y` (string, required) - Y-coordinate (vertical axis) of the panel's location on the stock sheet, and `label` (string, optional). Note: Length is always in horizontal direction and width is always in vertical direction. |
| `remainders` | array | optional | A list of all remainders in current layout. Every child object contains: `length` (string, required), `width` (string, required), `x` (string, required) - X-coordinate, and `y` (string, required) - Y-coordinate. |
| `cuts` | object | required | Information object. Holds info about cuts for this layout. Contains `count` (integer, required) - the number of cuts in this layout, and `length` (string, required) - the length of cuts in this layout. |
| `svgImage` | base64 string | optional | Cut layout scheme as SVG image encoded into base64 string. After decoding you get plain-text SVG image which can be processed by your API client. |

##### Example Response

```json
{
  "solution": {
    "totalRequiredStocks": 4,
    "requiredStocks": [
      {
        "index": 0,
        "length": "60",
        "width": "40",
        "count": 1
      },
      {
        "index": 1,
        "length": "40",
        "width": "35",
        "count": 3
      }
    ],
    "layouts": [
      {
        "count": 1,
        "stock": {
          "index": 0,
          "length": "60",
          "width": "40"
        },
        "panels": [
          {
            "index": 1,
            "length": "20",
            "width": "20",
            "x": "0",
            "y": "0"
          },
          {
            "index": 0,
            "length": "30",
            "width": "20",
            "x": "0",
            "y": "20"
          },
          {
            "index": 0,
            "length": "30",
            "width": "20",
            "x": "30",
            "y": "20"
          },
          {
            "index": 1,
            "length": "20",
            "width": "20",
            "x": "20",
            "y": "0"
          },
          {
            "index": 1,
            "length": "20",
            "width": "20",
            "x": "40",
            "y": "0"
          }
        ],
        "remainders": null,
        "cuts": {
          "count": 4,
          "length": "120"
        }
      },
      {
        "count": 3,
        "stock": {
          "index": 1,
          "length": "40",
          "width": "35"
        },
        "panels": [
          {
            "index": 0,
            "length": "20",
            "width": "30",
            "x": "0",
            "y": "0"
          },
          {
            "index": 0,
            "length": "20",
            "width": "30",
            "x": "20",
            "y": "0"
          }
        ],
        "remainders": [
          {
            "length": "40",
            "width": "5",
            "x": "0",
            "y": "30"
          }
        ],
        "cuts": {
          "count": 2,
          "length": "70"
        }
      }
    ]
  }
}
```

##### Graphical Representation

As you can see in the graphical representation, "blue" panels (index: 0) are placed horizontally (length: 30, width: 20) on the first layout, but vertically (length: 20, width: 30) on the second layout.

Zero-point coordinates (0, 0) are always in upper left corner of the stock sheet.

### Status

Provides account status info.

#### Example Request

```bash
curl -H "Content-type: application/json" \
-H "Authorization: Bearer <TOKEN>" \
-X POST http://api.opticutter.com/v1/status
```

#### Example Response

```json
{
  "message": "OK",
  "remaining": 4959
}
```

Field `remaining` contains info on how many API calls remain for this billing period. The same info is available also in API status section in online application.

The value can also be a negative number. Negative number means you spent all your API calls included in subscription package and you are currently spending additional calls, that will be billed at the end of the current billing period on the additional invoice.

Additional API calls are billed in groups of 100 rounded down, e.g. 99 or less additional API calls are free, 199 calls are billed as 100, etc.

## Errors

If something goes wrong, we will return an error to you. Here is the list of common errors you could receive. Element `source` (when not null) contains detailed information which JSON element contains invalid data.

### Invalid or Missing Authorization Token

```json
{
  "errors": [
    {
      "status": "401",
      "source": null,
      "title": "Unauthorized",
      "detail": "Authorization header is missing or invalid."
    }
  ]
}
```

### Invalid Number Format in JSON Request

```json
{
  "errors": [
    {
      "status": "422",
      "source": {
        "pointer": "settings.kerf"
      },
      "title": "Validation failed",
      "detail": "Invalid decimal or fractional number"
    }
  ]
}
```

### Missing Mandatory Data in JSON Request

```json
{
  "errors": [
    {
      "status": "422",
      "source": {
        "pointer": "stocks[0].length"
      },
      "title": "Validation failed",
      "detail": "Must not be blank."
    }
  ]
}
```

### Lack of Stocks

The supplied stock is too small to accept all the required parts.

```json
{
  "errors": [
    {
      "status": "422",
      "source": {
        "pointer": "stocks"
      },
      "title": "Validation failed",
      "detail": "Lack of stocks! Please add more stock's quantity or leave at least one stock quantity field blank."
    }
  ]
}
```

### Internal Server Error

This is not your fault. Something broke on our servers. We will try to fix it ASAP.

```json
{
  "errors": [
    {
      "status": "500",
      "source": null,
      "title": "Internal Server Error",
      "detail": "Identifier: 1643996842483"
    }
  ]
}
```