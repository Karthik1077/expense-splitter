import { useEffect, useState, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import {
  UserPlus, Receipt, ArrowLeft, Trash2, Scale,
  ArrowRight, CheckCircle2, ArrowDownUp,
} from "lucide-react";
import { api } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { SkeletonExpenseList } from "../components/Skeleton.jsx";
import SpendingChart from "../components/SpendingChart.jsx";

const CATEGORIES = ["Food", "Rent", "Utilities", "Travel", "Entertainment", "Other"];

function formatMoney(amount) {
  const n = Number(amount);
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function initials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return parts.length === 1
    ? parts[0].slice(0, 2).toUpperCase()
    : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function GroupDetail() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const { showToast } = useToast();

  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [balances, setBalances] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [breakdown, setBreakdown] = useState([]);
  const [tab, setTab] = useState("expenses");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showAddMember, setShowAddMember] = useState(false);
  const [memberEmail, setMemberEmail] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [memberNotFound, setMemberNotFound] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);

  const [showAddExpense, setShowAddExpense] = useState(false);

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const [groupData, balanceData, breakdownData] = await Promise.all([
        api.getGroup(id, token),
        api.getBalances(id, token),
        api.getSpendingByCategory(id, token),
      ]);
      setGroup(groupData.group);
      setMembers(groupData.members);
      setExpenses(groupData.expenses);
      setBalances(balanceData.balances);
      setSettlements(balanceData.settlements);
      setBreakdown(breakdownData.breakdown);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleAddMember(e) {
    e.preventDefault();
    setAddingMember(true);
    setError("");
    setMemberNotFound(false);
    try {
      await api.addMember(id, { email: memberEmail }, token);
      showToast(`Added ${memberEmail} to the group`);
      setMemberEmail("");
      setShowAddMember(false);
      loadAll();
    } catch (err) {
      // The backend returns this specific message when the email has no
      // account yet — that's our cue to offer "send an invite" instead.
      if (err.message.includes("sign up first")) {
        setMemberNotFound(true);
      } else {
        setError(err.message);
      }
    } finally {
      setAddingMember(false);
    }
  }

  async function handleSendInvite() {
    setSendingInvite(true);
    setError("");
    try {
      const result = await api.sendInvite(id, { email: memberEmail }, token);
      showToast(
        result.emailSent ? `Invite emailed to ${memberEmail}` : `Invite created for ${memberEmail} (no email service configured — check server console)`
      );
      setMemberEmail("");
      setMemberNotFound(false);
      setShowAddMember(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSendingInvite(false);
    }
  }

  async function handleDeleteExpense(expenseId) {
    if (!confirm("Remove this expense? Balances will be recalculated.")) return;
    try {
      await api.deleteExpense(id, expenseId, token);
      showToast("Expense removed");
      loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleMarkSettled(settlement) {
    try {
      await api.recordSettlement(
        id,
        { fromId: settlement.fromId, toId: settlement.toId, amount: settlement.amount },
        token
      );
      showToast(`Marked ${formatMoney(settlement.amount)} as paid`);
      loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) {
    return (
      <main className="container-wide">
        <SkeletonExpenseList />
      </main>
    );
  }

  if (!group) {
    return (
      <main>
        <div className="error-banner">{error || "Group not found"}</div>
      </main>
    );
  }

  return (
    <main className="container-wide">
      <div className="group-header">
        <Link to="/dashboard" className="back-link">
          <ArrowLeft size={13} style={{ verticalAlign: "-2px", marginRight: "0.3rem" }} />
          All groups
        </Link>
        <div className="page-header">
          <h1>{group.name}</h1>
          <div style={{ display: "flex", gap: "0.6rem" }}>
            <button className="btn btn-ghost" onClick={() => setShowAddMember(true)}>
              <UserPlus size={16} /> Add member
            </button>
            <button className="btn btn-gold" onClick={() => setShowAddExpense(true)}>
              <Receipt size={16} /> Add expense
            </button>
          </div>
        </div>

        <div className="members-row">
          {members.map((m) => (
            <span className="member-chip" key={m.id}>
              <span className="member-avatar">{initials(m.name)}</span>
              {m.name}
              {m.id === user.id ? " (you)" : ""}
            </span>
          ))}
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="tabs">
        <button
          className={`tab ${tab === "expenses" ? "active" : ""}`}
          onClick={() => setTab("expenses")}
        >
          <Receipt size={15} style={{ verticalAlign: "-3px", marginRight: "0.35rem" }} />
          Expenses
        </button>
        <button
          className={`tab ${tab === "balances" ? "active" : ""}`}
          onClick={() => setTab("balances")}
        >
          <Scale size={15} style={{ verticalAlign: "-3px", marginRight: "0.35rem" }} />
          Balances
        </button>
      </div>

      {tab === "expenses" ? (
        <>
          <SpendingChart breakdown={breakdown} />
          <ExpensesList expenses={expenses} onDelete={handleDeleteExpense} />
        </>
      ) : (
        <BalancesView
          balances={balances}
          settlements={settlements}
          currentUserId={user.id}
          onMarkSettled={handleMarkSettled}
        />
      )}

      {showAddMember && (
        <div
          className="modal-backdrop"
          onClick={() => {
            setShowAddMember(false);
            setMemberNotFound(false);
          }}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Add a member</h2>

            {memberNotFound ? (
              <div>
                <p className="helper-text" style={{ marginBottom: "1rem" }}>
                  No account exists yet for <strong>{memberEmail}</strong>. You can send them an
                  invite email instead — they'll join this group automatically once they sign up.
                </p>
                {error && <div className="error-banner">{error}</div>}
                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      setMemberNotFound(false);
                      setError("");
                    }}
                  >
                    Try a different email
                  </button>
                  <button className="btn btn-gold" onClick={handleSendInvite} disabled={sendingInvite}>
                    {sendingInvite ? "Sending…" : "Send invite"}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleAddMember}>
                <div className="field">
                  <label htmlFor="memberEmail">Their email</label>
                  <input
                    id="memberEmail"
                    type="email"
                    value={memberEmail}
                    onChange={(e) => setMemberEmail(e.target.value)}
                    required
                    autoFocus
                  />
                  <p className="helper-text">
                    If they don't have an account yet, we'll offer to invite them instead.
                  </p>
                </div>
                {error && <div className="error-banner">{error}</div>}
                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setShowAddMember(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-gold" disabled={addingMember}>
                    {addingMember ? "Checking…" : "Add"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {showAddExpense && (
        <AddExpenseModal
          groupId={id}
          members={members}
          token={token}
          onClose={() => setShowAddExpense(false)}
          onAdded={() => {
            setShowAddExpense(false);
            loadAll();
          }}
        />
      )}
    </main>
  );
}

const EXPENSE_SORTS = {
  newest: { label: "Newest first", fn: (a, b) => new Date(b.created_at) - new Date(a.created_at) },
  oldest: { label: "Oldest first", fn: (a, b) => new Date(a.created_at) - new Date(b.created_at) },
  amount_high: { label: "Amount: high to low", fn: (a, b) => b.amount - a.amount },
  amount_low: { label: "Amount: low to high", fn: (a, b) => a.amount - b.amount },
};

function ExpensesList({ expenses, onDelete }) {
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [sortKey, setSortKey] = useState("newest");

  const categoriesPresent = useMemo(
    () => ["All", ...new Set(expenses.map((e) => e.category))],
    [expenses]
  );

  const visibleExpenses = useMemo(() => {
    const filtered =
      categoryFilter === "All" ? expenses : expenses.filter((e) => e.category === categoryFilter);
    return [...filtered].sort(EXPENSE_SORTS[sortKey].fn);
  }, [expenses, categoryFilter, sortKey]);

  if (expenses.length === 0) {
    return (
      <div className="empty-state">
        <p>No expenses logged yet. Add the first one to start the ledger.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="list-controls">
        <div className="filter-pills">
          {categoriesPresent.map((c) => (
            <button
              key={c}
              className={`filter-pill ${categoryFilter === c ? "active" : ""}`}
              onClick={() => setCategoryFilter(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <label className="sort-select">
          <ArrowDownUp size={13} />
          <select value={sortKey} onChange={(e) => setSortKey(e.target.value)}>
            {Object.entries(EXPENSE_SORTS).map(([key, { label }]) => (
              <option value={key} key={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {visibleExpenses.length === 0 ? (
        <p className="muted" style={{ padding: "1rem 0" }}>
          No expenses in this category yet.
        </p>
      ) : (
        visibleExpenses.map((e) => (
          <div className="expense-row" key={e.id}>
            <div className="expense-main">
              <div className="description">{e.description}</div>
              <div className="meta">
                Paid by {e.paid_by_name} · {e.split_type === "equal" ? "split equally" : "custom split"} ·{" "}
                {new Date(e.created_at).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                })}
              </div>
              <span className="category-tag">{e.category}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <span className="expense-amount amount">{formatMoney(e.amount)}</span>
              <button className="btn-danger-text" onClick={() => onDelete(e.id)} title="Remove expense">
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function BalancesView({ balances, settlements, currentUserId, onMarkSettled }) {
  return (
    <div>
      <div className="section-title">Net balance per person</div>
      <div style={{ marginBottom: "2rem" }}>
        {balances.map((b) => {
          const kind = b.balance > 0.005 ? "positive" : b.balance < -0.005 ? "negative" : "neutral";
          const label =
            kind === "positive"
              ? `is owed ${formatMoney(b.balance)}`
              : kind === "negative"
              ? `owes ${formatMoney(Math.abs(b.balance))}`
              : "is settled up";
          return (
            <div className="balance-row" key={b.userId}>
              <span>
                {b.name}
                {String(b.userId) === String(currentUserId) ? " (you)" : ""}
              </span>
              <span className={`balance-amount amount ${kind}`}>{label}</span>
            </div>
          );
        })}
      </div>

      <div className="section-title">Suggested settlements</div>
      {settlements.length === 0 ? (
        <p className="muted">Everyone's settled up — nothing to pay.</p>
      ) : (
        <div>
          {settlements.map((s, i) => (
            <div className="settlement-row" key={i}>
              <span>{s.fromName}</span>
              <ArrowRight size={14} className="arrow" />
              <span>{s.toName}</span>
              <span className="amount" style={{ marginLeft: "auto", fontWeight: 600 }}>
                {formatMoney(s.amount)}
              </span>
              <button
                className="btn btn-ghost btn-small"
                onClick={() => onMarkSettled(s)}
                style={{ marginLeft: "0.75rem" }}
              >
                <CheckCircle2 size={14} /> Mark as paid
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AddExpenseModal({ groupId, members, token, onClose, onAdded }) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState(members[0]?.id || "");
  const [splitType, setSplitType] = useState("equal");
  const [category, setCategory] = useState("Other");
  const [customShares, setCustomShares] = useState(
    Object.fromEntries(members.map((m) => [m.id, ""]))
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const { showToast } = useToast();

  function handleCustomChange(memberId, value) {
    setCustomShares((prev) => ({ ...prev, [memberId]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const numericAmount = Number(amount);
    if (!description.trim() || !numericAmount || numericAmount <= 0 || !paidBy) {
      setError("Fill in a description, a positive amount, and who paid.");
      return;
    }

    let body = { description, amount: numericAmount, paidBy, splitType, category };

    if (splitType === "custom") {
      const shares = members.map((m) => ({
        userId: m.id,
        amount: Number(customShares[m.id] || 0),
      }));
      const total = shares.reduce((sum, s) => sum + s.amount, 0);
      if (Math.abs(total - numericAmount) > 0.01) {
        setError(
          `Custom shares add up to ${total.toFixed(2)}, but the total is ${numericAmount.toFixed(2)}. They must match.`
        );
        return;
      }
      body.shares = shares;
    }

    setSubmitting(true);
    try {
      await api.addExpense(groupId, body, token);
      showToast(`Added "${description}"`);
      onAdded();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Add expense</h2>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="description">Description</label>
            <input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Groceries, Electricity bill"
              autoFocus
              required
            />
          </div>

          <div className="field">
            <label htmlFor="amount">Amount (₹)</label>
            <input
              id="amount"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="category">Category</label>
            <select id="category" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option value={c} key={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="paidBy">Paid by</label>
            <select id="paidBy" value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
              {members.map((m) => (
                <option value={m.id} key={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Split</label>
            <div className="radio-row">
              <label>
                <input
                  type="radio"
                  name="splitType"
                  value="equal"
                  checked={splitType === "equal"}
                  onChange={() => setSplitType("equal")}
                />
                Equally
              </label>
              <label>
                <input
                  type="radio"
                  name="splitType"
                  value="custom"
                  checked={splitType === "custom"}
                  onChange={() => setSplitType("custom")}
                />
                Custom amounts
              </label>
            </div>
          </div>

          {splitType === "custom" && (
            <div className="field">
              <label>Each person's share (₹)</label>
              {members.map((m) => (
                <div className="custom-split-row" key={m.id}>
                  <span>{m.name}</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={customShares[m.id]}
                    onChange={(e) => handleCustomChange(m.id, e.target.value)}
                  />
                </div>
              ))}
              <p className="helper-text">Shares must add up to the total amount.</p>
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-gold" disabled={submitting}>
              {submitting ? "Adding…" : "Add expense"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
