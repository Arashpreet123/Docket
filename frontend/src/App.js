import { useState, useEffect, useCallback } from "react";

const API = process.env.REACT_APP_API_URL || "http://localhost:8000/api";

const PRIORITY_META = {
  high: { label: "HIGH", color: "#c2410c", bg: "#fff7ed", dot: "●" },
  medium: { label: "MED", color: "#b45309", bg: "#fffbeb", dot: "●" },
  low: { label: "LOW", color: "#15803d", bg: "#f0fdf4", dot: "●" },
};

// ─── API helpers ──────────────────────────────────────────────────────────────

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  if (res.status === 204) return null;
  return res.json();
}

// ─── Components ───────────────────────────────────────────────────────────────

function StatsBar({ stats }) {
  if (!stats) return null;
  const pct = stats.total
    ? Math.round((stats.completed / stats.total) * 100)
    : 0;
  return (
    <div style={styles.statsBar}>
      <div style={styles.statItem}>
        <span style={styles.statNum}>{stats.total}</span>
        <span style={styles.statLabel}>TOTAL</span>
      </div>
      <div style={styles.statDivider} />
      <div style={styles.statItem}>
        <span style={styles.statNum}>{stats.pending}</span>
        <span style={styles.statLabel}>OPEN</span>
      </div>
      <div style={styles.statDivider} />
      <div style={styles.statItem}>
        <span style={styles.statNum}>{stats.completed}</span>
        <span style={styles.statLabel}>CLOSED</span>
      </div>
      <div style={styles.statDivider} />
      <div style={styles.statProgress}>
        <div style={styles.progressTrack}>
          <div style={{ ...styles.progressFill, width: `${pct}%` }} />
        </div>
        <span style={styles.statLabel}>{pct}% DONE</span>
      </div>
    </div>
  );
}

function TaskForm({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const task = await apiFetch("/tasks/", {
        method: "POST",
        body: JSON.stringify({ title, description, priority }),
      });
      onAdd(task);
      setTitle("");
      setDescription("");
      setPriority("medium");
      setOpen(false);
    } catch (e) {
      alert("Failed to create task.");
    } finally {
      setSaving(false);
    }
  };

  if (!open)
    return (
      <button style={styles.addButton} onClick={() => setOpen(true)}>
        + NEW ENTRY
      </button>
    );

  return (
    <div style={styles.formCard}>
      <div style={styles.formHeader}>
        <span style={styles.formTitle}>NEW DOCKET ENTRY</span>
        <button style={styles.cancelBtn} onClick={() => setOpen(false)}>
          ✕
        </button>
      </div>
      <input
        style={styles.input}
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        autoFocus
      />
      <textarea
        style={{ ...styles.input, ...styles.textarea }}
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
      />
      <div style={styles.formRow}>
        <div style={styles.priorityGroup}>
          {["high", "medium", "low"].map((p) => (
            <button
              key={p}
              style={{
                ...styles.priorityBtn,
                ...(priority === p
                  ? {
                      background: PRIORITY_META[p].bg,
                      color: PRIORITY_META[p].color,
                      borderColor: PRIORITY_META[p].color,
                      fontWeight: 600,
                    }
                  : {}),
              }}
              onClick={() => setPriority(p)}
            >
              {PRIORITY_META[p].label}
            </button>
          ))}
        </div>
        <button
          style={styles.submitBtn}
          onClick={handleSubmit}
          disabled={saving || !title.trim()}
        >
          {saving ? "FILING…" : "FILE ENTRY"}
        </button>
      </div>
    </div>
  );
}

