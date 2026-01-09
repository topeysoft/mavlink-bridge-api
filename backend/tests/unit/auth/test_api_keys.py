"""Tests for API key management."""

import pytest
from datetime import datetime, timedelta

from yardrover.auth.api_keys import (
    APIKeyManager,
    generate_api_key,
    hash_api_key,
    verify_api_key,
)
from yardrover.auth.models import Role


def test_generate_api_key():
    """Test API key generation."""
    key1 = generate_api_key()
    key2 = generate_api_key()

    # Keys should be unique
    assert key1 != key2

    # Keys should have correct prefix
    assert key1.startswith("yr_")
    assert key2.startswith("yr_")

    # Keys should have sufficient length
    assert len(key1) > 32


def test_hash_and_verify_api_key():
    """Test API key hashing and verification."""
    plaintext_key = generate_api_key()
    hashed_key = hash_api_key(plaintext_key)

    # Hash should be different from plaintext
    assert hashed_key != plaintext_key

    # Verification should succeed with correct key
    assert verify_api_key(plaintext_key, hashed_key) is True

    # Verification should fail with incorrect key
    assert verify_api_key("wrong_key", hashed_key) is False


def test_create_key():
    """Test creating an API key."""
    manager = APIKeyManager()

    api_key, plaintext_key = manager.create_key(
        name="Test Key",
        role=Role.OPERATOR,
        description="Test key for unit tests",
    )

    assert api_key.name == "Test Key"
    assert api_key.role == Role.OPERATOR
    assert api_key.description == "Test key for unit tests"
    assert api_key.enabled is True
    assert api_key.expires_at is None
    assert plaintext_key.startswith("yr_")


def test_create_key_with_expiration():
    """Test creating an API key with expiration."""
    manager = APIKeyManager()

    api_key, plaintext_key = manager.create_key(
        name="Expiring Key",
        role=Role.VIEWER,
        expires_in_days=30,
    )

    assert api_key.expires_at is not None
    assert api_key.expires_at > datetime.utcnow()
    assert api_key.is_expired() is False


def test_verify_key():
    """Test verifying an API key."""
    manager = APIKeyManager()

    # Create a key
    api_key, plaintext_key = manager.create_key(name="Test Key", role=Role.ADMIN)

    # Verification should succeed
    verified_key = manager.verify_key(plaintext_key)
    assert verified_key is not None
    assert verified_key.key_id == api_key.key_id
    assert verified_key.name == api_key.name
    assert verified_key.role == api_key.role

    # Verification should fail with wrong key
    assert manager.verify_key("wrong_key") is None


def test_verify_disabled_key():
    """Test that disabled keys cannot be verified."""
    manager = APIKeyManager()

    # Create and disable a key
    api_key, plaintext_key = manager.create_key(name="Test Key", role=Role.ADMIN)
    manager.revoke_key(api_key.key_id)

    # Verification should fail
    assert manager.verify_key(plaintext_key) is None


def test_verify_expired_key():
    """Test that expired keys cannot be verified."""
    manager = APIKeyManager()

    # Create key with past expiration
    api_key, plaintext_key = manager.create_key(
        name="Expired Key",
        role=Role.VIEWER,
        expires_in_days=1,
    )

    # Manually set expiration to past
    api_key.expires_at = datetime.utcnow() - timedelta(days=1)

    # Verification should fail
    assert manager.verify_key(plaintext_key) is None


def test_list_keys():
    """Test listing all API keys."""
    manager = APIKeyManager()

    # Create multiple keys
    manager.create_key(name="Key 1", role=Role.ADMIN)
    manager.create_key(name="Key 2", role=Role.OPERATOR)
    manager.create_key(name="Key 3", role=Role.VIEWER)

    keys = manager.list_keys()
    assert len(keys) == 3
    assert keys[0].name == "Key 1"
    assert keys[1].name == "Key 2"
    assert keys[2].name == "Key 3"


def test_revoke_key():
    """Test revoking an API key."""
    manager = APIKeyManager()

    api_key, _ = manager.create_key(name="Test Key", role=Role.ADMIN)
    assert api_key.enabled is True

    # Revoke the key
    result = manager.revoke_key(api_key.key_id)
    assert result is True
    assert api_key.enabled is False

    # Revoking non-existent key should fail
    assert manager.revoke_key("non-existent-id") is False


def test_delete_key():
    """Test deleting an API key."""
    manager = APIKeyManager()

    api_key, _ = manager.create_key(name="Test Key", role=Role.ADMIN)

    # Delete the key
    result = manager.delete_key(api_key.key_id)
    assert result is True

    # Key should no longer exist
    assert manager.get_key(api_key.key_id) is None

    # Deleting non-existent key should fail
    assert manager.delete_key("non-existent-id") is False


def test_enable_key():
    """Test enabling a disabled API key."""
    manager = APIKeyManager()

    api_key, _ = manager.create_key(name="Test Key", role=Role.ADMIN)
    manager.revoke_key(api_key.key_id)
    assert api_key.enabled is False

    # Enable the key
    result = manager.enable_key(api_key.key_id)
    assert result is True
    assert api_key.enabled is True


def test_update_key_role():
    """Test updating an API key's role."""
    manager = APIKeyManager()

    api_key, _ = manager.create_key(name="Test Key", role=Role.VIEWER)
    assert api_key.role == Role.VIEWER

    # Update role
    result = manager.update_key_role(api_key.key_id, Role.ADMIN)
    assert result is True
    assert api_key.role == Role.ADMIN


def test_cleanup_expired_keys():
    """Test cleaning up expired keys."""
    manager = APIKeyManager()

    # Create keys with different expiration dates
    key1, _ = manager.create_key(name="Active Key", role=Role.ADMIN)
    key2, _ = manager.create_key(name="Expired Key 1", role=Role.OPERATOR, expires_in_days=1)
    key3, _ = manager.create_key(name="Expired Key 2", role=Role.VIEWER, expires_in_days=1)

    # Manually expire keys
    key2.expires_at = datetime.utcnow() - timedelta(days=1)
    key3.expires_at = datetime.utcnow() - timedelta(days=1)

    # Cleanup expired keys
    removed_count = manager.cleanup_expired_keys()
    assert removed_count == 2

    # Only active key should remain
    keys = manager.list_keys()
    assert len(keys) == 1
    assert keys[0].key_id == key1.key_id
