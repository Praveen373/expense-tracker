from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import engine, Base
from .routes import router

app = FastAPI(
    title="Expense Tracker API",
    description="Personal finance expense tracking API",
    version="1.0.0",
)

# allow_credentials=True + allow_origins=["*"] is rejected by browsers.
# For a local dev assignment, list the Vite dev server explicitly.
# In production this would come from an env var.
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=[
#         "http://localhost:5173",   # Vite dev server
#         "http://localhost:3000",   # fallback CRA / other
#         "http://127.0.0.1:5173",
#     ],
#     allow_credentials=True,
#     allow_methods=["GET", "POST", "OPTIONS"],
#     allow_headers=["Content-Type", "Authorization"],
# )

import os

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        os.getenv("FRONTEND_URL", "http://localhost:5173"),
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

Base.metadata.create_all(bind=engine)

app.include_router(router)


@app.get("/health")
def health_check():
    return {"status": "ok"}