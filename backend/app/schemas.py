from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP, InvalidOperation
from typing import Optional
import uuid

from pydantic import BaseModel, field_validator, model_validator


class ExpenseCreate(BaseModel):
    idempotency_key: Optional[str] = None  # client-generated UUID per request
    amount: Decimal
    category: str
    description: str
    date: date

    @field_validator("amount", mode="before")
    @classmethod
    def parse_amount(cls, v):
        try:
            d = Decimal(str(v))
        except InvalidOperation:
            raise ValueError("Invalid amount")
        return d

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("Amount must be greater than 0")
        # Enforce 2 decimal places — prevents sub-paisa values
        return v.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    @field_validator("category", "description", mode="before")
    @classmethod
    def not_blank(cls, v):
        if not str(v).strip():
            raise ValueError("Field cannot be empty or whitespace")
        return str(v).strip()

    @model_validator(mode="after")
    def set_idempotency_key(self) -> "ExpenseCreate":
        # If the client didn't send one, generate server-side so the
        # UniqueConstraint still protects concurrent duplicate POSTs.
        if not self.idempotency_key:
            self.idempotency_key = str(uuid.uuid4())
        return self


class ExpenseResponse(BaseModel):
    id: str
    amount: Decimal
    category: str
    description: str
    date: date
    created_at: datetime

    model_config = {"from_attributes": True}