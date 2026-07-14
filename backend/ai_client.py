import os
import json
import re
from groq import Groq


class AIError(Exception):
    pass


def _get_config():
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    model = os.getenv(
        "GROQ_MODEL",
        "llama-3.3-70b-versatile"
    ).strip()

    return api_key, model


async def call_groq(system_prompt, user_prompt, temperature=0.7):

    api_key, model = _get_config()

    if not api_key:
        raise AIError("GROQ_API_KEY is missing")

    client = Groq(api_key=api_key)

    try:
        response = client.chat.completions.create(
            model=model,
            temperature=temperature,
            messages=[
                {
                    "role": "system",
                    "content": system_prompt
                },
                {
                    "role": "user",
                    "content": user_prompt
                }
            ]
        )

        return response.choices[0].message.content

    except Exception as e:
        raise AIError(str(e))


def extract_json(text):
    cleaned = text.strip()

    # Remove markdown code fences if AI adds them
    cleaned = re.sub(
        r"^```(?:json)?",
        "",
        cleaned,
        flags=re.IGNORECASE
    )

    cleaned = re.sub(
        r"```$",
        "",
        cleaned
    )

    cleaned = cleaned.strip()

    try:
        return json.loads(cleaned)

    except json.JSONDecodeError:
        # Try extracting JSON object from extra text
        match = re.search(r"\{.*\}", cleaned, re.DOTALL)

        if match:
            return json.loads(match.group())

        raise AIError("AI returned invalid JSON")