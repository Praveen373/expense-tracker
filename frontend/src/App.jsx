import { useEffect, useState } from "react";
import "./styles.css";

const API_URL = "http://127.0.0.1:8000";

function App() {
  const [expenses, setExpenses] = useState([]);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    amount: "",
    category: "",
    description: "",
    date: "",
  });

  const [categoryFilter, setCategoryFilter] = useState("");
  const [sort, setSort] = useState("");

  const fetchExpenses = async () => {
    let url = `${API_URL}/expenses?`;
    if (categoryFilter) url += `category=${categoryFilter}&`;
    if (sort) url += `sort=${sort}`;

    const res = await fetch(url);
    const data = await res.json();
    setExpenses(data);
  };

  useEffect(() => {
    fetchExpenses();
  }, [categoryFilter, sort]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const res = await fetch(`${API_URL}/expenses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...form,
        amount: Number(form.amount),
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.detail || "Something went wrong");
      return;
    }

    setForm({ amount: "", category: "", description: "", date: "" });
    fetchExpenses();
  };

  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <div className="container">
      <h1>Expense Tracker</h1>

      {error && <div className="error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <input name="amount" placeholder="Amount" value={form.amount} onChange={handleChange} required />
        <input name="category" placeholder="Category" value={form.category} onChange={handleChange} required />
        <input name="description" placeholder="Description" value={form.description} onChange={handleChange} required />
        <input name="date" type="date" value={form.date} onChange={handleChange} required />

        <button type="submit" disabled={!form.amount || !form.category || !form.date}>
          Add Expense
        </button>
      </form>

      <div style={{ marginBottom: "10px" }}>
        <input
          placeholder="Filter by category"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        />

        <button onClick={() => setSort("date_desc")}>
          Sort by Date
        </button>
      </div>

      <h3>Total: ₹{total}</h3>

      <table className="table">
        <thead>
          <tr>
            <th>Amount</th>
            <th>Category</th>
            <th>Description</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((e) => (
            <tr key={e.id}>
              <td>₹{e.amount}</td>
              <td>{e.category}</td>
              <td>{e.description}</td>
              <td>{e.date}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;