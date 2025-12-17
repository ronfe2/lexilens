import logging

import httpx
from fastapi import APIRouter, HTTPException

from app.models.response import PronunciationResponse

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/pronunciation/{word}")
async def get_pronunciation(word: str) -> PronunciationResponse:
    logger.info(f"Getting pronunciation for: '{word}'")

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"https://api.dictionaryapi.dev/api/v2/entries/en/{word}"
            )

            if response.status_code != 200:
                raise HTTPException(
                    status_code=404,
                    detail=f"Pronunciation not found for word: {word}"
                )

            data = response.json()

            if not data or not isinstance(data, list) or len(data) == 0:
                raise HTTPException(
                    status_code=404,
                    detail=f"No pronunciation data for word: {word}"
                )

            entry = data[0]
            phonetics = entry.get("phonetics", [])

            ipa = None
            audio_url = None

            for phonetic in phonetics:
                if not ipa and phonetic.get("text"):
                    ipa = phonetic["text"]
                if not audio_url and phonetic.get("audio"):
                    audio_url = phonetic["audio"]
                if ipa and audio_url:
                    break

            if not ipa:
                ipa = entry.get("phonetic", "N/A")

            return PronunciationResponse(
                word=word,
                ipa=ipa,
                audio_url=audio_url
            )

    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Pronunciation API timeout")
    except httpx.HTTPError as e:
        logger.error(f"HTTP error getting pronunciation: {e}")
        raise HTTPException(status_code=503, detail="Pronunciation service unavailable")
    except Exception as e:
        logger.error(f"Error getting pronunciation: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
