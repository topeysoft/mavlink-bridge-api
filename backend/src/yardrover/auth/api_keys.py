"""API key management with bcrypt hashing."""

import secrets
import uuid
from datetime import datetime, timedelta
from typing import Optional

import structlog
from passlib.context import CryptContext

from .models import APIKey, Role

logger = structlog.get_logger(__name__)

# Password context for bcrypt hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def generate_api_key(prefix: str = "yr") -> str:
    """Generate a secure random API key.

    Args:
        prefix: Optional prefix for the key (default: "yr" for YardRover)

    Returns:
        A secure random API key string (e.g., "yr_abc123...")
    """
    # Generate 32 bytes of random data and encode as hex (64 chars)
    random_part = secrets.token_hex(32)
    return f"{prefix}_{random_part}"


def hash_api_key(api_key: str) -> str:
    """Hash an API key using bcrypt.

    Args:
        api_key: Plaintext API key

    Returns:
        Bcrypt hashed API key
    """
    return pwd_context.hash(api_key)


def verify_api_key(plaintext_key: str, hashed_key: str) -> bool:
    """Verify an API key against its hash.

    Args:
        plaintext_key: Plaintext API key provided by user
        hashed_key: Stored bcrypt hash

    Returns:
        True if key matches, False otherwise
    """
    try:
        return pwd_context.verify(plaintext_key, hashed_key)
    except Exception as e:
        logger.warning("api_key_verification_error", error=str(e))
        return False


class APIKeyManager:
    """Manager for API keys stored in memory or persistent storage."""

    def __init__(self) -> None:
        """Initialize API key manager."""
        self._keys: dict[str, APIKey] = {}

    def create_key(
        self,
        name: str,
        role: Role = Role.VIEWER,
        description: Optional[str] = None,
        expires_in_days: Optional[int] = None,
    ) -> tuple[APIKey, str]:
        """Create a new API key.

        Args:
            name: Human-readable name for the key
            role: Role to assign to this key
            description: Optional description
            expires_in_days: Optional expiration in days

        Returns:
            Tuple of (APIKey object, plaintext key)
            WARNING: Plaintext key is only returned once!
        """
        # Generate unique key ID and API key
        key_id = str(uuid.uuid4())
        plaintext_key = generate_api_key()

        # Calculate expiration
        expires_at = None
        if expires_in_days:
            expires_at = datetime.utcnow() + timedelta(days=expires_in_days)

        # Create API key object
        api_key = APIKey(
            key_id=key_id,
            name=name,
            role=role,
            hashed_key=hash_api_key(plaintext_key),
            expires_at=expires_at,
            description=description,
        )

        # Store in memory
        self._keys[key_id] = api_key

        logger.info(
            "api_key_created",
            key_id=key_id,
            name=name,
            role=role.value,
            expires_at=expires_at,
        )

        return api_key, plaintext_key

    def verify_key(self, plaintext_key: str) -> Optional[APIKey]:
        """Verify an API key and return the key object if valid.

        Args:
            plaintext_key: Plaintext API key to verify

        Returns:
            APIKey object if valid, None otherwise
        """
        # Check all stored keys
        for key_id, api_key in self._keys.items():
            # Skip disabled or expired keys
            if not api_key.is_valid():
                continue

            # Verify hash
            if verify_api_key(plaintext_key, api_key.hashed_key):
                # Update last used timestamp
                api_key.last_used_at = datetime.utcnow()
                logger.info("api_key_verified", key_id=key_id, name=api_key.name)
                return api_key

        logger.warning("api_key_verification_failed")
        return None

    def get_key(self, key_id: str) -> Optional[APIKey]:
        """Get an API key by ID.

        Args:
            key_id: Key ID

        Returns:
            APIKey object or None if not found
        """
        return self._keys.get(key_id)

    def list_keys(self) -> list[APIKey]:
        """List all API keys.

        Returns:
            List of APIKey objects
        """
        return list(self._keys.values())

    def revoke_key(self, key_id: str) -> bool:
        """Revoke (disable) an API key.

        Args:
            key_id: Key ID to revoke

        Returns:
            True if key was revoked, False if not found
        """
        api_key = self._keys.get(key_id)
        if not api_key:
            return False

        api_key.enabled = False
        logger.info("api_key_revoked", key_id=key_id, name=api_key.name)
        return True

    def delete_key(self, key_id: str) -> bool:
        """Delete an API key permanently.

        Args:
            key_id: Key ID to delete

        Returns:
            True if key was deleted, False if not found
        """
        if key_id in self._keys:
            api_key = self._keys.pop(key_id)
            logger.info("api_key_deleted", key_id=key_id, name=api_key.name)
            return True
        return False

    def enable_key(self, key_id: str) -> bool:
        """Enable a previously disabled API key.

        Args:
            key_id: Key ID to enable

        Returns:
            True if key was enabled, False if not found
        """
        api_key = self._keys.get(key_id)
        if not api_key:
            return False

        api_key.enabled = True
        logger.info("api_key_enabled", key_id=key_id, name=api_key.name)
        return True

    def update_key_role(self, key_id: str, role: Role) -> bool:
        """Update the role of an API key.

        Args:
            key_id: Key ID
            role: New role

        Returns:
            True if updated, False if not found
        """
        api_key = self._keys.get(key_id)
        if not api_key:
            return False

        old_role = api_key.role
        api_key.role = role
        logger.info(
            "api_key_role_updated",
            key_id=key_id,
            name=api_key.name,
            old_role=old_role.value,
            new_role=role.value,
        )
        return True

    def cleanup_expired_keys(self) -> int:
        """Remove expired keys from storage.

        Returns:
            Number of keys removed
        """
        expired = [
            key_id
            for key_id, api_key in self._keys.items()
            if api_key.is_expired()
        ]

        for key_id in expired:
            self._keys.pop(key_id)

        if expired:
            logger.info("expired_keys_cleaned_up", count=len(expired))

        return len(expired)


# Global API key manager instance
_api_key_manager: Optional[APIKeyManager] = None


def get_api_key_manager() -> APIKeyManager:
    """Get global API key manager instance.

    Returns:
        APIKeyManager instance
    """
    global _api_key_manager
    if _api_key_manager is None:
        _api_key_manager = APIKeyManager()
    return _api_key_manager
