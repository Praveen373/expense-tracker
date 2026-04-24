from pydantic import BaseModel, validator
from datetime import date, datetime
from decimal import Decimal


class ExpenseCreate(BaseModel):
    amount: Decimal
    category: str
    description: str
    date: date

    @validator("amount")
    def amount_must_be_positive(cls, v):
        if v <= 0:
            raise ValueError("Amount must be greater than 0")
        return v

    @validator("category", "description")
    def must_not_be_empty(cls, v):
        if not v.strip():
            raise ValueError("Field cannot be empty")
        return v


class ExpenseResponse(BaseModel):
    id: str
    amount: Decimal
    category: str
    description: str
    date: date
    created_at: datetime

    class Config:
        from_attributes = True