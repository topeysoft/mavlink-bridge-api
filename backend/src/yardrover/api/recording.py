"""Zone recording API endpoints

REST API for GPS-based zone boundary recording.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status

from yardrover.auth import SecurityContext, require_operator, require_viewer
from yardrover.models.recording import (
    AnchorPoint,
    GPSWaypoint,
    RecordingCompleteResponse,
    RecordingConfig,
    RecordingStartResponse,
    RecordingStatusResponse,
)
from yardrover.services.recording_session import RecordingSessionManager
from yardrover.utils.anchor_interpolation import (
    detect_shape_type,
    interpolate_polygon_from_anchors,
    validate_anchors,
)
from yardrover.utils.path_processing import (
    calculate_path_length,
    calculate_polygon_area,
    close_polygon,
    detect_closure,
    simplify_path_douglas_peucker,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/zones/recording", tags=["zone-recording"])

# Global session manager
_session_manager: Optional[RecordingSessionManager] = None


def get_session_manager() -> RecordingSessionManager:
    """Get or create the global session manager"""
    global _session_manager
    if _session_manager is None:
        _session_manager = RecordingSessionManager()
    return _session_manager


@router.post("/start", response_model=RecordingStartResponse)
async def start_recording(
    config: RecordingConfig,
    context: SecurityContext = Depends(require_operator),
) -> RecordingStartResponse:
    """Start a new zone recording session

    Creates a new recording session and begins collecting GPS waypoints.

    Args:
        config: Recording configuration

    Returns:
        Session information with session ID
    """
    try:
        manager = get_session_manager()
        session_id = manager.create_session(config, owner_id=context.subject_id)

        logger.info(
            f"Recording session started: {session_id} by {context.subject_name}"
        )

        return RecordingStartResponse(session_id=session_id, status="active")
    except ValueError as e:
        # User already has active session
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )
    except Exception as e:
        logger.error(f"Failed to start recording: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start recording: {str(e)}",
        )


@router.post("/{session_id}/waypoint", status_code=status.HTTP_204_NO_CONTENT)
async def add_waypoint(
    session_id: str,
    waypoint: GPSWaypoint,
    context: SecurityContext = Depends(require_operator),
):
    """Add a GPS waypoint to the recording session

    Waypoints are filtered based on GPS accuracy and sample rate configuration.

    Args:
        session_id: Recording session ID
        waypoint: GPS waypoint data

    Raises:
        HTTPException: 404 if session not found, 400 if session not active
    """
    try:
        manager = get_session_manager()
        added = manager.add_waypoint(session_id, waypoint, owner_id=context.subject_id)

        if added:
            logger.debug(f"Waypoint added to session {session_id}: ({waypoint.lat}, {waypoint.lon})")

    except ValueError as e:
        if "not found" in str(e):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=str(e)
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)
            )
    except Exception as e:
        logger.error(f"Failed to add waypoint: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add waypoint: {str(e)}",
        )


@router.post("/{session_id}/pause", status_code=status.HTTP_204_NO_CONTENT)
async def pause_recording(
    session_id: str,
    context: SecurityContext = Depends(require_operator),
):
    """Pause the recording session

    Paused sessions can be resumed later.

    Args:
        session_id: Recording session ID

    Raises:
        HTTPException: 404 if session not found, 400 if cannot pause
    """
    try:
        manager = get_session_manager()
        manager.pause_session(session_id, owner_id=context.subject_id)
        logger.info(f"Recording session paused: {session_id}")
    except ValueError as e:
        if "not found" in str(e):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=str(e)
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)
            )
    except Exception as e:
        logger.error(f"Failed to pause recording: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to pause recording: {str(e)}",
        )


@router.post("/{session_id}/resume", status_code=status.HTTP_204_NO_CONTENT)
async def resume_recording(
    session_id: str,
    context: SecurityContext = Depends(require_operator),
):
    """Resume a paused recording session

    Args:
        session_id: Recording session ID

    Raises:
        HTTPException: 404 if session not found, 400 if cannot resume
    """
    try:
        manager = get_session_manager()
        manager.resume_session(session_id, owner_id=context.subject_id)
        logger.info(f"Recording session resumed: {session_id}")
    except ValueError as e:
        if "not found" in str(e):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=str(e)
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)
            )
    except Exception as e:
        logger.error(f"Failed to resume recording: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to resume recording: {str(e)}",
        )


@router.get("/{session_id}/status", response_model=RecordingStatusResponse)
async def get_recording_status(
    session_id: str,
    context: SecurityContext = Depends(require_viewer),
) -> RecordingStatusResponse:
    """Get current status of recording session

    Returns session metadata including waypoint count and estimated area/perimeter.

    Args:
        session_id: Recording session ID

    Returns:
        Current session status

    Raises:
        HTTPException: 404 if session not found
    """
    try:
        manager = get_session_manager()
        session = manager.get_session(session_id)

        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Session not found: {session_id}",
            )

        # Calculate estimated area and perimeter based on mode
        estimated_area = None
        estimated_perimeter = None
        shape_type = None

        if session.config.mode == "perimeter":
            # Perimeter mode - use waypoints
            waypoints = [(w.lat, w.lon) for w in session.waypoints]
            if len(waypoints) >= 3:
                estimated_area = calculate_polygon_area(waypoints)
                estimated_perimeter = calculate_path_length(waypoints)
        elif session.config.mode == "anchor":
            # Anchor mode - use anchors
            anchors = [(a.lat, a.lon) for a in session.anchors]
            if len(anchors) >= 3:
                # Interpolate polygon from anchors
                try:
                    polygon = interpolate_polygon_from_anchors(
                        anchors,
                        auto_square=session.config.auto_square,
                        snap_angle_threshold=session.config.snap_angle_threshold,
                    )
                    estimated_area = calculate_polygon_area(polygon)
                    estimated_perimeter = calculate_path_length(polygon)
                    shape_type = detect_shape_type(anchors)
                except ValueError:
                    # Not enough anchors yet
                    pass

        return RecordingStatusResponse(
            session_id=session.session_id,
            status=session.status,
            mode=session.config.mode,
            waypoint_count=len(session.waypoints),
            anchor_count=len(session.anchors),
            estimated_area=estimated_area,
            estimated_perimeter=estimated_perimeter,
            shape_type=shape_type,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get recording status: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get recording status: {str(e)}",
        )


@router.post("/{session_id}/complete", response_model=RecordingCompleteResponse)
async def complete_recording(
    session_id: str,
    context: SecurityContext = Depends(require_operator),
) -> RecordingCompleteResponse:
    """Complete recording and process the path into a zone

    Applies path simplification, closure detection, and calculates final metrics.

    Args:
        session_id: Recording session ID

    Returns:
        Completed recording with zone preview

    Raises:
        HTTPException: 404 if session not found, 400 if insufficient waypoints
    """
    try:
        manager = get_session_manager()
        session = manager.complete_session(session_id, owner_id=context.subject_id)

        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Session not found: {session_id}",
            )

        # Process based on mode
        if session.config.mode == "perimeter":
            # Perimeter mode - process waypoints
            # Validate minimum waypoints
            if len(session.waypoints) < 3:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Insufficient waypoints: need at least 3, got {len(session.waypoints)}",
                )

            # Extract coordinates
            waypoints = [(w.lat, w.lon) for w in session.waypoints]
            original_count = len(waypoints)

            # Auto-close polygon if configured
            if session.config.auto_close and detect_closure(
                waypoints, threshold=session.config.sample_rate * 2
            ):
                waypoints = close_polygon(waypoints)
                logger.info(f"Auto-closed polygon for session {session_id}")

            # Simplify path if configured
            simplified_waypoints = waypoints
            if session.config.auto_simplify:
                simplified_waypoints = simplify_path_douglas_peucker(
                    waypoints, session.config.simplify_tolerance
                )
                logger.info(
                    f"Simplified path from {len(waypoints)} to {len(simplified_waypoints)} points"
                )

            # Calculate final metrics
            area = calculate_polygon_area(simplified_waypoints)
            perimeter = calculate_path_length(simplified_waypoints)

            # Create GeoJSON preview
            zone_preview = {
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [
                        [[lon, lat] for lat, lon in simplified_waypoints]
                    ],
                },
                "properties": {
                    "area": area,
                    "perimeter": perimeter,
                    "waypoint_count": len(simplified_waypoints),
                },
            }

            logger.info(
                f"Recording session completed: {session_id} - "
                f"{original_count} waypoints, {len(simplified_waypoints)} simplified, "
                f"{area:.2f} m², {perimeter:.2f} m perimeter"
            )

            return RecordingCompleteResponse(
                session_id=session_id,
                zone_preview=zone_preview,
                waypoint_count=original_count,
                simplified_count=len(simplified_waypoints),
                area=area,
                perimeter=perimeter,
            )

        elif session.config.mode == "anchor":
            # Anchor mode - process anchors
            anchors = [(a.lat, a.lon) for a in session.anchors]

            # Validate anchors
            is_valid, error_msg = validate_anchors(
                anchors,
                min_anchors=session.config.min_anchors,
                max_anchors=session.config.max_anchors,
            )
            if not is_valid:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=error_msg,
                )

            # Interpolate polygon from anchors
            try:
                polygon = interpolate_polygon_from_anchors(
                    anchors,
                    auto_square=session.config.auto_square,
                    snap_angle_threshold=session.config.snap_angle_threshold,
                )
            except ValueError as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=str(e),
                )

            # Calculate final metrics
            area = calculate_polygon_area(polygon)
            perimeter = calculate_path_length(polygon)
            shape_type = detect_shape_type(anchors)

            # Create GeoJSON preview
            zone_preview = {
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [
                        [[lon, lat] for lat, lon in polygon]
                    ],
                },
                "properties": {
                    "area": area,
                    "perimeter": perimeter,
                    "anchor_count": len(anchors),
                    "shape_type": shape_type,
                },
            }

            logger.info(
                f"Recording session completed (anchor mode): {session_id} - "
                f"{len(anchors)} anchors, {shape_type} shape, "
                f"{area:.2f} m², {perimeter:.2f} m perimeter"
            )

            return RecordingCompleteResponse(
                session_id=session_id,
                zone_preview=zone_preview,
                waypoint_count=len(anchors),
                simplified_count=len(polygon),
                area=area,
                perimeter=perimeter,
            )

        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown recording mode: {session.config.mode}",
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to complete recording: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to complete recording: {str(e)}",
        )


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_recording(
    session_id: str,
    context: SecurityContext = Depends(require_operator),
):
    """Cancel and delete a recording session

    Args:
        session_id: Recording session ID

    Raises:
        HTTPException: 404 if session not found
    """
    try:
        manager = get_session_manager()
        deleted = manager.delete_session(session_id)

        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Session not found: {session_id}",
            )

        logger.info(f"Recording session cancelled: {session_id}")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to cancel recording: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to cancel recording: {str(e)}",
        )


# Anchor mode specific endpoints


@router.post("/{session_id}/anchor", status_code=status.HTTP_201_CREATED)
async def add_anchor(
    session_id: str,
    anchor: AnchorPoint,
    context: SecurityContext = Depends(require_operator),
):
    """Add an anchor point to the recording session (anchor mode only)

    Args:
        session_id: Recording session ID
        anchor: Anchor point data

    Raises:
        HTTPException: 404 if session not found, 400 if not anchor mode or max anchors reached
    """
    try:
        manager = get_session_manager()
        manager.add_anchor(session_id, anchor, owner_id=context.subject_id)
        logger.debug(f"Anchor added to session {session_id}: ({anchor.lat}, {anchor.lon})")

    except ValueError as e:
        if "not found" in str(e):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=str(e)
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)
            )
    except Exception as e:
        logger.error(f"Failed to add anchor: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add anchor: {str(e)}",
        )


@router.put("/{session_id}/anchor/{index}", status_code=status.HTTP_204_NO_CONTENT)
async def update_anchor(
    session_id: str,
    index: int,
    lat: float,
    lon: float,
    context: SecurityContext = Depends(require_operator),
):
    """Update an existing anchor point position

    Args:
        session_id: Recording session ID
        index: Anchor index to update
        lat: New latitude
        lon: New longitude

    Raises:
        HTTPException: 404 if session not found, 400 if invalid index or not anchor mode
    """
    try:
        manager = get_session_manager()
        manager.update_anchor(session_id, index, lat, lon, owner_id=context.subject_id)
        logger.debug(f"Anchor {index} updated in session {session_id}: ({lat}, {lon})")

    except ValueError as e:
        if "not found" in str(e):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=str(e)
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)
            )
    except Exception as e:
        logger.error(f"Failed to update anchor: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update anchor: {str(e)}",
        )


@router.delete("/{session_id}/anchor/{index}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_anchor(
    session_id: str,
    index: int,
    context: SecurityContext = Depends(require_operator),
):
    """Remove an anchor point

    Args:
        session_id: Recording session ID
        index: Anchor index to remove

    Raises:
        HTTPException: 404 if session not found, 400 if invalid index or not anchor mode
    """
    try:
        manager = get_session_manager()
        manager.remove_anchor(session_id, index, owner_id=context.subject_id)
        logger.info(f"Anchor {index} removed from session {session_id}")

    except ValueError as e:
        if "not found" in str(e):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=str(e)
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)
            )
    except Exception as e:
        logger.error(f"Failed to remove anchor: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to remove anchor: {str(e)}",
        )
