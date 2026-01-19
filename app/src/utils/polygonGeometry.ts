/**
 * Polygon geometry utilities for mission path clipping
 *
 * Handles point-in-polygon testing and line-polygon clipping
 * for constraining generated paths to zone boundaries.
 *
 * Coordinate format: [lng, lat] (GeoJSON standard)
 */

// Types - using GeoJSON format [lng, lat]
export type Coordinate = [number, number] // [lng, lat]
export type Polygon = Coordinate[]
export type LineSegment = [Coordinate, Coordinate]

export interface Bounds {
  minLat: number
  maxLat: number
  minLng: number
  maxLng: number
}

/**
 * Check if a point is inside a polygon using ray casting algorithm
 *
 * Algorithm: Cast a horizontal ray from the test point eastward.
 * Count intersections with polygon edges. Odd count = inside, even = outside.
 *
 * @param point - [lng, lat] coordinate to test
 * @param polygon - Array of [lng, lat] coordinates defining polygon vertices
 * @returns true if point is inside polygon
 */
export function isPointInPolygon(point: Coordinate, polygon: Polygon): boolean {
  const [lng, lat] = point
  let inside = false

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const pi = polygon[i]
    const pj = polygon[j]
    if (!pi || !pj) continue

    const [xi, yi] = pi // [lng, lat]
    const [xj, yj] = pj // [lng, lat]

    const intersect =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi

    if (intersect) inside = !inside
  }

  return inside
}

/**
 * Fast point-in-polygon with bounding box pre-check
 *
 * @param point - [lng, lat] coordinate to test
 * @param polygon - Array of [lng, lat] coordinates
 * @param bounds - Pre-computed bounding box for quick rejection
 * @returns true if point is inside polygon
 */
export function isPointInPolygonFast(
  point: Coordinate,
  polygon: Polygon,
  bounds: Bounds
): boolean {
  const [lng, lat] = point

  // Quick bounding box rejection
  if (
    lat < bounds.minLat ||
    lat > bounds.maxLat ||
    lng < bounds.minLng ||
    lng > bounds.maxLng
  ) {
    return false
  }

  return isPointInPolygon(point, polygon)
}

/**
 * Calculate intersection point of two line segments
 *
 * Uses parametric form of line equations to find intersection.
 *
 * @param p1 - Start of first segment
 * @param p2 - End of first segment
 * @param p3 - Start of second segment
 * @param p4 - End of second segment
 * @returns Intersection coordinate or null if segments don't intersect
 */
export function lineSegmentIntersection(
  p1: Coordinate,
  p2: Coordinate,
  p3: Coordinate,
  p4: Coordinate
): Coordinate | null {
  const [x1, y1] = p1
  const [x2, y2] = p2
  const [x3, y3] = p3
  const [x4, y4] = p4

  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)

  // Lines are parallel
  if (Math.abs(denom) < 1e-10) return null

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom

  // Check if intersection is within both segments
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return [x1 + t * (x2 - x1), y1 + t * (y2 - y1)]
  }

  return null
}

/**
 * Find all intersections between a line and polygon edges
 *
 * @param lineStart - Start of line segment
 * @param lineEnd - End of line segment
 * @param polygon - Polygon to test against
 * @returns Array of intersection coordinates
 */
export function findLinePolygonIntersections(
  lineStart: Coordinate,
  lineEnd: Coordinate,
  polygon: Polygon
): Coordinate[] {
  const intersections: Coordinate[] = []

  for (let i = 0; i < polygon.length; i++) {
    const edgeStart = polygon[i]
    const edgeEnd = polygon[(i + 1) % polygon.length]
    if (!edgeStart || !edgeEnd) continue

    const intersection = lineSegmentIntersection(
      lineStart,
      lineEnd,
      edgeStart,
      edgeEnd
    )

    if (intersection) {
      intersections.push(intersection)
    }
  }

  return intersections
}

