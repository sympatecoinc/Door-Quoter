# Item API Reference

## Description

Product: QBO Description: The Item resource represents any product or service that is sold or purchased. Inventory items are not currently supported. Product: QBW Description: An item is a thing that your company buys, sells, or re-sells, such as products, shipping and handling charges, discounts, and sales tax (if applicable). An item is shown as a line on an invoice or other sales form. The Item.Type property, which specifies how the item is used, may have one of the following values: 
- Assembly: The Assembly item allows you combine inventory part items and other assembly items (subassemblies) into a single item by defining a Bill of Materials, that lists the component parts of the assembly item. You can also include the cost of building the assembly item by adding the non-inventory part items, service items, and other charge items to the Bill of Materials. 
-  Fixed Asset: The Fixed Asset item represents those business assets that you do not convert to cash one year of normal operation. A fixed asset is usually something that is integral to your business operations. For example, a truck or computer. 
- Group: The Group item helps you to quickly enter a group of individual items that you often purchase or sell together. 
- Inventory: The Inventory item is used to track merchandise which your business purchases, stocks as inventory, and re-sells. QuickBooks tracks the current number of inventory items in stock and the average value of the inventory after the purchase and sale of every item. 
- Other Charge: The Other Charge item is used to charge customers for the mileage expense. 
- Product The Product item is used to record the sales information of a product. 
- Payment: The Payment item subtracts the amount of a customer payment from the total amount of an invoice or statement. You must create a payment item if you receive payment for an invoice or statement in parts. If you receive full payment at the time of sale, use a sales receipt form instead of an invoice with a payment item. 
- Service: The Service item is used for the services that you charge on the purchase. For example, including specialized labor, consulting hours, and professional fees. 
- Subtotal: The Subtotal item is used when you want the total of all the items. You can use this item to apply a percentage discount or surcharge. Business Rules: 
- The item name must be unique. 
- The item type must not be NULL. 
- The item cannot define both unit price and unit price percent simultaneously. 
- For the Service, Product, and Other Charge items, you must specify the ID or name of the expense account or both. 
- If the purchase order cost is specified for the Service, Product, and Other Charge items, you must specify the ID or name of the expense account or both. For the Inventory and Assembly items, you must specify: 
- the ID or name of the income account or both 
- the ID or name of the cogs account or both 
- the ID or name of the asset account or both 
- For the Group item, you must specify the tax ID or tax name or both. For the Fixed Asset item, you must: 
- set the asset account type to Asset 
- specify the purchase date 
- specify the ID or name of the income account or both

## API Endpoint

