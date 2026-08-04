import {
  PetpoojaPurchaseOrderWebhookPayload,
  PetpoojaWebhookResponse
} from './PetpoojaService';
import { PetpoojaAuthConfig } from './ErpInvoiceMapper';

export interface WebhookAuthResult {
  isAuthenticated: boolean;
  response?: PetpoojaWebhookResponse;
}

/**
 * Security adapter for verifying Petpooja HTTP webhooks and payload credentials.
 */
export class PetpoojaWebhookAuthenticator {
  /**
   * Verifies incoming webhook credentials against authoritative tenant configuration.
   */
  public static verifyWebhookCredentials(
    payload: PetpoojaPurchaseOrderWebhookPayload,
    config: PetpoojaAuthConfig
  ): WebhookAuthResult {
    if (
      payload.app_key !== config.appKey ||
      payload.app_secret !== config.appSecret ||
      payload.access_token !== config.accessToken
    ) {
      return {
        isAuthenticated: false,
        response: {
          code: '401',
          success: '0',
          message: 'Unauthorized: Credential Mismatch'
        }
      };
    }

    return { isAuthenticated: true };
  }
}
