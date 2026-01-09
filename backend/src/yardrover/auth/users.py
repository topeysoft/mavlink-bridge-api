"""User management with password and PIN authentication."""

import secrets
import uuid
from datetime import datetime
from typing import Optional

import structlog
from passlib.context import CryptContext

from .models import Role, User

logger = structlog.get_logger(__name__)

# Password context for bcrypt hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hash a password using bcrypt.

    Args:
        password: Plaintext password

    Returns:
        Bcrypt hashed password
    """
    return pwd_context.hash(password)


def verify_password(plaintext_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash.

    Args:
        plaintext_password: Plaintext password provided by user
        hashed_password: Stored bcrypt hash

    Returns:
        True if password matches, False otherwise
    """
    try:
        return pwd_context.verify(plaintext_password, hashed_password)
    except Exception as e:
        logger.warning("password_verification_error", error=str(e))
        return False


def hash_pin(pin: str) -> str:
    """Hash a PIN using bcrypt.

    Args:
        pin: Plaintext PIN (4-6 digits)

    Returns:
        Bcrypt hashed PIN
    """
    return pwd_context.hash(pin)


def verify_pin(plaintext_pin: str, hashed_pin: str) -> bool:
    """Verify a PIN against its hash.

    Args:
        plaintext_pin: Plaintext PIN provided by user
        hashed_pin: Stored bcrypt hash

    Returns:
        True if PIN matches, False otherwise
    """
    try:
        return pwd_context.verify(plaintext_pin, hashed_pin)
    except Exception as e:
        logger.warning("pin_verification_error", error=str(e))
        return False


