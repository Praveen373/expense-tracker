import { useEffect, useState, useCallback, useRef } from "react";
import "./style.css";

// const API_URL = "http://127.0.0.1:8000";

const API_URL = import.meta.env.VITE_API_URL;

// ─── Helpers ────────────────────────────────────────────────────────────────────

function generateUUID() {
  // crypto.randomUUID() is available in all modern browsers (and Vite's env).
  // Fallback for older environments just in case.
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const CATEGORY_COLORS = {
  Food:          { bg: "#0f1f0f", fg: "#00e87a" },
  Transport:     { bg: "#0f151f", fg: "#4d9fff" },
  Housing:       { bg: "#1f0f14", fg: "#ff4d6a" },
  Health:        { bg: "#1f1a0f", fg: "#f5a623" },
  Shopping:      { bg: "#140f1f", fg: "#a78bfa" },
  Entertainment: { bg: "#1f0f1a", fg: "#f472b6" },
  Utilities:     { bg: "#0f1a1f", fg: "#22d3ee" },
  Other:         { bg: "#1a1a1a", fg: "#8b90a8" },
};

const CATEGORIES = Object.keys(CATEGORY_COLORS);

function catStyle(cat) {
  return CATEGORY_COLORS[cat] || CATEGORY_COLORS.Other;
}

function formatAmount(n) {
  return (
    "₹" +
    Number(n).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function formatDate(d) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return new Date(Number(y), Number(m) - 1, Number(day)).toLocaleDateString(
    "en-IN",
    { day: "2-digit", month: "short", year: "numeric" }
  );
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

// ─── API layer ──────────────────────────────────────────────────────────────────

/**
 * Fetch expenses with optional server-side category filter and sort.
 * Passes params to the API so filtering/sorting is authoritative.
 */
async function apiFetchExpenses({ category = "", sort = "" } = {}) {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (sort)     params.set("sort", sort);

  const url = `${API_URL}/expenses${params.size ? "?" + params.toString() : ""}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Server error ${res.status}`);
  return res.json();
}

/**
 * Extracts a human-readable message from a FastAPI error response.
 *
 * FastAPI returns two shapes depending on the error source:
 *   - Pydantic validation failure → { detail: [ { loc, msg, type }, ... ] }
 *   - Manual HTTPException        → { detail: "some string" }
 *
 * `[object Object]` appears when code does `new Error(array)` — the array
 * gets coerced to a string via `.toString()` which produces that output.
 * We extract .msg from each validation error and join them instead.
 */
function parseApiError(detail) {
  if (!detail) return "Something went wrong";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((err) => {
        // err.msg looks like "Value error, Field cannot be empty or whitespace"
        // Strip the "Value error, " prefix Pydantic prepends for cleaner display
        const msg = err.msg || "Invalid value";
        return msg.replace(/^Value error,\s*/i, "");
      })
      .join(" · ");
  }
  return String(detail);
}

async function apiCreateExpense(payload) {
  const res = await fetch(`${API_URL}/expenses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...payload,
      amount: String(payload.amount), // send as string to preserve decimal precision
    }),
  });

  const data = await res.json();

  if (!res.ok && res.status !== 200 && res.status !== 201) {
    throw new Error(parseApiError(data.detail));
  }

  return data;
}

// ─── StatsGrid ──────────────────────────────────────────────────────────────────

function StatsGrid({ expenses }) {
  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);

  const now = new Date();
  const monthExpenses = expenses.filter((e) => {
    const [y, m] = (e.date || "").split("-");
    return Number(y) === now.getFullYear() && Number(m) === now.getMonth() + 1;
  });
  const monthTotal = monthExpenses.reduce((s, e) => s + Number(e.amount), 0);

  const byCat = {};
  expenses.forEach((e) => {
    byCat[e.category] = (byCat[e.category] || 0) + Number(e.amount);
  });
  const topCat = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="stats-grid">
      <div className="stat-card">
        <div className="stat-label">Total Spent</div>
        <div className="stat-value green">{formatAmount(total)}</div>
        <div className="stat-sub">
          {expenses.length} transaction{expenses.length !== 1 ? "s" : ""}
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-label">This Month</div>
        <div className="stat-value">{formatAmount(monthTotal)}</div>
        <div className="stat-sub">
          {now.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-label">Top Category</div>
        <div className="stat-value" style={{ fontSize: "18px", paddingTop: "4px" }}>
          {topCat ? topCat[0] : "—"}
        </div>
        <div className="stat-sub">
          {topCat ? `${formatAmount(topCat[1])} spent` : "no data"}
        </div>
      </div>
    </div>
  );
}

// ─── ExpenseForm ────────────────────────────────────────────────────────────────

function ExpenseForm({ onAdd }) {
  const [form, setForm] = useState({
    amount: "",
    category: "",
    description: "",
    date: todayISO(),
  });
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(false);

  /**
   * idempotencyKeyRef holds the key for the CURRENT pending submission.
   * It is generated once when the user clicks Submit, and reused on any
   * automatic retry. A new key is only generated for a new form submission.
   * Using a ref (not state) so it doesn't trigger re-renders.
   */
  const idempotencyKeyRef = useRef(null);

  const isValid = form.amount && form.category && form.date && !loading;

  const set = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const resetForm = () => {
    setForm({ amount: "", category: "", description: "", date: todayISO() });
    idempotencyKeyRef.current = null;
  };

  const handleSubmit = async () => {
    setError("");

    // Generate a fresh idempotency key for this new submission attempt.
    // Any network retry should reuse idempotencyKeyRef.current (not re-generate).
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = generateUUID();
    }

    setLoading(true);
    try {
      await apiCreateExpense({
        ...form,
        amount: form.amount,
        idempotency_key: idempotencyKeyRef.current,
      });
      resetForm();
      await onAdd();
    } catch (err) {
      // Keep idempotencyKeyRef.current — retrying will reuse it safely.
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">New Expense</div>
      </div>

      {error && (
        <div className="error-bar">
          <span className="error-dot" />
          {error}
        </div>
      )}

      <div className="form-group">
        <label className="form-label">Amount (₹)</label>
        <input
          type="number"
          placeholder="0.00"
          min="0.01"
          step="0.01"
          value={form.amount}
          onChange={set("amount")}
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Category</label>
          <select value={form.category} onChange={set("category")}>
            <option value="" disabled>Select…</option>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Date</label>
          <input type="date" value={form.date} onChange={set("date")} />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Description</label>
        <textarea
          placeholder="What was this for?"
          value={form.description}
          onChange={set("description")}
        />
      </div>

      <button
        className="btn-primary"
        disabled={!isValid}
        onClick={handleSubmit}
      >
        {loading ? (
          <span className="btn-loading">
            <span className="spinner" />
            Adding…
          </span>
        ) : (
          "Add Expense"
        )}
      </button>
    </div>
  );
}

// ─── ExpenseItem ────────────────────────────────────────────────────────────────

function ExpenseItem({ expense, index }) {
  const { bg, fg } = catStyle(expense.category);
  return (
    <div className="expense-item" style={{ animationDelay: `${index * 0.04}s` }}>
      <div className="expense-cat-badge" style={{ background: bg, color: fg }}>
        {(expense.category || "?")[0].toUpperCase()}
      </div>
      <div className="expense-info">
        <div className="expense-desc">{expense.description || "—"}</div>
        <div className="expense-meta">{expense.category}</div>
      </div>
      <div className="expense-right">
        <div className="expense-amount">{formatAmount(expense.amount)}</div>
        <div className="expense-date-tag">{formatDate(expense.date)}</div>
      </div>
    </div>
  );
}

// ─── ExpenseList ────────────────────────────────────────────────────────────────

function ExpenseList({ expenses, loading, onFilterChange, onSortChange, sortMode }) {
  const [filter, setFilter] = useState("");
  // Debounce the filter so we don't hammer the API on every keystroke
  const debounceTimer = useRef(null);

  const handleFilterChange = (e) => {
    const val = e.target.value;
    setFilter(val);
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      onFilterChange(val);
    }, 350);
  };

  const cycleSortMode = () => {
    const next =
      sortMode === "none" ? "date_desc" : "none";
    onSortChange(next);
  };

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="panel panel-right">
      <div className="panel-header">
        <div className="panel-title">Transactions</div>
        {loading && <div className="loading-pill">Refreshing…</div>}
      </div>

      <div className="controls-bar">
        <div className="search-wrap">
          <svg
            className="search-icon"
            width="14" height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Filter by category…"
            value={filter}
            onChange={handleFilterChange}
          />
        </div>
        <button
          className={`btn-sort ${sortMode !== "none" ? "active" : ""}`}
          onClick={cycleSortMode}
        >
          {sortMode === "date_desc" ? "Date ↓" : "Sort by date"}
        </button>
      </div>

      {expenses.length > 0 && (
        <div className="total-bar">
          <span className="total-label">Total</span>
          <span className="total-value">{formatAmount(total)}</span>
        </div>
      )}

      {expenses.length === 0 && !loading ? (
        <div className="empty-state">
          <div className="empty-icon">◈</div>
          <div className="empty-text">
            {filter ? "No matches found" : "No expenses yet"}
          </div>
        </div>
      ) : (
        <div className="expense-list scrollable">
          {expenses.map((e, i) => (
            <ExpenseItem key={e.id} expense={e} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── App ────────────────────────────────────────────────────────────────────────

export default function App() {
  const [expenses, setExpenses]   = useState([]);
  const [loading, setLoading]     = useState(false);
  const [category, setCategory]   = useState("");
  const [sortMode, setSortMode]   = useState("none");

  /**
   * Fetch is driven by category + sortMode.
   * Both filtering and sorting are delegated to the server per the API spec:
   *   GET /expenses?category=Food&sort=date_desc
   */
  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetchExpenses({
        category,
        sort: sortMode === "none" ? "" : sortMode,
      });
      setExpenses(data);
    } catch (err) {
      console.error("Failed to fetch expenses:", err);
    } finally {
      setLoading(false);
    }
  }, [category, sortMode]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  return (
    <>
      <nav className="navbar">
        <div className="nav-logo">
          <div className="nav-logo-dot" />
          Expense Tracker
        </div>
        <div className="nav-badge">v1.0 · local</div>
      </nav>

      <div className="container">
        <StatsGrid expenses={expenses} />

        <div className="grid-main">
          <ExpenseForm onAdd={fetchExpenses} />
          <ExpenseList
            expenses={expenses}
            loading={loading}
            onFilterChange={setCategory}
            onSortChange={setSortMode}
            sortMode={sortMode}
          />
        </div>
      </div>
    </>
  );
}