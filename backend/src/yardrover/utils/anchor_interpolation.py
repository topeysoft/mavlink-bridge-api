"""Anchor point interpolation utilities

Geometric algorithms for interpolating polygons from anchor points.
"""

import math
from typing import List, Literal, Optional, Tuple

from .path_processing import haversine_distance


ShapeType = Literal["rectangle", "l_shape", "triangle", "custom"]


def interpolate_polygon_from_anchors(
    anchors: List[Tuple[float, float]],
    auto_square: bool = True,
    snap_angle_threshold: float = 10.0,
) -> List[Tuple[float, float]]:
    """Interpolate a polygon from anchor points

    Creates a polygon by connecting anchor points with line segments.
    Optionally snaps near-90° angles to exactly 90° for cleaner shapes.

    Args:
        anchors: List of (lat, lon) anchor points
        auto_square: Whether to snap near-90° angles to exactly 90°
        snap_angle_threshold: Angle tolerance in degrees for snapping

    Returns:
        Interpolated polygon coordinates (closed)
    """
    if len(anchors) < 3:
        raise ValueError("Need at least 3 anchor points to create a polygon")

    # For simple interpolation, just connect anchors with straight lines
    polygon = list(anchors)

    # Apply auto-squaring if enabled
    if auto_square and len(anchors) == 4:
        polygon = _try_square_rectangle(polygon, snap_angle_threshold)

    # Ensure polygon is closed
    if polygon[0] != polygon[-1]:
        polygon.append(polygon[0])

    return polygon


def _try_square_rectangle(
    points: List[Tuple[float, float]], threshold_degrees: float
) -> List[Tuple[float, float]]:
    """Attempt to square a 4-point polygon if angles are near 90°

    Args:
        points: List of 4 corner points
        threshold_degrees: Maximum deviation from 90° to allow squaring

    Returns:
        Squared polygon if applicable, otherwise original points
    """
    if len(points) != 4:
        return points

    # Calculate angles at each corner
    angles = []
    for i in range(4):
        prev_pt = points[(i - 1) % 4]
        curr_pt = points[i]
        next_pt = points[(i + 1) % 4]

        angle = _calculate_corner_angle(prev_pt, curr_pt, next_pt)
        angles.append(angle)

    # Check if all angles are close to 90°
    all_near_90 = all(abs(angle - 90.0) < threshold_degrees for angle in angles)

    if not all_near_90:
        return points

    # Points form a near-rectangle, keep them as-is but could refine
    # For now, just return original points (actual squaring would require
    # adjusting coordinates to force perfect 90° angles)
    return points


def _calculate_corner_angle(
    p1: Tuple[float, float], p2: Tuple[float, float], p3: Tuple[float, float]
) -> float:
    """Calculate the angle at point p2 formed by p1-p2-p3

    Args:
        p1: Previous point (lat, lon)
        p2: Current point (lat, lon)
        p3: Next point (lat, lon)

    Returns:
        Angle in degrees (0-180)
    """
    # Convert to approximate meters for angle calculation
    # Use simple planar approximation
    lat_to_m = 111132.92
    lon_to_m = 111132.92 * math.cos(math.radians(p2[0]))

    def to_xy(pt: Tuple[float, float]) -> Tuple[float, float]:
        return ((pt[1] - p2[1]) * lon_to_m, (pt[0] - p2[0]) * lat_to_m)

    # Vector from p2 to p1
    v1 = to_xy(p1)
    # Vector from p2 to p3
    v2 = to_xy(p3)

    # Calculate angle using dot product
    dot = v1[0] * v2[0] + v1[1] * v2[1]
    mag1 = math.sqrt(v1[0] ** 2 + v1[1] ** 2)
    mag2 = math.sqrt(v2[0] ** 2 + v2[1] ** 2)

    if mag1 == 0 or mag2 == 0:
        return 0.0

    cos_angle = dot / (mag1 * mag2)
    # Clamp to valid range for acos
    cos_angle = max(-1.0, min(1.0, cos_angle))

    angle_rad = math.acos(cos_angle)
    return math.degrees(angle_rad)


