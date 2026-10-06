import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Users2, FolderHeart, ChevronRight } from "lucide-react";
import { api } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { SkeletonGroupList } from "../components/Skeleton.jsx";

export default function Dashboard() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [creating, setCreating] = useState(false);

  async function loadGroups() {
    setLoading(true);
    try {
      const data = await api.listGroups(token);
      setGroups(data.groups);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreateGroup(e) {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    setCreating(true);
    try {
      await api.createGroup({ name: newGroupName }, token);
      setNewGroupName("");
      setShowModal(false);
      showToast(`"${newGroupName}" created`);
      loadGroups();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <main>
      <div className="page-header">
        <h1>Your groups</h1>
        <button className="btn btn-gold" onClick={() => setShowModal(true)}>
          <Plus size={16} /> New group
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <SkeletonGroupList />
      ) : groups.length === 0 ? (
        <div className="empty-state">
          <FolderHeart size={28} style={{ color: "var(--gold)", marginBottom: "0.6rem" }} />
          <p>No groups yet. Start one for your flat, trip, or friend circle.</p>
          <button className="btn btn-gold" onClick={() => setShowModal(true)}>
            <Plus size={16} /> Create your first group
          </button>
        </div>
      ) : (
        <div className="group-list">
          {groups.map((g) => (
            <Link to={`/groups/${g.id}`} className="group-row" key={g.id}>
              <span className="group-name">{g.name}</span>
              <span className="group-meta">
                <Users2 size={14} style={{ verticalAlign: "-2px", marginRight: "0.3rem" }} />
                {g.member_count} member{g.member_count === "1" ? "" : "s"}
                <ChevronRight size={16} style={{ verticalAlign: "-3px", marginLeft: "0.5rem", color: "var(--text-muted)" }} />
              </span>
            </Link>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>New group</h2>
            <form onSubmit={handleCreateGroup}>
              <div className="field">
                <label htmlFor="groupName">Group name</label>
                <input
                  id="groupName"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="e.g. Flat 3B, Goa trip"
                  autoFocus
                  required
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-gold" disabled={creating}>
                  {creating ? "Creating…" : "Create group"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
