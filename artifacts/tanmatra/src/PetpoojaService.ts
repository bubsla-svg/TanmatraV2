import { ErpInvoiceMapper } from './ErpInvoiceMapper';
import { PosStockReconciler } from './PosStockReconciler';
import { PetpoojaWebhookAuthenticator } from './PetpoojaWebhookAuthenticator';

export interface PetpoojaItemDetail {
  itemName: string;
  qty: number | string;
  price: string;
  amount: string;
  lblUnit: string;
  sapCode: string;
  discount?: string;
  description?: string;
  hsnCode?: string;
  invoiceDate?: string;
  tax1?: string;
  tax2?: string;
  tax3?: string;
  tax4?: string;
  tax1Amount?: string;
  tax2Amount?: string;
  tax3Amount?: string;
  tax4Amount?: string;
  actualQty?: string;
  batch_code?: string;
  expiryDate?: string;
}

export interface PetpoojaPurchase {
  id?: number;
  updateStock: '1' | '0';
  status: '1' | '0';
  receiverType: string;
  invoiceDate: string;
  invoiceNumber: string;
  totalTax: string;
  totalDiscount: string;
  deliveryCharge?: string;
  discountPer?: string;
  enable_batch_wise_inventory?: 'yes' | 'no';
  itemDetails: PetpoojaItemDetail[];
  total: string;
  roundoff: string;
  restDetails: {
    sender: { senderName: string };
    receiver: { receiverType: string; receiverName: string };
  };
}

export interface PetpoojaSale {
  id?: string | number;
  updateStock: '1' | '0';
  receiverType: string;
  invoiceDate: string;
  invoiceNumber?: string;
  challanNo?: string;
  totalTax?: number | string;
  totalDiscount?: number | string;
  deliveryCharge?: number | string;
  discountPer?: number | string;
  total?: string;
  roundoff?: string;
  itemDetails: PetpoojaItemDetail[];
  restDetails: {
    sender: { senderName: string; senderGst?: string };
    receiver: { receiverType: string; receiverName: string; receiverGst?: string };
  };
}

export interface PetpoojaPurchaseSaveRequest {
  app_key: string;
  app_secret: string;
  access_token: string;
  menuSharingCode: string;
  Purchase: PetpoojaPurchase;
}

export interface PetpoojaSaleSaveRequest {
  app_key: string;
  app_secret: string;
  access_token: string;
  menuSharingCode: string;
  Sale: PetpoojaSale;
}

export interface PetpoojaStockRequest {
  app_key: string;
  app_secret: string;
  access_token: string;
  menuSharingCode: string;
  date: string; // YYYY-MM-DD
}

export interface PetpoojaStockItem {
  name: string;
  price: string;
  unit: string;
  qty: string;
  restaurant_id: string | null;
  category: string;
  sapcode: string;
}

export interface PetpoojaStockResponse {
  code: string;
  success: string;
  message: string;
  closing_json: PetpoojaStockItem[];
}

export interface PetpoojaPurchaseUnit {
  unitName: string;
  isConsumptionUnit: '1' | '0';
}

export interface PetpoojaRawMaterialItem {
  name: string;
  category?: string;
  type: 'R';
  unit: string;
  consumptionUnit: string;
  conversionQty: string | number;
  sapCode: string;
  hsnCode?: string;
  gstPer?: string | number;
  status: '1' | '0';
  isExpiry: '1' | '0';
  description?: string;
  created?: string;
  createdbyUsername?: string;
  rawMaterialPurchaseUnit: PetpoojaPurchaseUnit[];
}

export interface PetpoojaRawMaterialSaveRequest {
  app_key: string;
  app_secret: string;
  access_token: string;
  menuSharingCode: string;
  jsonData: PetpoojaRawMaterialItem[];
}

export interface PetpoojaWebhookDeliveryChargeDetails {
  delivery_charge: number;
  delivery_charge_per: number;
  delivery_charge_cgst: number;
  delivery_charge_cgst_amt: number;
  delivery_charge_sgst: number;
  delivery_charge_sgst_amt: number;
  delivery_charge_igst: number;
  delivery_charge_igst_amt: number;
  delivery_charge_cess: number;
  delivery_charge_cess_amt: number;
}

export interface PetpoojaWebhookItemDetail {
  itemname: string;
  qty: number;
  price: number;
  amount: number;
  lbl_unit: string;
  hsn_code: string;
  description: string;
  sap_code: string;
  standard_qty: number;
  item_lock: number;
  category: string;
  sub_category: string;
  tax1: number;
  tax2: number;
  tax3: number;
  tax4: number;
  tax1_amount: string;
  tax2_amount: string;
  tax3_amount: string;
  tax4_amount: string;
  yield_qty: string;
}

export interface PetpoojaWebhookSender {
  sender_gst: string;
  sender_city: string;
  sender_name: string;
  sender_state: string;
  sender_cin_no: string;
  sender_address: string;
  sender_contact: string;
}

export interface PetpoojaWebhookReceiver {
  receiver_gst: string;
  receiver_name: string;
  receiver_type: string;
  receiver_email: string | null;
  receiver_cin_no: string;
  receiver_pan_no: string;
  receiver_tan_no: string;
  receiver_address: string;
  receiver_contact: string | null;
  receiver_msme_no: string;
  receiver_pin_code: string;
}

export interface PetpoojaWebhookPoData {
  id: string;
  menuSharingCode: string;
  receiverType: string;
  deliveryDate: string;
  poNumber: string;
  totalTax: string;
  total: string;
  roundOff: string;
  itemDetails: PetpoojaWebhookItemDetail[];
  chargeDetails: {
    delivery_charge_details: PetpoojaWebhookDeliveryChargeDetails;
  };
  restDetails: {
    sender: PetpoojaWebhookSender;
    receiver: PetpoojaWebhookReceiver;
  };
  status: string;
  from_department_id: number;
  from_department_code: string;
  from_department_name: string;
  to_department_id: number;
  to_department_code: string;
  to_department_name: string;
}

export interface PetpoojaPurchaseOrderWebhookPayload {
  menuSharingCode: string;
  app_key: string;
  app_secret: string;
  access_token: string;
  data: PetpoojaWebhookPoData;
}

export interface PetpoojaWebhookResponse {
  code: string;
  success: string;
  message: string;
}

export interface PetpoojaGetPurchaseRequest {
  app_key: string;
  app_secret: string;
  access_token: string;
  menuSharingCode: string;
  from_date: string; // DD-MM-YYYY
  to_date: string;   // DD-MM-YYYY
  refId?: string;
}

export interface PetpoojaGetPurchaseItemDetail {
  prev_price: string;
  item_id: string;
  itemname: string;
  qty: number;
  price: number;
  amount: number;
  discount: string;
  lbl_unit: string;
  unit: string;
  description: string;
  hsn_code: string;
  weighted_price: number;
  invoice_date: string;
  sap_code: string;
  purchase_doc_number: string;
  purchase_invoice_number: string;
  tax1: number;
  tax2: number;
  tax3: number;
  tax4: number;
  tax1_amount: number;
  tax2_amount: number;
  tax3_amount: number;
  tax4_amount: number;
  sap_group_master_id: number;
  category: string;
  rmconv_qty: string;
  rmconv_qty_total: number;
  rmconv_unit_id: string;
  rmconv_unit: string;
  yield_qty: string;
  discount_application: string;
  container_weight: number;
  net_weight: string;
  gross_weight: number;
  batchprefix: string;
  tax_type: number;
  excise_duty: number;
  tax1_label: string;
  tax2_label: string;
  tax3_label: string;
  tax4_label: string;
}

