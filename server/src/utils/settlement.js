/**
 * Given a map of { userId: netBalance } where a positive balance means
 * "is owed money" and a negative balance means "owes money", compute the
 * minimum number of transactions needed to settle every balance to zero.
 *
 * Approach: greedy matching. Repeatedly match the person owed the most
 * against the person who owes the most, settle as much of that pair as
 * possible, and repeat. This does not guarantee the mathematically optimal
 * minimum in every edge case (that's an NP-hard subset-sum variant), but
 * it is the standard, well-understood approach used by tools like
 * Splitwise for the general case, and is a good, explainable answer for
 * an interview: O(n log n) for the sort, O(n) for the settlement pass.
 *
 * @param {Object<string, number>} balances - userId -> net balance
 * @returns {Array<{from: string, to: string, amount: number}>}
 */
function computeSettlements(balances) {
  const EPSILON = 0.01; // ignore rounding dust below one cent

  // Split into creditors (owed money) and debtors (owe money).
  // Round to 2 decimal places to avoid floating point drift.
  const creditors = [];
  const debtors = [];

  for (const [userId, rawAmount] of Object.entries(balances)) {
    const amount = Math.round(rawAmount * 100) / 100;
    if (amount > EPSILON) {
      creditors.push({ userId, amount });
    } else if (amount < -EPSILON) {
      debtors.push({ userId, amount: -amount }); // store as positive "owes"
    }
  }

  // Largest amounts first — this is what keeps the number of
  // transactions low in the common case.
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const settlements = [];
  let i = 0;
  let j = 0;

  while (i < creditors.length && j < debtors.length) {
    const creditor = creditors[i];
    const debtor = debtors[j];
    const settledAmount = Math.min(creditor.amount, debtor.amount);

    if (settledAmount > EPSILON) {
      settlements.push({
        from: debtor.userId,
        to: creditor.userId,
        amount: Math.round(settledAmount * 100) / 100,
      });
    }

    creditor.amount -= settledAmount;
    debtor.amount -= settledAmount;

    if (creditor.amount <= EPSILON) i++;
    if (debtor.amount <= EPSILON) j++;
  }

  return settlements;
}

module.exports = { computeSettlements };
