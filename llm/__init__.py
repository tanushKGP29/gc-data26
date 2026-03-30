"""LLM module - All LLM calls route through groq_client."""
from . import groq_client

fast_complete = groq_client.fast_complete
think_complete = groq_client.think_complete
stream_fast = groq_client.stream_fast
stream_think = groq_client.stream_think
format_messages = groq_client.format_messages
FAST_MODEL = groq_client.FAST_MODEL
THINK_MODEL = groq_client.THINK_MODEL


__all__ = [
    "fast_complete",
    "think_complete",
    "stream_fast",
    "stream_think",
    "format_messages",
    "FAST_MODEL",
    "THINK_MODEL"
]
