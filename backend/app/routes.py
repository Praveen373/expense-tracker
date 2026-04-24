from fastapi import APIRouter, Depends, HTTPException, status
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


@router.post(
    "/expenses",
    response_model=schemas.ExpenseResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_expense(
    expense: schemas.ExpenseCreate,
    db: Session = Depends(get_db),
):
    """
    Idempotent expense creation.

    The client sends a UUID `idempotency_key` with every POST.
    If the same key arrives again (retry / double-click / network replay),
    we return the already-created expense with 200 OK instead of creating
    a duplicate or returning an error.

    This means:
      - First request  → 201 Created  + new expense
      - Any retry      → 200 OK       + same expense (safe for the client to use)
    """
    # Check idempotency first — before we even try to insert
    if expense.idempotency_key:
        existing = (
            db.query(models.Expense)
            .filter(models.Expense.idempotency_key == expense.idempotency_key)
            .first()
        )
        if existing:
            # Return the original resource; HTTP 200 signals "already done"
            from fastapi.responses import JSONResponse
            from fastapi.encoders import jsonable_encoder
            schema = schemas.ExpenseResponse.model_validate(existing)
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=jsonable_encoder(schema),
            )

    data = expense.model_dump()
    db_expense = models.Expense(**data)

    try:
        db.add(db_expense)
        db.commit()
        db.refresh(db_expense)
        return db_expense

    except IntegrityError:
        db.rollback()
        # Race condition: two concurrent requests with same idempotency_key.
        # Re-fetch and return the winner.
        existing = (
            db.query(models.Expense)
            .filter(models.Expense.idempotency_key == expense.idempotency_key)
            .first()
        )
        if existing:
            from fastapi.responses import JSONResponse
            from fastapi.encoders import jsonable_encoder
            schema = schemas.ExpenseResponse.model_validate(existing)
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=jsonable_encoder(schema),
            )
        # Genuinely unexpected integrity error
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Could not create expense due to a conflict.",
        )


@router.get("/expenses", response_model=list[schemas.ExpenseResponse])
def get_expenses(
    category: Optional[str] = None,
    sort: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    List expenses with optional server-side filtering and sorting.

    Query params:
      ?category=Food          — exact match (case-insensitive)
      ?sort=date_desc         — newest date first (default when omitted: created_at desc)
    """
    query = db.query(models.Expense)

    if category:
        query = query.filter(
            models.Expense.category.ilike(f"%{category}%")  # partial, case-insensitive
        )

    if sort == "date_desc":
        query = query.order_by(
            models.Expense.date.desc(),
            models.Expense.created_at.desc(),  # tiebreak by insertion order
        )
    else:
        # Default: newest created first so a fresh page load feels natural
        query = query.order_by(models.Expense.created_at.desc())

    return query.all()