export interface PetpoojaGetPurchaseRecord {
  purchase_id: string;
  type: string;
  po_id: string | null;
  mrn_no: string;
  invoice_number: string;
  invoice_date: string;
  total: string;
  paid_amount: string;
  action_status: string;
  payment: string;
  gst_no: string;
  sub_total: number;
  total_tax: string;
  total_discount: string;
  delivery_charge: string;
  delivery_charge_tax_amount: string;
  round_off_amount: string;
  created_on: string;
  modified_on: string;
  receiver_id: string;
  receiver_type: string;
  restaurant_details: {
    sender: {
      sender_gst: string;
      sender_city: string;
      sender_name: string;
      sender_state: string;
      sender_cin_no: string;
      sender_address: string;
      sender_contact: string;
    };
    receiver: {
      receiver_gst: string;
      receiver_name: string;
      receiver_type: string;
      receiver_email: string;
      receiver_cin_no: string;
      receiver_pan_no: string;
      receiver_tan_no: string;
      receiver_address: string;
      receiver_contact: string;
      receiver_msme_no: string;
      receiver_pin_code: string;
      receiver_state: string;
    };
    common_batch: string;
    freeze_stock: number;
    purchase_date: string;
    allow_fifo_lifo: string;
  };
  item_details: PetpoojaGetPurchaseItemDetail[];
}

export interface PetpoojaGetPurchaseResponse {
  code: string;
  success: string;
  message: string;
  restID: string;
  purchases: PetpoojaGetPurchaseRecord[];
}

export type PetpoojaSlType = 'transfer' | 'sale' | 'wastage' | 'purchase return';

export interface PetpoojaGetSalesRequest {
  app_key: string;
  app_secret: string;
  access_token: string;
  menuSharingCode: string;
  from_date: string; // DD-MM-YYYY
  to_date: string;   // DD-MM-YYYY
  refId?: string;
  slType: PetpoojaSlType;
}

export interface PetpoojaGetSalesItemDetail {
  prev_price: number;
  item_id: string;
  itemname: string;
  qty: number;
  amount: number;
  discount: string;
  lbl_unit: string;
  unit: string;
  price: number;
  hsn_code: string;
  description: string;
  invoice_date: string;
  sap_code: string;
  weighted_price: number;
  tax1: number;
  tax2: number;
  tax3: number;
  tax4: number;
  tax1_amount: number;
  tax2_amount: number;
  tax3_amount: number;
  tax4_amount: number;
  expiry_date: string;
  manufacturing_date: string;
  category: string;
  sub_category: string;
  rmconv_qty: string;
  rmconv_qty_total: number;
  rmconv_unit_id: string;
  rmconv_unit: string;
  yield_qty: string;
  discount_application: string;
  container_weight: number;
  net_weight: string;
  gross_weight: number;
  batch_detail: string;
  tax_type: number;
  excise_duty: number;
  tax1_label: string;
  tax2_label: string;
  tax3_label: string;
  tax4_label: string;
}

export interface PetpoojaGetSalesRecord {
  sale_id: string;
  type: string;
  po_id: string | null;
  mrn_no: string;
  invoice_number: string;
  invoice_date: string;
  total: string;
  paid_amount: string;
  action_status: string;
  payment: string;
  sub_total: number;
  total_tax: string;
  total_discount: string;
  delivery_charge: string;
  delivery_charge_tax_amount: string;
  round_off_amount: string;
  created_on: string;
  modified_on: string;
  sender_id: string;
  sender_type: string;
  address?: string;
  restaurant_details: {
    sender: {
      sender_gst: string;
      sender_city: string;
      sender_name: string;
      sender_state: string;
      sender_cin_no: string;
      sender_address: string;
      sender_contact: string;
    };
    receiver: {
      receiver_gst: string;
      receiver_city: string;
      receiver_name: string;
      receiver_type: string;
      receiver_email: string | null;
      receiver_state: string;
      receiver_cin_no: string;
      receiver_pan_no: string;
      receiver_tan_no: string;
      receiver_address: string | null;
      receiver_contact: string | null;
      receiver_msme_no: string;
      receiver_pin_code: string;
    };
    module_type: string;
    freeze_stock: number;
    allow_fifo_lifo: string;
    is_rm_transfer_only?: number;
  };
  item_details: PetpoojaGetSalesItemDetail[];
}

export interface PetpoojaGetSalesResponse {
  code: string;
  success: string;
  message: string;
  restID: string;
  sales: PetpoojaGetSalesRecord[];
}

export interface PetpoojaGetOrdersRequest {
  app_key: string;
  app_secret: string;
  access_token: string;
  menuSharingCode: string;
  order_date: string; // YYYY-MM-DD
  refId?: string;
}

export interface PetpoojaOrderRestaurantInfo {
  restaurantid: string;
  res_name: string;
  address: string;
  restaurant_state: string;
  contact_information: string;
  restID: string;
}

export interface PetpoojaOrderCustomerInfo {
  name: string;
  address: string;
  phone: string;
  gst_no: string;
  created_date: string;
  refId: string;
}

export interface PetpoojaOrderHeader {
  orderID: string;
  refId: string;
  delivery_charges: string;
  container_charges: string;
  order_type: string;
  sub_order_type_id: string;
  sub_order_type: string;
  payment_type: string;
  custom_payment_type: string;
  table_no: string;
  no_of_persons: string;
  discount_total: string;
  tax_total: string;
  round_off: string;
  core_total: string;
  total: string;
  created_on: string;
  order_from: string;
  advance_order: string;
  part_payment: any[];
  order_date: string;
  status: string;
  service_charge: number;
  group_ids: number;
  group_names: string;
  online_order_id: string;
  thirdparty_gst_info: any[];
  GroupWiseOrderID: string;
  thirdparty_charges_info: any[];
  tip: string;
  is_food_res: string;
}

export interface PetpoojaOrderConsumedItem {
  rawmaterialname: string;
  rawmaterialquantity: number;
  unitname: string;
  price: string;
  rawmaterialsapcode: string;
}

export interface PetpoojaOrderItem {
  categoryid: string;
  categoryname: string;
  name: string;
  itemid: string;
  itemcode: string;
  specialnotes: string;
  price: string;
  quantity: string;
  total: string;
  addon: any[];
  consumed: PetpoojaOrderConsumedItem[];
  item_tax_info: any;
  total_discount: number;
  total_tax: number;
  tax_ids: string;
  groupname: string;
  groupid: string;
  addonprice: number;
  discount_id: string;
  item_discount_total: number;
  tax_inclusive: number;
  itemsapcode: string;
}

export interface PetpoojaOrderRecord {
  Restaurant: PetpoojaOrderRestaurantInfo;
  Customer: PetpoojaOrderCustomerInfo;
  Order: PetpoojaOrderHeader;
  Tax: any[];
  Discount: any[];
  OrderItem: PetpoojaOrderItem[];
}

export interface PetpoojaGetOrdersResponse {
  code: string;
  success: string;
  message: string;
  order_json: PetpoojaOrderRecord[];
}

export interface PetpoojaPurchaseSaveResponse {
  code: string;
  success: string;
  message: string;
}

