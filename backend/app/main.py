from fastapi import FastAPI
from .db import engine, Base
from .routes import router

app = FastAPI()

Base.metadata.create_all(bind=engine)

app.include_router(router)


@app.get("/health")
def health_check():
    return {"status": "ok"}