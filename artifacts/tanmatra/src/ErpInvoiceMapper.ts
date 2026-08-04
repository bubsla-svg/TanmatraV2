import {
  PetpoojaItemDetail,
  PetpoojaPurchase,
  PetpoojaSale,
  PetpoojaPurchaseSaveRequest,
  PetpoojaSaleSaveRequest,
  PetpoojaRawMaterialItem,
  PetpoojaRawMaterialSaveRequest,
  PetpoojaWebhookPoData,
  SapPurchaseInvoice,
  SapPurchaseReturnInvoice,
  SapRawMaterial,
  SapPurchaseOrder
} from './PetpoojaService';

export interface PetpoojaAuthConfig {
  appKey: string;
  appSecret: string;
  accessToken: string;
  menuSharingCode: string;
}

/**
 * Pure value-transformation module for ERP (SAP) <-> POS (Petpooja) data mapping.
 * Zero side-effects, zero network I/O.
 */
export class ErpInvoiceMapper {
  /**
   * Maps a domain SAP Purchase Invoice into a Petpooja Purchase Save Request payload.
   */
  public static mapSapToPetpooja(
    sapInvoice: SapPurchaseInvoice,
    config: PetpoojaAuthConfig
  ): PetpoojaPurchaseSaveRequest {
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
        discount: '0.00',
        tax1: '0.00',
        tax2: '0.00',
        tax3: '0.00',
        tax4: '0.00',
        tax1Amount: '0.00',
        tax2Amount: '0.00',
        tax3Amount: '0.00',
        tax4Amount: '0.00'
      };

      if (item.batchNumber) detail.batch_code = item.batchNumber;
      if (item.expiryDate) detail.expiryDate = item.expiryDate;
      if (item.hsnCode) detail.hsnCode = item.hsnCode;

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
      itemDetails,
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
      app_key: config.appKey,
      app_secret: config.appSecret,
      access_token: config.accessToken,
      menuSharingCode: config.menuSharingCode,
      Purchase: purchase
    };
  }

  /**
   * Maps a domain SAP Purchase Return Invoice into a Petpooja Sale Save Request.
   */
  public static mapSapToPetpoojaReturn(
    sapInvoice: SapPurchaseReturnInvoice,
    config: PetpoojaAuthConfig
  ): PetpoojaSaleSaveRequest {
    const itemDetails: PetpoojaItemDetail[] = sapInvoice.items.map(item => {
      const detail: PetpoojaItemDetail = {
        itemName: item.materialName,
        qty: item.quantity.toString(),
        price: item.unitPrice.toFixed(2),
        amount: (item.quantity * item.unitPrice).toFixed(2),
        lblUnit: item.unitOfMeasure,
        sapCode: item.materialCode,
        discount: (item.discount || 0).toFixed(2),
        description: item.description || 'SAP SALES',
        actualQty: (item.actualQuantity !== undefined ? item.actualQuantity : item.quantity).toFixed(3),
        tax1: (item.taxPercent1 || 0).toFixed(2),
        tax2: (item.taxPercent2 || 0).toFixed(2),
        tax3: (item.taxPercent3 || 0).toFixed(2),
        tax4: (item.taxPercent4 || 0).toFixed(2),
        tax1Amount: (item.taxAmount1 || 0).toFixed(2),
        tax2Amount: (item.taxAmount2 || 0).toFixed(2),
        tax3Amount: (item.taxAmount3 || 0).toFixed(2),
        tax4Amount: (item.taxAmount4 || 0).toFixed(2)
      };

      if (item.hsnCode) detail.hsnCode = item.hsnCode;
      return detail;
    });

    const sale: PetpoojaSale = {
      updateStock: '1',
      receiverType: sapInvoice.outletType,
      invoiceDate: sapInvoice.invoiceDate,
      invoiceNumber: sapInvoice.invoiceNumber,
      itemDetails,
      restDetails: {
        sender: {
          senderName: sapInvoice.outletName,
          senderGst: sapInvoice.outletGst || ''
        },
        receiver: {
          receiverType: sapInvoice.outletType,
          receiverName: sapInvoice.supplierName,
          receiverGst: sapInvoice.supplierGst || ''
        }
      }
    };

    return {
      app_key: config.appKey,
      app_secret: config.appSecret,
      access_token: config.accessToken,
      menuSharingCode: config.menuSharingCode,
      Sale: sale
    };
  }

  /**
   * Maps SAP Raw Materials list to Petpooja DTO payload.
   */
  public static mapSapToPetpoojaRawMaterials(
    sapMaterials: SapRawMaterial[],
    config: PetpoojaAuthConfig
  ): PetpoojaRawMaterialSaveRequest {
    const jsonData: PetpoojaRawMaterialItem[] = sapMaterials.map(mat => ({
      name: mat.materialName,
      category: mat.categoryName || 'General',
      type: 'R',
      unit: mat.consumptionUnit,
      consumptionUnit: mat.consumptionUnit,
      conversionQty: mat.conversionFactor.toString(),
      sapCode: mat.materialCode,
      hsnCode: mat.hsnCode,
      gstPer: (mat.gstPercent || 0).toString(),
      status: '1',
      isExpiry: mat.trackExpiry ? '1' : '0',
      description: mat.description,
      rawMaterialPurchaseUnit: [
        {
          unitName: mat.purchaseUnit,
          isConsumptionUnit: mat.purchaseUnit === mat.consumptionUnit ? '1' : '0'
        }
      ]
    }));

    return {
      app_key: config.appKey,
      app_secret: config.appSecret,
      access_token: config.accessToken,
      menuSharingCode: config.menuSharingCode,
      jsonData
    };
  }

  /**
   * Maps incoming Petpooja Webhook Purchase Order payload to internal SAP PO.
   */
  public static mapPetpoojaToSapPo(poData: PetpoojaWebhookPoData): SapPurchaseOrder {
    return {
      petpoojaPoId: poData.id,
      poNumber: poData.poNumber || poData.id,
      deliveryDate: poData.deliveryDate,
      supplierName: poData.restDetails.sender.sender_name,
      supplierGst: poData.restDetails.sender.sender_gst,
      outletName: poData.restDetails.receiver.receiver_name,
      outletGst: poData.restDetails.receiver.receiver_gst,
      totalAmount: parseFloat(poData.total) || 0,
      totalTax: parseFloat(poData.totalTax) || 0,
      items: poData.itemDetails.map(item => ({
        materialCode: item.sap_code,
        materialName: item.itemname,
        quantity: item.qty,
        unitPrice: item.price,
        unitOfMeasure: item.lbl_unit,
        hsnCode: item.hsn_code
      }))
    };
  }
}
