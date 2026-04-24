# Expense Tracker

## Screenshot

![Expense Tracker UI](docs/screenshot.png)

Full-stack personal expense tracker with a FastAPI backend and React frontend.

---

## Running locally

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev          # → http://localhost:5173
```

---

## Key design decisions

### Persistence — SQLite via SQLAlchemy ORM

SQLite covers everything the assignment needs: it's file-based (zero infra),
ACID-compliant, and survives process restarts. Switching to Postgres later
requires changing only `DATABASE_URL` — the ORM abstracts the rest.

### Money type — `Numeric(12, 2)` / `Decimal`

Floating-point types (Python `float`, SQLite `REAL`) cannot exactly represent
decimal fractions — `0.1 + 0.2` evaluates to `0.30000000000000004`. This
matters for money totals over many rows. All amount values are stored and
returned as fixed-point `Decimal` with exactly 2 decimal places.

The frontend sends amounts as strings in the JSON body (`"amount": "1234.50"`)
so the value survives JS number parsing without precision loss.

### Idempotency — client-generated UUID key

The assignment explicitly calls out double-clicks, page refreshes, and retries
due to network failures.

**Approach:**  
The frontend generates a `crypto.randomUUID()` once per user-initiated submit.
This UUID is stored in a `ref` (not state) and sent as `idempotency_key` in
every POST — including any automatic retries. A fresh key is only generated
when the user clicks Submit on a clean form.

The backend stores the key in a `UNIQUE` indexed column. On any duplicate
arrival, it fetches and returns the already-created expense with `200 OK`
instead of erroring. Concurrent races are handled by catching `IntegrityError`
and re-fetching.

This means: a user can click Submit 10 times on a slow connection — exactly
one expense is created.

### Server-side filter and sort

`GET /expenses?category=Food&sort=date_desc` — filtering and sorting are
delegated to SQLite, consistent with the API spec. The category filter uses
`ilike` (case-insensitive). The frontend debounces the filter input (350 ms)
to avoid a query per keystroke.

Default sort (no `sort` param) is `created_at DESC` so a fresh page load shows
the most recently added expense first, which feels natural.

---

## Trade-offs made due to timebox

| What | Decision |
|---|---|
| Auth / multi-user | Skipped — single user assumed per the brief |
| Pagination | Skipped — acceptable for personal finance volumes |
| Automated tests | Skipped — see "Intentionally not done" below |
| Category as enum | Used free-text string; frontend enforces a dropdown |
| Migrations (Alembic) | Skipped — `create_all` is fine for a fresh DB assignment |

---

## Intentionally not done

- **Auth** — No session or JWT layer. The brief describes a personal tool,
  and adding auth would dwarf the actual feature work.

- **Automated tests** — Prioritised correctness of the idempotency and money
  handling logic in the main code over test coverage given the timebox. The
  next thing I'd add is `pytest` integration tests hitting the FastAPI
  `TestClient` for the idempotency path and the filter/sort params.

- **Pagination** — Personal expense lists are small. A `LIMIT/OFFSET` query
  param would be straightforward to add later.

- **Alembic migrations** — `Base.metadata.create_all` is acceptable for an
  assignment with a fresh database. Production would use Alembic.

- **HTTPS / production CORS** — `allow_origins` lists localhost origins for
  dev. A production deploy would read allowed origins from an env var.