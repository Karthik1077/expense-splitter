const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");
const { sendInviteEmail } = require("../utils/email");

const router = express.Router();
router.use(requireAuth);

async function assertMember(groupId, userId) {
  const result = await db.query(
    "SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2",
    [groupId, userId]
  );
  return result.rows.length > 0;
}

// POST /api/groups/:id/invites - invite someone who doesn't have an account yet
router.post("/:id/invites", async (req, res) => {
  try {
    const groupId = req.params.id;
    const { email } = req.body;

    const isMember = await assertMember(groupId, req.user.id);
    if (!isMember) return res.status(404).json({ error: "Group not found" });
    if (!email) return res.status(400).json({ error: "Email is required" });

    const normalizedEmail = email.toLowerCase();

    const existingUser = await db.query("SELECT id FROM users WHERE email = $1", [
      normalizedEmail,
    ]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        error: "That person already has an account — add them directly instead of inviting.",
      });
    }

    const existingInvite = await db.query(
      "SELECT id FROM invites WHERE group_id = $1 AND email = $2 AND accepted = FALSE",
      [groupId, normalizedEmail]
    );
    if (existingInvite.rows.length > 0) {
      return res.status(409).json({ error: "An invite is already pending for that email" });
    }

    const groupResult = await db.query("SELECT name FROM groups WHERE id = $1", [groupId]);
    const inviterResult = await db.query("SELECT name FROM users WHERE id = $1", [req.user.id]);

    await db.query(
      "INSERT INTO invites (group_id, email, invited_by) VALUES ($1, $2, $3)",
      [groupId, normalizedEmail, req.user.id]
    );

    const emailResult = await sendInviteEmail({
      to: normalizedEmail,
      groupName: groupResult.rows[0]?.name || "a group",
      inviterName: inviterResult.rows[0]?.name || "Someone",
    });

    res.status(201).json({
      invited: normalizedEmail,
      emailSent: emailResult.sent,
      note: emailResult.sent
        ? undefined
        : "No email service configured — check the server console for the invite link.",
    });
  } catch (err) {
    console.error("Send invite error:", err.message);
    res.status(500).json({ error: "Could not send invite" });
  }
});

// GET /api/groups/:id/invites - list pending invites for a group
router.get("/:id/invites", async (req, res) => {
  try {
    const groupId = req.params.id;
    const isMember = await assertMember(groupId, req.user.id);
    if (!isMember) return res.status(404).json({ error: "Group not found" });

    const result = await db.query(
      "SELECT id, email, created_at FROM invites WHERE group_id = $1 AND accepted = FALSE ORDER BY created_at DESC",
      [groupId]
    );
    res.json({ invites: result.rows });
  } catch (err) {
    console.error("List invites error:", err.message);
    res.status(500).json({ error: "Could not fetch invites" });
  }
});

module.exports = router;