export interface PetpoojaApiGateway {
  savePurchase(request: PetpoojaPurchaseSaveRequest): Promise<PetpoojaPurchaseSaveResponse>;
  savePurchaseReturn(request: PetpoojaSaleSaveRequest): Promise<PetpoojaPurchaseSaveResponse>;
  saveSales(request: PetpoojaSaleSaveRequest): Promise<PetpoojaPurchaseSaveResponse>;
  saveTransfer(request: PetpoojaSaleSaveRequest): Promise<PetpoojaPurchaseSaveResponse>;
  getStock(request: PetpoojaStockRequest): Promise<PetpoojaStockResponse>;
  saveRawMaterials(request: PetpoojaRawMaterialSaveRequest): Promise<PetpoojaPurchaseSaveResponse>;
  saveSalesReturn(request: PetpoojaPurchaseSaveRequest): Promise<PetpoojaPurchaseSaveResponse>;
  getPurchases(request: PetpoojaGetPurchaseRequest): Promise<PetpoojaGetPurchaseResponse>;
  getSalesTransactions(request: PetpoojaGetSalesRequest): Promise<PetpoojaGetSalesResponse>;
  getOrders(request: PetpoojaGetOrdersRequest): Promise<PetpoojaGetOrdersResponse>;
}

export interface SapPurchaseInvoiceItem {
  materialCode: string;
  materialName: string;
  quantity: number;
  unitPrice: number;
  unitOfMeasure: string;
  batchNumber?: string;
  expiryDate?: string; // YYYY-MM-DD
  hsnCode?: string;
}

export interface SapPurchaseInvoice {
  petpoojaPurchaseId?: number; // Present if updating
  invoiceNumber: string;
  invoiceDate: string; // YYYY-MM-DD
  items: SapPurchaseInvoiceItem[];
  supplierName: string;
  outletName: string;
  outletType: string;
  totalAmount: number;
  totalTax?: number;
  totalDiscount?: number;
  deliveryCharge?: number;
}

export interface SapPurchaseReturnInvoiceItem {
  materialCode: string;
  materialName: string;
  quantity: number;
  unitPrice: number;
  unitOfMeasure: string;
  hsnCode?: string;
  discount?: number;
  description?: string;
  taxPercent1?: number;
  taxPercent2?: number;
  taxPercent3?: number;
  taxPercent4?: number;
  taxAmount1?: number;
  taxAmount2?: number;
  taxAmount3?: number;
  taxAmount4?: number;
  actualQuantity?: number;
}

export interface SapPurchaseReturnInvoice {
  petpoojaSaleId?: string | number; // Present if updating
  invoiceNumber: string;
  invoiceDate: string; // YYYY-MM-DD
  items: SapPurchaseReturnInvoiceItem[];
  supplierName: string;
  supplierGst?: string;
  outletName: string;
  outletType: string;
  outletGst?: string;
}

export interface SapSalesInvoiceItem {
  materialCode: string;
  materialName: string;
  quantity: number;
  unitPrice: number;
  unitOfMeasure: string;
  hsnCode?: string;
  discount?: number;
  description?: string;
  taxPercent1?: number;
  taxPercent2?: number;
  taxPercent3?: number;
  taxPercent4?: number;
  taxAmount1?: number;
  taxAmount2?: number;
  taxAmount3?: number;
  taxAmount4?: number;
}

export interface SapSalesInvoice {
  petpoojaSaleId?: number; // Present if updating
  invoiceNumber: string;
  invoiceDate: string; // YYYY-MM-DD
  items: SapSalesInvoiceItem[];
  customerName: string;
  outletName: string;
  outletType: string;
  totalAmount: number;
  totalTax?: number;
  totalDiscount?: number;
  deliveryCharge?: number;
  discountPercent?: number;
}

export interface SapTransferInvoiceItem {
  materialCode: string;
  materialName: string;
  quantity: number;
  unitPrice: number;
  unitOfMeasure: string;
  hsnCode?: string;
  description?: string;
}

export interface SapTransferInvoice {
  petpoojaSaleId?: string | number; // Present if updating
  challanNumber: string;
  transferDate: string; // YYYY-MM-DD
  items: SapTransferInvoiceItem[];
  sourceOutletName: string;
  destinationOutletName: string;
  destinationOutletType: string;
  totalAmount: number;
}

export interface SapStockItem {
  materialCode: string;
  materialName: string;
  quantity: number;
  averagePrice: number;
  unitOfMeasure: string;
  category?: string;
}

export interface SapStockReconciliation {
  date: string;
  items: SapStockItem[];
}

export interface SapRawMaterial {
  materialCode: string;
  materialName: string;
  categoryName?: string;
  purchaseUnit: string;
  consumptionUnit: string;
  conversionFactor: number;
  hsnCode?: string;
  gstPercent?: number;
  trackExpiry: boolean;
  description?: string;
  createdTime?: string; // YYYY-MM-DD HH:MM:SS
  creatorName?: string;
}

export interface SapSalesReturnInvoiceItem {
  materialCode: string;
  materialName: string;
  quantity: number;
  unitPrice: number;
  unitOfMeasure: string;
  hsnCode?: string;
  discount?: number;
  description?: string;
  originalInvoiceDate?: string;
  taxPercent1?: number;
  taxPercent2?: number;
  taxPercent3?: number;
  taxPercent4?: number;
  taxAmount1?: number;
  taxAmount2?: number;
  taxAmount3?: number;
  taxAmount4?: number;
  actualQuantity?: number;
}

export interface SapSalesReturnInvoice {
  petpoojaPurchaseId?: number;
  invoiceNumber: string;
  invoiceDate: string; // Return date
  items: SapSalesReturnInvoiceItem[];
  customerName: string;
  outletName: string;
  outletType: string;
  totalAmount: number;
  totalTax?: number;
  totalDiscount?: number;
  deliveryCharge?: number;
  discountPercent?: number;
}

export interface SapPurchaseOrderItem {
  materialCode: string;
  materialName: string;
  quantity: number;
  unitPrice: number;
  unitOfMeasure: string;
  hsnCode?: string;
  taxPercent1?: number;
  taxPercent2?: number;
  taxPercent3?: number;
  taxPercent4?: number;
  taxAmount1?: number;
  taxAmount2?: number;
  taxAmount3?: number;
  taxAmount4?: number;
}

export interface SapPurchaseOrder {
  petpoojaPoId: string;
  poNumber: string;
  deliveryDate: string;
  items: SapPurchaseOrderItem[];
  supplierName: string;
  supplierGst?: string;
  outletName: string;
  outletGst?: string;
  totalAmount: number;
  totalTax: number;
}

export interface SapReconciliationPurchaseItem {
  materialCode: string;
  materialName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  unitOfMeasure: string;
  weightedPrice: number;
  category?: string;
  taxPercent1?: number;
  taxPercent2?: number;
  taxPercent3?: number;
  taxPercent4?: number;
  taxAmount1?: number;
  taxAmount2?: number;
  taxAmount3?: number;
  taxAmount4?: number;
}

export interface SapReconciliationPurchase {
  petpoojaPurchaseId: string;
  mrnNumber: string;
  poId?: string;
  invoiceNumber: string;
  invoiceDate: string; // YYYY-MM-DD
  totalAmount: number;
  subTotal: number;
  totalTax: number;
  outletName: string;
  outletGst?: string;
  supplierName: string;
  supplierGst?: string;
  items: SapReconciliationPurchaseItem[];
}

export interface SapPurchaseReconciliationResponse {
  purchases: SapReconciliationPurchase[];
  nextRefId?: string;
}

export interface SapReconciliationTransferItem {
  materialCode: string;
  materialName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  unitOfMeasure: string;
  category?: string;
}

export interface SapReconciliationTransfer {
  petpoojaSaleId: string;
  challanNumber: string;
  transferDate: string; // YYYY-MM-DD
  totalAmount: number;
  sourceOutletName: string;
  sourceOutletGst?: string;
  destinationOutletName: string;
  destinationOutletGst?: string;
  destinationOutletType: string;
  isRawMaterialOnly: boolean;
  items: SapReconciliationTransferItem[];
}

