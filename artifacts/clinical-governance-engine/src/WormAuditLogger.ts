import crypto from 'crypto';

export type UserRole =
  | 'ROLE_PATIENT_CONSUMER'
  | 'ROLE_TIER_1_SUPPORT'
  | 'ROLE_TIER_2_CLINICAL_RD'
  | 'ROLE_TIER_3_CMO'
  | 'ROLE_QA_SUPERVISOR';

export interface AuthenticatedUser {
  userId: string;
  role: UserRole;
  credentials?: string;
  ipAddress: string;
  userAgent: string;
}

export interface WormAuditRecord {
  event_id: string;
  event_type: string;
  timestamp_utc: string;
  actor: AuthenticatedUser;
  chaining: {
    previous_event_hash: string;
    event_hash: string;
  };
  payload: Record<string, any>;
}

export interface WormStorageGateway {
  appendImmutableRecord(record: WormAuditRecord): Promise<void>;
  getLatestHash(): Promise<string>;
}

export class RBACEnforcementMiddleware {
  private static readonly PERMISSION_MATRIX: Record<string, UserRole[]> = {
    'ACKNOWLEDGE_WARNING': ['ROLE_PATIENT_CONSUMER'],
    'OVERRIDE_BIOCHEMICAL_HARD_STOP': [
      'ROLE_TIER_2_CLINICAL_RD',
      'ROLE_TIER_3_CMO',
    ],
    'OVERRIDE_ALLERGEN_HARD_STOP': [], // Strictly prohibited for all roles without 0ppm ELISA
    'LOCK_KITCHEN_PRODUCTION_LOT': [
      'ROLE_TIER_2_CLINICAL_RD',
      'ROLE_TIER_3_CMO',
      'ROLE_QA_SUPERVISOR',
    ],
    'VIEW_UNMASKED_CLINICAL_BIOMARKERS': [
      'ROLE_PATIENT_CONSUMER',
      'ROLE_TIER_2_CLINICAL_RD',
      'ROLE_TIER_3_CMO',
    ],
    'RESET_PACKING_STATION_INTERLOCK': [
      'ROLE_QA_SUPERVISOR',
      'ROLE_TIER_3_CMO',
    ],
  };

  public static authorize(action: string, user: AuthenticatedUser): void {
    const allowedRoles = this.PERMISSION_MATRIX[action];
    if (!allowedRoles) {
      throw new Error(
        `Security Exception: Action '${action}' is not defined in the RBAC matrix.`,
      );
    }

    if (!allowedRoles.includes(user.role)) {
      throw new Error(
        `RBAC Access Denied: User role '${user.role}' is not authorized to perform action '${action}'.`,
      );
    }
  }
}

export class CryptographicWormLogger {
  private lastEventHash: string =
    '0000000000000000000000000000000000000000000000000000000000000000';

  constructor(
    private readonly wormStorageGateway: WormStorageGateway,
    private readonly hmacSecretKey: string = process.env.WORM_AUDIT_HMAC_KEY ||
      'tanmatra_evd_65b_secret_key',
  ) {}

  public async initializeGenesis(): Promise<void> {
    try {
      this.lastEventHash = await this.wormStorageGateway.getLatestHash();
    } catch {
      this.lastEventHash =
        '0000000000000000000000000000000000000000000000000000000000000000';
    }
  }

  public async logEvent(
    eventType: string,
    actor: AuthenticatedUser,
    payload: Record<string, any>,
  ): Promise<WormAuditRecord> {
    const timestampUtc = new Date().toISOString();
    const eventId = `aud_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const previousHash = this.lastEventHash;

    const canonicalString = JSON.stringify({
      event_id: eventId,
      event_type: eventType,
      timestamp_utc: timestampUtc,
      actor,
      previous_event_hash: previousHash,
      payload,
    });

    const eventHash = crypto
      .createHmac('sha256', this.hmacSecretKey)
      .update(canonicalString)
      .digest('hex');

    const record: WormAuditRecord = {
      event_id: eventId,
      event_type: eventType,
      timestamp_utc: timestampUtc,
      actor,
      chaining: {
        previous_event_hash: previousHash,
        event_hash: eventHash,
      },
      payload,
    };

    await this.wormStorageGateway.appendImmutableRecord(record);
    this.lastEventHash = eventHash;
    return record;
  }
}