/**
 * Clip a line segment to polygon boundary
 *
 * Returns array of segments that are inside the polygon.
 * For concave polygons, a single line may produce multiple segments.
 *
 * @param lineStart - Start of line segment [lng, lat]
 * @param lineEnd - End of line segment [lng, lat]
 * @param polygon - Polygon to clip against
 * @returns Array of line segments that are inside the polygon
 */
export function clipLineToPolygon(
  lineStart: Coordinate,
  lineEnd: Coordinate,
  polygon: Polygon
): LineSegment[] {
  // Find all intersections with polygon
  const intersections = findLinePolygonIntersections(lineStart, lineEnd, polygon)

  // If no intersections, check if entire line is inside or outside
  if (intersections.length === 0) {
    // Check midpoint
    const midpoint: Coordinate = [
      (lineStart[0] + lineEnd[0]) / 2,
      (lineStart[1] + lineEnd[1]) / 2
    ]

    if (isPointInPolygon(midpoint, polygon)) {
      return [[lineStart, lineEnd]]
    }
    return []
  }

  // Build list of all points along the line
  const allPoints: Coordinate[] = [lineStart, ...intersections, lineEnd]

  // Sort by distance from start
  allPoints.sort((a, b) => {
    const distA = Math.hypot(a[0] - lineStart[0], a[1] - lineStart[1])
    const distB = Math.hypot(b[0] - lineStart[0], b[1] - lineStart[1])
    return distA - distB
  })

  // Remove duplicates (points very close together)
  const firstPoint = allPoints[0]
  if (!firstPoint) return []

  const uniquePoints: Coordinate[] = [firstPoint]
  for (let i = 1; i < allPoints.length; i++) {
    const prev = uniquePoints[uniquePoints.length - 1]
    const curr = allPoints[i]
    if (!prev || !curr) continue
    const dist = Math.hypot(curr[0] - prev[0], curr[1] - prev[1])
    if (dist > 1e-10) {
      uniquePoints.push(curr)
    }
  }

  // Build segments, keeping only those inside polygon
  const segments: LineSegment[] = []

  for (let i = 0; i < uniquePoints.length - 1; i++) {
    const segStart = uniquePoints[i]
    const segEnd = uniquePoints[i + 1]
    if (!segStart || !segEnd) continue

    // Test midpoint of segment
    const midpoint: Coordinate = [
      (segStart[0] + segEnd[0]) / 2,
      (segStart[1] + segEnd[1]) / 2
    ]

    if (isPointInPolygon(midpoint, polygon)) {
      segments.push([segStart, segEnd])
    }
  }

  return segments
}

/**
 * Calculate minimum distance from point to polygon edge (in coordinate units)
 *
 * Used for edge mode calculations. Returns approximate distance in degrees.
 * For accurate meter distances, multiply by ~111,000 for latitude.
 *
 * @param point - [lng, lat] coordinate
 * @param polygon - Polygon to test against
 * @returns Minimum distance to any polygon edge
 */
export function minDistanceToPolygonEdge(
  point: Coordinate,
  polygon: Polygon
): number {
  let minDist = Infinity
  const [px, py] = point

  for (let i = 0; i < polygon.length; i++) {
    const pa = polygon[i]
    const pb = polygon[(i + 1) % polygon.length]
    if (!pa || !pb) continue

    const [ax, ay] = pa
    const [bx, by] = pb

    // Vector from a to b
    const abx = bx - ax
    const aby = by - ay

    // Vector from a to point
    const apx = px - ax
    const apy = py - ay

    // Project point onto line segment
    const abLen = abx * abx + aby * aby
    let t = abLen > 0 ? (apx * abx + apy * aby) / abLen : 0
    t = Math.max(0, Math.min(1, t))

    // Closest point on segment
    const closestX = ax + t * abx
    const closestY = ay + t * aby

    // Distance to closest point
    const dist = Math.hypot(px - closestX, py - closestY)
    minDist = Math.min(minDist, dist)
  }

  return minDist
}

