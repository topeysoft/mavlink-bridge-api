"""Refresh token storage and management."""

import json
import time
from datetime import datetime
from pathlib import Path
from typing import Optional

import structlog

from .models import Role

logger = structlog.get_logger(__name__)


class RefreshTokenData:
    """Data for a stored refresh token."""

    def __init__(
        self,
        jti: str,
        subject: str,
        role: Role,
        issued_at: datetime,
        expires_at: datetime,
        revoked: bool = False,
    ):
        """Initialize refresh token data.

        Args:
            jti: JWT ID (unique token identifier)
            subject: Subject (API key ID or username)
            role: User role
            issued_at: Token issuance timestamp
            expires_at: Token expiration timestamp
            revoked: Whether token has been revoked
        """
        self.jti = jti
        self.subject = subject
        self.role = role
        self.issued_at = issued_at
        self.expires_at = expires_at
        self.revoked = revoked

    def is_expired(self) -> bool:
        """Check if token is expired."""
        return datetime.utcnow() >= self.expires_at

    def is_valid(self) -> bool:
        """Check if token is valid (not revoked and not expired)."""
        return not self.revoked and not self.is_expired()


class RefreshTokenStore:
    """Persistent store for refresh tokens with TTL and revocation support."""

    def __init__(self, storage_path: Optional[Path] = None):
        """Initialize refresh token store.

        Args:
            storage_path: Path to storage directory (defaults to ./storage)
        """
        self._tokens: dict[str, RefreshTokenData] = {}
        self._subject_tokens: dict[str, set[str]] = {}  # subject -> set of JTIs

        # Set up storage
        self._storage_path = storage_path or Path("storage")
        self._storage_path.mkdir(parents=True, exist_ok=True)
        self._tokens_file = self._storage_path / "refresh_tokens.json"

        # Load existing tokens
        self._load_from_disk()

    def _load_from_disk(self) -> None:
        """Load refresh tokens from JSON file."""
        if not self._tokens_file.exists():
            logger.info("refresh_tokens_file_not_found", path=str(self._tokens_file), action="creating_new")
            return

        try:
            with open(self._tokens_file, "r") as f:
                data = json.load(f)

            for token_dict in data.get("tokens", []):
                # Reconstruct RefreshTokenData
                token_data = RefreshTokenData(
                    jti=token_dict["jti"],
                    subject=token_dict["subject"],
                    role=Role(token_dict["role"]),
                    issued_at=datetime.fromisoformat(token_dict["issued_at"]),
                    expires_at=datetime.fromisoformat(token_dict["expires_at"]),
                    revoked=token_dict.get("revoked", False),
                )

                self._tokens[token_data.jti] = token_data

                # Rebuild subject index
                if token_data.subject not in self._subject_tokens:
                    self._subject_tokens[token_data.subject] = set()
                self._subject_tokens[token_data.subject].add(token_data.jti)

            logger.info("refresh_tokens_loaded_from_disk", count=len(self._tokens), path=str(self._tokens_file))

        except Exception as e:
            logger.error("refresh_tokens_load_failed", path=str(self._tokens_file), error=str(e))

    def _save_to_disk(self) -> None:
        """Save refresh tokens to JSON file."""
        try:
            data = {
                "tokens": [
                    {
                        "jti": token.jti,
                        "subject": token.subject,
                        "role": token.role.value,
                        "issued_at": token.issued_at.isoformat(),
                        "expires_at": token.expires_at.isoformat(),
                        "revoked": token.revoked,
                    }
                    for token in self._tokens.values()
                ]
            }

            # Write atomically using temporary file
            temp_file = self._tokens_file.with_suffix(".tmp")
            with open(temp_file, "w") as f:
                json.dump(data, f, indent=2)

            # Atomic replace
            temp_file.replace(self._tokens_file)

            logger.debug("refresh_tokens_saved_to_disk", count=len(self._tokens), path=str(self._tokens_file))

        except Exception as e:
            logger.error("refresh_tokens_save_failed", path=str(self._tokens_file), error=str(e))

    def store_token(
        self,
        jti: str,
        subject: str,
        role: Role,
        issued_at: datetime,
        expires_at: datetime,
    ) -> None:
        """Store a refresh token.

        Args:
            jti: JWT ID (unique token identifier)
            subject: Subject (API key ID or username)
            role: User role
            issued_at: Token issuance timestamp
            expires_at: Token expiration timestamp
        """
        token_data = RefreshTokenData(jti, subject, role, issued_at, expires_at)
        self._tokens[jti] = token_data

        # Track tokens by subject for bulk operations
        if subject not in self._subject_tokens:
            self._subject_tokens[subject] = set()
        self._subject_tokens[subject].add(jti)

        # Persist to disk
        self._save_to_disk()

        logger.info(
            "refresh_token_stored",
            jti=jti,
            subject=subject,
            role=role.value,
            expires_at=expires_at.isoformat(),
        )

    def get_token(self, jti: str) -> Optional[RefreshTokenData]:
        """Get a refresh token by JTI.

        Args:
            jti: JWT ID to look up

        Returns:
            RefreshTokenData if found, None otherwise
        """
        return self._tokens.get(jti)

    def is_token_valid(self, jti: str) -> bool:
        """Check if a refresh token is valid (exists, not revoked, not expired).

        Args:
            jti: JWT ID to check

        Returns:
            True if token is valid, False otherwise
        """
        token_data = self.get_token(jti)
        if token_data is None:
            return False
        return token_data.is_valid()

    def revoke_token(self, jti: str) -> bool:
        """Revoke a specific refresh token.

        Args:
            jti: JWT ID to revoke

        Returns:
            True if token was revoked, False if not found
        """
        token_data = self._tokens.get(jti)
        if token_data is None:
            logger.warning("refresh_token_revoke_failed", reason="not_found", jti=jti)
            return False

        token_data.revoked = True
        self._save_to_disk()
        logger.info(
            "refresh_token_revoked",
            jti=jti,
            subject=token_data.subject,
        )
        return True

    def revoke_all_subject_tokens(self, subject: str) -> int:
        """Revoke all refresh tokens for a specific subject (logout all devices).

        Args:
            subject: Subject whose tokens should be revoked

        Returns:
            Number of tokens revoked
        """
        jtis = self._subject_tokens.get(subject, set())
        revoked_count = 0

        for jti in jtis:
            token_data = self._tokens.get(jti)
            if token_data and not token_data.revoked:
                token_data.revoked = True
                revoked_count += 1

        if revoked_count > 0:
            self._save_to_disk()

        logger.info(
            "refresh_tokens_revoked_for_subject",
            subject=subject,
            count=revoked_count,
        )
        return revoked_count

    def cleanup_expired(self) -> int:
        """Remove expired tokens from store (periodic cleanup).

        Returns:
            Number of expired tokens removed
        """
        now = datetime.utcnow()
        expired_jtis = [
            jti
            for jti, token_data in self._tokens.items()
            if token_data.expires_at < now
        ]

        for jti in expired_jtis:
            token_data = self._tokens.pop(jti)
            # Remove from subject index
            if token_data.subject in self._subject_tokens:
                self._subject_tokens[token_data.subject].discard(jti)
                # Clean up empty subject entries
                if not self._subject_tokens[token_data.subject]:
                    del self._subject_tokens[token_data.subject]

        if expired_jtis:
            self._save_to_disk()
            logger.info(
                "refresh_tokens_cleaned_up",
                count=len(expired_jtis),
            )

        return len(expired_jtis)

    def get_subject_token_count(self, subject: str) -> int:
        """Get the number of active tokens for a subject.

        Args:
            subject: Subject to check

        Returns:
            Number of active (non-revoked, non-expired) tokens
        """
        jtis = self._subject_tokens.get(subject, set())
        active_count = 0

        for jti in jtis:
            token_data = self._tokens.get(jti)
            if token_data and token_data.is_valid():
                active_count += 1

        return active_count

    def get_stats(self) -> dict:
        """Get statistics about the token store.

        Returns:
            Dictionary with store statistics
        """
        total = len(self._tokens)
        revoked = sum(1 for t in self._tokens.values() if t.revoked)
        expired = sum(1 for t in self._tokens.values() if t.is_expired())
        active = sum(1 for t in self._tokens.values() if t.is_valid())

        return {
            "total_tokens": total,
            "active_tokens": active,
            "revoked_tokens": revoked,
            "expired_tokens": expired,
            "unique_subjects": len(self._subject_tokens),
        }


# Global refresh token store instance
_refresh_token_store: Optional[RefreshTokenStore] = None


def initialize_refresh_token_store(storage_path: Optional[Path] = None) -> RefreshTokenStore:
    """Initialize global refresh token store.

    Args:
        storage_path: Optional storage path (uses config if not provided)

    Returns:
        RefreshTokenStore instance
    """
    global _refresh_token_store

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

    _refresh_token_store = RefreshTokenStore(storage_path)
    logger.info("refresh_token_store_initialized", path=str(storage_path))
    return _refresh_token_store


def get_refresh_token_store() -> RefreshTokenStore:
    """Get global refresh token store instance.

    Returns:
        RefreshTokenStore instance

    Raises:
        RuntimeError: If store not initialized
    """
    if _refresh_token_store is None:
        # Auto-initialize with default path if not explicitly initialized
        logger.warning("refresh_token_store_auto_initializing")
        return initialize_refresh_token_store()
    return _refresh_token_store