function TaskRow({ task, onToggle, onDelete }) {
  const [deleting, setDeleting] = useState(false);
  const meta = PRIORITY_META[task.priority];
  const date = new Date(task.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const handleDelete = async () => {
    if (!window.confirm("Remove this entry?")) return;
    setDeleting(true);
    try {
      await apiFetch(`/tasks/${task.id}/`, { method: "DELETE" });
      onDelete(task.id);
    } catch {
      setDeleting(false);
    }
  };

  return (
    <div
      style={{
        ...styles.taskRow,
        ...(task.completed ? styles.taskRowDone : {}),
      }}
    >
      <button style={styles.checkbox} onClick={() => onToggle(task)}>
        {task.completed ? (
          <span style={styles.checkmark}>✓</span>
        ) : (
          <span style={styles.checkboxEmpty} />
        )}
      </button>

      <div style={styles.taskBody}>
        <div style={styles.taskTop}>
          <span
            style={{
              ...styles.taskTitle,
              ...(task.completed ? styles.taskTitleDone : {}),
            }}
          >
            {task.title}
          </span>
          <span
            style={{
              ...styles.priorityTag,
              color: meta.color,
              background: meta.bg,
            }}
          >
            {meta.dot} {meta.label}
          </span>
        </div>
        {task.description && <p style={styles.taskDesc}>{task.description}</p>}
        <span style={styles.taskDate}>{date}</span>
      </div>

      <button
        style={styles.deleteBtn}
        onClick={handleDelete}
        disabled={deleting}
        title="Remove"
      >
        {deleting ? "…" : "×"}
      </button>
    </div>
  );
}

function FilterBar({ filter, setFilter }) {
  const tabs = [
    { key: "all", label: "ALL" },
    { key: "open", label: "OPEN" },
    { key: "done", label: "CLOSED" },
  ];
  return (
    <div style={styles.filterBar}>
      {tabs.map((t) => (
        <button
          key={t.key}
          style={{
            ...styles.filterTab,
            ...(filter === t.key ? styles.filterTabActive : {}),
          }}
          onClick={() => setFilter(t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState(null);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadTasks = useCallback(async () => {
    try {
      const params =
        filter === "open"
          ? "?completed=false"
          : filter === "done"
            ? "?completed=true"
            : "";
      const [taskData, statsData] = await Promise.all([
        apiFetch(`/tasks/${params}`),
        apiFetch("/tasks/stats/"),
      ]);
      setTasks(taskData.results ?? taskData);
      setStats(statsData);
      setError(null);
    } catch (e) {
      console.log(e);
      setError("Cannot connect to backend. Is Docker running?");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleAdd = (task) => {
    setTasks((prev) => [task, ...prev]);
    loadTasks(); // refresh stats
  };

  const handleToggle = async (task) => {
    const updated = await apiFetch(`/tasks/${task.id}/`, {
      method: "PATCH",
      body: JSON.stringify({ completed: !task.completed }),
    });
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    loadTasks(); // refresh stats
  };

  const handleDelete = (id) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    loadTasks();
  };

  return (
    <div style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div>
            <h1 style={styles.logo}>DOCKET</h1>
            <p style={styles.tagline}>Your official case record</p>
          </div>
          <StatsBar stats={stats} />
        </div>
        <div style={styles.headerRule} />
      </header>

      {/* Main */}
      <main style={styles.main}>
        <div style={styles.toolbar}>
          <FilterBar filter={filter} setFilter={setFilter} />
          <TaskForm onAdd={handleAdd} />
        </div>

        {error && <div style={styles.error}>{error}</div>}

        {loading ? (
          <div style={styles.loading}>Loading entries…</div>
        ) : tasks.length === 0 ? (
          <div style={styles.empty}>
            <p style={styles.emptyIcon}>⊘</p>
            <p style={styles.emptyText}>No entries on the docket.</p>
          </div>
        ) : (
          <div style={styles.taskList}>
            {/* Column headers */}
            <div style={styles.columnHeader}>
              <span style={{ width: 32 }} />
              <span style={{ flex: 1 }}>MATTER</span>
              <span style={{ width: 80, textAlign: "right" }}>PRIORITY</span>
              <span style={{ width: 32 }} />
            </div>
            {tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onToggle={handleToggle}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </main>

      <footer style={styles.footer}>
        DOCKET · Django + PostgreSQL + React · Docker
      </footer>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    background: "#1c1917",
    color: "#faf8f5",
    padding: "0 40px",
  },
  headerInner: {
    maxWidth: 900,
    margin: "0 auto",
    padding: "32px 0 24px",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 24,
    flexWrap: "wrap",
  },
  logo: {
    fontFamily: "'Playfair Display', serif",
    fontSize: "3.5rem",
    fontWeight: 900,
    letterSpacing: "0.08em",
    color: "#faf8f5",
    lineHeight: 1,
  },
  tagline: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: "0.7rem",
    color: "#a8a29e",
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    marginTop: 6,
  },
  headerRule: {
    height: 3,
    background:
      "linear-gradient(90deg, #c2410c 0%, #ea580c 40%, transparent 100%)",
  },
  statsBar: {
    display: "flex",
    alignItems: "center",
    gap: 20,
  },
  statItem: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
  },
  statNum: {
    fontFamily: "'Playfair Display', serif",
    fontSize: "1.8rem",
    fontWeight: 700,
    color: "#faf8f5",
    lineHeight: 1,
  },
  statLabel: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: "0.6rem",
    color: "#a8a29e",
    letterSpacing: "0.12em",
  },
  statDivider: {
    width: 1,
    height: 40,
    background: "#44403c",
  },
  statProgress: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
  },
  progressTrack: {
    width: 80,
    height: 4,
    background: "#44403c",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    background: "#c2410c",
    borderRadius: 2,
    transition: "width 0.4s ease",
  },
  main: {
    flex: 1,
    maxWidth: 900,
    margin: "0 auto",
    width: "100%",
    padding: "32px 40px",
  },
  toolbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
    flexWrap: "wrap",
    gap: 12,
  },
  filterBar: {
    display: "flex",
    gap: 2,
    background: "#e8e2d9",
    borderRadius: 4,
    padding: 3,
  },
  filterTab: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: "0.7rem",
    letterSpacing: "0.1em",
    padding: "6px 16px",
    border: "none",
    background: "transparent",
    color: "#78716c",
    borderRadius: 3,
    transition: "all 0.15s",
  },
  filterTabActive: {
    background: "#1c1917",
    color: "#faf8f5",
  },
  addButton: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: "0.75rem",
    letterSpacing: "0.1em",
    padding: "10px 20px",
    background: "#c2410c",
    color: "#fff",
    border: "none",
    borderRadius: 4,
    transition: "background 0.15s",
  },
  formCard: {
    background: "#fff",
    border: "1.5px solid #1c1917",
    borderRadius: 6,
    padding: 24,
    marginBottom: 24,
    boxShadow: "4px 4px 0 #1c1917",
  },
  formHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  formTitle: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: "0.7rem",
    letterSpacing: "0.15em",
    color: "#78716c",
  },
  cancelBtn: {
    background: "none",
    border: "none",
    color: "#78716c",
    fontSize: "1rem",
    lineHeight: 1,
    padding: "2px 6px",
  },
  input: {
    width: "100%",
    padding: "10px 14px",
    border: "1px solid #d6cfc4",
    borderRadius: 4,
    fontSize: "0.95rem",
    marginBottom: 12,
    background: "#faf8f5",
    color: "#1c1917",
    outline: "none",
    resize: "vertical",
  },
  textarea: {
    fontFamily: "'IBM Plex Sans', sans-serif",
  },
  formRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  priorityGroup: {
    display: "flex",
    gap: 6,
  },
  priorityBtn: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: "0.65rem",
    letterSpacing: "0.1em",
    padding: "6px 12px",
    border: "1px solid #d6cfc4",
    background: "#faf8f5",
    color: "#78716c",
    borderRadius: 3,
    transition: "all 0.15s",
  },
  submitBtn: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: "0.75rem",
    letterSpacing: "0.1em",
    padding: "10px 24px",
    background: "#1c1917",
    color: "#faf8f5",
    border: "none",
    borderRadius: 4,
  },
  columnHeader: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "0 12px 8px",
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: "0.6rem",
    letterSpacing: "0.12em",
    color: "#a8a29e",
    borderBottom: "2px solid #1c1917",
    marginBottom: 4,
  },
  taskList: {
    display: "flex",
    flexDirection: "column",
    gap: 0,
  },
  taskRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    padding: "16px 12px",
    borderBottom: "1px solid #e8e2d9",
    transition: "background 0.12s",
    background: "transparent",
  },
  taskRowDone: {
    background: "#f7f5f2",
  },
  checkbox: {
    width: 20,
    height: 20,
    minWidth: 20,
    border: "1.5px solid #78716c",
    borderRadius: 3,
    background: "transparent",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    padding: 0,
    transition: "all 0.15s",
  },
  checkmark: {
    color: "#15803d",
    fontSize: "0.85rem",
    fontWeight: 700,
    lineHeight: 1,
  },
  checkboxEmpty: {
    display: "block",
    width: 10,
    height: 10,
  },
  taskBody: {
    flex: 1,
    minWidth: 0,
  },
  taskTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  taskTitle: {
    fontFamily: "'IBM Plex Sans', sans-serif",
    fontWeight: 500,
    fontSize: "0.95rem",
    color: "#1c1917",
    lineHeight: 1.3,
  },
  taskTitleDone: {
    textDecoration: "line-through",
    color: "#a8a29e",
  },
  priorityTag: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: "0.6rem",
    letterSpacing: "0.08em",
    padding: "3px 8px",
    borderRadius: 3,
    whiteSpace: "nowrap",
    flexShrink: 0,
    width: 80,
    textAlign: "center",
  },
  taskDesc: {
    fontFamily: "'IBM Plex Sans', sans-serif",
    fontSize: "0.82rem",
    color: "#78716c",
    marginTop: 4,
    lineHeight: 1.5,
  },
  taskDate: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: "0.6rem",
    color: "#a8a29e",
    marginTop: 6,
    display: "block",
    letterSpacing: "0.05em",
  },
  deleteBtn: {
    background: "none",
    border: "none",
    color: "#c4b5a5",
    fontSize: "1.2rem",
    lineHeight: 1,
    padding: "2px 6px",
    borderRadius: 3,
    transition: "color 0.15s",
    marginTop: -2,
    flexShrink: 0,
  },
  loading: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: "0.8rem",
    color: "#78716c",
    textAlign: "center",
    padding: "60px 0",
    letterSpacing: "0.1em",
  },
  error: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: "0.78rem",
    color: "#c2410c",
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    borderRadius: 4,
    padding: "12px 16px",
    marginBottom: 20,
  },
  empty: {
    textAlign: "center",
    padding: "80px 0",
  },
  emptyIcon: {
    fontSize: "3rem",
    color: "#d6cfc4",
    marginBottom: 12,
  },
  emptyText: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: "0.8rem",
    color: "#a8a29e",
    letterSpacing: "0.1em",
  },
  footer: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: "0.6rem",
    letterSpacing: "0.15em",
    color: "#a8a29e",
    textAlign: "center",
    padding: "20px",
    borderTop: "1px solid #e8e2d9",
  },
};
