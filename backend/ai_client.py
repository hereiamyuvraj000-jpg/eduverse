import os
import json
import re
from dotenv import load_dotenv
from groq import Groq
load_dotenv()


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
    temperature=0,
    response_format={"type": "json_object"},
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
    try:
        # Remove markdown code fences
        text = re.sub(r"```json", "", text, flags=re.IGNORECASE)
        text = re.sub(r"```", "", text)
        text = text.strip()

        # Extract the first JSON object
        start = text.find("{")
        end = text.rfind("}")

        if start == -1 or end == -1:
            raise AIError("No JSON found in AI response.")

        json_text = text[start:end + 1]

        return json.loads(json_text)

    except Exception as e:
        raise AIError(f"AI returned invalid JSON: {e}")