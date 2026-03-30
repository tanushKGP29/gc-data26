"""Groq LLM Client - all calls route through this module.

This module uses Groq with two models:
- FAST_MODEL for quick routing/code-generation style work
- THINK_MODEL for deeper analysis/planning work
"""

import os
from typing import AsyncGenerator, Dict, List, Optional

from groq import AsyncGroq, Groq
from dotenv import load_dotenv

# Load environment variables from .env if present.
load_dotenv()

# ─── Model Configuration ─────────────────────────────────────────────────────
FAST_MODEL = os.getenv("GROQ_FAST_MODEL", "llama-3.1-8b-instant")
THINK_MODEL = os.getenv("GROQ_THINK_MODEL", "llama-3.3-70b-versatile")

# ─── Client Initialization ───────────────────────────────────────────────────
_api_key = os.getenv("GROQ_API_KEY", "")
_sync_client: Optional[Groq] = None
_async_client: Optional[AsyncGroq] = None


def _get_sync_client() -> Groq:
    """Get or create synchronous Groq client."""
    global _sync_client
    if _sync_client is None:
        if not _api_key:
            raise ValueError("GROQ_API_KEY environment variable not set")
        _sync_client = Groq(api_key=_api_key)
    return _sync_client


def _get_async_client() -> AsyncGroq:
    """Get or create asynchronous Groq client."""
    global _async_client
    if _async_client is None:
        if not _api_key:
            raise ValueError("GROQ_API_KEY environment variable not set")
        _async_client = AsyncGroq(api_key=_api_key)
    return _async_client


# ─── Synchronous Completion Functions ────────────────────────────────────────

def fast_complete(
    messages: List[Dict[str, str]],
    system_prompt: str = "",
    temperature: float = 0.7,
    max_tokens: int = 2048,
) -> str:
    """Fast completion using the lightweight Groq model."""
    client = _get_sync_client()

    full_messages: List[Dict[str, str]] = []
    if system_prompt:
        full_messages.append({"role": "system", "content": system_prompt})
    full_messages.extend(messages)

    response = client.chat.completions.create(
        model=FAST_MODEL,
        messages=full_messages,
        temperature=temperature,
        max_tokens=max_tokens,
    )
    return response.choices[0].message.content or ""


def think_complete(
    messages: List[Dict[str, str]],
    system_prompt: str = "",
    temperature: float = 0.5,
    max_tokens: int = 4096,
) -> str:
    """Thinking completion using the larger Groq model."""
    client = _get_sync_client()

    full_messages: List[Dict[str, str]] = []
    if system_prompt:
        full_messages.append({"role": "system", "content": system_prompt})
    full_messages.extend(messages)

    response = client.chat.completions.create(
        model=THINK_MODEL,
        messages=full_messages,
        temperature=temperature,
        max_tokens=max_tokens,
    )
    return response.choices[0].message.content or ""


# ─── Async Streaming Functions ───────────────────────────────────────────────

async def stream_fast(
    messages: List[Dict[str, str]],
    system_prompt: str = "",
) -> AsyncGenerator[str, None]:
    """Stream tokens from the fast Groq model."""
    client = _get_async_client()

    full_messages: List[Dict[str, str]] = []
    if system_prompt:
        full_messages.append({"role": "system", "content": system_prompt})
    full_messages.extend(messages)

    stream = await client.chat.completions.create(
        model=FAST_MODEL,
        messages=full_messages,
        temperature=0.7,
        max_tokens=4096,
        stream=True,
    )

    async for chunk in stream:
        if chunk.choices and chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content


async def stream_think(
    messages: List[Dict[str, str]],
    system_prompt: str = "",
) -> AsyncGenerator[str, None]:
    """Stream tokens from the think Groq model."""
    client = _get_async_client()

    full_messages: List[Dict[str, str]] = []
    if system_prompt:
        full_messages.append({"role": "system", "content": system_prompt})
    full_messages.extend(messages)

    stream = await client.chat.completions.create(
        model=THINK_MODEL,
        messages=full_messages,
        temperature=0.5,
        max_tokens=4096,
        stream=True,
    )

    async for chunk in stream:
        if chunk.choices and chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content


# ─── Utility Functions ───────────────────────────────────────────────────────

def format_messages(history: List[Dict]) -> List[Dict[str, str]]:
    """Convert conversation history to Groq-compatible message format."""
    return [
        {"role": msg.get("role", "user"), "content": msg.get("content", "")}
        for msg in history
    ]


def count_tokens_approx(text: str) -> int:
    """Approximate token count (rough estimate: 4 chars per token)."""
    return len(text) // 4
