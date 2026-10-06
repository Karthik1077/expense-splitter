const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

async function assertMember(groupId, userId) {
  const result = await db.query(
    "SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2",
    [groupId, userId]
  );
  return result.rows.length > 0;
}

// POST /api/groups/:id/expenses
// body: { description, amount, paidBy, splitType: 'equal' | 'custom', shares?: [{userId, amount}] }
router.post("/:id/expenses", async (req, res) => {
  const client = await db.pool.connect();
  try {
    const groupId = req.params.id;
    const { description, amount, paidBy, splitType, shares, category } = req.body;
    const ALLOWED_CATEGORIES = ["Food", "Rent", "Utilities", "Travel", "Entertainment", "Other"];
    const finalCategory = ALLOWED_CATEGORIES.includes(category) ? category : "Other";

    const isMember = await assertMember(groupId, req.user.id);
    if (!isMember) return res.status(404).json({ error: "Group not found" });

    if (!description || !description.trim()) {
      return res.status(400).json({ error: "Description is required" });
    }
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      return res.status(400).json({ error: "Amount must be a positive number" });
    }
    if (!paidBy) {
      return res.status(400).json({ error: "paidBy is required" });
    }
    if (!["equal", "custom"].includes(splitType)) {
      return res.status(400).json({ error: "splitType must be 'equal' or 'custom'" });
    }

    const payerIsMember = await assertMember(groupId, paidBy);
    if (!payerIsMember) {
      return res.status(400).json({ error: "The payer must be a member of this group" });
    }

    let computedShares;

    if (splitType === "equal") {
      const membersResult = await db.query(
        "SELECT user_id FROM group_members WHERE group_id = $1",
        [groupId]
      );
      const memberIds = membersResult.rows.map((r) => r.user_id);
      if (memberIds.length === 0) {
        return res.status(400).json({ error: "Group has no members" });
      }

      // Split evenly, giving any leftover paise/cents to the first member
      // so the shares always sum exactly to the total amount.
      const baseShare = Math.floor((numericAmount / memberIds.length) * 100) / 100;
      const remainder =
        Math.round((numericAmount - baseShare * memberIds.length) * 100) / 100;

      computedShares = memberIds.map((userId, index) => ({
        userId,
        amount: index === 0 ? baseShare + remainder : baseShare,
      }));
    } else {
      if (!Array.isArray(shares) || shares.length === 0) {
        return res.status(400).json({ error: "Custom split requires a shares array" });
      }
      const total = shares.reduce((sum, s) => sum + Number(s.amount || 0), 0);
      if (Math.abs(total - numericAmount) > 0.01) {
        return res.status(400).json({
          error: `Shares must add up to the total amount (got ${total.toFixed(2)}, expected ${numericAmount.toFixed(2)})`,
        });
      }
      for (const s of shares) {
        const memberOk = await assertMember(groupId, s.userId);
        if (!memberOk) {
          return res.status(400).json({ error: "All share recipients must be group members" });
        }
      }
      computedShares = shares.map((s) => ({ userId: s.userId, amount: Number(s.amount) }));
    }

    await client.query("BEGIN");

    const expenseResult = await client.query(
      `INSERT INTO expenses (group_id, paid_by, description, amount, split_type, category)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, description, amount, split_type, category, created_at`,
      [groupId, paidBy, description.trim(), numericAmount, splitType, finalCategory]
    );
    const expense = expenseResult.rows[0];

    for (const share of computedShares) {
      await client.query(
        "INSERT INTO expense_shares (expense_id, user_id, share_amount) VALUES ($1, $2, $3)",
        [expense.id, share.userId, share.amount]
      );
    }

    await client.query("COMMIT");
    res.status(201).json({ expense, shares: computedShares });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Add expense error:", err.message);
    res.status(500).json({ error: "Could not add expense" });
  } finally {
    client.release();
  }
});

// DELETE /api/groups/:id/expenses/:expenseId
router.delete("/:id/expenses/:expenseId", async (req, res) => {
  try {
    const { id: groupId, expenseId } = req.params;
    const isMember = await assertMember(groupId, req.user.id);
    if (!isMember) return res.status(404).json({ error: "Group not found" });

    const result = await db.query(
      "DELETE FROM expenses WHERE id = $1 AND group_id = $2 RETURNING id",
      [expenseId, groupId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Expense not found" });
    }
    res.json({ deleted: true });
  } catch (err) {
    console.error("Delete expense error:", err.message);
    res.status(500).json({ error: "Could not delete expense" });
  }
});

module.exports = router;
