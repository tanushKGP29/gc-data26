"""
Groq LLM Client - All LLM calls route through this module.
Swap-ready: change provider/models by editing only this file.

Now using Modal-hosted vLLM server instead of Groq API.
"""
import os
import asyncio
import aiohttp
from typing import AsyncGenerator, List, Dict, Optional
from openai import OpenAI

# ─── Modal vLLM Server Configuration ─────────────────────────────────────────
BASE_URL = "https://ajsalali2005--llama-8b-vllm-server-serve.modal.run"
MODEL = "llama"

# OpenAI-compatible client for sync calls
_sync_client: Optional[OpenAI] = None


def _get_sync_client() -> OpenAI:
    """Get or create synchronous OpenAI-compatible client for Modal vLLM."""
    global _sync_client
    if _sync_client is None:
        _sync_client = OpenAI(base_url=f"{BASE_URL}/v1", api_key="not-needed")
    return _sync_client


# ─── Synchronous Completion Functions ────────────────────────────────────────

def fast_complete(
    messages: List[Dict[str, str]],
    system_prompt: str = "",
    temperature: float = 0.5,
    max_tokens: int = 4096
) -> str:
    """
    Fast completion using Modal-hosted vLLM.
    Used for: code generation, routing, quick narration.
    """
    client = _get_sync_client()
    
    full_messages = []
    if system_prompt:
        full_messages.append({"role": "system", "content": system_prompt})
    full_messages.extend(messages)
    
    response = client.chat.completions.create(
        model=MODEL,
        messages=full_messages,
        temperature=temperature,
        max_tokens=max_tokens
    )
    return response.choices[0].message.content or ""


def think_complete(
    messages: List[Dict[str, str]],
    system_prompt: str = "",
    temperature: float = 0.5,
    max_tokens: int = 4096
) -> str:
    """
    Deep thinking completion using Modal-hosted vLLM.
    Used for: planning, reflection, complex insights.
    """
    client = _get_sync_client()
    
    full_messages = []
    if system_prompt:
        full_messages.append({"role": "system", "content": system_prompt})
    full_messages.extend(messages)
    
    response = client.chat.completions.create(
        model=MODEL,
        messages=full_messages,
        temperature=temperature,
        max_tokens=max_tokens
    )
    return response.choices[0].message.content or ""


# ─── Async Streaming Functions ───────────────────────────────────────────────

async def stream_fast(
    messages: List[Dict[str, str]],
    system_prompt: str = ""
) -> AsyncGenerator[str, None]:
    """
    Stream tokens from Modal-hosted vLLM.
    Used for: real-time chat responses.
    """
    client = _get_sync_client()
    
    full_messages = []
    if system_prompt:
        full_messages.append({"role": "system", "content": system_prompt})
    full_messages.extend(messages)
    
    stream = client.chat.completions.create(
        model=MODEL,
        messages=full_messages,
        temperature=0.7,
        max_tokens=2048,
        stream=True
    )
    
    for chunk in stream:
        if chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content


async def stream_think(
    messages: List[Dict[str, str]],
    system_prompt: str = ""
) -> AsyncGenerator[str, None]:
    """
    Stream tokens from Modal-hosted vLLM.
    Used for: detailed explanations, complex analysis.
    """
    client = _get_sync_client()
    
    full_messages = []
    if system_prompt:
        full_messages.append({"role": "system", "content": system_prompt})
    full_messages.extend(messages)
    
    stream = client.chat.completions.create(
        model=MODEL,
        messages=full_messages,
        temperature=0.5,
        max_tokens=4096,
        stream=True
    )
    
    for chunk in stream:
        if chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content


# ─── Utility Functions ───────────────────────────────────────────────────────

def format_messages(history: List[Dict]) -> List[Dict[str, str]]:
    """Convert conversation history to message format."""
    return [
        {"role": msg.get("role", "user"), "content": msg.get("content", "")}
        for msg in history
    ]


def count_tokens_approx(text: str) -> int:
    """Approximate token count (rough estimate: 4 chars per token)."""
    return len(text) // 4


