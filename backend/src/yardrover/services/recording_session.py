"""Recording session manager

Manages active zone recording sessions with GPS waypoint collection.
"""

import uuid
from datetime import datetime
from typing import Dict, Optional

from yardrover.models.recording import (
    AnchorPoint,
    GPSWaypoint,
    RecordingConfig,
    RecordingSession,
    RecordingStatus,
)
from yardrover.utils.path_processing import haversine_distance


class RecordingSessionManager:
    """Manages active zone recording sessions"""

    def __init__(self):
        self._sessions: Dict[str, RecordingSession] = {}

    def _verify_ownership(self, session_id: str, owner_id: str) -> None:
        """Verify that the owner_id matches the session owner

        Args:
            session_id: Session identifier
            owner_id: ID of the user/API key requesting access

        Raises:
            ValueError: If session not found or ownership doesn't match
        """
        session = self._sessions.get(session_id)
        if not session:
            raise ValueError(f"Session not found: {session_id}")

        if session.owner_id != owner_id:
            raise ValueError(
                f"Access denied: session {session_id} belongs to another user"
            )

    def _update_activity(self, session_id: str) -> None:
        """Update last_activity timestamp for a session

        Args:
            session_id: Session identifier
        """
        session = self._sessions.get(session_id)
        if session:
            session.last_activity = datetime.now()

    def create_session(self, config: RecordingConfig, owner_id: str) -> str:
        """Create a new recording session

        Args:
            config: Recording configuration
            owner_id: ID of the user/API key creating the session

        Returns:
            Created session ID

        Raises:
            ValueError: If user already has an active session
        """
        # Check if owner already has an active session
        for session in self._sessions.values():
            if session.owner_id == owner_id and session.status in ["active", "paused"]:
                raise ValueError(
                    f"User already has an active recording session: {session.session_id}"
                )

        now = datetime.now()
        session_id = str(uuid.uuid4())
        session = RecordingSession(
            session_id=session_id,
            owner_id=owner_id,
            created_at=now,
            last_activity=now,
            config=config,
            status="active",
        )
        self._sessions[session_id] = session
        return session_id

    def add_waypoint(self, session_id: str, waypoint: GPSWaypoint, owner_id: str) -> bool:
        """Add waypoint to active session (perimeter mode only)

        Applies sample rate filtering - only adds waypoint if it's far enough
        from the last recorded point.

        Args:
            session_id: Session identifier
            waypoint: GPS waypoint to add
            owner_id: ID of the user/API key adding the waypoint

        Returns:
            True if waypoint was added, False if skipped due to sampling

        Raises:
            ValueError: If session not found or not active or not in perimeter mode or access denied
        """
        self._verify_ownership(session_id, owner_id)
        session = self._sessions[session_id]

        if session.config.mode != "perimeter":
            raise ValueError(f"Cannot add waypoint to {session.config.mode} mode session")

        if session.status != "active":
            raise ValueError(
                f"Cannot add waypoint to {session.status} session: {session_id}"
            )

        # Check GPS accuracy threshold
        if (
            waypoint.accuracy is not None
            and waypoint.accuracy > session.config.min_accuracy
        ):
            # Skip waypoint with poor accuracy
            return False

        # Check if we should sample this waypoint based on distance
        if len(session.waypoints) > 0:
            last = session.waypoints[-1]
            distance = haversine_distance(
                last.lat, last.lon, waypoint.lat, waypoint.lon
            )

            # Skip if too close to last waypoint
            if distance < session.config.sample_rate:
                return False

        # Add waypoint
        session.waypoints.append(waypoint)
        self._update_activity(session_id)
        return True

    def add_anchor(self, session_id: str, anchor: AnchorPoint, owner_id: str) -> bool:
        """Add anchor point to active session (anchor mode only)

        Args:
            session_id: Session identifier
            anchor: Anchor point to add
            owner_id: ID of the user/API key adding the anchor

        Returns:
            True if anchor was added

        Raises:
            ValueError: If session not found or not active or not in anchor mode
                       or max anchors exceeded or access denied
        """
        self._verify_ownership(session_id, owner_id)
        session = self._sessions[session_id]

        if session.config.mode != "anchor":
            raise ValueError(f"Cannot add anchor to {session.config.mode} mode session")

        if session.status != "active":
            raise ValueError(
                f"Cannot add anchor to {session.status} session: {session_id}"
            )

        # Check max anchors limit
        if len(session.anchors) >= session.config.max_anchors:
            raise ValueError(
                f"Maximum anchors ({session.config.max_anchors}) already reached"
            )

        # Add anchor
        session.anchors.append(anchor)
        self._update_activity(session_id)
        return True

    def update_anchor(self, session_id: str, index: int, lat: float, lon: float, owner_id: str) -> bool:
        """Update an existing anchor point position

        Args:
            session_id: Session identifier
            index: Anchor index to update
            lat: New latitude
            lon: New longitude
            owner_id: ID of the user/API key updating the anchor

        Returns:
            True if anchor was updated

        Raises:
            ValueError: If session not found or anchor index invalid or access denied
        """
        self._verify_ownership(session_id, owner_id)
        session = self._sessions[session_id]

        if session.config.mode != "anchor":
            raise ValueError(f"Cannot update anchor in {session.config.mode} mode session")

        if index < 0 or index >= len(session.anchors):
            raise ValueError(f"Invalid anchor index: {index}")

        # Update anchor position
        session.anchors[index].lat = lat
        session.anchors[index].lon = lon
        session.anchors[index].timestamp = int(datetime.now().timestamp() * 1000000)

        self._update_activity(session_id)
        return True

    def remove_anchor(self, session_id: str, index: int, owner_id: str) -> bool:
        """Remove an anchor point

        Args:
            session_id: Session identifier
            index: Anchor index to remove
            owner_id: ID of the user/API key removing the anchor

        Returns:
            True if anchor was removed

        Raises:
            ValueError: If session not found or anchor index invalid or access denied
        """
        self._verify_ownership(session_id, owner_id)
        session = self._sessions[session_id]

        if session.config.mode != "anchor":
            raise ValueError(f"Cannot remove anchor from {session.config.mode} mode session")

        if index < 0 or index >= len(session.anchors):
            raise ValueError(f"Invalid anchor index: {index}")

        # Remove anchor and re-index remaining anchors
        session.anchors.pop(index)
        for i, anchor in enumerate(session.anchors):
            anchor.index = i

        self._update_activity(session_id)
        return True

    def get_session(self, session_id: str) -> Optional[RecordingSession]:
        """Get session by ID

        Args:
            session_id: Session identifier

        Returns:
            Recording session or None if not found
        """
        return self._sessions.get(session_id)

    def pause_session(self, session_id: str, owner_id: str) -> bool:
        """Pause recording

        Args:
            session_id: Session identifier
            owner_id: ID of the user/API key pausing the session

        Returns:
            True if paused successfully

        Raises:
            ValueError: If session not found or not active or access denied
        """
        self._verify_ownership(session_id, owner_id)
        session = self._sessions[session_id]

        if session.status != "active":
            raise ValueError(f"Cannot pause {session.status} session: {session_id}")

        session.status = "paused"
        self._update_activity(session_id)
        return True

    def resume_session(self, session_id: str, owner_id: str) -> bool:
        """Resume recording

        Args:
            session_id: Session identifier
            owner_id: ID of the user/API key resuming the session

        Returns:
            True if resumed successfully

        Raises:
            ValueError: If session not found or not paused or access denied
        """
        self._verify_ownership(session_id, owner_id)
        session = self._sessions[session_id]

        if session.status != "paused":
            raise ValueError(f"Cannot resume {session.status} session: {session_id}")

        session.status = "active"
        self._update_activity(session_id)
        return True

    def complete_session(self, session_id: str, owner_id: str) -> RecordingSession:
        """Mark session as completed and return final data

        Args:
            session_id: Session identifier
            owner_id: ID of the user/API key completing the session

        Returns:
            Completed recording session

        Raises:
            ValueError: If session not found or access denied
        """
        self._verify_ownership(session_id, owner_id)
        session = self._sessions[session_id]

        session.status = "completed"
        self._update_activity(session_id)
        return session

    def delete_session(self, session_id: str) -> bool:
        """Delete session

        Args:
            session_id: Session identifier

        Returns:
            True if deleted successfully
        """
        if session_id in self._sessions:
            del self._sessions[session_id]
            return True
        return False

    def cleanup_old_sessions(self, max_age_seconds: int = 3600) -> int:
        """Clean up sessions older than max_age_seconds

        Args:
            max_age_seconds: Maximum age in seconds (default: 1 hour)

        Returns:
            Number of sessions cleaned up
        """
        now = datetime.now()
        to_delete = []

        for session_id, session in self._sessions.items():
            age = (now - session.created_at).total_seconds()
            if age > max_age_seconds:
                to_delete.append(session_id)

        for session_id in to_delete:
            del self._sessions[session_id]

        return len(to_delete)

    def get_active_session_count(self) -> int:
        """Get count of active sessions

        Returns:
            Number of active sessions
        """
        return len(self._sessions)
