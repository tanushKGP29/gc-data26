"""
Conversation Memory System
Stores conversation history per session with smart summarization.
"""
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from datetime import datetime
import json

@dataclass
class Message:
    role: str  # "user" or "assistant"
    content: str
    timestamp: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> dict:
        return {
            "role": self.role,
            "content": self.content,
            "timestamp": self.timestamp.isoformat(),
            "metadata": self.metadata
        }

@dataclass 
class ConversationTurn:
    """A single Q&A turn"""
    user_query: str
    assistant_response: str
    datasets_used: List[str] = field(default_factory=list)
    charts_created: List[str] = field(default_factory=list)
    key_findings: List[str] = field(default_factory=list)
    timestamp: datetime = field(default_factory=datetime.now)
    
    def to_summary(self) -> str:
        """Create a concise summary of this turn"""
        summary = f"Q: {self.user_query[:100]}"
        if self.datasets_used:
            summary += f" | Used: {', '.join(self.datasets_used[:2])}"
        if self.key_findings:
            summary += f" | Found: {self.key_findings[0][:50]}"
        return summary


class SessionMemory:
    """Memory for a single chat session"""
    
    def __init__(self, session_id: str, max_turns: int = 10):
        self.session_id = session_id
        self.max_turns = max_turns
        self.turns: List[ConversationTurn] = []
        self.context_summary: str = ""
        self.referenced_datasets: set = set()
        self.created_at = datetime.now()
        self.last_activity = datetime.now()
    
    def add_turn(
        self,
        user_query: str,
        assistant_response: str,
        datasets_used: List[str] = None,
        charts_created: List[str] = None,
        key_findings: List[str] = None
    ):
        """Add a conversation turn"""
        turn = ConversationTurn(
            user_query=user_query,
            assistant_response=assistant_response,
            datasets_used=datasets_used or [],
            charts_created=charts_created or [],
            key_findings=key_findings or []
        )
        self.turns.append(turn)
        self.last_activity = datetime.now()
        
        # Track referenced datasets
        if datasets_used:
            self.referenced_datasets.update(datasets_used)
        
        # Trim old turns if needed (keep summary of old ones)
        if len(self.turns) > self.max_turns:
            self._summarize_old_turns()
    
    def _summarize_old_turns(self):
        """Summarize older turns to save memory"""
        if len(self.turns) <= self.max_turns:
            return
        
        # Keep last max_turns, summarize the rest
        old_turns = self.turns[:-self.max_turns]
        self.turns = self.turns[-self.max_turns:]
        
        # Build summary of old turns
        summaries = [t.to_summary() for t in old_turns]
        old_summary = "\n".join(summaries)
        
        if self.context_summary:
            self.context_summary = f"{self.context_summary}\n---\n{old_summary}"
        else:
            self.context_summary = f"Earlier in conversation:\n{old_summary}"
    
    def get_context_for_llm(self, include_last_n: int = 5) -> str:
        """Get conversation context formatted for LLM"""
        parts = []
        
        # Add summary of older conversation if exists
        if self.context_summary:
            parts.append(f"[Previous context]\n{self.context_summary}")
        
        # Add recent turns
        recent = self.turns[-include_last_n:] if self.turns else []
        if recent:
            parts.append("[Recent conversation]")
            for turn in recent:
                parts.append(f"User: {turn.user_query}")
                # Truncate long responses
                response = turn.assistant_response
                if len(response) > 300:
                    response = response[:300] + "..."
                parts.append(f"Assistant: {response}")
                if turn.datasets_used:
                    parts.append(f"  (Used datasets: {', '.join(turn.datasets_used)})")
        
        return "\n".join(parts)
    
    def get_last_query(self) -> Optional[str]:
        """Get the last user query"""
        return self.turns[-1].user_query if self.turns else None
    
    def get_last_response(self) -> Optional[str]:
        """Get the last assistant response"""
        return self.turns[-1].assistant_response if self.turns else None
    
    def get_referenced_datasets(self) -> List[str]:
        """Get all datasets referenced in this session"""
        return list(self.referenced_datasets)
    
    def get_recent_findings(self, n: int = 3) -> List[str]:
        """Get recent key findings"""
        findings = []
        for turn in reversed(self.turns):
            findings.extend(turn.key_findings)
            if len(findings) >= n:
                break
        return findings[:n]


class ConversationMemoryManager:
    """Manages memory across all sessions"""
    
    def __init__(self, max_sessions: int = 100):
        self.sessions: Dict[str, SessionMemory] = {}
        self.max_sessions = max_sessions
    
    def get_session(self, session_id: str) -> SessionMemory:
        """Get or create a session"""
        if session_id not in self.sessions:
            # Cleanup old sessions if needed
            self._cleanup_old_sessions()
            self.sessions[session_id] = SessionMemory(session_id)
        return self.sessions[session_id]
    
    def _cleanup_old_sessions(self):
        """Remove oldest sessions if we exceed max"""
        if len(self.sessions) >= self.max_sessions:
            # Sort by last activity and remove oldest
            sorted_sessions = sorted(
                self.sessions.items(),
                key=lambda x: x[1].last_activity
            )
            # Remove oldest 20%
            to_remove = len(self.sessions) // 5
            for session_id, _ in sorted_sessions[:to_remove]:
                del self.sessions[session_id]
    
    def clear_session(self, session_id: str):
        """Clear a specific session"""
        if session_id in self.sessions:
            del self.sessions[session_id]


# Global instance
_memory_manager: Optional[ConversationMemoryManager] = None

def get_memory_manager() -> ConversationMemoryManager:
    """Get the global memory manager"""
    global _memory_manager
    if _memory_manager is None:
        _memory_manager = ConversationMemoryManager()
    return _memory_manager

def get_session_memory(session_id: str) -> SessionMemory:
    """Convenience function to get session memory"""
    return get_memory_manager().get_session(session_id)
