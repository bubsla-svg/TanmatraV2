import { ordersApi, type OrderStatus } from "./ordersApi";

export type UpiProvider = "razorpay" | "gpay" | "phonepe" | "paytm" | "generic";

export interface PendingUpiTx {
  orderId: string;
  idempotencyKey: string;
  initiatedAt: number; // Date.now() in ms
  amount: number; // amount in paise
  provider: UpiProvider;
}

export interface UpiRecoveryEvent {
  tx: PendingUpiTx;
  status: OrderStatus;
  recoveredAt: number;
}

export let inMemoryPendingTxs: PendingUpiTx[] = [];

const STORAGE_KEY = "tanmatra:upi-pending-tx:v1";
const TTL_MS = 60 * 60 * 1000; // 1 hour TTL

/**
 * Reads pending UPI transactions from localStorage and in-memory fallback, purging any expired entries.
 */
export function getPendingTransactions(): PendingUpiTx[] {
  let storageList: PendingUpiTx[] = [];
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        storageList = Array.isArray(parsed) ? parsed : [parsed];
      }
    } catch {
      // localStorage read failed (e.g. SecurityError in private browsing)
    }
  }

  const txMap = new Map<string, PendingUpiTx>();
  for (const tx of storageList) {
    if (tx && tx.orderId) txMap.set(tx.orderId, tx);
  }
  for (const tx of inMemoryPendingTxs) {
    if (tx && tx.orderId) txMap.set(tx.orderId, tx);
  }

  const now = Date.now();
  const allList = Array.from(txMap.values());
  const valid = allList.filter((tx) => tx && tx.orderId && (now - tx.initiatedAt) < TTL_MS);

  inMemoryPendingTxs = valid;

  if (typeof window !== "undefined") {
    try {
      if (valid.length === 0) {
        window.localStorage.removeItem(STORAGE_KEY);
      } else if (valid.length !== storageList.length) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(valid));
      }
    } catch {
      // Ignore localStorage write failure (e.g. QuotaExceededError or Private Browsing)
    }
  }

  return valid;
}

/**
 * Saves or updates a pending UPI transaction in localStorage and in-memory fallback.
 */
export function savePendingTransaction(tx: PendingUpiTx): void {
  const existing = getPendingTransactions().filter((item) => item.orderId !== tx.orderId);
  existing.push(tx);
  inMemoryPendingTxs = existing;

  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  } catch (err) {
    console.error("Failed to persist pending UPI transaction to storage, retained in memory:", err);
  }
}

/**
 * Removes a specific pending transaction by orderId from both storage and memory.
 */
export function removePendingTransaction(orderId: string): void {
  const remaining = getPendingTransactions().filter((item) => item.orderId !== orderId);
  inMemoryPendingTxs = remaining;

  if (typeof window === "undefined") return;
  try {
    if (remaining.length === 0) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
    }
  } catch (err) {
    console.error("Failed to remove pending UPI transaction from storage:", err);
  }
}

export type RecoveryListeners = {
  onPollingStart?: (txs: PendingUpiTx[]) => void;
  onRecovered?: (event: UpiRecoveryEvent) => void;
  onFailed?: (tx: PendingUpiTx, status: OrderStatus) => void;
  onPollingEnd?: () => void;
};

const listeners = new Set<RecoveryListeners>();
let pollingActive = false;
let currentSleepCancel: (() => void) | null = null;
let restartRequested = false;

/**
 * Polls backend order status with bounded exponential backoff upon return from UPI app.
 * If forceImmediate is true while sleeping during backoff, interrupts sleep and restarts polling sequence immediately.
 */
export async function pollPendingTransactions(forceImmediate = false): Promise<void> {
  const pending = getPendingTransactions();
  if (pending.length === 0) return;

  if (pollingActive) {
    if (forceImmediate) {
      restartRequested = true;
      if (currentSleepCancel) {
        currentSleepCancel();
      }
    }
    return;
  }

  pollingActive = true;
  restartRequested = false;
  listeners.forEach((l) => l.onPollingStart?.(pending));

  const delays = [0, 2000, 5000, 10000, 20000]; // Multi-step poll sequence
  let i = 0;
  while (i < delays.length) {
    if (restartRequested) {
      i = 0;
      restartRequested = false;
    }
    const delayMs = delays[i];

    if (delayMs > 0) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          currentSleepCancel = null;
          resolve();
        }, delayMs);
        currentSleepCancel = () => {
          clearTimeout(timer);
          currentSleepCancel = null;
          resolve();
        };
      });
    }

    if (restartRequested) {
      i = 0;
      restartRequested = false;
      continue;
    }

    const currentList = getPendingTransactions();
    if (currentList.length === 0) break;

    for (const tx of currentList) {
      try {
        const res = await ordersApi.getOrderStatus(tx.orderId);
        const isSuccess = ["confirmed", "prep", "out_for_delivery", "delivered", "placed", "preparing", "ready"].includes(res.status as string);
        const isTerminalFailure = ["cancelled", "failed"].includes(res.status as string);

        if (isSuccess) {
          removePendingTransaction(tx.orderId);
          const event: UpiRecoveryEvent = { tx, status: res.status, recoveredAt: Date.now() };
          window.dispatchEvent(new CustomEvent("tanmatra:upi-recovered", { detail: event }));
          listeners.forEach((l) => l.onRecovered?.(event));
        } else if (isTerminalFailure) {
          removePendingTransaction(tx.orderId);
          listeners.forEach((l) => l.onFailed?.(tx, res.status));
        }
      } catch {
        // Network or polling error; retry on next delay tick
      }
    }

    const remainingList = getPendingTransactions();
    if (remainingList.length === 0) break;

    if (restartRequested) {
      i = 0;
      restartRequested = false;
    } else {
      i++;
    }
  }

  pollingActive = false;
  currentSleepCancel = null;
  listeners.forEach((l) => l.onPollingEnd?.());
}

let listenerRefCount = 0;
let listenerInitialized = false;
let globalRemoveListeners: (() => void) | null = null;

/**
 * Initializes global visibilitychange and focus event listeners for UPI auto-recovery.
 */
export function initUpiRecoveryListener(): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") return () => {};

  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      void pollPendingTransactions(true);
    }
  };

  const handleFocus = () => {
    void pollPendingTransactions(true);
  };

  if (!listenerInitialized) {
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    listenerInitialized = true;
    globalRemoveListeners = () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
    if (document.visibilityState === "visible") {
      void pollPendingTransactions(true);
    }
  }

  listenerRefCount++;

  let cleanedUp = false;
  return () => {
    if (cleanedUp) return;
    cleanedUp = true;
    listenerRefCount--;
    if (listenerRefCount <= 0) {
      listenerRefCount = 0;
      if (globalRemoveListeners) {
        globalRemoveListeners();
        globalRemoveListeners = null;
      }
      listenerInitialized = false;
    }
  };
}

export function subscribeUpiRecovery(cb: RecoveryListeners): () => void {
  listeners.add(cb);
  const unsubscribeListener = initUpiRecoveryListener();
  void pollPendingTransactions(true);
  return () => {
    listeners.delete(cb);
    unsubscribeListener();
  };
}