export interface SapTransferReconciliationResponse {
  transfers: SapReconciliationTransfer[];
  nextRefId?: string;
}

export interface SapReconciliationSalesItem {
  materialCode: string;
  materialName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  unitOfMeasure: string;
  category?: string;
  taxPercent1?: number;
  taxPercent2?: number;
  taxPercent3?: number;
  taxPercent4?: number;
  taxAmount1?: number;
  taxAmount2?: number;
  taxAmount3?: number;
  taxAmount4?: number;
}

export interface SapReconciliationSales {
  petpoojaSaleId: string;
  invoiceNumber: string;
  invoiceDate: string; // YYYY-MM-DD
  totalAmount: number;
  subTotal: number;
  totalTax: number;
  outletName: string;
  customerName: string;
  customerGst?: string;
  items: SapReconciliationSalesItem[];
}

export interface SapSalesReconciliationResponse {
  sales: SapReconciliationSales[];
  nextRefId?: string;
}

export interface SapWastageReportItem {
  materialCode: string;
  materialName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  unitOfMeasure: string;
  category?: string;
}

export interface SapWastageReport {
  petpoojaWastageId: string;
  wastageDate: string; // YYYY-MM-DD
  totalAmount: number;
  outletName: string;
  items: SapWastageReportItem[];
}

export interface SapWastageReconciliationResponse {
  wastages: SapWastageReport[];
  nextRefId?: string;
}

export interface SapReconciliationPurchaseReturnItem {
  materialCode: string;
  materialName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  unitOfMeasure: string;
  category?: string;
  taxPercent1?: number;
  taxPercent2?: number;
  taxPercent3?: number;
  taxPercent4?: number;
  taxAmount1?: number;
  taxAmount2?: number;
  taxAmount3?: number;
  taxAmount4?: number;
}

export interface SapReconciliationPurchaseReturn {
  petpoojaSaleId: string;
  invoiceNumber: string;
  invoiceDate: string; // YYYY-MM-DD
  totalAmount: number;
  subTotal: number;
  totalTax: number;
  outletName: string;
  outletGst?: string;
  supplierName: string;
  supplierGst?: string;
  items: SapReconciliationPurchaseReturnItem[];
}

export interface SapPurchaseReturnReconciliationResponse {
  purchaseReturns: SapReconciliationPurchaseReturn[];
  nextRefId?: string;
}

export interface SapOrderItemConsumption {
  materialCode: string;
  materialName: string;
  quantityConsumed: number;
  unitOfMeasure: string;
}

export interface SapOrderItemReconciliation {
  itemCode: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  consumptions: SapOrderItemConsumption[];
}

export interface SapOrderConsumption {
  petpoojaOrderId: string;
  posOrderReference: string;
  orderDate: string; // YYYY-MM-DD
  orderType: string;
  paymentType: string;
  coreTotal: number;
  totalTax: number;
  grandTotal: number;
  outletName: string;
  items: SapOrderItemReconciliation[];
}

export interface SapOrderConsumptionResponse {
  orders: SapOrderConsumption[];
  nextRefId?: string;
}

export interface PetpoojaServiceConfig {
  appKey: string;
  appSecret: string;
  accessToken: string;
  menuSharingCode: string;
}

export class PetpoojaService {
  constructor(
    private readonly config: PetpoojaServiceConfig,
    private readonly apiGateway: PetpoojaApiGateway
  ) {}

  public async syncPurchaseInvoice(sapInvoice: SapPurchaseInvoice): Promise<PetpoojaPurchaseSaveResponse> {
    const requestPayload = ErpInvoiceMapper.mapSapToPetpooja(sapInvoice, this.config);
    return this.apiGateway.savePurchase(requestPayload);
  }

  public async syncPurchaseReturn(sapInvoice: SapPurchaseReturnInvoice): Promise<PetpoojaPurchaseSaveResponse> {
    const requestPayload = ErpInvoiceMapper.mapSapToPetpoojaReturn(sapInvoice, this.config);
    return this.apiGateway.savePurchaseReturn(requestPayload);
  }

  public async syncSalesInvoice(sapInvoice: SapSalesInvoice): Promise<PetpoojaPurchaseSaveResponse> {
    const requestPayload = this.mapSapToPetpoojaSale(sapInvoice);
    return this.apiGateway.saveSales(requestPayload);
  }

  public async syncTransfer(sapInvoice: SapTransferInvoice): Promise<PetpoojaPurchaseSaveResponse> {
    const requestPayload = this.mapSapToPetpoojaTransfer(sapInvoice);
    return this.apiGateway.saveTransfer(requestPayload);
  }

  public async getClosingStock(date: string): Promise<SapStockReconciliation> {
    const requestPayload: PetpoojaStockRequest = {
      app_key: this.config.appKey,
      app_secret: this.config.appSecret,
      access_token: this.config.accessToken,
      menuSharingCode: this.config.menuSharingCode,
      date: date
    };

    const response = await this.apiGateway.getStock(requestPayload);

    if (response.success !== '1') {
      throw new Error(`Failed to fetch stock from Petpooja: ${response.message} (Code: ${response.code})`);
    }

    return PosStockReconciler.mapPetpoojaToSapStock(response, date);
  }

  public async syncRawMaterials(sapMaterials: SapRawMaterial[]): Promise<PetpoojaPurchaseSaveResponse> {
    const requestPayload = ErpInvoiceMapper.mapSapToPetpoojaRawMaterials(sapMaterials, this.config);
    return this.apiGateway.saveRawMaterials(requestPayload);
  }

  public async syncSalesReturn(sapInvoice: SapSalesReturnInvoice): Promise<PetpoojaPurchaseSaveResponse> {
    const requestPayload = this.mapSapToPetpoojaSalesReturn(sapInvoice);
    return this.apiGateway.saveSalesReturn(requestPayload);
  }

  public async handlePurchaseOrderWebhook(
    payload: PetpoojaPurchaseOrderWebhookPayload
  ): Promise<{ response: PetpoojaWebhookResponse; mappedSapPo?: SapPurchaseOrder }> {
    const authResult = PetpoojaWebhookAuthenticator.verifyWebhookCredentials(payload, this.config);
    if (!authResult.isAuthenticated) {
      return { response: authResult.response! };
    }

    try {
      const mappedSapPo = ErpInvoiceMapper.mapPetpoojaToSapPo(payload.data);
      return {
        response: {
          code: '200',
          success: '1',
          message: 'Webhook processed successfully'
        },
        mappedSapPo
      };
    } catch (error: any) {
      return {
        response: {
          code: '400',
          success: '0',
          message: `Mapping failed: ${error.message}`
        }
      };
    }
  }

  public async getPurchaseInvoices(
    fromDate: string, // DD-MM-YYYY
    toDate: string,   // DD-MM-YYYY
    refId?: string
  ): Promise<SapPurchaseReconciliationResponse> {
    const requestPayload: PetpoojaGetPurchaseRequest = {
      app_key: this.config.appKey,
      app_secret: this.config.appSecret,
      access_token: this.config.accessToken,
      menuSharingCode: this.config.menuSharingCode,
      from_date: fromDate,
      to_date: toDate
    };

    if (refId) {
      requestPayload.refId = refId;
    }

    const response = await this.apiGateway.getPurchases(requestPayload);

    if (response.success !== '1') {
      throw new Error(`Failed to fetch purchases from Petpooja: ${response.message} (Code: ${response.code})`);
    }

    return this.mapPetpoojaToSapPurchases(response);
  }

