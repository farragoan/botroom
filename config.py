import os
from dotenv import load_dotenv

load_dotenv()

# --- Groq (primary — fast, no rate-limit issues) ---
GROQ_API_BASE = "https://api.groq.com/openai/v1"
GROQ_API_KEY  = os.getenv("GROQ_API_KEY", "")

# Groq models (verified available 2026-03-09 via /v1/models)
GROQ_MODELS = {
    "llama-70b":    "llama-3.3-70b-versatile",
    "llama-8b":     "llama-3.1-8b-instant",
    "llama4-maverick": "meta-llama/llama-4-maverick-17b-128e-instruct",
    "llama4-scout": "meta-llama/llama-4-scout-17b-16e-instruct",
    "qwen3-32b":    "qwen/qwen3-32b",
    "kimi-k2":      "moonshotai/kimi-k2-instruct",
}

# --- OpenRouter (fallback — free tier) ---
OPENROUTER_API_BASE = "https://openrouter.ai/api/v1"
OPENROUTER_API_KEY  = os.getenv("OPENROUTER_API_KEY", "")

FREE_MODELS = {
    "gemma-27b":     "google/gemma-3-27b-it:free",
    "gemma-12b":     "google/gemma-3-12b-it:free",
    "llama-70b-or":  "meta-llama/llama-3.3-70b-instruct:free",
    "mistral-24b":   "mistralai/mistral-small-3.1-24b-instruct:free",
    "gemma-4b":      "google/gemma-3-4b-it:free",
    "llama-3b":      "meta-llama/llama-3.2-3b-instruct:free",
}

# Merged view for --list-models / --maker / --checker CLI choices
ALL_MODELS = {**GROQ_MODELS, **FREE_MODELS}

# Defaults: Groq primary
DEFAULT_MAKER_MODEL   = GROQ_MODELS["llama-70b"]
DEFAULT_CHECKER_MODEL = GROQ_MODELS["llama4-maverick"]
SYNTHESIS_MODEL       = GROQ_MODELS["llama-70b"]

MAX_TURNS         = 999
MAX_TOKENS        = 1024
REQUEST_TIMEOUT   = 60   # seconds per API call

MAKER_COLOR   = "cyan"
CHECKER_COLOR = "magenta"
