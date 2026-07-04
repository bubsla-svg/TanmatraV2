import * as crypto from 'crypto';

export class SecurityThreatMitigationService {
  private otpRequestCounts: Map<
    string,
    {count: number; firstRequestMs: number}
  > = new Map();

  /**
   * GATE-SEC-02: Cryptographic timing-safe webhook signature & timestamp verification.
   * Prevents timing attacks via crypto.timingSafeEqual and blocks replayed packets (>300s old).
   */
  public static validateWebhookSignatureTimingSafe(
    payloadBody: string,
    signatureHeader: string,
    timestampHeader: string,
    secret: string,
  ): {isValid: boolean; reason?: string} {
    // 1. Verify timestamp window (< 300 seconds)
    const timestampSec = parseInt(timestampHeader, 10);
    if (isNaN(timestampSec)) {
      return {isValid: false, reason: 'Invalid X-Timestamp header format.'};
    }
    const currentSec = Math.floor(Date.now() / 1000);
    const ageSec = Math.abs(currentSec - timestampSec);
    if (ageSec > 300) {
      return {
        isValid: false,
        reason: `Webhook replay protection triggered: Timestamp age ${ageSec}s exceeds 300s window.`,
      };
    }

    // 2. Compute expected HMAC-SHA256 signature
    const signedPayload = `${timestampHeader}.${payloadBody}`;
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');

    // 3. Constant-time comparison using crypto.timingSafeEqual
    const expectedBuffer = Buffer.from(expectedSig, 'utf8');
    const providedBuffer = Buffer.from(signatureHeader, 'utf8');

    if (expectedBuffer.length !== providedBuffer.length) {
      return {isValid: false, reason: 'HMAC signature length mismatch.'};
    }

    const isMatch = crypto.timingSafeEqual(expectedBuffer, providedBuffer);
    if (!isMatch) {
      return {
        isValid: false,
        reason: 'HMAC signature mismatch (Timing-safe check failed).',
      };
    }

    return {isValid: true};
  }

  /**
   * GATE-SEC-04: OTP rate-limiting and SIM-swap binding verification.
   * Enforces 3 requests per 300s window and verifies SIM ICCID hash binding.
   */
  public enforceOtpRateLimitAndSimBinding(
    phone: string,
    clientIp: string,
    deviceId: string,
    simIccidHash?: string,
    registeredSimHash?: string,
  ): {allowed: boolean; reason?: string; retryAfterSec?: number} {
    const rateKey = `otp:${phone}:${clientIp}`;
    const now = Date.now();
    const windowMs = 300 * 1000;
    const maxRequests = 3;

    // 1. Check SIM ICCID binding if registered
    if (registeredSimHash && simIccidHash !== registeredSimHash) {
      return {
        allowed: false,
        reason: `SECURITY ALERT: SIM-swap fraud risk detected. Provided SIM ICCID hash does not match bound device SIM.`,
      };
    }

    // 2. Sliding window token bucket check
    const current = this.otpRequestCounts.get(rateKey);
    if (!current || now - current.firstRequestMs > windowMs) {
      this.otpRequestCounts.set(rateKey, {count: 1, firstRequestMs: now});
      return {allowed: true};
    }

    if (current.count >= maxRequests) {
      const retryAfterSec = Math.ceil(
        (windowMs - (now - current.firstRequestMs)) / 1000,
      );
      return {
        allowed: false,
        reason: `OTP rate-limit exceeded: Maximum ${maxRequests} requests per 5 minutes allowed.`,
        retryAfterSec,
      };
    }

    current.count += 1;
    return {allowed: true};
  }

  /**
   * GATE-SEC-03: Automated PII & Health Biomarker log scrubbing.
   * Redacts sensitive biomarkers and personal data before log serialization.
   */
  public static sanitizePiiAndClinicalLogs(data: any): any {
    if (data === null || typeof data !== 'object') {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.sanitizePiiAndClinicalLogs(item));
    }

    const sanitized: Record<string, any> = {};
    const sensitiveKeys = new Set([
      'phone',
      'phone_number',
      'token',
      'idempotency_key',
      'egfr_ml_min',
      'serum_potassium_meq_l',
      'is_pregnant',
      'current_glucose_mgdl',
      'cgm_glucose_trend',
      'tamper_seal_barcode',
      'signature',
    ]);

    for (const [key, val] of Object.entries(data)) {
      if (sensitiveKeys.has(key.toLowerCase())) {
        sanitized[key] = '[REDACTED_PHI]';
      } else if (typeof val === 'object' && val !== null) {
        sanitized[key] = this.sanitizePiiAndClinicalLogs(val);
      } else {
        sanitized[key] = val;
      }
    }

    return sanitized;
  }

  /**
   * GATE-SEC-01: Object-level BOLA / IDOR authorization guard.
   * Verifies requester ownership or explicit clinical delegation.
   */
  public static authorizeObjectLevelAccess(
    requesterId: string,
    requesterRole: string,
    targetPatientId: string,
  ): {authorized: boolean; auditFlag?: string} {
    if (requesterId === targetPatientId) {
      return {authorized: true};
    }
    if (
      requesterRole === 'ROLE_TIER_2_CLINICAL_RD' ||
      requesterRole === 'ROLE_SYSTEM_AUDITOR'
    ) {
      return {
        authorized: true,
        auditFlag: `DELEGATED_ACCESS_BY_${requesterRole}`,
      };
    }
    return {
      authorized: false,
      auditFlag: `BOLA_ATTEMPT_BLOCKED: User '${requesterId}' (${requesterRole}) attempted unauthorized access to dossier '${targetPatientId}'.`,
    };
  }
}
