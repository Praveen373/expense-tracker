from fastapi import FastAPI
from .db import engine, Base
from .routes import router
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # fine for assignment
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

app.include_router(router)


@app.get("/health")
def health_check():
    return {"status": "ok"}