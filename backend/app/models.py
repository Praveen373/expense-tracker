import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Date, DateTime, Numeric, Index
from .db import Base


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(
        String,
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    idempotency_key = Column(String, unique=True, nullable=True, index=True)

    # Numeric(12, 2): up to 10 digits before decimal, always 2 after.
    # Never use Float for money — binary floating point cannot represent
    # decimal fractions exactly (e.g. 0.1 + 0.2 ≠ 0.3).
    amount = Column(Numeric(12, 2), nullable=False)

    category    = Column(String(100), nullable=False)
    description = Column(String(500), nullable=False)
    date        = Column(Date, nullable=False)
    created_at  = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        Index("idx_category", "category"),
        Index("idx_date",     "date"),
    )