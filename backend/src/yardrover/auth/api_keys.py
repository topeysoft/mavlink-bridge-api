"""API key management with bcrypt hashing."""

import json
import secrets
import uuid
from datetime import datetime, timedelta
from pathlib import Path
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
    """Manager for API keys with persistent JSON storage."""

    def __init__(self, storage_path: Optional[Path] = None) -> None:
        """Initialize API key manager.

        Args:
            storage_path: Path to storage directory (defaults to ./storage)
        """
        self._keys: dict[str, APIKey] = {}

        # Set up storage
        self._storage_path = storage_path or Path("storage")
        self._storage_path.mkdir(parents=True, exist_ok=True)
        self._keys_file = self._storage_path / "api_keys.json"

        # Load existing keys
        self._load_from_disk()

    def _load_from_disk(self) -> None:
        """Load API keys from JSON file."""
        if not self._keys_file.exists():
            logger.info("api_keys_file_not_found", path=str(self._keys_file), action="creating_new")
            return

        try:
            with open(self._keys_file, "r") as f:
                data = json.load(f)

            for key_data in data.get("keys", []):
                # Reconstruct APIKey object
                api_key = APIKey(
                    key_id=key_data["key_id"],
                    name=key_data["name"],
                    role=Role(key_data["role"]),
                    hashed_key=key_data["hashed_key"],
                    description=key_data.get("description"),
                    enabled=key_data.get("enabled", True),
                    created_at=datetime.fromisoformat(key_data["created_at"]),
                    expires_at=(
                        datetime.fromisoformat(key_data["expires_at"])
                        if key_data.get("expires_at")
                        else None
                    ),
                    last_used_at=(
                        datetime.fromisoformat(key_data["last_used_at"])
                        if key_data.get("last_used_at")
                        else None
                    ),
                )

                self._keys[api_key.key_id] = api_key

            logger.info("api_keys_loaded_from_disk", count=len(self._keys), path=str(self._keys_file))

        except Exception as e:
            logger.error("api_keys_load_failed", path=str(self._keys_file), error=str(e))

    def _save_to_disk(self) -> None:
        """Save API keys to JSON file."""
        try:
            data = {
                "keys": [
                    {
                        "key_id": key.key_id,
                        "name": key.name,
                        "role": key.role.value,
                        "hashed_key": key.hashed_key,
                        "description": key.description,
                        "enabled": key.enabled,
                        "created_at": key.created_at.isoformat(),
                        "expires_at": key.expires_at.isoformat() if key.expires_at else None,
                        "last_used_at": key.last_used_at.isoformat() if key.last_used_at else None,
                    }
                    for key in self._keys.values()
                ]
            }

            # Write atomically using temporary file
            temp_file = self._keys_file.with_suffix(".tmp")
            with open(temp_file, "w") as f:
                json.dump(data, f, indent=2)

            # Atomic replace
            temp_file.replace(self._keys_file)

            logger.debug("api_keys_saved_to_disk", count=len(self._keys), path=str(self._keys_file))

        except Exception as e:
            logger.error("api_keys_save_failed", path=str(self._keys_file), error=str(e))

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

        # Persist to disk
        self._save_to_disk()

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
                self._save_to_disk()  # Persist usage timestamp
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
        self._save_to_disk()
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
            self._save_to_disk()
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
        self._save_to_disk()
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
        self._save_to_disk()
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
            self._save_to_disk()
            logger.info("expired_keys_cleaned_up", count=len(expired))

        return len(expired)


# Global API key manager instance
_api_key_manager: Optional[APIKeyManager] = None


def get_api_key_manager(storage_path: Optional[Path] = None) -> APIKeyManager:
    """Get global API key manager instance.

    Args:
        storage_path: Optional storage path (uses config on first call)

    Returns:
        APIKeyManager instance
    """
    global _api_key_manager
    if _api_key_manager is None:
        # Get storage path from config if not provided
        if storage_path is None:
            try:
                from yardrover.core.config import get_config_manager
                config_manager = get_config_manager()
                storage_path = config_manager.config.storage.base_path
            except Exception:
                # Fall back to default if config not available
                storage_path = Path("storage")
                logger.warning("config_not_available_using_default_storage", path=str(storage_path))

        _api_key_manager = APIKeyManager(storage_path)
    return _api_key_manager
