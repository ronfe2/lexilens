import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import analyze, pronunciation, lexical_map, interests
from app.config import settings

logging.basicConfig(
    level=settings.log_level,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

logger = logging.getLogger(__name__)

app = FastAPI(
    title="LexiLens API",
    description="AI Language Coach Backend - Contextual vocabulary analysis with 4-layer approach",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

app.include_router(analyze.router, prefix="/api", tags=["analyze"])
app.include_router(pronunciation.router, prefix="/api", tags=["pronunciation"])
app.include_router(lexical_map.router, prefix="/api", tags=["lexical-map"])
app.include_router(interests.router, prefix="/api", tags=["interests"])


@app.get("/")
async def root():
    return {
        "name": "LexiLens API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