  public async getTransfers(
    fromDate: string, // DD-MM-YYYY
    toDate: string,   // DD-MM-YYYY
    refId?: string
  ): Promise<SapTransferReconciliationResponse> {
    const response = await this.getSalesRawData('transfer', fromDate, toDate, refId);
    return this.mapPetpoojaToSapTransfers(response);
  }

  public async getSalesReconciliation(
    fromDate: string, // DD-MM-YYYY
    toDate: string,   // DD-MM-YYYY
    refId?: string
  ): Promise<SapSalesReconciliationResponse> {
    const response = await this.getSalesRawData('sale', fromDate, toDate, refId);
    return this.mapPetpoojaToSapSales(response);
  }

  public async getWastages(
    fromDate: string, // DD-MM-YYYY
    toDate: string,   // DD-MM-YYYY
    refId?: string
  ): Promise<SapWastageReconciliationResponse> {
    const response = await this.getSalesRawData('wastage', fromDate, toDate, refId);
    return this.mapPetpoojaToSapWastages(response);
  }

  public async getPurchaseReturns(
    fromDate: string, // DD-MM-YYYY
    toDate: string,   // DD-MM-YYYY
    refId?: string
  ): Promise<SapPurchaseReturnReconciliationResponse> {
    const response = await this.getSalesRawData('purchase return', fromDate, toDate, refId);
    return this.mapPetpoojaToSapPurchaseReturns(response);
  }

  public async getOrderConsumption(
    date: string, // YYYY-MM-DD
    refId?: string
  ): Promise<SapOrderConsumptionResponse> {
    const requestPayload: PetpoojaGetOrdersRequest = {
      app_key: this.config.appKey,
      app_secret: this.config.appSecret,
      access_token: this.config.accessToken,
      menuSharingCode: this.config.menuSharingCode,
      order_date: date
    };

    if (refId) {
      requestPayload.refId = refId;
    }

    const response = await this.apiGateway.getOrders(requestPayload);

    if (response.success !== '1') {
      throw new Error(`Failed to fetch orders/consumption from Petpooja: ${response.message} (Code: ${response.code})`);
    }

    return this.mapPetpoojaToSapOrderConsumption(response);
  }

  private async getSalesRawData(
    slType: PetpoojaSlType,
    fromDate: string,
    toDate: string,
    refId?: string
  ): Promise<PetpoojaGetSalesResponse> {
    const requestPayload: PetpoojaGetSalesRequest = {
      app_key: this.config.appKey,
      app_secret: this.config.appSecret,
      access_token: this.config.accessToken,
      menuSharingCode: this.config.menuSharingCode,
      from_date: fromDate,
      to_date: toDate,
      slType
    };

    if (refId) {
      requestPayload.refId = refId;
    }

    const response = await this.apiGateway.getSalesTransactions(requestPayload);

    if (response.success !== '1') {
      throw new Error(`Failed to fetch ${slType} from Petpooja: ${response.message} (Code: ${response.code})`);
    }

    return response;
  }

  private mapSapToPetpooja(sapInvoice: SapPurchaseInvoice): PetpoojaPurchaseSaveRequest {
    const hasBatchInfo = sapInvoice.items.some(item => item.batchNumber !== undefined);

    const itemDetails: PetpoojaItemDetail[] = sapInvoice.items.map(item => {
      const detail: PetpoojaItemDetail = {
        itemName: item.materialName,
        qty: item.quantity,
        price: item.unitPrice.toFixed(2),
        amount: (item.quantity * item.unitPrice).toFixed(2),
        lblUnit: item.unitOfMeasure,
        sapCode: item.materialCode,
        actualQty: item.quantity.toString(),
      };

      if (item.batchNumber) {
        detail.batch_code = item.batchNumber;
      }
      if (item.expiryDate) {
        detail.expiryDate = item.expiryDate;
      }
      if (item.hsnCode) {
        detail.hsnCode = item.hsnCode;
      }

      // Default taxes and discounts per item if not specified
      detail.discount = "0.00";
      detail.tax1 = "0.00";
      detail.tax2 = "0.00";
      detail.tax3 = "0.00";
      detail.tax4 = "0.00";
      detail.tax1Amount = "0.00";
      detail.tax2Amount = "0.00";
      detail.tax3Amount = "0.00";
      detail.tax4Amount = "0.00";

      return detail;
    });

    const purchase: PetpoojaPurchase = {
      updateStock: '1',
      status: '1',
      receiverType: sapInvoice.outletType,
      invoiceDate: sapInvoice.invoiceDate,
      invoiceNumber: sapInvoice.invoiceNumber,
      totalTax: (sapInvoice.totalTax || 0).toFixed(2),
      totalDiscount: (sapInvoice.totalDiscount || 0).toString(),
      deliveryCharge: (sapInvoice.deliveryCharge || 0).toString(),
      itemDetails: itemDetails,
      total: sapInvoice.totalAmount.toFixed(2),
      roundoff: '0',
      restDetails: {
        sender: { senderName: sapInvoice.supplierName },
        receiver: {
          receiverType: sapInvoice.outletType,
          receiverName: sapInvoice.outletName
        }
      }
    };

    if (sapInvoice.petpoojaPurchaseId) {
      purchase.id = sapInvoice.petpoojaPurchaseId;
    }

    if (hasBatchInfo) {
      purchase.enable_batch_wise_inventory = 'yes';
    }

    return {
      app_key: this.config.appKey,
      app_secret: this.config.appSecret,
      access_token: this.config.accessToken,
      menuSharingCode: this.config.menuSharingCode,
      Purchase: purchase
    };
  }

  private mapSapToPetpoojaReturn(sapInvoice: SapPurchaseReturnInvoice): PetpoojaSaleSaveRequest {
    const itemDetails: PetpoojaItemDetail[] = sapInvoice.items.map(item => {
      const detail: PetpoojaItemDetail = {
        itemName: item.materialName,
        qty: item.quantity.toString(),
        price: item.unitPrice.toFixed(2),
        amount: (item.quantity * item.unitPrice).toFixed(2),
        lblUnit: item.unitOfMeasure,
        sapCode: item.materialCode,
        discount: (item.discount || 0).toFixed(2),
        description: item.description || "SAP SALES",
        actualQty: (item.actualQuantity !== undefined ? item.actualQuantity : item.quantity).toFixed(3),
      };

      if (item.hsnCode) {
        detail.hsnCode = item.hsnCode;
      }

      detail.tax1 = (item.taxPercent1 || 0).toFixed(2);
      detail.tax2 = (item.taxPercent2 || 0).toFixed(2);
      detail.tax3 = (item.taxPercent3 || 0).toFixed(2);
      detail.tax4 = (item.taxPercent4 || 0).toFixed(2);
      detail.tax1Amount = (item.taxAmount1 || 0).toFixed(2);
      detail.tax2Amount = (item.taxAmount2 || 0).toFixed(2);
      detail.tax3Amount = (item.taxAmount3 || 0).toFixed(2);
      detail.tax4Amount = (item.taxAmount4 || 0).toFixed(2);

      return detail;
    });

    const sale: PetpoojaSale = {
      updateStock: '1',
      receiverType: sapInvoice.outletType,
      invoiceDate: sapInvoice.invoiceDate,
      invoiceNumber: sapInvoice.invoiceNumber,
      itemDetails: itemDetails,
      restDetails: {
        sender: {
          senderName: sapInvoice.outletName,
          senderGst: sapInvoice.outletGst || ""
        },
        receiver: {
          receiverType: sapInvoice.outletType,
          receiverName: sapInvoice.supplierName,
          receiverGst: sapInvoice.supplierGst || ""
        }
      }
    };

    if (sapInvoice.petpoojaSaleId) {
      sale.id = sapInvoice.petpoojaSaleId.toString();
    }

    return {
      app_key: this.config.appKey,
      app_secret: this.config.appSecret,
      access_token: this.config.accessToken,
      menuSharingCode: this.config.menuSharingCode,
      Sale: sale
    };
  }

