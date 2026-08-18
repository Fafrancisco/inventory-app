#!/usr/bin/env python3
"""Exercise a Gemini image-generation request without exposing the API key."""

import base64
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


MODEL = os.getenv("GEMINI_IMAGE_MODEL", "gemini-2.5-flash-image")
API_KEY = os.getenv("GEMINI_API_KEY")
OUTPUT_PATH = Path(os.getenv("GEMINI_IMAGE_OUTPUT", "test-results/gemini-image.png"))
PROMPT = os.getenv(
    "GEMINI_IMAGE_PROMPT",
    "Generate a realistic food photograph of a bowl of vegetable soup, "
    "natural light, clean home kitchen, no text, labels, logos, or people.",
)


def main() -> int:
    if not API_KEY:
        print("GEMINI_API_KEY is not configured.", file=sys.stderr)
        return 2

    model_path = MODEL if MODEL.startswith("models/") else f"models/{MODEL}"
    url = (
        "https://generativelanguage.googleapis.com/v1beta/"
        f"{model_path}:generateContent"
    )
    payload = {
        "contents": [{"role": "user", "parts": [{"text": PROMPT}]}],
        "generationConfig": {"responseModalities": ["TEXT", "IMAGE"]},
    }
    request = urllib.request.Request(
        f"{url}?key={urllib.parse.quote(API_KEY)}",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    started_at = time.monotonic()
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            response_status = response.status
            response_payload = json.load(response)
    except urllib.error.HTTPError as error:
        response_status = error.code
        try:
            response_payload = json.load(error)
        except json.JSONDecodeError:
            response_payload = {}
    except urllib.error.URLError as error:
        print(json.dumps({"status": None, "error": str(error.reason)}))
        return 1

    elapsed_ms = round((time.monotonic() - started_at) * 1000)
    if response_status >= 400:
        error_payload = response_payload.get("error", {})
        print(
            json.dumps(
                {
                    "model": MODEL,
                    "status": response_status,
                    "elapsedMs": elapsed_ms,
                    "error": error_payload.get("message", "Gemini request failed"),
                },
                ensure_ascii=False,
            )
        )
        return 1

    parts = response_payload.get("candidates", [{}])[0].get("content", {}).get("parts", [])
    image_part = next(
        (
            part
            for part in parts
            if part.get("inlineData", {}).get("data")
            or part.get("inline_data", {}).get("data")
        ),
        None,
    )
    image_data = (image_part or {}).get("inlineData") or (image_part or {}).get("inline_data")

    if not image_data:
        print(
            json.dumps(
                {
                    "model": MODEL,
                    "status": response_status,
                    "elapsedMs": elapsed_ms,
                    "generated": False,
                    "message": "The API returned no inline image data.",
                },
                ensure_ascii=False,
            )
        )
        return 1

    mime_type = image_data.get("mimeType") or image_data.get("mime_type", "image/png")
    raw_image = base64.b64decode(image_data["data"])
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_bytes(raw_image)

    print(
        json.dumps(
            {
                "model": MODEL,
                "status": response_status,
                "elapsedMs": elapsed_ms,
                "generated": True,
                "mimeType": mime_type,
                "bytes": len(raw_image),
                "output": str(OUTPUT_PATH),
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
