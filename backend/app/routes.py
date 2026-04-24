from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import Optional

from .db import SessionLocal
from . import models, schemas

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/expenses", response_model=schemas.ExpenseResponse)
def create_expense(expense: schemas.ExpenseCreate, db: Session = Depends(get_db)):
    db_expense = models.Expense(**expense.model_dump())

    try:
        db.add(db_expense)
        db.commit()
        db.refresh(db_expense)
        return db_expense

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=409,
            detail="Expense already exists"
        )


@router.get("/expenses", response_model=list[schemas.ExpenseResponse])
def get_expenses(
    category: Optional[str] = None,
    sort: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.Expense)

    if category:
        query = query.filter(models.Expense.category == category)

    if sort == "date_desc":
        query = query.order_by(models.Expense.date.desc())

    return query.all()