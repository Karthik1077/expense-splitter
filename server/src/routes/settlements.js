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

// POST /api/groups/:id/settlements - record a real payment between two members
// body: { fromId, toId, amount }
router.post("/:id/settlements", async (req, res) => {
  try {
    const groupId = req.params.id;
    const { fromId, toId, amount } = req.body;

    const isMember = await assertMember(groupId, req.user.id);
    if (!isMember) return res.status(404).json({ error: "Group not found" });

    const numericAmount = Number(amount);
    if (!fromId || !toId || !numericAmount || numericAmount <= 0) {
      return res.status(400).json({ error: "fromId, toId and a positive amount are required" });
    }
    if (fromId === toId) {
      return res.status(400).json({ error: "fromId and toId must be different people" });
    }

    const fromOk = await assertMember(groupId, fromId);
    const toOk = await assertMember(groupId, toId);
    if (!fromOk || !toOk) {
      return res.status(400).json({ error: "Both people must be members of this group" });
    }

    const result = await db.query(
      `INSERT INTO settlement_records (group_id, from_user, to_user, amount)
       VALUES ($1, $2, $3, $4) RETURNING id, from_user, to_user, amount, settled_at`,
      [groupId, fromId, toId, numericAmount]
    );

    res.status(201).json({ settlement: result.rows[0] });
  } catch (err) {
    console.error("Record settlement error:", err.message);
    res.status(500).json({ error: "Could not record settlement" });
  }
});

// GET /api/groups/:id/settlements - history of recorded payments
router.get("/:id/settlements", async (req, res) => {
  try {
    const groupId = req.params.id;
    const isMember = await assertMember(groupId, req.user.id);
    if (!isMember) return res.status(404).json({ error: "Group not found" });

    const result = await db.query(
      `SELECT sr.id, sr.amount, sr.settled_at,
              sr.from_user, uf.name AS from_name,
              sr.to_user, ut.name AS to_name
       FROM settlement_records sr
       JOIN users uf ON uf.id = sr.from_user
       JOIN users ut ON ut.id = sr.to_user
       WHERE sr.group_id = $1
       ORDER BY sr.settled_at DESC`,
      [groupId]
    );

    res.json({ settlements: result.rows });
  } catch (err) {
    console.error("Settlement history error:", err.message);
    res.status(500).json({ error: "Could not fetch settlement history" });
  }
});

module.exports = router;