/**
 * Ensure polygon is closed (first and last points match)
 *
 * @param polygon - Polygon to check
 * @returns Closed polygon (may be same reference if already closed)
 */
export function ensurePolygonClosed(polygon: Polygon): Polygon {
  if (polygon.length < 3) return polygon

  const first = polygon[0]
  const last = polygon[polygon.length - 1]
  if (!first || !last) return polygon

  // Check if already closed
  if (first[0] === last[0] && first[1] === last[1]) {
    return polygon
  }

  return [...polygon, first]
}

/**
 * Calculate bounding box for polygon
 *
 * @param polygon - Polygon coordinates
 * @returns Bounding box with min/max lat/lng
 */
export function calculatePolygonBounds(polygon: Polygon): Bounds {
  let minLat = Infinity
  let maxLat = -Infinity
  let minLng = Infinity
  let maxLng = -Infinity

  for (const coord of polygon) {
    if (!coord) continue
    const [lng, lat] = coord
    minLat = Math.min(minLat, lat)
    maxLat = Math.max(maxLat, lat)
    minLng = Math.min(minLng, lng)
    maxLng = Math.max(maxLng, lng)
  }

  return { minLat, maxLat, minLng, maxLng }
}

/**
 * Convert a line segment into a rectangular strip polygon
 *
 * Creates a rectangle centered on the line with specified width.
 * Returns polygon vertices in counter-clockwise order.
 *
 * @param start - [lng, lat] start point
 * @param end - [lng, lat] end point
 * @param widthMeters - strip width in meters
 * @param centerLat - reference latitude for meters-to-degrees conversion
 * @returns Polygon vertices forming the strip rectangle
 */
export function lineToStripPolygon(
  start: Coordinate,
  end: Coordinate,
  widthMeters: number,
  centerLat: number
): Polygon {
  // Convert half-width from meters to degrees
  // Latitude: 1 degree ≈ 111,320 meters
  // Longitude: 1 degree ≈ 111,320 * cos(lat) meters
  const halfWidthMeters = widthMeters / 2
  const metersPerDegreeLat = 111320
  const metersPerDegreeLng = 111320 * Math.cos(centerLat * Math.PI / 180)

  // Calculate direction vector of the line in meters
  const dxDeg = end[0] - start[0] // longitude delta in degrees
  const dyDeg = end[1] - start[1] // latitude delta in degrees
  const dxMeters = dxDeg * metersPerDegreeLng
  const dyMeters = dyDeg * metersPerDegreeLat

  const lengthMeters = Math.hypot(dxMeters, dyMeters)

  if (lengthMeters === 0) return []

  // Perpendicular unit vector in meters (90 degrees rotated)
  // For a vector (dx, dy), perpendicular is (-dy, dx)
  const perpXMeters = -dyMeters / lengthMeters
  const perpYMeters = dxMeters / lengthMeters

  // Scale perpendicular to half-width and convert back to degrees
  const offsetLng = (perpXMeters * halfWidthMeters) / metersPerDegreeLng
  const offsetLat = (perpYMeters * halfWidthMeters) / metersPerDegreeLat

  // Create rectangle vertices (counter-clockwise for proper polygon winding)
  return [
    [start[0] - offsetLng, start[1] - offsetLat], // start left
    [end[0] - offsetLng, end[1] - offsetLat], // end left
    [end[0] + offsetLng, end[1] + offsetLat], // end right
    [start[0] + offsetLng, start[1] + offsetLat], // start right
    [start[0] - offsetLng, start[1] - offsetLat] // close polygon
  ]
}

/**
 * Check if a point is on the left side of an edge (for polygon clipping)
 */
function isPointOnLeftOfEdge(
  point: Coordinate,
  edgeStart: Coordinate,
  edgeEnd: Coordinate
): boolean {
  return (
    (edgeEnd[0] - edgeStart[0]) * (point[1] - edgeStart[1]) -
      (edgeEnd[1] - edgeStart[1]) * (point[0] - edgeStart[0]) >=
    0
  )
}

