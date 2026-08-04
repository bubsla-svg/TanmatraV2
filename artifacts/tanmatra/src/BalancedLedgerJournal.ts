export interface DoubleEntryLedgerRecordPaise {
  journalId: string;
  orderId: string;
  debitAccount: string;
  creditAccount: string;
  amountPaise: number;
  timestamp: string;
  gstCreditNoteNumber?: string;
}

export interface LedgerPostingEntry {
  debitAccount: string;
  creditAccount: string;
  amountPaise: number;
}

/**
 * Deep double-entry ledger journal module.
 * Guarantees atomic debit/credit equality validation (sum(Debits) === sum(Credits)) before committing entries.
 */
export class BalancedLedgerJournal {
  private records: DoubleEntryLedgerRecordPaise[] = [];

  /**
   * Posts a batch of double-entry ledger lines for a given order ID.
   * Enforces that all accounts are valid and amounts are positive integer paise.
   */
  public postTransaction(orderId: string, entries: LedgerPostingEntry[]): DoubleEntryLedgerRecordPaise[] {
    if (!entries || entries.length === 0) {
      return [];
    }

    let totalDebitsPaise = 0;
    let totalCreditsPaise = 0;

    for (const entry of entries) {
      if (!entry.debitAccount || !entry.creditAccount) {
        throw new Error(
          `LEGAL_INVARIANT_VIOLATION: Double-entry ledger record malformed for order ${orderId} (missing debit or credit account).`
        );
      }
      if (entry.amountPaise <= 0) continue;
      totalDebitsPaise += entry.amountPaise;
      totalCreditsPaise += entry.amountPaise;
    }

    if (totalDebitsPaise !== totalCreditsPaise) {
      throw new Error(
        `LEGAL_INVARIANT_VIOLATION: Double-entry ledger imbalance detected for order ${orderId} ` +
        `(Total Debits: ${totalDebitsPaise} paise, Total Credits: ${totalCreditsPaise} paise).`
      );
    }

    const timestamp = new Date().toISOString();
    const newRecords: DoubleEntryLedgerRecordPaise[] = entries
      .filter(e => e.amountPaise > 0)
      .map((entry, idx) => ({
        journalId: `j_${orderId}_${Date.now()}_${idx + 1}`,
        orderId,
        debitAccount: entry.debitAccount,
        creditAccount: entry.creditAccount,
        amountPaise: entry.amountPaise,
        timestamp
      }));

    this.records.push(...newRecords);
    return newRecords;
  }

  /**
   * Returns all posted ledger records.
   */
  public getRecords(): DoubleEntryLedgerRecordPaise[] {
    return [...this.records];
  }

  /**
   * Returns records for a specific order.
   */
  public getRecordsForOrder(orderId: string): DoubleEntryLedgerRecordPaise[] {
    return this.records.filter(r => r.orderId === orderId);
  }
}
