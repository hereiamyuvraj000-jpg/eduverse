"""
Thin wrapper around the OpenRouter chat completions API.

OpenRouter is OpenAI-API-compatible, so we just POST to
https://openrouter.ai/api/v1/chat/completions with a Bearer token.
"""

import os
import json
import re
import httpx

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"


class AIError(Exception):
    pass


def _get_config():
    api_key = os.getenv("OPENROUTER_API_KEY", "").strip()
    model = os.getenv("OPENROUTER_MODEL", "openai/gpt-4o-mini").strip()
    site_url = os.getenv("OPENROUTER_SITE_URL", "http://localhost:5173").strip()
    site_name = os.getenv("OPENROUTER_SITE_NAME", "EduVerse AI Lite").strip()
    return api_key, model, site_url, site_name


async def call_openrouter(system_prompt: str, user_prompt: str, temperature: float = 0.7) -> str:
    """Send a chat completion request to OpenRouter and return the raw text content."""
    api_key, model, site_url, site_name = _get_config()

    if not api_key or api_key == "your_openrouter_api_key_here":
        raise AIError(
            "OPENROUTER_API_KEY is not set. Add your key to backend/.env "
            "(copy .env.example to .env first) and restart the server."
        )

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": site_url,
        "X-Title": site_name,
    }

    payload = {
        "model": model,
        "temperature": temperature,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            response = await client.post(OPENROUTER_URL, headers=headers, json=payload)
        except httpx.RequestError as exc:
            raise AIError(f"Could not reach OpenRouter: {exc}") from exc

    if response.status_code != 200:
        detail = response.text
        raise AIError(f"OpenRouter API error ({response.status_code}): {detail}")

    data = response.json()
    try:
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError) as exc:
        raise AIError(f"Unexpected OpenRouter response shape: {data}") from exc


def extract_json(text: str) -> dict:
    """
    Best-effort extraction of a JSON object from an LLM response, in case
    the model wraps it in markdown fences or adds extra commentary.
    """
    cleaned = text.strip()
    cleaned = re.sub(r"^```(json)?", "", cleaned.strip(), flags=re.IGNORECASE).strip()
    cleaned = re.sub(r"```$", "", cleaned.strip()).strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Fallback: find the first { ... } block
    match = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError as exc:
            raise AIError(f"AI response was not valid JSON: {exc}") from exc

    raise AIError("AI response did not contain a JSON object.")