class UserManager:
    """Manager for user accounts stored in memory or persistent storage."""

    def __init__(self) -> None:
        """Initialize user manager."""
        self._users: dict[str, User] = {}
        self._username_index: dict[str, str] = {}  # username -> user_id

    def create_user(
        self,
        username: str,
        password: str,
        role: Role = Role.VIEWER,
        display_name: Optional[str] = None,
        pin: Optional[str] = None,
    ) -> User:
        """Create a new user.

        Args:
            username: Unique username
            password: Plaintext password (will be hashed)
            role: Role to assign to this user
            display_name: Optional display name
            pin: Optional PIN (4-6 digits, will be hashed)

        Returns:
            User object

        Raises:
            ValueError: If username already exists
        """
        # Check if username exists
        if username.lower() in self._username_index:
            raise ValueError(f"Username '{username}' already exists")

        # Generate unique user ID
        user_id = str(uuid.uuid4())

        # Hash password
        hashed_password = hash_password(password)

        # Hash PIN if provided
        hashed_pin = None
        if pin:
            # Validate PIN format (4-6 digits)
            if not pin.isdigit() or not (4 <= len(pin) <= 6):
                raise ValueError("PIN must be 4-6 digits")
            hashed_pin = hash_pin(pin)

        # Create user object
        user = User(
            user_id=user_id,
            username=username,
            role=role,
            hashed_password=hashed_password,
            hashed_pin=hashed_pin,
            display_name=display_name or username,
        )

        # Store in memory
        self._users[user_id] = user
        self._username_index[username.lower()] = user_id

        logger.info(
            "user_created",
            user_id=user_id,
            username=username,
            role=role.value,
            has_pin=pin is not None,
        )

        return user

    def verify_user_password(self, username: str, password: str) -> Optional[User]:
        """Verify username and password, return user if valid.

        Args:
            username: Username
            password: Plaintext password

        Returns:
            User object if valid, None otherwise
        """
        # Find user by username
        user_id = self._username_index.get(username.lower())
        if not user_id:
            logger.warning("user_login_failed", username=username, reason="user_not_found")
            return None

        user = self._users.get(user_id)
        if not user or not user.is_valid():
            logger.warning("user_login_failed", username=username, reason="user_disabled")
            return None

        # Verify password
        if not verify_password(password, user.hashed_password):
            logger.warning("user_login_failed", username=username, reason="invalid_password")
            return None

        # Update last login timestamp
        user.last_login_at = datetime.utcnow()
        logger.info("user_login_success", user_id=user.user_id, username=user.username)
        return user

    def verify_user_pin(self, pin: str) -> Optional[User]:
        """Verify PIN and return user if valid.

        Note: This searches through all users with PINs configured.
        For security, only one user should have a PIN enabled at a time.

        Args:
            pin: Plaintext PIN (4-6 digits)

        Returns:
            User object if valid, None otherwise
        """
        # Validate PIN format
        if not pin.isdigit() or not (4 <= len(pin) <= 6):
            logger.warning("pin_login_failed", reason="invalid_format")
            return None

        # Check all users with PINs
        for user in self._users.values():
            if not user.is_valid() or not user.hashed_pin:
                continue

            # Verify PIN
            if verify_pin(pin, user.hashed_pin):
                # Update last login timestamp
                user.last_login_at = datetime.utcnow()
                logger.info("user_pin_login_success", user_id=user.user_id, username=user.username)
                return user

        logger.warning("pin_login_failed", reason="invalid_pin")
        return None

    def get_user(self, user_id: str) -> Optional[User]:
        """Get a user by ID.

        Args:
            user_id: User ID

        Returns:
            User object or None if not found
        """
        return self._users.get(user_id)

    def get_user_by_username(self, username: str) -> Optional[User]:
        """Get a user by username.

        Args:
            username: Username (case-insensitive)

        Returns:
            User object or None if not found
        """
        user_id = self._username_index.get(username.lower())
        if user_id:
            return self._users.get(user_id)
        return None

    def list_users(self) -> list[User]:
        """List all users.

        Returns:
            List of User objects
        """
        return list(self._users.values())

    def change_password(self, user_id: str, old_password: str, new_password: str) -> bool:
        """Change a user's password.

        Args:
            user_id: User ID
            old_password: Current password (for verification)
            new_password: New password (min 8 chars)

        Returns:
            True if password was changed, False otherwise
        """
        user = self._users.get(user_id)
        if not user:
            logger.warning("password_change_failed", user_id=user_id, reason="user_not_found")
            return False

        # Verify old password
        if not verify_password(old_password, user.hashed_password):
            logger.warning("password_change_failed", user_id=user_id, reason="invalid_old_password")
            return False

        # Validate new password length
        if len(new_password) < 8:
            logger.warning("password_change_failed", user_id=user_id, reason="password_too_short")
            return False

        # Hash and update password
        user.hashed_password = hash_password(new_password)
        logger.info("password_changed", user_id=user_id, username=user.username)
        return True

    def set_pin(self, user_id: str, pin: str, password: str) -> bool:
        """Set or update a user's PIN.

        Args:
            user_id: User ID
            pin: New PIN (4-6 digits)
            password: Current password (for verification)

        Returns:
            True if PIN was set, False otherwise
        """
        user = self._users.get(user_id)
        if not user:
            logger.warning("set_pin_failed", user_id=user_id, reason="user_not_found")
            return False

        # Verify password
        if not verify_password(password, user.hashed_password):
            logger.warning("set_pin_failed", user_id=user_id, reason="invalid_password")
            return False

        # Validate PIN format
        if not pin.isdigit() or not (4 <= len(pin) <= 6):
            logger.warning("set_pin_failed", user_id=user_id, reason="invalid_pin_format")
            return False

        # Hash and update PIN
        user.hashed_pin = hash_pin(pin)
        logger.info("pin_set", user_id=user_id, username=user.username)
        return True

    def remove_pin(self, user_id: str, password: str) -> bool:
        """Remove a user's PIN.

        Args:
            user_id: User ID
            password: Current password (for verification)

        Returns:
            True if PIN was removed, False otherwise
        """
        user = self._users.get(user_id)
        if not user:
            logger.warning("remove_pin_failed", user_id=user_id, reason="user_not_found")
            return False

        # Verify password
        if not verify_password(password, user.hashed_password):
            logger.warning("remove_pin_failed", user_id=user_id, reason="invalid_password")
            return False

        # Remove PIN
        user.hashed_pin = None
        logger.info("pin_removed", user_id=user_id, username=user.username)
        return True

    def disable_user(self, user_id: str) -> bool:
        """Disable a user account.

        Args:
            user_id: User ID to disable

        Returns:
            True if user was disabled, False if not found
        """
        user = self._users.get(user_id)
        if not user:
            return False

        user.enabled = False
        logger.info("user_disabled", user_id=user_id, username=user.username)
        return True

    def enable_user(self, user_id: str) -> bool:
        """Enable a previously disabled user account.

        Args:
            user_id: User ID to enable

        Returns:
            True if user was enabled, False if not found
        """
        user = self._users.get(user_id)
        if not user:
            return False

        user.enabled = True
        logger.info("user_enabled", user_id=user_id, username=user.username)
        return True

    def delete_user(self, user_id: str) -> bool:
        """Delete a user permanently.

        Args:
            user_id: User ID to delete

        Returns:
            True if user was deleted, False if not found
        """
        user = self._users.get(user_id)
        if not user:
            return False

        # Remove from username index
        self._username_index.pop(user.username.lower(), None)

        # Remove from users dict
        self._users.pop(user_id)
        logger.info("user_deleted", user_id=user_id, username=user.username)
        return True

    def update_user_role(self, user_id: str, role: Role) -> bool:
        """Update the role of a user.

        Args:
            user_id: User ID
            role: New role

        Returns:
            True if updated, False if not found
        """
        user = self._users.get(user_id)
        if not user:
            return False

        old_role = user.role
        user.role = role
        logger.info(
            "user_role_updated",
            user_id=user_id,
            username=user.username,
            old_role=old_role.value,
            new_role=role.value,
        )
        return True


# Global user manager instance
_user_manager: Optional[UserManager] = None


def get_user_manager() -> UserManager:
    """Get global user manager instance.

    Returns:
        UserManager instance
    """
    global _user_manager
    if _user_manager is None:
        _user_manager = UserManager()
    return _user_manager
