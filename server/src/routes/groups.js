const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");
const { computeSettlements } = require("../utils/settlement");

const router = express.Router();
router.use(requireAuth);

// POST /api/groups - create a group (creator is auto-added as a member)
router.post("/", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Group name is required" });
    }

    const groupResult = await db.query(
      "INSERT INTO groups (name, created_by) VALUES ($1, $2) RETURNING id, name, created_at",
      [name.trim(), req.user.id]
    );
    const group = groupResult.rows[0];

    await db.query(
      "INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)",
      [group.id, req.user.id]
    );

    res.status(201).json({ group });
  } catch (err) {
    console.error("Create group error:", err.message);
    res.status(500).json({ error: "Could not create group" });
  }
});

// GET /api/groups - list groups the current user belongs to
router.get("/", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT g.id, g.name, g.created_at,
              (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) AS member_count
       FROM groups g
       JOIN group_members gm ON gm.group_id = g.id
       WHERE gm.user_id = $1
       ORDER BY g.created_at DESC`,
      [req.user.id]
    );
    res.json({ groups: result.rows });
  } catch (err) {
    console.error("List groups error:", err.message);
    res.status(500).json({ error: "Could not fetch groups" });
  }
});

// Helper: check the current user belongs to a group, 404 the group otherwise.
async function assertMember(groupId, userId) {
  const result = await db.query(
    "SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2",
    [groupId, userId]
  );
  return result.rows.length > 0;
}

// GET /api/groups/:id - group details, members, and expenses
router.get("/:id", async (req, res) => {
  try {
    const groupId = req.params.id;
    const isMember = await assertMember(groupId, req.user.id);
    if (!isMember) return res.status(404).json({ error: "Group not found" });

    const groupResult = await db.query("SELECT id, name, created_at FROM groups WHERE id = $1", [
      groupId,
    ]);
    if (groupResult.rows.length === 0) {
      return res.status(404).json({ error: "Group not found" });
    }

    const membersResult = await db.query(
      `SELECT u.id, u.name, u.email
       FROM group_members gm
       JOIN users u ON u.id = gm.user_id
       WHERE gm.group_id = $1
       ORDER BY u.name`,
      [groupId]
    );

    const expensesResult = await db.query(
      `SELECT e.id, e.description, e.amount, e.split_type, e.category, e.created_at,
              e.paid_by, u.name AS paid_by_name
       FROM expenses e
       JOIN users u ON u.id = e.paid_by
       WHERE e.group_id = $1
       ORDER BY e.created_at DESC`,
      [groupId]
    );

    res.json({
      group: groupResult.rows[0],
      members: membersResult.rows,
      expenses: expensesResult.rows,
    });
  } catch (err) {
    console.error("Get group error:", err.message);
    res.status(500).json({ error: "Could not fetch group" });
  }
});

// POST /api/groups/:id/members - add a member by email (they must already have an account)
router.post("/:id/members", async (req, res) => {
  try {
    const groupId = req.params.id;
    const { email } = req.body;

    const isMember = await assertMember(groupId, req.user.id);
    if (!isMember) return res.status(404).json({ error: "Group not found" });

    if (!email) return res.status(400).json({ error: "Email is required" });

    const userResult = await db.query("SELECT id, name, email FROM users WHERE email = $1", [
      email.toLowerCase(),
    ]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "No account found with that email. They need to sign up first." });
    }
    const newMember = userResult.rows[0];

    const already = await assertMember(groupId, newMember.id);
    if (already) {
      return res.status(409).json({ error: "That person is already in the group" });
    }

    await db.query("INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)", [
      groupId,
      newMember.id,
    ]);

    res.status(201).json({ member: newMember });
  } catch (err) {
    console.error("Add member error:", err.message);
    res.status(500).json({ error: "Could not add member" });
  }
});

// GET /api/groups/:id/balances - net balance per member + minimal settlement plan
router.get("/:id/balances", async (req, res) => {
  try {
    const groupId = req.params.id;
    const isMember = await assertMember(groupId, req.user.id);
    if (!isMember) return res.status(404).json({ error: "Group not found" });

    const membersResult = await db.query(
      `SELECT u.id, u.name FROM group_members gm
       JOIN users u ON u.id = gm.user_id
       WHERE gm.group_id = $1`,
      [groupId]
    );

    // Net balance = total paid - total owed, per user.
    const paidResult = await db.query(
      `SELECT paid_by AS user_id, COALESCE(SUM(amount), 0) AS total_paid
       FROM expenses WHERE group_id = $1 GROUP BY paid_by`,
      [groupId]
    );
    const owedResult = await db.query(
      `SELECT es.user_id, COALESCE(SUM(es.share_amount), 0) AS total_owed
       FROM expense_shares es
       JOIN expenses e ON e.id = es.expense_id
       WHERE e.group_id = $1
       GROUP BY es.user_id`,
      [groupId]
    );

    // Recorded real-world payments (from "mark as paid") that have already
    // settled part of the debt, and so need to be netted out below.
    const settlementsResult = await db.query(
      `SELECT from_user, to_user, amount FROM settlement_records WHERE group_id = $1`,
      [groupId]
    );

    const paidMap = Object.fromEntries(
      paidResult.rows.map((r) => [r.user_id, parseFloat(r.total_paid)])
    );
    const owedMap = Object.fromEntries(
      owedResult.rows.map((r) => [r.user_id, parseFloat(r.total_owed)])
    );

    const balances = {};
    const memberNames = {};
    for (const member of membersResult.rows) {
      const paid = paidMap[member.id] || 0;
      const owed = owedMap[member.id] || 0;
      balances[member.id] = paid - owed;
      memberNames[member.id] = member.name;
    }

    // A recorded settlement is a real payment from a debtor to a creditor:
    // it moves both balances toward zero by the settled amount.
    for (const s of settlementsResult.rows) {
      const amount = parseFloat(s.amount);
      if (balances[s.from_user] !== undefined) balances[s.from_user] += amount;
      if (balances[s.to_user] !== undefined) balances[s.to_user] -= amount;
    }

    const settlements = computeSettlements(balances).map((s) => ({
      fromId: s.from,
      fromName: memberNames[s.from],
      toId: s.to,
      toName: memberNames[s.to],
      amount: s.amount,
    }));

    const balanceList = Object.entries(balances).map(([userId, amount]) => ({
      userId,
      name: memberNames[userId],
      balance: Math.round(amount * 100) / 100,
    }));

    res.json({ balances: balanceList, settlements });
  } catch (err) {
    console.error("Balances error:", err.message);
    res.status(500).json({ error: "Could not compute balances" });
  }
});

// GET /api/groups/:id/spending-by-category - totals for the chart
router.get("/:id/spending-by-category", async (req, res) => {
  try {
    const groupId = req.params.id;
    const isMember = await assertMember(groupId, req.user.id);
    if (!isMember) return res.status(404).json({ error: "Group not found" });

    const result = await db.query(
      `SELECT category, SUM(amount) AS total
       FROM expenses
       WHERE group_id = $1
       GROUP BY category
       ORDER BY total DESC`,
      [groupId]
    );

    const breakdown = result.rows.map((r) => ({
      category: r.category,
      total: parseFloat(r.total),
    }));

    res.json({ breakdown });
  } catch (err) {
    console.error("Spending by category error:", err.message);
    res.status(500).json({ error: "Could not compute spending breakdown" });
  }
});

module.exports = router;
