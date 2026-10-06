require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const groupRoutes = require("./routes/groups");
const expenseRoutes = require("./routes/expenses");
const settlementRoutes = require("./routes/settlements");
const inviteRoutes = require("./routes/invites");

const app = express();

app.use(cors());
app.use(express.json());

// Simple request log, useful when demoing in an interview.
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/groups", groupRoutes);
// expenseRoutes, settlementRoutes and inviteRoutes all add routes nested
// under /api/groups/:id/...
app.use("/api/groups", expenseRoutes);
app.use("/api/groups", settlementRoutes);
app.use("/api/groups", inviteRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Central error handler as a safety net for anything not caught in routes.
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Something went wrong on the server" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Expense Splitter API running on port ${PORT}`);
});
