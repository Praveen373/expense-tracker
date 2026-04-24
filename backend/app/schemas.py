from pydantic import BaseModel
from datetime import date, datetime
from decimal import Decimal


class ExpenseCreate(BaseModel):
    amount: Decimal
    category: str
    description: str
    date: date


class ExpenseResponse(BaseModel):
    id: str
    amount: Decimal
    category: str
    description: str
    date: date
    created_at: datetime

    class Config:
        from_attributes = True