"""Path processing utilities for GPS data

GPS calculations, polygon area computation, and path simplification algorithms.
"""

import math
from typing import List, Tuple


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two GPS points using Haversine formula

    Args:
        lat1: First point latitude in decimal degrees
        lon1: First point longitude in decimal degrees
        lat2: Second point latitude in decimal degrees
        lon2: Second point longitude in decimal degrees

    Returns:
        Distance in meters
    """
    # Earth radius in meters
    R = 6371000

    # Convert degrees to radians
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)

    # Haversine formula
    a = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c


def calculate_path_length(waypoints: List[Tuple[float, float]]) -> float:
    """Calculate total path length from a list of GPS coordinates

    Args:
        waypoints: List of (lat, lon) tuples

    Returns:
        Total path length in meters
    """
    if len(waypoints) < 2:
        return 0.0

    total = 0.0
    for i in range(len(waypoints) - 1):
        lat1, lon1 = waypoints[i]
        lat2, lon2 = waypoints[i + 1]
        total += haversine_distance(lat1, lon1, lat2, lon2)

    return total


def calculate_polygon_area(waypoints: List[Tuple[float, float]]) -> float:
    """Calculate polygon area using shoelace formula

    For GPS coordinates, we project to a local coordinate system first
    to get approximate area in square meters.

    Args:
        waypoints: List of (lat, lon) tuples forming a polygon

    Returns:
        Area in square meters
    """
    if len(waypoints) < 3:
        return 0.0

    # Find center point for local projection
    center_lat = sum(lat for lat, lon in waypoints) / len(waypoints)
    center_lon = sum(lon for lat, lon in waypoints) / len(waypoints)

    # Project to local XY coordinates (meters from center)
    def to_xy(lat: float, lon: float) -> Tuple[float, float]:
        # Approximate meters per degree at this latitude
        meters_per_deg_lat = 111132.92  # fairly constant
        meters_per_deg_lon = 111132.92 * math.cos(math.radians(center_lat))

        x = (lon - center_lon) * meters_per_deg_lon
        y = (lat - center_lat) * meters_per_deg_lat
        return x, y

    xy_points = [to_xy(lat, lon) for lat, lon in waypoints]

    # Shoelace formula on projected coordinates
    area = 0.0
    for i in range(len(xy_points)):
        x1, y1 = xy_points[i]
        x2, y2 = xy_points[(i + 1) % len(xy_points)]
        area += x1 * y2 - x2 * y1

    return abs(area) / 2.0


def simplify_path_douglas_peucker(
    waypoints: List[Tuple[float, float]], tolerance: float
) -> List[Tuple[float, float]]:
    """Simplify a path using the Douglas-Peucker algorithm

    Args:
        waypoints: List of (lat, lon) tuples
        tolerance: Maximum allowed perpendicular distance in meters

    Returns:
        Simplified list of waypoints
    """
    if len(waypoints) < 3:
        return waypoints

    def perpendicular_distance(
        point: Tuple[float, float],
        line_start: Tuple[float, float],
        line_end: Tuple[float, float],
    ) -> float:
        """Calculate perpendicular distance from point to line segment"""
        # Calculate distance using haversine for accuracy
        # For simplicity, we use a projected approximation
        x0, y0 = point
        x1, y1 = line_start
        x2, y2 = line_end

        # Project to local meters
        center_lat = (y0 + y1 + y2) / 3
        meters_per_deg_lat = 111132.92
        meters_per_deg_lon = 111132.92 * math.cos(math.radians(center_lat))

        def to_meters(lat: float, lon: float) -> Tuple[float, float]:
            return lon * meters_per_deg_lon, lat * meters_per_deg_lat

        p0 = to_meters(y0, x0)
        p1 = to_meters(y1, x1)
        p2 = to_meters(y2, x2)

        # Vector from line start to end
        dx = p2[0] - p1[0]
        dy = p2[1] - p1[1]
        line_length_sq = dx * dx + dy * dy

        if line_length_sq == 0:
            # Line start and end are the same point
            return math.sqrt((p0[0] - p1[0]) ** 2 + (p0[1] - p1[1]) ** 2)

        # Calculate parameter t (projection of point onto line)
        t = max(
            0,
            min(1, ((p0[0] - p1[0]) * dx + (p0[1] - p1[1]) * dy) / line_length_sq),
        )

        # Find closest point on line segment
        closest_x = p1[0] + t * dx
        closest_y = p1[1] + t * dy

        # Return distance
        return math.sqrt((p0[0] - closest_x) ** 2 + (p0[1] - closest_y) ** 2)

    def douglas_peucker_recursive(
        points: List[Tuple[float, float]], epsilon: float
    ) -> List[Tuple[float, float]]:
        """Recursive Douglas-Peucker implementation"""
        if len(points) < 3:
            return points

        # Find point with maximum distance from line start->end
        max_distance = 0.0
        max_index = 0
        for i in range(1, len(points) - 1):
            distance = perpendicular_distance(points[i], points[0], points[-1])
            if distance > max_distance:
                max_distance = distance
                max_index = i

        # If max distance is greater than epsilon, recursively simplify
        if max_distance > epsilon:
            # Recursive call on both segments
            left_result = douglas_peucker_recursive(points[: max_index + 1], epsilon)
            right_result = douglas_peucker_recursive(points[max_index:], epsilon)

            # Combine results (remove duplicate middle point)
            return left_result[:-1] + right_result
        else:
            # All points can be approximated by line start->end
            return [points[0], points[-1]]

    return douglas_peucker_recursive(waypoints, tolerance)


def detect_closure(waypoints: List[Tuple[float, float]], threshold: float = 2.0) -> bool:
    """Detect if a path returns to its starting point

    Args:
        waypoints: List of (lat, lon) tuples
        threshold: Maximum distance in meters to consider closed

    Returns:
        True if path is closed within threshold
    """
    if len(waypoints) < 4:
        return False

    first = waypoints[0]
    last = waypoints[-1]

    distance = haversine_distance(first[0], first[1], last[0], last[1])
    return distance <= threshold


def close_polygon(
    waypoints: List[Tuple[float, float]]
) -> List[Tuple[float, float]]:
    """Ensure polygon is closed by adding first point at end if needed

    Args:
        waypoints: List of (lat, lon) tuples

    Returns:
        Closed polygon waypoints
    """
    if len(waypoints) < 2:
        return waypoints

    # Check if already closed
    if waypoints[0] == waypoints[-1]:
        return waypoints

    # Add first point to end
    return waypoints + [waypoints[0]]