  private mapSapToPetpoojaSale(sapInvoice: SapSalesInvoice): PetpoojaSaleSaveRequest {
    const itemDetails: PetpoojaItemDetail[] = sapInvoice.items.map(item => {
      const detail: PetpoojaItemDetail = {
        itemName: item.materialName,
        qty: item.quantity,
        price: item.unitPrice.toFixed(2),
        amount: (item.quantity * item.unitPrice).toFixed(2),
        lblUnit: item.unitOfMeasure,
        sapCode: item.materialCode,
        discount: (item.discount || 0).toFixed(2),
        description: item.description || "SAP SALES",
      };

      if (item.hsnCode) {
        detail.hsnCode = item.hsnCode;
      }

      detail.tax1 = (item.taxPercent1 || 0).toFixed(2);
      detail.tax2 = (item.taxPercent2 || 0).toFixed(2);
      detail.tax3 = (item.taxPercent3 || 0).toFixed(2);
      detail.tax4 = (item.taxPercent4 || 0).toFixed(2);
      detail.tax1Amount = (item.taxAmount1 || 0).toFixed(2);
      detail.tax2Amount = (item.taxAmount2 || 0).toFixed(2);
      detail.tax3Amount = (item.taxAmount3 || 0).toFixed(2);
      detail.tax4Amount = (item.taxAmount4 || 0).toFixed(2);

      return detail;
    });

    const sale: PetpoojaSale = {
      updateStock: '1',
      receiverType: sapInvoice.outletType,
      invoiceDate: sapInvoice.invoiceDate,
      invoiceNumber: sapInvoice.invoiceNumber,
      totalTax: sapInvoice.totalTax || 0,
      totalDiscount: sapInvoice.totalDiscount || 0,
      deliveryCharge: sapInvoice.deliveryCharge || 0,
      discountPer: sapInvoice.discountPercent || 0,
      total: sapInvoice.totalAmount.toFixed(2),
      roundoff: '0',
      itemDetails: itemDetails,
      restDetails: {
        sender: { senderName: sapInvoice.outletName },
        receiver: {
          receiverType: sapInvoice.outletType,
          receiverName: sapInvoice.customerName
        }
      }
    };

    if (sapInvoice.petpoojaSaleId) {
      sale.id = sapInvoice.petpoojaSaleId;
    }

    return {
      app_key: this.config.appKey,
      app_secret: this.config.appSecret,
      access_token: this.config.accessToken,
      menuSharingCode: this.config.menuSharingCode,
      Sale: sale
    };
  }

  private mapSapToPetpoojaTransfer(sapInvoice: SapTransferInvoice): PetpoojaSaleSaveRequest {
    const itemDetails: PetpoojaItemDetail[] = sapInvoice.items.map(item => {
      const detail: PetpoojaItemDetail = {
        itemName: item.materialName,
        qty: item.quantity,
        price: item.unitPrice.toFixed(2),
        amount: (item.quantity * item.unitPrice).toFixed(2),
        lblUnit: item.unitOfMeasure,
        sapCode: item.materialCode,
        description: item.description || "SAP SALES",
      };

      if (item.hsnCode) {
        detail.hsnCode = item.hsnCode;
      }

      return detail;
    });

    const sale: PetpoojaSale = {
      updateStock: '1',
      receiverType: sapInvoice.destinationOutletType,
      invoiceDate: sapInvoice.transferDate,
      challanNo: sapInvoice.challanNumber,
      total: sapInvoice.totalAmount.toFixed(2),
      roundoff: '0',
      itemDetails: itemDetails,
      restDetails: {
        sender: { senderName: sapInvoice.sourceOutletName },
        receiver: {
          receiverType: sapInvoice.destinationOutletType,
          receiverName: sapInvoice.destinationOutletName
        }
      }
    };

    if (sapInvoice.petpoojaSaleId) {
      sale.id = sapInvoice.petpoojaSaleId.toString();
    }

    return {
      app_key: this.config.appKey,
      app_secret: this.config.appSecret,
      access_token: this.config.accessToken,
      menuSharingCode: this.config.menuSharingCode,
      Sale: sale
    };
  }

  private mapPetpoojaToSapStock(response: PetpoojaStockResponse, date: string): SapStockReconciliation {
    const items: SapStockItem[] = response.closing_json.map(item => ({
      materialCode: item.sapcode,
      materialName: item.name,
      quantity: Number(item.qty),
      averagePrice: Number(item.price),
      unitOfMeasure: item.unit,
      category: item.category || undefined
    }));

    return {
      date: date,
      items: items
    };
  }

  private mapSapToPetpoojaRawMaterials(sapMaterials: SapRawMaterial[]): PetpoojaRawMaterialSaveRequest {
    const jsonData: PetpoojaRawMaterialItem[] = sapMaterials.map(material => {
      const purchaseUnits: PetpoojaPurchaseUnit[] = [
        { unitName: material.consumptionUnit, isConsumptionUnit: '1' },
        { unitName: material.purchaseUnit, isConsumptionUnit: '0' }
      ];

      const item: PetpoojaRawMaterialItem = {
        name: material.materialName,
        type: 'R',
        unit: material.purchaseUnit,
        consumptionUnit: material.consumptionUnit,
        conversionQty: material.conversionFactor,
        sapCode: material.materialCode,
        status: '1',
        isExpiry: material.trackExpiry ? '1' : '0',
        rawMaterialPurchaseUnit: purchaseUnits
      };

      if (material.categoryName) {
        item.category = material.categoryName;
      }
      if (material.hsnCode) {
        item.hsnCode = material.hsnCode;
      }
      if (material.gstPercent !== undefined) {
        item.gstPer = material.gstPercent.toFixed(2);
      }
      if (material.description) {
        item.description = material.description;
      }
      if (material.createdTime) {
        item.created = material.createdTime;
      }
      if (material.creatorName) {
        item.createdbyUsername = material.creatorName;
      }

      return item;
    });

    return {
      app_key: this.config.appKey,
      app_secret: this.config.appSecret,
      access_token: this.config.accessToken,
      menuSharingCode: this.config.menuSharingCode,
      jsonData: jsonData
    };
  }

