import { http, HttpResponse } from 'msw';

const validatePayload = async (request: Request) => {
  if (request.method !== 'GET') {
    try {
      const payload = await request.clone().json();
      if (!payload) return false;
      return true;
    } catch (e) {
      return false;
    }
  }
  return true;
};

export const handlers = [
  http.post('https://api.petpooja.com/purchase/save', async ({ request }: { request: Request }) => {
    if (!(await validatePayload(request))) {
      return HttpResponse.json({ response: { code: '400', success: '0', message: 'Malformed payload' } }, { status: 400 });
    }
    const dialect = request.headers.get('x-simulate-failure');
    if (dialect === 'true') {
      return HttpResponse.json({ response: { code: '400', success: '0', message: 'Simulated failure dialect' } }, { status: 400 });
    }
    if (dialect === 'validation_error') {
      return HttpResponse.json({ response: { code: '400', success: '0', message: 'Invalid material code' } }, { status: 400 });
    }
    if (dialect === 'timeout') {
      return HttpResponse.json({ response: { code: '504', success: '0', message: 'Gateway Timeout' } }, { status: 504 });
    }
    return HttpResponse.json({ response: { code: '200', success: '1', message: 'Success' } }, { status: 200 });
  }),
  
  http.post('https://api.petpooja.com/purchase/return/save', async ({ request }: { request: Request }) => {
    if (!(await validatePayload(request))) {
      return HttpResponse.json({ response: { code: '400', success: '0', message: 'Malformed payload' } }, { status: 400 });
    }
    const dialect = request.headers.get('x-simulate-failure');
    if (dialect === 'true') return HttpResponse.json({ response: { code: '400', success: '0', message: 'Simulated failure dialect' } }, { status: 400 });
    return HttpResponse.json({ response: { code: '200', success: '1', message: 'Success' } }, { status: 200 });
  }),

  http.post('https://api.petpooja.com/sale/save', async ({ request }: { request: Request }) => {
    if (!(await validatePayload(request))) {
      return HttpResponse.json({ response: { code: '400', success: '0', message: 'Malformed payload' } }, { status: 400 });
    }
    const dialect = request.headers.get('x-simulate-failure');
    if (dialect === 'true') {
      return HttpResponse.json({ response: { code: '400', success: '0', message: 'Simulated failure dialect' } }, { status: 400 });
    }
    if (dialect === 'print_failure') {
      return HttpResponse.json({ response: { code: '500', success: '0', message: 'KDS Print Failure' } }, { status: 500 });
    }
    return HttpResponse.json({ response: { code: '200', success: '1', message: 'Success' } }, { status: 200 });
  }),
  
  http.post('https://api.petpooja.com/transfer/save', async ({ request }: { request: Request }) => {
    if (!(await validatePayload(request))) {
      return HttpResponse.json({ response: { code: '400', success: '0', message: 'Malformed payload' } }, { status: 400 });
    }
    const dialect = request.headers.get('x-simulate-failure');
    if (dialect === 'true') return HttpResponse.json({ response: { code: '400', success: '0', message: 'Simulated failure dialect' } }, { status: 400 });
    return HttpResponse.json({ response: { code: '200', success: '1', message: 'Success' } }, { status: 200 });
  }),

  http.get('https://api.petpooja.com/stock', async ({ request }: { request: Request }) => {
    const dialect = request.headers.get('x-simulate-failure');
    if (dialect === 'true') {
      return HttpResponse.json({ response: { code: '400', success: '0', message: 'Simulated failure dialect' } }, { status: 400 });
    }
    return HttpResponse.json({ response: { code: '200', success: '1', message: 'Success' } }, { status: 200 });
  }),

  http.post('https://api.petpooja.com/raw_material/save', async ({ request }: { request: Request }) => {
    if (!(await validatePayload(request))) {
      return HttpResponse.json({ response: { code: '400', success: '0', message: 'Malformed payload' } }, { status: 400 });
    }
    const dialect = request.headers.get('x-simulate-failure');
    if (dialect === 'true') return HttpResponse.json({ response: { code: '400', success: '0', message: 'Simulated failure dialect' } }, { status: 400 });
    return HttpResponse.json({ response: { code: '200', success: '1', message: 'Success' } }, { status: 200 });
  }),

  http.post('https://api.petpooja.com/sale/return/save', async ({ request }: { request: Request }) => {
    if (!(await validatePayload(request))) {
      return HttpResponse.json({ response: { code: '400', success: '0', message: 'Malformed payload' } }, { status: 400 });
    }
    const dialect = request.headers.get('x-simulate-failure');
    if (dialect === 'true') return HttpResponse.json({ response: { code: '400', success: '0', message: 'Simulated failure dialect' } }, { status: 400 });
    return HttpResponse.json({ response: { code: '200', success: '1', message: 'Success' } }, { status: 200 });
  }),

  http.get('https://api.petpooja.com/purchase/list', async ({ request }: { request: Request }) => {
    const dialect = request.headers.get('x-simulate-failure');
    if (dialect === 'true') return HttpResponse.json({ response: { code: '400', success: '0', message: 'Simulated failure dialect' } }, { status: 400 });
    return HttpResponse.json({ response: { code: '200', success: '1', message: 'Success' } }, { status: 200 });
  }),

  http.get('https://api.petpooja.com/sale/list', async ({ request }: { request: Request }) => {
    const dialect = request.headers.get('x-simulate-failure');
    if (dialect === 'true') return HttpResponse.json({ response: { code: '400', success: '0', message: 'Simulated failure dialect' } }, { status: 400 });
    return HttpResponse.json({ response: { code: '200', success: '1', message: 'Success' } }, { status: 200 });
  }),

  http.get('https://api.petpooja.com/order/list', async ({ request }: { request: Request }) => {
    const dialect = request.headers.get('x-simulate-failure');
    if (dialect === 'true') return HttpResponse.json({ response: { code: '400', success: '0', message: 'Simulated failure dialect' } }, { status: 400 });
    return HttpResponse.json({ response: { code: '200', success: '1', message: 'Success' } }, { status: 200 });
  }),
  
  http.post('https://api.razorpay.com/v1/orders', async ({ request }: { request: Request }) => {
    if (!(await validatePayload(request))) {
      return HttpResponse.json({ response: { code: '400', success: '0', message: 'Malformed payload' } }, { status: 400 });
    }
    const dialect = request.headers.get('x-simulate-failure');
    if (dialect === 'true') {
      return HttpResponse.json({ response: { code: '400', success: '0', message: 'Simulated failure dialect' } }, { status: 400 });
    }
    return HttpResponse.json({ id: 'order_mock123', amount: 50000, status: 'created' }, { status: 200 });
  }),
];