```
POST /v3/company/{realmId}/item
GET /v3/company/{realmId}/item/{id}
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
| `Name` | `string` | No | Product: QBW Description: User recognizable name for the Item. Max. length: 31 characters. Product: ... |
| `Sku` | `string` | No | Product: QBO Description: Stock Keeping Unit - User entered item identifier that identifies an item ... |
| `Description` | `string` | No | Product: QBW Description: User entered description for the item that describes the details of the se... |
| `Active` | `boolean` | No | Product: QBW Description: True if active. Inactive items may be hidden from display and may not be u... |
| `SubItem` | `boolean` | No | Product: ALL Description: True if the item is a subitem; false or null indicates a top-level item. |
| `ParentRef` | `ReferenceType` | No | Product: ALL Description: Reference to the item's parent entity. |
| `Level` | `int` | No | Product: ALL Description: Specifies the level of the item, 0 if top level parent, otherwise specifie... |
| `FullyQualifiedName` | `string` | No | Product: ALL Description: Fully qualified name of the entity. The fully qualified name prepends the ... |
| `Taxable` | `boolean` | No | Product: ALL Description: True if the item is subject to tax. |
| `SalesTaxIncluded` | `boolean` | No | Product: ALL Description: True if the sales tax is included in the item amount, and therefore is not... |
| `PercentBased` | `boolean` | No | Product: ALL Description: True if the tax amount is percentage based. |
| `UnitPrice` | `decimal` | No | Product: ALL Description: Monetary value of the service or product, as expressed in the home currenc... |
| `RatePercent` | `decimal` | No | Product: ALL Description: The tax amount expressed as a percent of charges entered in the current tr... |
| `Type` | `ItemTypeEnum` | No | Product: ALL Description: Classification that specifies the use of this item. See the description at... |
| `PaymentMethodRef` | `ReferenceType` | No | Product: ALL Description: Reference to a PaymentMethod for an item of type Payment. |
| `UOMSetRef` | `ReferenceType` | No | Product: ALL Description: Reference to the unit of measure set (UOM) entity used by this item. |
| `IncomeAccountRef` | `ReferenceType` | No | Product: ALL Description: Reference to the posting account, that is, the account that records the pr... |
| `PurchaseDesc` | `string` | No | Product: ALL Description: User entered purchase description for the item. |
| `PurchaseTaxIncluded` | `boolean` | No | Product: ALL Description: True if the purchase tax is included in the item amount, and therefore is ... |
| `PurchaseCost` | `decimal` | No | Product: ALL Description: Amount paid when buying or ordering the item, as expressed in the home cur... |
| `ExpenseAccountRef` | `ReferenceType` | No | Product: ALL Description: Reference to the expense account used to pay the vendor for this item. Not... |
| `COGSAccountRef` | `ReferenceType` | No | Product: ALL Description: Reference to the Cost of Goods Sold account for the inventory item. Requir... |
| `AssetAccountRef` | `ReferenceType` | No | Product: ALL Description: Reference to the Inventory Asset account that tracks the current value of ... |
| `PrefVendorRef` | `ReferenceType` | No | Product: ALL Description: Reference to the preferred vendor of this item. |
| `AvgCost` | `decimal` | No | Product: ALL Description: Average cost of the item, expressed in the home currency. |
| `TrackQtyOnHand` | `boolean` | No | Product: QBO Description: Quantity on hand to be tracked. |
| `QtyOnHand` | `decimal` | No | Product: ALL Description: Current quantity of the inventory items available for sale. Sortable: QBW |
| `QtyOnPurchaseOrder` | `decimal` | No | Product: ALL Description: Quantity of the inventory item being ordered, for which there is a purchas... |
| `QtyOnSalesOrder` | `decimal` | No | Product: ALL Description: Quantity of the inventory item that is placed on sales orders. |
| `ReorderPoint` | `decimal` | No | Product: ALL Description: Quantity on hand threshold below which a purchase order against this inven... |
| `ManPartNum` | `string` | No | Product: ALL Description: Identifier provided by manufacturer for the Item, for example, the model n... |
| `DepositToAccountRef` | `ReferenceType` | No | Product: ALL Description: Optional reference to the account in which the payment money is deposited.... |
| `SalesTaxCodeRef` | `ReferenceType` | No | Product: ALL Description: Reference to the sales tax code for the item. Applicable to the Service, O... |
| `PurchaseTaxCodeRef` | `ReferenceType` | No | Product: ALL Description: Reference to the purchase tax code for the item. Applicable to the Service... |
| `InvStartDate` | `date` | No | Product: ALL Description: Date of the opening balance for the inventory transaction. QuickBooks crea... |
| `BuildPoint` | `decimal` | No | Product: ALL Description: Assembly item QuantityOnHand threshold below which more assemblies should ... |
| `PrintGroupedItems` | `boolean` | No | Product: QBW Description: Lets us know if the user wants to display the subitems as a group. Applica... |
| `SpecialItem` | `boolean` | No | Product: ALL Description: True if this is a special item used by QuickBooks in certain accounting fu... |
| `SpecialItemType` | `SpecialItemTypeEnum` | No | Product: ALL Description Type of special item, if SpecialItem is true. |
| `ItemGroupDetail` | `ItemGroupDetail` | No | Product: ALL Description: Contains the detailed components of the group. Applicable to a group item ... |
| `ItemAssemblyDetail` | `ItemAssemblyDetail` | No | Product: ALL Description: Contains the detailed inventory parts used when the assembly is built. App... |
| `AbatementRate` | `decimal` | No | Product: QBO Description: India sales tax abatement rate. |
| `ReverseChargeRate` | `decimal` | No | Product: QBO Description: India sales tax reverse charge rate. |
| `ServiceType` | `string` | No | Product: QBO Description: India sales tax service type, see ServiceTypeEnum for values. |
| `ItemCategoryType` | `string` | No | Product: QBO Description: Categorizes the given item as a product or a service. The applicable value... |
| `ItemEx` | `IntuitAnyType` | No | Internal use only: extension place holder for Item |
| `TaxClassificationRef` | `ReferenceType` | No | Product: ALL Description: Reference to the SalesTaxCode for this item. |
| `UQCDisplayText` | `string` | No | Product: ALL Description: Unit of measure (UQC) text to be displayed for this line item in Invoice/S... |
| `UQCId` | `string` | No | Product: ALL Description: Unit of measure for this line item as per the standard unit (UQC) defined ... |
| `ClassRef` | `ReferenceType` | No | Product: QBO Description: Reference to the Class for this item. |
| `Source` | `string` | No | Product: QBO Description: Originating source of the Item. Valid values are defined in SourceTypeEnum |
| `DeferredRevenue` | `boolean` | No | Product: QBO Description: Use the DeferredRevenue property to indicate that the goods/services sold ... |

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

### Name

**Type:** `string`

**Required:** No

Product: QBW Description: User recognizable name for the Item.
Max. length: 31 characters. Product: QBO Description: User recognizable name for the Item.
Max. length: 100 characters. Filterable: ALL Sortable: ALL Required: QBW

### Sku

**Type:** `string`

**Required:** No

Product: QBO Description: Stock Keeping Unit - User entered item identifier that identifies an item uniquely 
Max. length: 100 characters. Filterable: ALL Sortable: ALL

### Description

**Type:** `string`

**Required:** No

Product: QBW Description: User entered description for the item that describes the details of the service or product.
Max. length: 4000 characters. Product: QBO Description: User entered description for the item that describes the details of the service or product.
Max. length: 4000 characters. Filterable: QBO Sortable: QBO

### Active

**Type:** `boolean`

**Required:** No

Product: QBW Description: True if active. Inactive items may be hidden from display and may not be used in financial transactions. Filterable: QBW

### SubItem

**Type:** `boolean`

**Required:** No

Product: ALL Description: True if the item is a subitem; false or null indicates a top-level item.

### ParentRef

**Type:** `ReferenceType`

**Required:** No

Product: ALL Description: Reference to the item's parent entity.

### Level

**Type:** `int`

**Required:** No

Product: ALL Description: Specifies the level of the item, 0 if top level parent, otherwise specifies the depth from the top parent.

### FullyQualifiedName

**Type:** `string`

**Required:** No

Product: ALL Description: Fully qualified name of the entity. The fully qualified name prepends the topmost parent, followed by each sub element separated by colons. Takes the form of: 
 Parent:Customer:Job:Sub-job 
 Limited to 5 levels. Max. length: 41 characters (single name) or 209 characters (fully qualified name).

### Taxable

**Type:** `boolean`

**Required:** No

Product: ALL Description: True if the item is subject to tax.

### SalesTaxIncluded

**Type:** `boolean`

**Required:** No

Product: ALL Description: True if the sales tax is included in the item amount, and therefore is not calculated for the transaction.

### PercentBased

**Type:** `boolean`

**Required:** No

Product: ALL Description: True if the tax amount is percentage based.

### UnitPrice

**Type:** `decimal`

**Required:** No

Product: ALL Description: Monetary value of the service or product, as expressed in the home currency. Filterable: QBW Sortable: QBW

### RatePercent

**Type:** `decimal`

**Required:** No

Product: ALL Description: The tax amount expressed as a percent of charges entered in the current transaction. To enter a rate of 10% use 10.0, not 0.01.
Applicable to the Service, OtherCharge or Part (Non-Inventory) item types only, and only if the Purchase part of the item does not exist, that is, the item is not used as a reimbursable item, or as a part in assemblies.

### Type

**Type:** `ItemTypeEnum`

**Required:** No

Product: ALL Description: Classification that specifies the use of this item. See the description at the top of the Item entity page for details. 
 Filterable: ALL

### PaymentMethodRef

**Type:** `ReferenceType`

**Required:** No

Product: ALL Description: Reference to a PaymentMethod for an item of type Payment.

### UOMSetRef

**Type:** `ReferenceType`

**Required:** No

Product: ALL Description: Reference to the unit of measure set (UOM) entity used by this item.

### IncomeAccountRef

**Type:** `ReferenceType`

**Required:** No

Product: ALL Description: Reference to the posting account, that is, the account that records the proceeds from the sale of this item.
Required for the the following types: Assembly, Inventory, Other Charge, Product, Service. Required: ALL

### PurchaseDesc

**Type:** `string`

**Required:** No

Product: ALL Description: User entered purchase description for the item.

### PurchaseTaxIncluded

**Type:** `boolean`

**Required:** No

Product: ALL Description: True if the purchase tax is included in the item amount, and therefore is not calculated for the transaction.

### PurchaseCost

**Type:** `decimal`

**Required:** No

Product: ALL Description: Amount paid when buying or ordering the item, as expressed in the home currency.

### ExpenseAccountRef

**Type:** `ReferenceType`

**Required:** No

Product: ALL Description: Reference to the expense account used to pay the vendor for this item.
Note: for a service item, this may also be an equity account to record a draw against the company equity to pay for the service.
If the Purchase information (PurchaseDesc, PurchaseTaxIncluded, PurchaseCost, etc.) is provided, this account is required for the the following item types: Other Charge, Product, Service. Required: ALL

### COGSAccountRef

**Type:** `ReferenceType`

**Required:** No

Product: ALL Description: Reference to the Cost of Goods Sold account for the inventory item.
Required for the the following item types: Assembly, Inventory. Required: ALL

### AssetAccountRef

**Type:** `ReferenceType`

**Required:** No

Product: ALL Description: Reference to the Inventory Asset account that tracks the current value of the inventory. If the same account is used for all inventory items, the current balance of this account will represent the current total value of the inventory.
Required for the the following item types: Assembly, Inventory. Required: ALL

### PrefVendorRef

**Type:** `ReferenceType`

**Required:** No

Product: ALL Description: Reference to the preferred vendor of this item.

### AvgCost

**Type:** `decimal`

**Required:** No

Product: ALL Description: Average cost of the item, expressed in the home currency.

### TrackQtyOnHand

**Type:** `boolean`

**Required:** No

Product: QBO Description: Quantity on hand to be tracked.

### QtyOnHand

**Type:** `decimal`

**Required:** No

Product: ALL Description: Current quantity of the inventory items available for sale. Sortable: QBW

### QtyOnPurchaseOrder

**Type:** `decimal`

**Required:** No

Product: ALL Description: Quantity of the inventory item being ordered, for which there is a purchase order issued.

### QtyOnSalesOrder

**Type:** `decimal`

**Required:** No

Product: ALL Description: Quantity of the inventory item that is placed on sales orders.

### ReorderPoint

**Type:** `decimal`

**Required:** No

Product: ALL Description: Quantity on hand threshold below which a purchase order against this inventory item should be issued. When the QtyOnHand is less than the ReorderPoint, the QuickBooks purchase order system will prompt the user to reorder.

### ManPartNum

**Type:** `string`

**Required:** No

Product: ALL Description: Identifier provided by manufacturer for the Item, for example, the model number.
Applicable for the the following item types: Inventory, Product.

### DepositToAccountRef

**Type:** `ReferenceType`

**Required:** No

Product: ALL Description: Optional reference to the account in which the payment money is deposited.
If not specified, the Undeposited Funds account will be used. Applicable to the Payment item type only.

### SalesTaxCodeRef

**Type:** `ReferenceType`

**Required:** No

Product: ALL Description: Reference to the sales tax code for the item.
Applicable to the Service, Other Charge, Part (Non-Inventory), Inventory and Assembly item types only.

### PurchaseTaxCodeRef

**Type:** `ReferenceType`

**Required:** No

Product: ALL Description: Reference to the purchase tax code for the item.
Applicable to the Service, Other Charge, and Part (Non-Inventory) item types.

### InvStartDate

**Type:** `date`

**Required:** No

Product: ALL Description: Date of the opening balance for the inventory transaction. QuickBooks creates the Opening Balance inventory transaction as of the given date, and calculates the total value by multiplying the cost by the quantity on hand.
Applies to the Quantity On Hand and Total Value.
Applicable to the Inventory and Assembly item types only.

### BuildPoint

**Type:** `decimal`

**Required:** No

Product: ALL Description: Assembly item QuantityOnHand threshold below which more assemblies should be built.
Applicable to the Assembly Item type only.
When he quantity of the assembly item gets below the BuildPoint number, QuickBooks will remind the user to build more.

### PrintGroupedItems

**Type:** `boolean`

**Required:** No

Product: QBW Description: Lets us know if the user wants to display the subitems as a group. Applicable to items of Group type only. Filterable: QBW

### SpecialItem

**Type:** `boolean`

**Required:** No

Product: ALL Description: True if this is a special item used by QuickBooks in certain accounting functions, including miscellaneous charges that do not fall into the categories of service, labor, materials, or parts. Examples include delivery charges, setup fees, and service charges.

### SpecialItemType

**Type:** `SpecialItemTypeEnum`

**Required:** No

Product: ALL Description Type of special item, if SpecialItem is true.

### ItemGroupDetail

**Type:** `ItemGroupDetail`

**Required:** No

Product: ALL Description: Contains the detailed components of the group. Applicable to a group item only.

### ItemAssemblyDetail

**Type:** `ItemAssemblyDetail`

**Required:** No

Product: ALL Description: Contains the detailed inventory parts used when the assembly is built. Applicable to an inventory assembly item only.

### AbatementRate

**Type:** `decimal`

**Required:** No

Product: QBO Description: India sales tax abatement rate.

### ReverseChargeRate

**Type:** `decimal`

**Required:** No

Product: QBO Description: India sales tax reverse charge rate.

### ServiceType

**Type:** `string`

**Required:** No

Product: QBO Description: India sales tax service type, see ServiceTypeEnum for values.

### ItemCategoryType

**Type:** `string`

**Required:** No

Product: QBO Description: Categorizes the given item as a product or a service. The applicable values are those exposed through the ItemCategoryTypeEnum. This is currently applicable only in FR region.

### ItemEx

**Type:** `IntuitAnyType`

**Required:** No

Internal use only: extension place holder for Item

### TaxClassificationRef

**Type:** `ReferenceType`

**Required:** No

Product: ALL Description: Reference to the SalesTaxCode for this item.

### UQCDisplayText

**Type:** `string`

**Required:** No

Product: ALL Description: Unit of measure (UQC) text to be displayed for this line item in Invoice/Sales forms. Applicable for IN Region.

### UQCId

**Type:** `string`

**Required:** No

Product: ALL Description: Unit of measure for this line item as per the standard unit (UQC) defined under the GST rule. Example: KGS- kilograms, MTR- metres, SQF- square feet. It will be shown in GSTR1 report. Applicable for IN Region.

### ClassRef

**Type:** `ReferenceType`

**Required:** No

Product: QBO Description: Reference to the Class for this item.

### Source

**Type:** `string`

**Required:** No

Product: QBO Description: Originating source of the Item. Valid values are defined in SourceTypeEnum

### DeferredRevenue

**Type:** `boolean`

**Required:** No

Product: QBO Description: Use the DeferredRevenue property to indicate that the goods/services sold have not yet been delivered to the customer, and therefore not appropriate for the accounting engine to book as Revenue for accounting.

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

### Create an Inventory Item (JavaScript/Node.js)

```javascript
const axios = require('axios');

const createItem = async (realmId, accessToken) => {
  const item = {
    "Name": "Widget",
    "Type": "Inventory",
    "QtyOnHand": 100,
    "InvStartDate": "2024-01-01",
    "TrackQtyOnHand": true,
    "IncomeAccountRef": {
      "value": "1"
    },
    "ExpenseAccountRef": {
      "value": "80"
    },
    "AssetAccountRef": {
      "value": "81"
    },
    "UnitPrice": 25.00,
    "PurchaseCost": 10.00
  };

  const response = await axios.post(
    `https://quickbooks.api.intuit.com/v3/company/${realmId}/item`,
    item,
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

### Create a Service Item

```javascript
const createServiceItem = async (realmId, accessToken) => {
  const item = {
    "Name": "Consulting Services",
    "Type": "Service",
    "IncomeAccountRef": {
      "value": "1"
    },
    "UnitPrice": 150.00
  };

  const response = await axios.post(
    `https://quickbooks.api.intuit.com/v3/company/${realmId}/item`,
    item,
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
