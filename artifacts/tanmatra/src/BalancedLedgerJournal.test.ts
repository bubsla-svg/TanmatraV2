import test from 'node:test';
import assert from 'node:assert/strict';
import { BalancedLedgerJournal, LedgerPostingEntry } from './BalancedLedgerJournal';

test('BalancedLedgerJournal posts balanced entries correctly in integer paise', () => {
  const journal = new BalancedLedgerJournal();

  const entries: LedgerPostingEntry[] = [
    { debitAccount: 'ASSET_PG_CLEARING', creditAccount: 'REVENUE_CLEARING', amountPaise: 11400 },
    { debitAccount: 'REVENUE_CLEARING', creditAccount: 'REVENUE_FOOD_SALES', amountPaise: 8000 },
    { debitAccount: 'REVENUE_CLEARING', creditAccount: 'REVENUE_DELIVERY_FEES', amountPaise: 2500 },
    { debitAccount: 'REVENUE_CLEARING', creditAccount: 'LIABILITY_GST_CGST_OUTPUT', amountPaise: 450 },
    { debitAccount: 'REVENUE_CLEARING', creditAccount: 'LIABILITY_GST_SGST_OUTPUT', amountPaise: 450 }
  ];

  const records = journal.postTransaction('ORD-9001', entries);

  assert.equal(records.length, 5);
  assert.equal(journal.getRecords().length, 5);
});

test('BalancedLedgerJournal throws invariant violation on missing debit or credit account', () => {
  const journal = new BalancedLedgerJournal();

  const entries: LedgerPostingEntry[] = [
    { debitAccount: 'ASSET_PG_CLEARING', creditAccount: '', amountPaise: 10000 } // missing credit account
  ];

  assert.throws(
    () => journal.postTransaction('ORD-9002', entries),
    /LEGAL_INVARIANT_VIOLATION/
  );
});
