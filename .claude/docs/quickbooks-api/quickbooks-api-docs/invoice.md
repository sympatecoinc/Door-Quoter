# Invoice API Reference

## Description

Product: QBO Description: The Invoice entity represents an invoice to a customer. Invoice could be based on salesterm with invoice and due dates for payment. Invoice supports sales tax, and shipping charges as a special line item. Invoice can be printed and emailed to a customer. Business Rules: 
-  An invoice must have at least one line that describes the item and an amount.
-  An invoice must have a reference to a customer in the header. Product: QBW Description: An Invoice is a financial transaction representing a request for payment for goods or services that have been sold. An invoice is a form that records the details of a customer's purchase, such as quantity and price of the goods or services. An invoice records the amount owed by a customer who does not pay in full at the time of purchase. If full payment is received at the time of purchase, the sale may be recorded as a sales receipt, not an invoice. An invoice must contain a valid customer reference in the CustomerId field and at least one line item. The referenced customer must already exist in the QuickBooks company at the desktop and any line items must also already exists in the QuickBooks company, or the attempt to sync will fail.
In general, it is a good practice to specify all the header fields if you have the data. You should always specify the ARAccountId; otherwise a default AR account will be used and this may give you unexpected results. If you want to apply one tax to all the transaction line items, use the TaxId or TaxGroupId field. If you want to use more than one tax, you need to use Tax Line items instead. Business Rules: 
-  An invoice must have at least one line that describes the item. 
-  If an account is specified in the header, the account must be of the Accounts Receivable (AR) type. 
-  An invoice must have a reference to a customer in the header.

## API Endpoint

```
POST /v3/company/{realmId}/invoice
GET /v3/company/{realmId}/invoice/{id}
```

**Extends:** `SalesTransaction`

## Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `Id` | `id` | No | Product: ALL Description: Unique Identifier for an Intuit entity (object).  Required for the update ... |
| `SyncToken` | `string` | No | Product: ALL Description: Version number of the entity. The SyncToken is used to lock the entity for... |
| `MetaData` | `ModificationMetaData` | No | Product: ALL Description: Descriptive information about the entity. The MetaData values are set by D... |
| `CustomField` | `CustomField` | No | Product: QBW Description: Custom field (or data extension). Filterable: QBW |
| `AttachableRef` | `AttachableRef` | No | Specifies entity name of the attachment from where the attachment was requested |
| `DocNumber` | `string` | No | Product: ALL Description: QBO: Reference number for the transaction. If DocNumber is not provided, a... |
| `TxnDate` | `date` | No | Product: ALL Description: QBO: The date entered by the user when this transaction occurred.  Often, ... |
| `DepartmentRef` | `ReferenceType` | No | Product: QBO Description: Location of the transaction, as defined using location tracking in QuickBo... |
| `CurrencyRef` | `ReferenceType` | No | Product: ALL Description: Reference to the Currency in which all amounts on the associated transacti... |
| `ExchangeRate` | `decimal` | No | Product: ALL Description: Currency exchange rate. Valid only if the company file is set up to use Mu... |
| `PrivateNote` | `string` | No | Product: ALL Description: User entered, organization-private note about the transaction. This note w... |
| `TxnStatus` | `string` | No | Product: ALL Description: QBW: The status of the transaction. Depending on the transaction type it m... |
| `LinkedTxn` | `LinkedTxn` | No | Product: ALL Description: A linked (related) transaction. More than one transaction can be linked. |
| `Line` | `Line` | No | Product: QBW Description: A line item of a transaction. Product: QBO Description: A line item of a t... |
| `TxnTaxDetail` | `TxnTaxDetail` | No | Product: ALL Description: Details of taxes charged on the transaction as a whole. For US versions of... |
| `TxnSource` | `string` | No | Product: QBO Description: Originating source of the Transaction. Valid values are defined in TxnSour... |
| `TaxFormType` | `string` | No | Description: refer TaxFormTypeEnum. Tax Form Type holds data related to Tax Information, values base... |
| `TaxFormNum` | `string` | No | Description: Tax Form Num holds data related to Tax Information based on Regional compliance laws.Th... |
| `TransactionLocationType` | `string` | No | Product: QBO Description: Location of the purchase or sale transaction. The applicable values are th... |
| `Tag` | `Tag` | No | Product: QBO Descripton: List of tags used to identify the transaction. |
| `TxnApprovalInfo` | `TxnApprovalInfo` | No | Product: QBO Description: Details of the Approval Status for current transaction in QBO workflows. |
| `RecurDataRef` | `ReferenceType` | No | Product: QBO Description: Reference to the RecurTemplate which was used to create the Transaction In... |
| `RecurringInfo` | `RecurringInfo` | No | Product: QBO Description: The Recurring Schedule information for the Transaction |
| `ProjectRef` | `ReferenceType` | No | Product: ALL Description: Project identifier References to the project this transaction is associate... |
| `TotalCostAmount` | `decimal` | No | Product: ALL Description: Project Estimate identifier The amount or equivalent paid or charged for a... |
| `HomeTotalCostAmount` | `decimal` | No | Product: ALL Description: Project Estimate identifier The amount or equivalent paid or charged for a... |
| `AutoDocNumber` | `boolean` | No | Product: QBO Description: If AutoDocNumber is true, DocNumber is generated automatically. If false o... |
| `CustomerRef` | `ReferenceType` | No | Product: ALL Description: Reference to a Customer or job. Filterable: QBW InputType: ReadWrite Busin... |
| `CustomerMemo` | `MemoRef` | No | Product: ALL Description: QBO: For an Invoice, this is the user-entered message to the customer that... |
| `BillAddr` | `PhysicalAddress` | No | Product: ALL Description: QBO: Bill-to address of the Invoice. See [a href="http://ipp.developer.int... |
| `ShipAddr` | `PhysicalAddress` | No | Product: ALL Description: QBO: Shipping address of the Invoice. See [a href="http://ipp.developer.in... |
| `FreeFormAddress` | `boolean` | No | Product: QBO Description: Specifies whether shipping address is in free-form or structured-form (cit... |
| `ShipFromAddr` | `PhysicalAddress` | No | Product: ALL Description: QBO: Shipping from address of the Invoice. See [a href="http://ipp.develop... |
| `RemitToRef` | `ReferenceType` | No | Product: QBW Description: Reference to the party receiving payment. InputType: ReadOnly |
| `ClassRef` | `ReferenceType` | No | Product: QBW Description: Reference to the Class associated with the transaction. InputType: ReadWri... |
| `SalesTermRef` | `ReferenceType` | No | Product: QBW Description: Reference to the SalesTerm associated with the transaction. InputType: Rea... |
| `DueDate` | `date` | No | Product: ALL Description: QBW: Date when the payment of the transaction is due. Description: QBO: Da... |
| `SalesRepRef` | `ReferenceType` | No | Product: QBW Description: Reference to the SalesRep associated with the transaction. InputType: Read... |
| `PONumber` | `string` | No | Product: ALL Description: Purchase Order number. ValidRange: QBW: max=25 ValidRange: QBO: max=15 |
| `FOB` | `string` | No | Product: ALL Description: "Free On Board", the terms between buyer and seller regarding transportati... |
| `ShipMethodRef` | `ReferenceType` | No | Product: QBW Description: Reference to the ShipMethod associated with the transaction. InputType: Re... |
| `ShipDate` | `date` | No | Product: QBW Description: Date for delivery of goods or services. InputType: ReadWrite |
| `TrackingNum` | `string` | No | Product: QBW Description: Shipping provider's tracking number for the delivery of the goods associat... |
| `GlobalTaxCalculation` | `GlobalTaxCalculationEnum` | No | Product: QBO Description: Indicates the GlobalTax model if the model inclusive of tax, exclusive of ... |
| `TotalAmt` | `decimal` | No | Product: All Description: QBO: Indicates the total amount of the transaction. This includes the tota... |
| `HomeTotalAmt` | `decimal` | No | Product: ALL Description: QBW: Total amount of the transaction in the home currency for multi-curren... |
| `ApplyTaxAfterDiscount` | `boolean` | No | Product: QBO Description: If false or null, calculate the sales tax first, and then apply the discou... |
| `ShippingTaxIncludedInTotalTax` | `boolean` | No | Product: QBO Description: During total tax override (when user specifies TxnTaxDetail.TotalTax), if ... |
| `TemplateRef` | `ReferenceType` | No | Product: QBW Description: Reference to the Template for the invoice form. InputType: ReadWrite |
| `PrintStatus` | `PrintStatusEnum` | No | Product: ALL Description: Printing status of the invoice.  InputType: ReadWrite |
| `EmailStatus` | `EmailStatusEnum` | No | Product: ALL Description: Email status of the invoice.  InputType: ReadWrite |
| `BillEmail` | `EmailAddress` | No | Product: QBO Description: Identifies the e-mail address where the invoice is sent. At present, you c... |
| `BillEmailCc` | `EmailAddress` | No | Product: QBO Description: Identifies the cc e-mail address where the invoice is sent. If the ToBeEma... |
| `BillEmailBcc` | `EmailAddress` | No | Product: QBO Description: Identifies the bcc e-mail address where the invoice is sent. If the ToBeEm... |
| `ARAccountRef` | `ReferenceType` | No | Product: QBW Description: Reference to the ARAccount (accounts receivable account) associated with t... |
| `Balance` | `decimal` | No | Product: QBO Description: The balance reflecting any payments made against the transaction. Initiall... |
| `HomeBalance` | `decimal` | No | Product: QBO Description: The balance reflecting any payments made against the transaction in home c... |
| `FinanceCharge` | `boolean` | No | Product: ALL Description: Indicates whether the transaction is a finance charge. InputType: ReadWrit... |
| `PaymentMethodRef` | `ReferenceType` | No | Product: ALL Description: Reference to the PaymentMethod. InputType: ReadWrite |
| `PaymentRefNum` | `string` | No | Product: QBO Description: The reference number for the payment received (I.e. Check # for a check, e... |
| `PaymentType` | `PaymentTypeEnum` | No | Product: QBO Description: Valid values are Cash, Check, CreditCard, or Other. No defaults. Cash base... |
| `DepositToAccountRef` | `ReferenceType` | No | Product: ALL Description: QBW: Reference to the DepositToAccount entity. If not specified, the Undep... |
| `DeliveryInfo` | `TransactionDeliveryInfo` | No | Product: QBO Description: Last delivery info of this transaction. |
| `DiscountRate` | `decimal` | No | Product: QBO Description: Indicates the discount rate that is applied on the transaction as a whole.... |
| `DiscountAmt` | `decimal` | No | Product: QBO Description: Indicates the discount amount that is applied on the transaction as a whol... |
| `GovtTxnRefIdentifier` | `string` | No | Product: QBO Description: this is the reference to the NotaFiscal created for the salesTransaction. ... |
| `TaxExemptionRef` | `ReferenceType` | No | Product: ALL Description: Reference to the TaxExemptionId and TaxExemptionReason for this customer. |
| `CheckPayment` | `CheckPayment` | No | Product: ALL Description Information about a check payment for the Invoice. NotApplicableTo: Estimat... |
| `CreditCardPayment` | `CreditCardPayment` | No | Product: ALL Description Information about a credit card payment for the Invoice. NotApplicableTo: E... |
| `Deposit` | `decimal` | No | Product: QBO Description: Amount in deposit against the Invoice. Supported for Invoice only. |
| `AllowIPNPayment` | `boolean` | No | Product: QBO Description: Specifies whether customer is allowed to use IPN to pay the Invoice |
| `AllowOnlinePayment` | `boolean` | No | Product: QBO Description: Specifies whether customer is allowed to use eInvoicing(online payment) to... |
| `AllowOnlineCreditCardPayment` | `boolean` | No | Product: QBO Description: Specifies whether customer is allowed to use eInvoicing(online payment -cr... |
| `AllowOnlineACHPayment` | `boolean` | No | Product: QBO Description: Specifies whether customer is allowed to use eInvoicing(online payment -ba... |
| `AllowOnlinePayPalPayment` | `boolean` | No | Product: QBO Description: Specifies whether customer is allowed to use eInvoicing(online payment -pa... |
| `EInvoiceStatus` | `ETransactionStatusEnum` | No | Product: QBO Description: Specifies the eInvoice Status(SENT, VIEWED, PAID) for the invoice |
| `ECloudStatusTimeStamp` | `dateTime` | No | Product: QBO Description: Specifies the eCloudStatus timeStamp(last Viewed/Sent/paid) for the invoic... |
| `CfdiUse` | `int` | No | Product: QBO Description: Use of Invoice of a transaction which is required by CFDI4.0 in Mexico. Vi... |
| `Exportation` | `string` | No | Product: QBO Description: Exportation type of a transaction which is required by CFDI4.0 in Mexico. ... |
| `GlobalInfo` | `MXGlobalInfo` | No | Product: QBO Description: Global invoice data of a transaction which is required by CFDI4.0 in Mexic... |
| `invoiceStatus` | `string` | No | Product: QBO Description: provides invoice statuses : MULTIPLE_ERRORS, DEPOSIT_ON_HOLD, DISPUTED, DE... |
| `callToAction` | `string` | No | Product: QBO Description: call to action for this status |
| `invoiceStatusLog` | `StatusInfo` | No | Product: QBO Description: invoice status log |
| `InvoiceEx` | `IntuitAnyType` | No | Product: ALL Description: Extension entity for Invoice. |
| `LessCIS` | `decimal` | No | Product: All Description: QBO: Indicates the less cis amount of the transaction, specific to UK regi... |
| `InvoiceLink` | `string` | No | Product: All Description: QBO: Sharable link of the invoice for external users |
| `PaymentDetailsMessage` | `string` | No | Product: QBO Description: QBO: Message displayed to customer about payment Instructions. eg: bank ac... |
| `ConvenienceFeeDetail` | `ConvenienceFeeDetail` | No | Product: QBO Description: Internal use only: Convenience Fee detail for the invoice |
| `InvoiceLinkSecurityCode` | `string` | No | Product: All Description: QBO: Security code associated with Sharable link of the invoice for extern... |
| `InvoiceLinkExpiryDate` | `date` | No | Product: All Description: QBO: Expiry date for Sharable link of the invoice for external users |
| `AutoPayEligible` | `boolean` | No | Product: QBO Description: Indicates whether the Recurring Invoice eligible for auto payment. |
| `SchedulePayEligible` | `boolean` | No | Product: QBO Description: Indicates whether the Non-Recurring Invoice eligible for scheduled payment... |
| `ScheduledPaymentId` | `string` | No | Product: QBO Description: Unique identifier for scheduled payment for invoice. Used to indicate if i... |
| `GratuityEnabled` | `boolean` | No | Product: QBO Description: Internal use only: Indicates whether gratuity is enabled for this invoice. |
| `FinancingProductType` | `FinancingProductTypeEnum` | No | Product: QBO Description: Internal use only: Indicates invoice financing type. |
| `SubscriptionPaymentsSetting` | `SubscriptionPaymentsSettingEnum` | No | Product: QBO Description: Internal use only: Subscription payment setting for a Recurring Invoice |

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

### DocNumber

**Type:** `string`

**Required:** No

Product: ALL Description: QBO: Reference number for the transaction. If DocNumber is not provided, and the Custom Transaction Number is set to "Off", QBO assigns a document number using the next-in-sequence algorithm for Sales transactions. Otherwise the value will remaing null. Alternatively, you can also pass in "AUTO_GENERATE" in this field to force QBO to auto-sequence the document number for Invoices, Estimates and Sales Receipt.
The maximum length for DocNumber is 21 characters. The default value is an empty String. Filter support not provided for Payment. Description: QBW: The primary document number for this transaction. DocNumber is exposed to end users.
If it is not provided, QuickBooks business logic will assign the document number using the "next in sequence" algorithm.
Max. length is 11 characters for Payment, Bill, ItemReceipt and VendorCredit. Max. length is 20 characters for other entities. Filterable: QBO InputType: ReadWrite ValidRange: QBW: max=11 ValidRange: QBO: max=21

### TxnDate

**Type:** `date`

**Required:** No

Product: ALL Description: QBO: The date entered by the user when this transaction occurred. 
Often, it is the date when the transaction is created in the system. 
For "posting" transactions, this is the posting date that affects the financial statements. If the date is not supplied, the current date on the server is used. Description: QBW: The nominal, user entered, date of the transaction. 
Often, but not required to be, the date the transaction was created in the system. 
For "posting" transactions, this is the posting date that affects financial statements. Filterable: ALL Sortable: ALL InputType: ReadWrite

### DepartmentRef

**Type:** `ReferenceType`

**Required:** No

Product: QBO Description: Location of the transaction, as defined using location tracking in QuickBooks Online.

### CurrencyRef

**Type:** `ReferenceType`

**Required:** No

Product: ALL Description: Reference to the Currency in which all amounts on the associated transaction are expressed.
 InputType: ReadWrite

### ExchangeRate

**Type:** `decimal`

**Required:** No

Product: ALL Description: Currency exchange rate. Valid only if the company file is set up to use Multi-Currency feature. In QuickBooks, exchange rates are always recorded as the number of home currency units it takes to equal one foreign currency unit. The foreign unit is always 1 and the amount of home units that equal that 1 foreign unit is what QuickBooks uses as the exchange rate. InputType: ReadWrite

### PrivateNote

**Type:** `string`

**Required:** No

Product: ALL Description: User entered, organization-private note about the transaction. This note will not appear on the transaction records by default. InputType: ReadWrite

### TxnStatus

**Type:** `string`

**Required:** No

Product: ALL Description: QBW: The status of the transaction. Depending on the transaction type it may have different values.
For Sales Transactions acceptable values are defined in PaymentStatusEnum. For Estimate, the values accepted are defined in EstimateStatusEnum. Description: QBO: The status of the transaction. Depending on the transaction type it may have different values.
For Sales Transactions acceptable values are defined in PaymentStatusEnum. For Estimate, the values accepted are defined in QboEstimateStatusEnum. Filterable:QBW

### LinkedTxn

**Type:** `LinkedTxn`

**Required:** No

Product: ALL Description: A linked (related) transaction. More than one transaction can be linked.

### Line

**Type:** `Line`

**Required:** No

Product: QBW Description: A line item of a transaction. Product: QBO Description: A line item of a transaction. QuickBooks Online does not support tax lines in the main transaction body, only in the TxnTaxDetail section.

### TxnTaxDetail

**Type:** `TxnTaxDetail`

**Required:** No

Product: ALL Description: Details of taxes charged on the transaction as a whole. For US versions of QuickBooks, tax rates used in the detail section must not be used in any tax line appearing in the main transaction body. For international versions of QuickBooks, the TxnTaxDetail should provide the details of all taxes (sales or purchase) calculated for the transaction based on the tax codes referenced by the transaction. This can be calculated by QuickBooks business logic or you may supply it when adding a transaction. For US versions of QuickBooks you need only supply the tax code for the customer and the tax code (in the case of multiple rates) or tax rate (for a single rate) to apply for the transaction as a whole.
See [a href="http://ipp.developer.intuit.com/0010_Intuit_Partner_Platform/0060_Financial_Management_Services_(v3)/01100_Global_Tax_Model"]Global Tax Model[/a].

### TxnSource

**Type:** `string`

**Required:** No

Product: QBO Description: Originating source of the Transaction. Valid values are defined in TxnSourceEnum: QBMobile.

### TaxFormType

**Type:** `string`

**Required:** No

Description: refer TaxFormTypeEnum. Tax Form Type holds data related to Tax Information, values based on regional compliance laws. Applicable for IN Region and can be extended for other Regions.

### TaxFormNum

**Type:** `string`

**Required:** No

Description: Tax Form Num holds data related to Tax Information based on Regional compliance laws.This is applicable for IN region and can be extended to other regions in future.

### TransactionLocationType

**Type:** `string`

**Required:** No

Product: QBO Description: Location of the purchase or sale transaction. The applicable values are those exposed through the TransactionLocationTypeEnum. This is currently applicable only for the FR region.

### Tag

**Type:** `Tag`

**Required:** No

Product: QBO Descripton: List of tags used to identify the transaction.

### TxnApprovalInfo

**Type:** `TxnApprovalInfo`

**Required:** No

Product: QBO Description: Details of the Approval Status for current transaction in QBO workflows.

### RecurDataRef

**Type:** `ReferenceType`

**Required:** No

Product: QBO Description: Reference to the RecurTemplate which was used to create the Transaction InputType: Read

### RecurringInfo

**Type:** `RecurringInfo`

**Required:** No

Product: QBO Description: The Recurring Schedule information for the Transaction

### ProjectRef

**Type:** `ReferenceType`

**Required:** No

Product: ALL Description: Project identifier References to the project this transaction is associated with

### TotalCostAmount

**Type:** `decimal`

**Required:** No

Product: ALL Description: Project Estimate identifier The amount or equivalent paid or charged for a product/service

### HomeTotalCostAmount

**Type:** `decimal`

**Required:** No

Product: ALL Description: Project Estimate identifier The amount or equivalent paid or charged for a product/service when using multi-currency

### AutoDocNumber

**Type:** `boolean`

**Required:** No

Product: QBO Description: If AutoDocNumber is true, DocNumber is generated automatically. If false or null, the DocNumber is generated based on preference of the user.

### CustomerRef

**Type:** `ReferenceType`

**Required:** No

Product: ALL Description: Reference to a Customer or job. Filterable: QBW InputType: ReadWrite BusinessRules: QBW: CustomerRef is mandatory for some SalesTransactions like Invoice

### CustomerMemo

**Type:** `MemoRef`

**Required:** No

Product: ALL Description: QBO: For an Invoice, this is the user-entered message to the customer that does appear in the invoice, and does appear in the printed invoice. The maximum length for Invoice Msg is 1000 characters.
For a Bill, this is the memo of the transaction to provide more detail, and does not appear in the printed message of the bill. The maximum length for Bill Msg is 4000 characters.
For a CreditCardCharge, this message appears in the printed record; maximum length is 4000 characters.
Not supported for BillPayment, JournalEntry or Payment. Description: QBW: User-entered message to the customer; this message will be visible to end user on their transactions. InputType: ReadWrite

### BillAddr

**Type:** `PhysicalAddress`

**Required:** No

Product: ALL Description: QBO: Bill-to address of the Invoice.
See [a href="http://ipp.developer.intuit.com/0010_Intuit_Partner_Platform/0060_Financial_Management_Services_(v3)/01000_Using_Data_Service_Entities#Addresses"]Addresses[/a] Description: QBW: The physical (postal) address where the bill or invoice is sent.
See [a href="http://ipp.developer.intuit.com/0010_Intuit_Partner_Platform/0060_Financial_Management_Services_(v3)/01000_Using_Data_Service_Entities#Addresses"]Addresses[/a] InputType: ReadWrite

### ShipAddr

**Type:** `PhysicalAddress`

**Required:** No

Product: ALL Description: QBO: Shipping address of the Invoice.
See [a href="http://ipp.developer.intuit.com/0010_Intuit_Partner_Platform/0060_Financial_Management_Services_(v3)/01000_Using_Data_Service_Entities#Addresses"]Addresses[/a] Description: QBW: Identifies the address where the goods must be shipped. 
QuickBooks Note: If ShipAddr is not specified, and a default ship-to address is specified in QuickBooks for this customer, the default ship-to address will be used by QuickBooks.
See [a href="http://ipp.developer.intuit.com/0010_Intuit_Partner_Platform/0060_Financial_Management_Services_(v3)/01000_Using_Data_Service_Entities#Addresses"]Addresses[/a]

### FreeFormAddress

**Type:** `boolean`

**Required:** No

Product: QBO Description: Specifies whether shipping address is in free-form or structured-form (city/state etc.)

### ShipFromAddr

**Type:** `PhysicalAddress`

**Required:** No

Product: ALL Description: QBO: Shipping from address of the Invoice.
See [a href="http://ipp.developer.intuit.com/0010_Intuit_Partner_Platform/0060_Financial_Management_Services_(v3)/01000_Using_Data_Service_Entities#Addresses"]Addresses[/a] Description: QBW: Identifies the address where the goods are shipped from. For transactions without shipping, it represents the address where the sale took place.

### RemitToRef

**Type:** `ReferenceType`

**Required:** No

Product: QBW Description: Reference to the party receiving payment. InputType: ReadOnly

### ClassRef

**Type:** `ReferenceType`

**Required:** No

Product: QBW Description: Reference to the Class associated with the transaction. InputType: ReadWrite

### SalesTermRef

**Type:** `ReferenceType`

**Required:** No

Product: QBW Description: Reference to the SalesTerm associated with the transaction. InputType: ReadWrite

### DueDate

**Type:** `date`

**Required:** No

Product: ALL Description: QBW: Date when the payment of the transaction is due. Description: QBO: Date when the invoice is to be paid, not including any early-payment discount incentives, or late payment penalties. If the date is not supplied, the current date on the server is used. Filterable: QBW InputType: ReadWrite BusinessRules: QBW: Following are the BusinessRules regarding DueDate of transaction

### SalesRepRef

**Type:** `ReferenceType`

**Required:** No

Product: QBW Description: Reference to the SalesRep associated with the transaction. InputType: ReadWrite

### PONumber

**Type:** `string`

**Required:** No

Product: ALL Description: Purchase Order number. ValidRange: QBW: max=25 ValidRange: QBO: max=15

### FOB

**Type:** `string`

**Required:** No

Product: ALL Description: "Free On Board", the terms between buyer and seller regarding transportation costs; does not have any bookkeeping implications. Description: "Free On Board", the terms between buyer and seller regarding transportation costs; does not have any bookkeeping implications. ValidRange: QBW: max=13 ValidRange: QBO: max=15

### ShipMethodRef

**Type:** `ReferenceType`

**Required:** No

Product: QBW Description: Reference to the ShipMethod associated with the transaction. InputType: ReadWrite

### ShipDate

**Type:** `date`

**Required:** No

Product: QBW Description: Date for delivery of goods or services. InputType: ReadWrite

### TrackingNum

**Type:** `string`

**Required:** No

Product: QBW Description: Shipping provider's tracking number for the delivery of the goods associated with the transaction.

### GlobalTaxCalculation

**Type:** `GlobalTaxCalculationEnum`

**Required:** No

Product: QBO Description: Indicates the GlobalTax model if the model inclusive of tax, exclusive of taxes or not applicable

### TotalAmt

**Type:** `decimal`

**Required:** No

Product: All Description: QBO: Indicates the total amount of the transaction. This includes the total of all the charges, allowances and taxes. By default, this is recalculated based on sub items total and overridden. Description: QBW: Indicates the total amount of the transaction. This includes the total of all the charges, allowances and taxes.
Calculated by QuickBooks business logic; cannot be written to QuickBooks. Filterable: QBW Sortable: QBW InputType: QBW: OverrideOnSync

### HomeTotalAmt

**Type:** `decimal`

**Required:** No

Product: ALL Description: QBW: Total amount of the transaction in the home currency for multi-currency enabled companies. Single currency companies will not have this field. Includes the total of all the charges, allowances and taxes. Calculated by QuickBooks business logic. Cannot be written to QuickBooks. InputType: QBW: ReadOnly

### ApplyTaxAfterDiscount

**Type:** `boolean`

**Required:** No

Product: QBO Description: If false or null, calculate the sales tax first, and then apply the discount. If true, subtract the discount first and then calculate the sales tax.

### ShippingTaxIncludedInTotalTax

**Type:** `boolean`

**Required:** No

Product: QBO Description: During total tax override (when user specifies TxnTaxDetail.TotalTax), if this is set to true, system overrides all taxes including the shipping tax, otherwise (if false or null) only non shipping taxes are overridden and original shipping tax is added to the total tax.

### TemplateRef

**Type:** `ReferenceType`

**Required:** No

Product: QBW Description: Reference to the Template for the invoice form. InputType: ReadWrite

### PrintStatus

**Type:** `PrintStatusEnum`

**Required:** No

Product: ALL Description: Printing status of the invoice.
 InputType: ReadWrite

### EmailStatus

**Type:** `EmailStatusEnum`

**Required:** No

Product: ALL Description: Email status of the invoice.
 InputType: ReadWrite

### BillEmail

**Type:** `EmailAddress`

**Required:** No

Product: QBO Description: Identifies the e-mail address where the invoice is sent. At present, you can provide only one e-mail address.
If the ToBeEmailed attribute is true and the BillEmail attribute contains an e-mail address, the user can send an e-mail message to the e-mail address that is specified in the BillEmail attribute.
If the BillEmail attribute contains an invalid e-mail address, QBO does not send the e-mail message to the invalid e-mail address. QBO also does not return any error message to indicate that the e-mail address is invalid.
The maximum length for BillEmail is 100 characters. Product: QBW Description: Identifies the email address where the bill or invoice is sent. 
UNSUPPORTED FIELD.

### BillEmailCc

**Type:** `EmailAddress`

**Required:** No

Product: QBO Description: Identifies the cc e-mail address where the invoice is sent. If the ToBeEmailed attribute is true and the BillEmailCc attribute contains an e-mail address, the user can send an e-mail message to the e-mail address that is specified in the BillEmailCc attribute.
 If the BillEmailCc attribute contains an invalid e-mail address, QBO does not send the e-mail message to the invalid cc e-mail address. 
The maximum length for BillEmailCc is 200 characters. Product: QBW Description: Identifies the cc email address where the bill or invoice is sent.

### BillEmailBcc

**Type:** `EmailAddress`

**Required:** No

Product: QBO Description: Identifies the bcc e-mail address where the invoice is sent. If the ToBeEmailed attribute is true and the BillEmailBcc attribute contains an e-mail address, the user can send an e-mail message to the e-mail address that is specified in the BillEmailBcc attribute.
 If the BillEmailCc attribute contains an invalid bcc e-mail address, QBO does not send the e-mail message to the invalid bcc e-mail address. 
The maximum length for BillEmailBcc is 200 characters. Product: QBW Description: Identifies the bcc email address where the bill or invoice is sent as bcc.

### ARAccountRef

**Type:** `ReferenceType`

**Required:** No

Product: QBW Description: Reference to the ARAccount (accounts receivable account) associated with the transaction. InputType: ReadWrite

### Balance

**Type:** `decimal`

**Required:** No

Product: QBO Description: The balance reflecting any payments made against the transaction. Initially this will be equal to the TotalAmt. Product: QBW Description: Indicates the unpaid amount of the transaction. Filterable: ALL Sortable: QBW InputType: ReadOnly

### HomeBalance

**Type:** `decimal`

**Required:** No

Product: QBO Description: The balance reflecting any payments made against the transaction in home currency. Initially this will be equal to the HomeTotalAmt.
Read-only field. Product: QBW Description: Indicates the unpaid amount of the transaction in home currency.
Cannot be written to QuickBooks. Filterable: ALL Sortable: QBW

### FinanceCharge

**Type:** `boolean`

**Required:** No

Product: ALL Description: Indicates whether the transaction is a finance charge. InputType: ReadWrite

### PaymentMethodRef

**Type:** `ReferenceType`

**Required:** No

Product: ALL Description: Reference to the PaymentMethod. InputType: ReadWrite

### PaymentRefNum

**Type:** `string`

**Required:** No

Product: QBO Description: The reference number for the payment received (I.e. Check # for a check, envelope # for a cash donation, CreditCardTransactionID for a credit card payment)

### PaymentType

**Type:** `PaymentTypeEnum`

**Required:** No

Product: QBO Description: Valid values are Cash, Check, CreditCard, or Other. No defaults. Cash based expense is not supported by QuickBooks Windows. NotApplicableTo: Estimate, SalesOrder

### DepositToAccountRef

**Type:** `ReferenceType`

**Required:** No

Product: ALL Description: QBW: Reference to the DepositToAccount entity. If not specified, the Undeposited Funds account will be used. Description: QBO: Asset account where the payment money is deposited. If you do not specify this account, QBO uses the Undeposited Funds account. Supported for Payment and SalesReceipt only. NotApplicableTo: QBW: Estimate, SalesOrder

### DeliveryInfo

**Type:** `TransactionDeliveryInfo`

**Required:** No

Product: QBO Description: Last delivery info of this transaction.

### DiscountRate

**Type:** `decimal`

**Required:** No

Product: QBO Description: Indicates the discount rate that is applied on the transaction as a whole. This will be pro-rated through item lines for tax calculation.

### DiscountAmt

**Type:** `decimal`

**Required:** No

Product: QBO Description: Indicates the discount amount that is applied on the transaction as a whole. This will be pro-rated through item lines for tax calculation.

### GovtTxnRefIdentifier

**Type:** `string`

**Required:** No

Product: QBO Description: this is the reference to the NotaFiscal created for the salesTransaction. ValidRange: QBO: max=30

### TaxExemptionRef

**Type:** `ReferenceType`

**Required:** No

Product: ALL Description: Reference to the TaxExemptionId and TaxExemptionReason for this customer.

### CheckPayment

**Type:** `CheckPayment`

**Required:** No

Product: ALL Description Information about a check payment for the Invoice. NotApplicableTo: Estimate, SalesOrder

### CreditCardPayment

**Type:** `CreditCardPayment`

**Required:** No

Product: ALL Description Information about a credit card payment for the Invoice. NotApplicableTo: Estimate, SalesOrder

### Deposit

**Type:** `decimal`

**Required:** No

Product: QBO Description: Amount in deposit against the Invoice. Supported for Invoice only.

### AllowIPNPayment

**Type:** `boolean`

**Required:** No

Product: QBO Description: Specifies whether customer is allowed to use IPN to pay the Invoice

### AllowOnlinePayment

**Type:** `boolean`

**Required:** No

Product: QBO Description: Specifies whether customer is allowed to use eInvoicing(online payment) to pay the Invoice

### AllowOnlineCreditCardPayment

**Type:** `boolean`

**Required:** No

Product: QBO Description: Specifies whether customer is allowed to use eInvoicing(online payment -credit card) to pay the Invoice

### AllowOnlineACHPayment

**Type:** `boolean`

**Required:** No

Product: QBO Description: Specifies whether customer is allowed to use eInvoicing(online payment -bank or ach) to pay the Invoice

### AllowOnlinePayPalPayment

**Type:** `boolean`

**Required:** No

Product: QBO Description: Specifies whether customer is allowed to use eInvoicing(online payment -paypal or venmo) to pay the Invoice

### EInvoiceStatus

**Type:** `ETransactionStatusEnum`

**Required:** No

Product: QBO Description: Specifies the eInvoice Status(SENT, VIEWED, PAID) for the invoice

### ECloudStatusTimeStamp

**Type:** `dateTime`

**Required:** No

Product: QBO Description: Specifies the eCloudStatus timeStamp(last Viewed/Sent/paid) for the invoice

### CfdiUse

**Type:** `int`

**Required:** No

Product: QBO Description: Use of Invoice of a transaction which is required by CFDI4.0 in Mexico. Visit http://omawww.sat.gob.mx/tramitesyservicios/Paginas/anexo_20_version3-3.htm and find the catalogues that contain the accepted values of cfdiUse.

### Exportation

**Type:** `string`

**Required:** No

Product: QBO Description: Exportation type of a transaction which is required by CFDI4.0 in Mexico. Visit http://omawww.sat.gob.mx/tramitesyservicios/Paginas/anexo_20_version3-3.htm and find the catalogues that contain the accepted values of Exportation.

### GlobalInfo

**Type:** `MXGlobalInfo`

**Required:** No

Product: QBO Description: Global invoice data of a transaction which is required by CFDI4.0 in Mexico.

### invoiceStatus

**Type:** `string`

**Required:** No

Product: QBO Description: provides invoice statuses : MULTIPLE_ERRORS, DEPOSIT_ON_HOLD, DISPUTED, DEPOSIT_FAILED, PAYMENT_FAILED, OVERDUE_VIEWED, OVERDUE_NOT_SENT, OVERDUE_SENT, DUE_VIEWED, DUE_NOT_SENT, DUE_SENT, PAID_NOT_DEPOSITED, PARTIALLY_PAID, DEPOSITED, VOIDED, REVERSED

### callToAction

**Type:** `string`

**Required:** No

Product: QBO Description: call to action for this status

### invoiceStatusLog

**Type:** `StatusInfo`

**Required:** No

Product: QBO Description: invoice status log

### InvoiceEx

**Type:** `IntuitAnyType`

**Required:** No

Product: ALL Description: Extension entity for Invoice.

### LessCIS

**Type:** `decimal`

**Required:** No

Product: All Description: QBO: Indicates the less cis amount of the transaction, specific to UK region companies

### InvoiceLink

**Type:** `string`

**Required:** No

Product: All Description: QBO: Sharable link of the invoice for external users

### PaymentDetailsMessage

**Type:** `string`

**Required:** No

Product: QBO Description: QBO: Message displayed to customer about payment Instructions. eg: bank account info.

### ConvenienceFeeDetail

**Type:** `ConvenienceFeeDetail`

**Required:** No

Product: QBO Description: Internal use only: Convenience Fee detail for the invoice

### InvoiceLinkSecurityCode

**Type:** `string`

**Required:** No

Product: All Description: QBO: Security code associated with Sharable link of the invoice for external users

### InvoiceLinkExpiryDate

**Type:** `date`

**Required:** No

Product: All Description: QBO: Expiry date for Sharable link of the invoice for external users

### AutoPayEligible

**Type:** `boolean`

**Required:** No

Product: QBO Description: Indicates whether the Recurring Invoice eligible for auto payment.

### SchedulePayEligible

**Type:** `boolean`

**Required:** No

Product: QBO Description: Indicates whether the Non-Recurring Invoice eligible for scheduled payment.

### ScheduledPaymentId

**Type:** `string`

**Required:** No

Product: QBO Description: Unique identifier for scheduled payment for invoice. Used to indicate if invoice has scheduled payment or not.

### GratuityEnabled

**Type:** `boolean`

**Required:** No

Product: QBO Description: Internal use only: Indicates whether gratuity is enabled for this invoice.

### FinancingProductType

**Type:** `FinancingProductTypeEnum`

**Required:** No

Product: QBO Description: Internal use only: Indicates invoice financing type.

### SubscriptionPaymentsSetting

**Type:** `SubscriptionPaymentsSettingEnum`

**Required:** No

Product: QBO Description: Internal use only: Subscription payment setting for a Recurring Invoice

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

### Create an Invoice (JavaScript/Node.js)

```javascript
const axios = require('axios');

const createInvoice = async (realmId, accessToken) => {
  const invoice = {
    "Line": [
      {
        "DetailType": "SalesItemLineDetail",
        "Amount": 100.00,
        "SalesItemLineDetail": {
          "ItemRef": {
            "value": "1",
            "name": "Services"
          }
        }
      }
    ],
    "CustomerRef": {
      "value": "1"
    },
    "BillEmail": {
      "Address": "customer@example.com"
    },
    "DueDate": "2024-02-15"
  };

  const response = await axios.post(
    `https://quickbooks.api.intuit.com/v3/company/${realmId}/invoice`,
    invoice,
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

### Read an Invoice

```javascript
const getInvoice = async (realmId, invoiceId, accessToken) => {
  const response = await axios.get(
    `https://quickbooks.api.intuit.com/v3/company/${realmId}/invoice/${invoiceId}`,
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

### Query Invoices

```javascript
const queryInvoices = async (realmId, accessToken) => {
  const query = "SELECT * FROM Invoice WHERE Balance > '0' MAXRESULTS 100";

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

### Send Invoice via Email

```javascript
const sendInvoice = async (realmId, invoiceId, accessToken) => {
  const response = await axios.post(
    `https://quickbooks.api.intuit.com/v3/company/${realmId}/invoice/${invoiceId}/send`,
    null,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/octet-stream'
      },
      params: { minorversion: 65 }
    }
  );

  return response.data;
};
```