/**
 * Find intersection of two infinite lines (not segments)
 * Used for Sutherland-Hodgman clipping
 */
function lineLineIntersection(
  p1: Coordinate,
  p2: Coordinate,
  p3: Coordinate,
  p4: Coordinate
): Coordinate | null {
  const [x1, y1] = p1
  const [x2, y2] = p2
  const [x3, y3] = p3
  const [x4, y4] = p4

  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)

  if (Math.abs(denom) < 1e-10) return null

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom

  return [x1 + t * (x2 - x1), y1 + t * (y2 - y1)]
}

/**
 * Calculate signed area of polygon (positive = CCW, negative = CW)
 */
function signedPolygonArea(polygon: Polygon): number {
  let area = 0
  for (let i = 0; i < polygon.length; i++) {
    const p1 = polygon[i]
    const p2 = polygon[(i + 1) % polygon.length]
    if (!p1 || !p2) continue
    area += (p2[0] - p1[0]) * (p2[1] + p1[1])
  }
  return area / 2
}

/**
 * Ensure polygon has counter-clockwise winding order
 */
function ensureCCW(polygon: Polygon): Polygon {
  if (polygon.length < 3) return polygon
  const area = signedPolygonArea(polygon)
  // If area is positive, polygon is CW in screen coords (y-down) which means CCW for lat/lng
  // For geographic coords where y (lat) increases upward, negative area = CCW
  if (area > 0) {
    return [...polygon].reverse()
  }
  return polygon
}

/**
 * Clip a subject polygon against a clip polygon using Sutherland-Hodgman algorithm
 *
 * Used for clipping coverage strips to zone boundaries.
 *
 * @param subject - Polygon to be clipped (e.g., the strip rectangle)
 * @param clipPolygon - Polygon to clip against (e.g., the zone boundary)
 * @returns Clipped polygon (may be empty if no intersection)
 */
export function clipPolygonToPolygon(
  subject: Polygon,
  clipPolygon: Polygon
): Polygon {
  if (subject.length < 3 || clipPolygon.length < 3) return []

  // Ensure clip polygon is CCW for correct inside/outside determination
  const clip = ensureCCW(ensurePolygonClosed(clipPolygon))
  let output = [...subject]

  // Get number of edges (closed polygon has n vertices and n edges)
  const numEdges = clip.length > 0 &&
    clip[0]![0] === clip[clip.length - 1]![0] &&
    clip[0]![1] === clip[clip.length - 1]![1]
    ? clip.length - 1
    : clip.length

  // Process each edge of the clip polygon
  for (let i = 0; i < numEdges; i++) {
    if (output.length === 0) return []

    const edgeStart = clip[i]
    const edgeEnd = clip[(i + 1) % clip.length]
    if (!edgeStart || !edgeEnd) continue

    const input = output
    output = []

    // Process each edge of the subject polygon
    for (let j = 0; j < input.length; j++) {
      const current = input[j]
      const next = input[(j + 1) % input.length]
      if (!current || !next) continue

      const currentInside = isPointOnLeftOfEdge(current, edgeStart, edgeEnd)
      const nextInside = isPointOnLeftOfEdge(next, edgeStart, edgeEnd)

      if (currentInside) {
        if (nextInside) {
          // Both inside: keep next point
          output.push(next)
        } else {
          // Current inside, next outside: add intersection
          const intersection = lineLineIntersection(current, next, edgeStart, edgeEnd)
          if (intersection) output.push(intersection)
        }
      } else if (nextInside) {
        // Current outside, next inside: add intersection and next
        const intersection = lineLineIntersection(current, next, edgeStart, edgeEnd)
        if (intersection) output.push(intersection)
        output.push(next)
      }
      // Both outside: add nothing
    }
  }

  // Close the output polygon if needed
  if (output.length > 0) {
    const first = output[0]
    const last = output[output.length - 1]
    if (first && last && (first[0] !== last[0] || first[1] !== last[1])) {
      output.push(first)
    }
  }

  return output
}
