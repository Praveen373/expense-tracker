import uuid
from datetime import datetime

from sqlalchemy import Column, String, Date, DateTime, Numeric, UniqueConstraint, Index
from .db import Base


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    amount = Column(Numeric, nullable=False)
    category = Column(String, nullable=False)
    description = Column(String, nullable=False)
    date = Column(Date, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint(
            "amount", "category", "description", "date",
            name="unique_expense_constraint"
        ),
        Index("idx_category", "category"),
    )