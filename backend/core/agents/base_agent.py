"""
Base Agent Class
All specialized agents inherit from this
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional

class BaseAgent(ABC):
    """Base class for all AI agents"""
    
    def __init__(self, agent_id: str, agent_name: str):
        self.agent_id = agent_id
        self.agent_name = agent_name
        self.initialized = False
    
    @abstractmethod
    async def initialize(self):
        """Initialize the agent (load models, connect to services, etc.)"""
        pass
    
    @abstractmethod
    async def cleanup(self):
        """Cleanup resources"""
        pass
    
    async def health_check(self) -> Dict[str, Any]:
        """Check agent health"""
        return {
            'agent_id': self.agent_id,
            'agent_name': self.agent_name,
            'initialized': self.initialized,
            'status': 'healthy' if self.initialized else 'not_initialized'
        }
    
    def _calculate_confidence(self, result: Any) -> float:
        """Calculate confidence score for agent response"""
        # Base implementation - can be overridden
        return 0.8