  private mapSapToPetpoojaSalesReturn(sapInvoice: SapSalesReturnInvoice): PetpoojaPurchaseSaveRequest {
    const itemDetails: PetpoojaItemDetail[] = sapInvoice.items.map(item => {
      const detail: PetpoojaItemDetail = {
        itemName: item.materialName,
        qty: item.quantity,
        price: item.unitPrice.toFixed(2),
        amount: (item.quantity * item.unitPrice).toFixed(2),
        lblUnit: item.unitOfMeasure,
        sapCode: item.materialCode,
        discount: (item.discount || 0).toFixed(2),
        description: item.description || "SAP SALES",
        actualQty: (item.actualQuantity !== undefined ? item.actualQuantity : item.quantity).toFixed(3),
      };

      if (item.hsnCode) {
        detail.hsnCode = item.hsnCode;
      }
      if (item.originalInvoiceDate) {
        detail.invoiceDate = item.originalInvoiceDate;
      }

      detail.tax1 = (item.taxPercent1 || 0).toFixed(2);
      detail.tax2 = (item.taxPercent2 || 0).toFixed(2);
      detail.tax3 = (item.taxPercent3 || 0).toFixed(2);
      detail.tax4 = (item.taxPercent4 || 0).toFixed(2);
      detail.tax1Amount = (item.taxAmount1 || 0).toFixed(2);
      detail.tax2Amount = (item.taxAmount2 || 0).toFixed(2);
      detail.tax3Amount = (item.taxAmount3 || 0).toFixed(2);
      detail.tax4Amount = (item.taxAmount4 || 0).toFixed(2);

      return detail;
    });

    const purchase: PetpoojaPurchase = {
      updateStock: '1',
      status: '1',
      receiverType: sapInvoice.outletType,
      invoiceDate: sapInvoice.invoiceDate,
      invoiceNumber: sapInvoice.invoiceNumber,
      totalTax: (sapInvoice.totalTax || 0).toFixed(2),
      totalDiscount: (sapInvoice.totalDiscount || 0).toString(),
      deliveryCharge: (sapInvoice.deliveryCharge || 0).toString(),
      discountPer: (sapInvoice.discountPercent || 0).toString(),
      itemDetails: itemDetails,
      total: sapInvoice.totalAmount.toFixed(2),
      roundoff: '0',
      restDetails: {
        sender: { senderName: sapInvoice.outletName },
        receiver: {
          receiverType: sapInvoice.outletType,
          receiverName: sapInvoice.customerName
        }
      }
    };

    if (sapInvoice.petpoojaPurchaseId) {
      purchase.id = sapInvoice.petpoojaPurchaseId;
    }

    return {
      app_key: this.config.appKey,
      app_secret: this.config.appSecret,
      access_token: this.config.accessToken,
      menuSharingCode: this.config.menuSharingCode,
      Purchase: purchase
    };
  }

  private mapPetpoojaToSapPo(poData: PetpoojaWebhookPoData): SapPurchaseOrder {
    const items: SapPurchaseOrderItem[] = poData.itemDetails.map(item => {
      const mappedItem: SapPurchaseOrderItem = {
        materialCode: item.sap_code,
        materialName: item.itemname,
        quantity: item.qty,
        unitPrice: item.price,
        unitOfMeasure: item.lbl_unit
      };

      if (item.hsn_code) {
        mappedItem.hsnCode = item.hsn_code;
      }

      // Map taxes (convert percentages and parse amount strings)
      if (item.tax1 !== undefined) mappedItem.taxPercent1 = item.tax1;
      if (item.tax2 !== undefined) mappedItem.taxPercent2 = item.tax2;
      if (item.tax3 !== undefined) mappedItem.taxPercent3 = item.tax3;
      if (item.tax4 !== undefined) mappedItem.taxPercent4 = item.tax4;

      if (item.tax1_amount !== undefined) mappedItem.taxAmount1 = Number(item.tax1_amount);
      if (item.tax2_amount !== undefined) mappedItem.taxAmount2 = Number(item.tax2_amount);
      if (item.tax3_amount !== undefined) mappedItem.taxAmount3 = Number(item.tax3_amount);
      if (item.tax4_amount !== undefined) mappedItem.taxAmount4 = Number(item.tax4_amount);

      return mappedItem;
    });

    const sapPo: SapPurchaseOrder = {
      petpoojaPoId: poData.id,
      poNumber: poData.poNumber,
      deliveryDate: poData.deliveryDate,
      items: items,
      supplierName: poData.restDetails.receiver.receiver_name,
      outletName: poData.restDetails.sender.sender_name,
      totalAmount: Number(poData.total),
      totalTax: Number(poData.totalTax)
    };

    if (poData.restDetails.receiver.receiver_gst) {
      sapPo.supplierGst = poData.restDetails.receiver.receiver_gst;
    }
    if (poData.restDetails.sender.sender_gst) {
      sapPo.outletGst = poData.restDetails.sender.sender_gst;
    }

    return sapPo;
  }

  private mapPetpoojaToSapPurchases(response: PetpoojaGetPurchaseResponse): SapPurchaseReconciliationResponse {
    const purchases: SapReconciliationPurchase[] = response.purchases.map(record => {
      const items: SapReconciliationPurchaseItem[] = record.item_details.map(item => {
        const mappedItem: SapReconciliationPurchaseItem = {
          materialCode: item.sap_code || item.item_id,
          materialName: item.itemname,
          quantity: item.qty,
          unitPrice: item.price,
          totalAmount: item.amount,
          unitOfMeasure: item.lbl_unit,
          weightedPrice: item.weighted_price
        };

        if (item.category) mappedItem.category = item.category;

        if (item.tax1 !== undefined) mappedItem.taxPercent1 = item.tax1;
        if (item.tax2 !== undefined) mappedItem.taxPercent2 = item.tax2;
        if (item.tax3 !== undefined) mappedItem.taxPercent3 = item.tax3;
        if (item.tax4 !== undefined) mappedItem.taxPercent4 = item.tax4;

        if (item.tax1_amount !== undefined) mappedItem.taxAmount1 = item.tax1_amount;
        if (item.tax2_amount !== undefined) mappedItem.taxAmount2 = item.tax2_amount;
        if (item.tax3_amount !== undefined) mappedItem.taxAmount3 = item.tax3_amount;
        if (item.tax4_amount !== undefined) mappedItem.taxAmount4 = item.tax4_amount;

        return mappedItem;
      });

      const purchase: SapReconciliationPurchase = {
        petpoojaPurchaseId: record.purchase_id,
        mrnNumber: record.mrn_no,
        invoiceNumber: record.invoice_number,
        invoiceDate: record.invoice_date,
        totalAmount: Number(record.total),
        subTotal: record.sub_total,
        totalTax: Number(record.total_tax),
        outletName: record.restaurant_details.sender.sender_name,
        supplierName: record.restaurant_details.receiver.receiver_name,
        items: items
      };

      if (record.po_id) purchase.poId = record.po_id;
      if (record.restaurant_details.sender.sender_gst) purchase.outletGst = record.restaurant_details.sender.sender_gst;
      if (record.restaurant_details.receiver.receiver_gst) purchase.supplierGst = record.restaurant_details.receiver.receiver_gst;

      return purchase;
    });

    const lastPurchase = response.purchases[response.purchases.length - 1];
    const nextRefId = lastPurchase ? lastPurchase.purchase_id : undefined;

    return {
      purchases,
      nextRefId
    };
  }

  private mapPetpoojaToSapTransfers(response: PetpoojaGetSalesResponse): SapTransferReconciliationResponse {
    const transfers: SapReconciliationTransfer[] = response.sales.map(record => {
      const items: SapReconciliationTransferItem[] = record.item_details.map(item => ({
        materialCode: item.sap_code || item.item_id,
        materialName: item.itemname,
        quantity: item.qty,
        unitPrice: item.price,
        totalAmount: item.amount,
        unitOfMeasure: item.lbl_unit,
        category: item.category || undefined
      }));

      const transfer: SapReconciliationTransfer = {
        petpoojaSaleId: record.sale_id,
        challanNumber: record.invoice_number,
        transferDate: record.invoice_date,
        totalAmount: Number(record.total),
        sourceOutletName: record.restaurant_details.sender.sender_name,
        destinationOutletName: record.restaurant_details.receiver.receiver_name,
        destinationOutletType: record.restaurant_details.receiver.receiver_type,
        isRawMaterialOnly: record.restaurant_details.is_rm_transfer_only === 1,
        items
      };

      if (record.restaurant_details.sender.sender_gst) {
        transfer.sourceOutletGst = record.restaurant_details.sender.sender_gst;
      }
      if (record.restaurant_details.receiver.receiver_gst) {
        transfer.destinationOutletGst = record.restaurant_details.receiver.receiver_gst;
      }

      return transfer;
    });

    const lastSale = response.sales[response.sales.length - 1];
    const nextRefId = lastSale ? lastSale.sale_id : undefined;

    return {
      transfers,
      nextRefId
    };
  }

