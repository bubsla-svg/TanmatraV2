import { PetpoojaApiGateway } from '../PetpoojaService';

export class HttpPetpoojaApiGateway implements PetpoojaApiGateway {
  private baseUrl = 'https://api.petpooja.com';

  async savePurchase(req: any): Promise<any> {
    const response = await fetch(`${this.baseUrl}/purchase/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(req.headers || {})
      },
      body: JSON.stringify(req)
    });
    return response.json();
  }

  async savePurchaseReturn(req: any): Promise<any> {
    const response = await fetch(`${this.baseUrl}/purchase/return/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(req.headers || {}) },
      body: JSON.stringify(req)
    });
    return response.json();
  }

  async saveSales(req: any): Promise<any> {
    const response = await fetch(`${this.baseUrl}/sale/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(req.headers || {}) },
      body: JSON.stringify(req)
    });
    return response.json();
  }

  async saveTransfer(req: any): Promise<any> {
    const response = await fetch(`${this.baseUrl}/transfer/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(req.headers || {}) },
      body: JSON.stringify(req)
    });
    return response.json();
  }

  async getStock(req: any): Promise<any> {
    const response = await fetch(`${this.baseUrl}/stock`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', ...(req.headers || {}) },
    });
    return response.json();
  }

  async saveRawMaterials(req: any): Promise<any> {
    const response = await fetch(`${this.baseUrl}/raw_material/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(req.headers || {}) },
      body: JSON.stringify(req)
    });
    return response.json();
  }

  async saveSalesReturn(req: any): Promise<any> {
    const response = await fetch(`${this.baseUrl}/sale/return/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(req.headers || {}) },
      body: JSON.stringify(req)
    });
    return response.json();
  }

  async getPurchases(req: any): Promise<any> {
    const response = await fetch(`${this.baseUrl}/purchase/list`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', ...(req.headers || {}) },
    });
    return response.json();
  }

  async getSalesTransactions(req: any): Promise<any> {
    const response = await fetch(`${this.baseUrl}/sale/list`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', ...(req.headers || {}) },
    });
    return response.json();
  }

  async getOrders(req: any): Promise<any> {
    const response = await fetch(`${this.baseUrl}/order/list`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', ...(req.headers || {}) },
    });
    return response.json();
  }
}