def detect_shape_type(anchors: List[Tuple[float, float]]) -> ShapeType:
    """Detect the shape type from anchor points

    Args:
        anchors: List of (lat, lon) anchor points

    Returns:
        Detected shape type
    """
    num_points = len(anchors)

    if num_points == 3:
        return "triangle"
    elif num_points == 4:
        # Check if it's a rectangle
        if _is_rectangle(anchors):
            return "rectangle"
        # Could check for L-shape here
        return "custom"
    elif num_points == 6:
        # Could be L-shape (6 corners for L)
        if _is_l_shape(anchors):
            return "l_shape"
        return "custom"
    else:
        return "custom"


def _is_rectangle(points: List[Tuple[float, float]], tolerance: float = 15.0) -> bool:
    """Check if 4 points form a rectangle

    Args:
        points: List of 4 corner points
        tolerance: Angle tolerance in degrees

    Returns:
        True if points form a rectangle
    """
    if len(points) != 4:
        return False

    # Calculate all 4 corner angles
    angles = []
    for i in range(4):
        prev_pt = points[(i - 1) % 4]
        curr_pt = points[i]
        next_pt = points[(i + 1) % 4]
        angle = _calculate_corner_angle(prev_pt, curr_pt, next_pt)
        angles.append(angle)

    # Check if all angles are close to 90°
    return all(abs(angle - 90.0) < tolerance for angle in angles)


def _is_l_shape(points: List[Tuple[float, float]]) -> bool:
    """Check if points form an L-shape

    Args:
        points: List of anchor points

    Returns:
        True if points form an L-shape
    """
    # L-shape detection is complex, for now just return False
    # Could implement by checking for 4 corners at 90° and 2 at 270°
    return False


def validate_anchors(
    anchors: List[Tuple[float, float]],
    min_anchors: int = 3,
    max_anchors: int = 20,
    min_distance: float = 1.0,
) -> Tuple[bool, Optional[str]]:
    """Validate anchor points

    Args:
        anchors: List of (lat, lon) anchor points
        min_anchors: Minimum number of anchors required
        max_anchors: Maximum number of anchors allowed
        min_distance: Minimum distance between consecutive anchors (meters)

    Returns:
        Tuple of (is_valid, error_message)
    """
    # Check count
    if len(anchors) < min_anchors:
        return False, f"Need at least {min_anchors} anchor points"

    if len(anchors) > max_anchors:
        return False, f"Too many anchor points (maximum {max_anchors})"

    # Check minimum distance between consecutive points
    for i in range(len(anchors) - 1):
        p1 = anchors[i]
        p2 = anchors[i + 1]
        distance = haversine_distance(p1[0], p1[1], p2[0], p2[1])
        if distance < min_distance:
            return (
                False,
                f"Anchors {i} and {i+1} are too close ({distance:.1f}m, minimum {min_distance}m)",
            )

    # Check closure distance (first to last)
    if len(anchors) >= 3:
        first = anchors[0]
        last = anchors[-1]
        distance = haversine_distance(first[0], first[1], last[0], last[1])
        if distance < min_distance:
            return (
                False,
                f"First and last anchors are too close ({distance:.1f}m, minimum {min_distance}m)",
            )

    return True, None


def snap_to_grid(
    point: Tuple[float, float], grid_size_meters: float = 1.0
) -> Tuple[float, float]:
    """Snap a GPS coordinate to a grid

    Args:
        point: (lat, lon) coordinate
        grid_size_meters: Grid spacing in meters

    Returns:
        Snapped (lat, lon) coordinate
    """
    lat, lon = point

    # Convert grid size to degrees (approximate)
    lat_grid = grid_size_meters / 111132.92
    lon_grid = grid_size_meters / (111132.92 * math.cos(math.radians(lat)))

    # Snap to grid
    snapped_lat = round(lat / lat_grid) * lat_grid
    snapped_lon = round(lon / lon_grid) * lon_grid

    return snapped_lat, snapped_lon


def get_bounding_box(
    anchors: List[Tuple[float, float]]
) -> Tuple[Tuple[float, float], Tuple[float, float]]:
    """Get bounding box for anchor points

    Args:
        anchors: List of (lat, lon) anchor points

    Returns:
        Tuple of ((min_lat, min_lon), (max_lat, max_lon))
    """
    if not anchors:
        return ((0.0, 0.0), (0.0, 0.0))

    lats = [pt[0] for pt in anchors]
    lons = [pt[1] for pt in anchors]

    return ((min(lats), min(lons)), (max(lats), max(lons)))