  private mapPetpoojaToSapSales(response: PetpoojaGetSalesResponse): SapSalesReconciliationResponse {
    const sales: SapReconciliationSales[] = response.sales.map(record => {
      const items: SapReconciliationSalesItem[] = record.item_details.map(item => {
        const mappedItem: SapReconciliationSalesItem = {
          materialCode: item.sap_code || item.item_id,
          materialName: item.itemname,
          quantity: item.qty,
          unitPrice: item.price,
          totalAmount: item.amount,
          unitOfMeasure: item.lbl_unit,
          category: item.category || undefined
        };

        if (item.tax1 !== undefined) mappedItem.taxPercent1 = item.tax1;
        if (item.tax2 !== undefined) mappedItem.taxPercent2 = item.tax2;
        if (item.tax3 !== undefined) mappedItem.taxPercent3 = item.tax3;
        if (item.tax4 !== undefined) mappedItem.taxPercent4 = item.tax4;

        if (item.tax1_amount !== undefined) mappedItem.taxAmount1 = item.tax1_amount;
        if (item.tax2_amount !== undefined) mappedItem.taxAmount2 = item.tax2_amount;
        if (item.tax3_amount !== undefined) mappedItem.taxAmount3 = item.tax3_amount;
        if (item.tax4_amount !== undefined) mappedItem.taxAmount4 = item.tax4_amount;

        return mappedItem;
      });

      const sale: SapReconciliationSales = {
        petpoojaSaleId: record.sale_id,
        invoiceNumber: record.invoice_number,
        invoiceDate: record.invoice_date,
        totalAmount: Number(record.total),
        subTotal: record.sub_total,
        totalTax: Number(record.total_tax),
        outletName: record.restaurant_details.sender.sender_name,
        customerName: record.restaurant_details.receiver.receiver_name,
        items
      };

      if (record.restaurant_details.receiver.receiver_gst) {
        sale.customerGst = record.restaurant_details.receiver.receiver_gst;
      }

      return sale;
    });

    const lastSale = response.sales[response.sales.length - 1];
    const nextRefId = lastSale ? lastSale.sale_id : undefined;

    return {
      sales,
      nextRefId
    };
  }

  private mapPetpoojaToSapWastages(response: PetpoojaGetSalesResponse): SapWastageReconciliationResponse {
    const wastages: SapWastageReport[] = response.sales.map(record => {
      const items: SapWastageReportItem[] = record.item_details.map(item => ({
        materialCode: item.sap_code || item.item_id,
        materialName: item.itemname,
        quantity: item.qty,
        unitPrice: item.price,
        totalAmount: item.amount,
        unitOfMeasure: item.lbl_unit,
        category: item.category || undefined
      }));

      return {
        petpoojaWastageId: record.sale_id,
        wastageDate: record.invoice_date,
        totalAmount: Number(record.total),
        outletName: record.restaurant_details.sender.sender_name,
        items
      };
    });

    const lastSale = response.sales[response.sales.length - 1];
    const nextRefId = lastSale ? lastSale.sale_id : undefined;

    return {
      wastages,
      nextRefId
    };
  }

  private mapPetpoojaToSapPurchaseReturns(response: PetpoojaGetSalesResponse): SapPurchaseReturnReconciliationResponse {
    const purchaseReturns: SapReconciliationPurchaseReturn[] = response.sales.map(record => {
      const items: SapReconciliationPurchaseReturnItem[] = record.item_details.map(item => {
        const mappedItem: SapReconciliationPurchaseReturnItem = {
          materialCode: item.sap_code || item.item_id,
          materialName: item.itemname,
          quantity: item.qty,
          unitPrice: item.price,
          totalAmount: item.amount,
          unitOfMeasure: item.lbl_unit,
          category: item.category || undefined
        };

        if (item.tax1 !== undefined) mappedItem.taxPercent1 = item.tax1;
        if (item.tax2 !== undefined) mappedItem.taxPercent2 = item.tax2;
        if (item.tax3 !== undefined) mappedItem.taxPercent3 = item.tax3;
        if (item.tax4 !== undefined) mappedItem.taxPercent4 = item.tax4;

        if (item.tax1_amount !== undefined) mappedItem.taxAmount1 = item.tax1_amount;
        if (item.tax2_amount !== undefined) mappedItem.taxAmount2 = item.tax2_amount;
        if (item.tax3_amount !== undefined) mappedItem.taxAmount3 = item.tax3_amount;
        if (item.tax4_amount !== undefined) mappedItem.taxAmount4 = item.tax4_amount;

        return mappedItem;
      });

      const purchaseReturn: SapReconciliationPurchaseReturn = {
        petpoojaSaleId: record.sale_id,
        invoiceNumber: record.invoice_number,
        invoiceDate: record.invoice_date,
        totalAmount: Number(record.total),
        subTotal: record.sub_total,
        totalTax: Number(record.total_tax),
        outletName: record.restaurant_details.sender.sender_name,
        supplierName: record.restaurant_details.receiver.receiver_name,
        items
      };

      if (record.restaurant_details.sender.sender_gst) {
        purchaseReturn.outletGst = record.restaurant_details.sender.sender_gst;
      }
      if (record.restaurant_details.receiver.receiver_gst) {
        purchaseReturn.supplierGst = record.restaurant_details.receiver.receiver_gst;
      }

      return purchaseReturn;
    });

    const lastSale = response.sales[response.sales.length - 1];
    const nextRefId = lastSale ? lastSale.sale_id : undefined;

    return {
      purchaseReturns,
      nextRefId
    };
  }

  private mapPetpoojaToSapOrderConsumption(response: PetpoojaGetOrdersResponse): SapOrderConsumptionResponse {
    const orders: SapOrderConsumption[] = response.order_json.map(record => {
      const items: SapOrderItemReconciliation[] = record.OrderItem.map(item => {
        const consumptions: SapOrderItemConsumption[] = item.consumed.map(c => ({
          materialCode: c.rawmaterialsapcode || c.rawmaterialname,
          materialName: c.rawmaterialname,
          quantityConsumed: c.rawmaterialquantity,
          unitOfMeasure: c.unitname
        }));

        return {
          itemCode: item.itemcode,
          itemName: item.name,
          quantity: Number(item.quantity),
          unitPrice: Number(item.price),
          totalAmount: Number(item.total),
          consumptions
        };
      });

      return {
        petpoojaOrderId: record.Order.orderID,
        posOrderReference: record.Order.refId,
        orderDate: record.Order.order_date,
        orderType: record.Order.order_type,
        paymentType: record.Order.payment_type,
        coreTotal: Number(record.Order.core_total),
        totalTax: Number(record.Order.tax_total),
        grandTotal: Number(record.Order.total),
        outletName: record.Restaurant.res_name,
        items
      };
    });

    const lastRecord = response.order_json[response.order_json.length - 1];
    const nextRefId = lastRecord ? lastRecord.Order.orderID : undefined;

    return {
      orders,
      nextRefId
    };
  }
}
