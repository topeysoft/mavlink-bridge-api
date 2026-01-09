"""JWT token generation and validation."""

import uuid
from datetime import datetime, timedelta
from typing import Literal, Optional

import structlog
from jose import JWTError, jwt

from .models import Role, TokenData

logger = structlog.get_logger(__name__)

# Token types
TokenType = Literal["access", "refresh"]


class JWTHandler:
    """Handler for JWT token operations."""

    def __init__(
        self,
        secret_key: str,
        algorithm: str = "HS256",
        access_token_expire_minutes: int = 15,  # 15 minutes for access tokens
        refresh_token_expire_days: int = 7,  # 7 days for refresh tokens
    ):
        """Initialize JWT handler.

        Args:
            secret_key: Secret key for JWT signing
            algorithm: JWT algorithm (default: HS256)
            access_token_expire_minutes: Access token expiration in minutes
            refresh_token_expire_days: Refresh token expiration in days
        """
        self.secret_key = secret_key
        self.algorithm = algorithm
        self.access_token_expire_minutes = access_token_expire_minutes
        self.refresh_token_expire_days = refresh_token_expire_days

    def create_access_token(
        self,
        subject: str,
        role: Role,
        permissions: list[str],
        expires_delta: Optional[timedelta] = None,
    ) -> str:
        """Create a JWT access token (short-lived, used for API requests).

        Args:
            subject: Subject (API key ID or username)
            role: User role
            permissions: List of permissions
            expires_delta: Optional custom expiration delta

        Returns:
            Encoded JWT access token
        """
        now = datetime.utcnow()
        if expires_delta:
            expire = now + expires_delta
        else:
            expire = now + timedelta(minutes=self.access_token_expire_minutes)

        jti = str(uuid.uuid4())  # Unique token ID

        to_encode = {
            "sub": subject,
            "jti": jti,
            "type": "access",
            "role": role.value,
            "permissions": [str(p) for p in permissions],
            "exp": expire,
            "iat": now,
        }

        encoded_jwt = jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)

        logger.info(
            "access_token_created",
            subject=subject,
            jti=jti,
            role=role.value,
            expires_at=expire.isoformat(),
        )

        return encoded_jwt

    def create_refresh_token(
        self,
        subject: str,
        role: Role,
        expires_delta: Optional[timedelta] = None,
    ) -> tuple[str, str]:
        """Create a JWT refresh token (long-lived, used to get new access tokens).

        Args:
            subject: Subject (API key ID or username)
            role: User role
            expires_delta: Optional custom expiration delta

        Returns:
            Tuple of (encoded JWT refresh token, jti)
        """
        now = datetime.utcnow()
        if expires_delta:
            expire = now + expires_delta
        else:
            expire = now + timedelta(days=self.refresh_token_expire_days)

        jti = str(uuid.uuid4())  # Unique token ID for tracking

        to_encode = {
            "sub": subject,
            "jti": jti,
            "type": "refresh",
            "role": role.value,
            "exp": expire,
            "iat": now,
        }

        encoded_jwt = jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)

        logger.info(
            "refresh_token_created",
            subject=subject,
            jti=jti,
            role=role.value,
            expires_at=expire.isoformat(),
        )

        return encoded_jwt, jti

    def verify_token(
        self,
        token: str,
        expected_type: Optional[TokenType] = None
    ) -> Optional[TokenData]:
        """Verify and decode a JWT token.

        Args:
            token: JWT token to verify
            expected_type: Expected token type ("access" or "refresh"), or None for backward compat

        Returns:
            TokenData if valid, None if invalid or expired
        """
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])

            # Extract data
            subject: str = payload.get("sub")
            if subject is None:
                logger.warning("jwt_verification_failed", reason="missing_subject")
                return None

            role_str: str = payload.get("role")
            if role_str is None:
                logger.warning("jwt_verification_failed", reason="missing_role")
                return None

            try:
                role = Role(role_str)
            except ValueError:
                logger.warning("jwt_verification_failed", reason="invalid_role", role=role_str)
                return None

            # Validate token type if specified
            token_type = payload.get("type")
            if expected_type and token_type != expected_type:
                logger.warning(
                    "jwt_verification_failed",
                    reason="invalid_token_type",
                    expected=expected_type,
                    actual=token_type,
                )
                return None

            permissions = payload.get("permissions", [])
            exp = payload.get("exp")
            iat = payload.get("iat")
            jti = payload.get("jti")

            # Convert timestamps
            exp_dt = datetime.fromtimestamp(exp) if exp else None
            iat_dt = datetime.fromtimestamp(iat) if iat else None

            token_data = TokenData(
                sub=subject,
                role=role,
                permissions=permissions,
                exp=exp_dt,
                iat=iat_dt,
                jti=jti,
                token_type=token_type,
            )

            logger.debug(
                "jwt_token_verified",
                subject=subject,
                role=role.value,
                type=token_type or "legacy",
            )
            return token_data

        except JWTError as e:
            logger.warning("jwt_verification_failed", error=str(e), error_type=type(e).__name__)
            return None
        except Exception as e:
            logger.error("jwt_verification_error", error=str(e), error_type=type(e).__name__)
            return None


# Global JWT handler instance
_jwt_handler: Optional[JWTHandler] = None


def initialize_jwt_handler(
    secret_key: str,
    algorithm: str = "HS256",
    access_token_expire_minutes: int = 15,
    refresh_token_expire_days: int = 7,
) -> JWTHandler:
    """Initialize global JWT handler.

    Args:
        secret_key: Secret key for JWT signing
        algorithm: JWT algorithm
        access_token_expire_minutes: Access token expiration in minutes
        refresh_token_expire_days: Refresh token expiration in days

    Returns:
        JWTHandler instance
    """
    global _jwt_handler
    _jwt_handler = JWTHandler(
        secret_key,
        algorithm,
        access_token_expire_minutes,
        refresh_token_expire_days,
    )
    logger.info(
        "jwt_handler_initialized",
        algorithm=algorithm,
        access_token_expire_minutes=access_token_expire_minutes,
        refresh_token_expire_days=refresh_token_expire_days,
    )
    return _jwt_handler


def get_jwt_handler() -> JWTHandler:
    """Get global JWT handler instance.

    Returns:
        JWTHandler instance

    Raises:
        RuntimeError: If JWT handler not initialized
    """
    if _jwt_handler is None:
        raise RuntimeError("JWT handler not initialized. Call initialize_jwt_handler() first.")
    return _jwt_handler


def create_access_token(
    subject: str,
    role: Role,
    permissions: list[str],
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Create a JWT access token using global handler.

    Args:
        subject: Subject (API key ID or username)
        role: User role
        permissions: List of permissions
        expires_delta: Optional custom expiration delta

    Returns:
        Encoded JWT token
    """
    handler = get_jwt_handler()
    return handler.create_access_token(subject, role, permissions, expires_delta)


def verify_token(token: str) -> Optional[TokenData]:
    """Verify a JWT token using global handler.

    Args:
        token: JWT token to verify

    Returns:
        TokenData if valid, None otherwise
    """
    handler = get_jwt_handler()
    return handler.verify_token(token)