# ═══════════════════════════════════════════════════════════════════════════════
# ORIGINAL GROQ IMPLEMENTATION (COMMENTED OUT)
# ═══════════════════════════════════════════════════════════════════════════════
# from groq import Groq, AsyncGroq
#
# # ─── Model Configuration ─────────────────────────────────────────────────────
# # FAST_MODEL = "llama-3.1-8b-instant"        # Code gen, routing, quick tasks
# # THINK_MODEL = "llama-3.3-70b-versatile"    # Planning, reflection, insights
#
# # ─── Client Initialization ───────────────────────────────────────────────────
# # _api_key = os.getenv("GROQ_API_KEY", "")
# # _sync_client: Optional[Groq] = None
# # _async_client: Optional[AsyncGroq] = None
#
#
# # def _get_sync_client() -> Groq:
# #     """Get or create synchronous Groq client."""
# #     global _sync_client
# #     if _sync_client is None:
# #         if not _api_key:
# #             raise ValueError("GROQ_API_KEY environment variable not set")
# #         _sync_client = Groq(api_key=_api_key)
# #     return _sync_client
#
#
# # def _get_async_client() -> AsyncGroq:
# #     """Get or create asynchronous Groq client."""
# #     global _async_client
# #     if _async_client is None:
# #         if not _api_key:
# #             raise ValueError("GROQ_API_KEY environment variable not set")
# #         _async_client = AsyncGroq(api_key=_api_key)
# #     return _async_client
#
#
# # ─── Synchronous Completion Functions (GROQ) ─────────────────────────────────
#
# # def fast_complete(
# #     messages: List[Dict[str, str]],
# #     system_prompt: str = "",
# #     temperature: float = 0.7,
# #     max_tokens: int = 2048
# # ) -> str:
# #     """
# #     Fast completion using the lightweight model.
# #     Used for: code generation, routing, quick narration.
# #     """
# #     client = _get_sync_client()
# #     
# #     full_messages = []
# #     if system_prompt:
# #         full_messages.append({"role": "system", "content": system_prompt})
# #     full_messages.extend(messages)
# #     
# #     response = client.chat.completions.create(
# #         model=FAST_MODEL,
# #         messages=full_messages,
# #         temperature=temperature,
# #         max_tokens=max_tokens
# #     )
# #     return response.choices[0].message.content or ""
#
#
# # def think_complete(
# #     messages: List[Dict[str, str]],
# #     system_prompt: str = "",
# #     temperature: float = 0.5,
# #     max_tokens: int = 4096
# # ) -> str:
# #     """
# #     Deep thinking completion using the larger model.
# #     Used for: planning, reflection, complex insights.
# #     """
# #     client = _get_sync_client()
# #     
# #     full_messages = []
# #     if system_prompt:
# #         full_messages.append({"role": "system", "content": system_prompt})
# #     full_messages.extend(messages)
# #     
# #     response = client.chat.completions.create(
# #         model=THINK_MODEL,
# #         messages=full_messages,
# #         temperature=temperature,
# #         max_tokens=max_tokens
# #     )
# #     return response.choices[0].message.content or ""
#
#
# # ─── Async Streaming Functions (GROQ) ────────────────────────────────────────
#
# # async def stream_fast(
# #     messages: List[Dict[str, str]],
# #     system_prompt: str = ""
# # ) -> AsyncGenerator[str, None]:
# #     """
# #     Stream tokens from the fast model.
# #     Used for: real-time chat responses.
# #     """
# #     client = _get_async_client()
# #     
# #     full_messages = []
# #     if system_prompt:
# #         full_messages.append({"role": "system", "content": system_prompt})
# #     full_messages.extend(messages)
# #     
# #     stream = await client.chat.completions.create(
# #         model=FAST_MODEL,
# #         messages=full_messages,
# #         temperature=0.7,
# #         max_tokens=2048,
# #         stream=True
# #     )
# #     
# #     async for chunk in stream:
# #         if chunk.choices[0].delta.content:
# #             yield chunk.choices[0].delta.content
#
#
# # async def stream_think(
# #     messages: List[Dict[str, str]],
# #     system_prompt: str = ""
# # ) -> AsyncGenerator[str, None]:
# #     """
# #     Stream tokens from the thinking model.
# #     Used for: detailed explanations, complex analysis.
# #     """
# #     client = _get_async_client()
# #     
# #     full_messages = []
# #     if system_prompt:
# #         full_messages.append({"role": "system", "content": system_prompt})
# #     full_messages.extend(messages)
# #     
# #     stream = await client.chat.completions.create(
# #         model=THINK_MODEL,
# #         messages=full_messages,
# #         temperature=0.5,
# #         max_tokens=4096,
# #         stream=True
# #     )
# #     
# #     async for chunk in stream:
# #         if chunk.choices[0].delta.content:
# #             yield chunk.choices[0].delta.content