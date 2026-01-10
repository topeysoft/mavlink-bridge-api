# Zone Recording Testing Guide

**Created**: 2026-01-09
**Status**: Ready for Manual Testing
**Implementation**: Phases 1 & 2 Complete

## Overview

This guide walks you through testing the zone recording feature, which has two modes:
1. **Perimeter Recording** ("Walk the Edge") - GPS-based boundary tracing
2. **Anchor Recording** ("Mark the Corners") - Point-and-click zone creation

## Prerequisites

### 1. Backend Running
```bash
cd backend
export YARDROVER_ENVIRONMENT=development
.venv/bin/python -m yardrover.main
```

Expected output:
```
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### 2. Frontend Running
```bash
cd app
npm run dev
```

Expected output:
```
VITE v7.3.0  ready in XXX ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

### 3. Authentication Setup

The app requires authentication. You should have:
- An admin user account created (via setup wizard on first boot)
- Or a valid API key

If you haven't set up authentication:
1. Navigate to `http://localhost:5173`
2. Complete the setup wizard
3. Create an admin account

## Test Plan

### Phase 1: Perimeter Recording ("Walk the Edge")

#### Test 1.1: Start Perimeter Recording Session

**Steps:**
1. Navigate to Zones view (`http://localhost:5173/zones`)
2. Click the **"📍 Record Zone"** button
3. Modal should open with two mode options
4. **"Walk the Edge"** mode should be selected by default
5. Click **"Start Recording"**

**Expected Results:**
- ✅ Modal displays instructions: "Drive or guide the rover around the perimeter"
- ✅ "Start Recording" button is prominent and clickable
- ✅ Success notification: "Recording started - drive around the perimeter"
- ✅ Map component appears showing live GPS position
- ✅ Recording controls (Pause/Resume/Stop) are visible

**Failure Modes:**
- ❌ "Not connected to device" error → Backend not running or not authenticated
- ❌ API error → Check browser console and backend logs

#### Test 1.2: Simulate GPS Waypoints

Since we may not have live GPS data, we'll test the API directly:

**Option A: Use Browser Console**

Open browser DevTools Console and run:

```javascript
// Get the client from the connection store
const client = window.__app__?.$stores?.connection?.client

if (!client) {
  console.error('Client not available. Make sure you are connected.')
} else {
  // Simulate adding waypoints
  const sessionId = 'your-session-id-here' // Get this from the recording modal state

  // Add a waypoint
  client.recording.addWaypoint(sessionId, {
    lat: 37.7749,
    lon: -122.4194,
    accuracy: 2.5,
    timestamp: Date.now() * 1000
  }).then(() => console.log('Waypoint added'))
}
```

**Option B: Use MAVLink GPS Messages**

If you have MAVLink integration:
1. The WebSocket connection should automatically capture `GLOBAL_POSITION_INT` messages
2. These will be sent to the backend as waypoints
3. The map should show a live trail of GPS points

**Expected Results:**
- ✅ Waypoints appear as markers on the map
- ✅ Polyline connects waypoints showing the path
- ✅ Stats panel updates:
  - Waypoint count increases
  - Estimated area updates (when 3+ points form a polygon)
  - Estimated perimeter updates
- ✅ Map auto-fits bounds to show all waypoints

#### Test 1.3: Pause and Resume

**Steps:**
1. While recording, click **"Pause"**
2. Verify status changes to paused
3. Click **"Resume"**
4. Verify recording continues

**Expected Results:**
- ✅ Pause button toggles to "Resume" state
- ✅ Waypoint collection stops when paused
- ✅ Waypoint collection resumes when resumed
- ✅ Backend session status reflects pause/resume state

#### Test 1.4: Complete Recording and Save Zone

**Steps:**
1. Click **"Stop Recording"**
2. Enter a zone name (e.g., "Front Lawn")
3. Click **"Save Zone"**

**Expected Results:**
- ✅ Name input screen appears with zone preview
- ✅ Preview shows simplified polygon (fewer points than original waypoints)
- ✅ Stats show final area and perimeter
- ✅ Success notification: "Zone 'Front Lawn' created successfully"
- ✅ Modal closes
- ✅ New zone appears in zones list

#### Test 1.5: Cancel Recording

**Steps:**
1. Start a new recording session
2. Add some waypoints
3. Click the **"✕"** close button
4. Confirm cancellation in the dialog

**Expected Results:**
- ✅ Confirmation dialog appears: "Discard recording?"
- ✅ Clicking "Cancel" keeps the modal open
- ✅ Clicking "Confirm" closes the modal
- ✅ Session is deleted on backend
- ✅ No zone is created

---

### Phase 2: Anchor Recording ("Mark the Corners")

#### Test 2.1: Start Anchor Recording Session

**Steps:**
1. Navigate to Zones view
2. Click **"📍 Record Zone"**
3. Select **"Mark the Corners"** mode
4. Click **"Start Recording"**

**Expected Results:**
- ✅ Mode selector shows both "Walk the Edge" and "Mark the Corners"
- ✅ Active mode is highlighted in green
- ✅ Success notification: "Recording started - click on the map to mark corners"
- ✅ Map displays with instruction overlay
- ✅ Instructions: "Click on the map to place anchor points"

#### Test 2.2: Place Anchor Points

**Steps:**
1. Click 4 times on different locations on the map to form a rectangle
2. Observe numbered markers appearing (1, 2, 3, 4)
3. Check that a polygon preview appears after 3+ anchors

**Expected Results:**
- ✅ Numbered markers (1️⃣, 2️⃣, 3️⃣, 4️⃣) appear at click locations
- ✅ Live polygon preview connects the anchors
- ✅ Anchor stats component shows:
  - Anchor count: 4
  - Shape type: "Rectangle ⬛" (if near-rectangular)
  - Estimated area (in user's preferred units)
  - Estimated perimeter
- ✅ Polygon boundary is interpolated smoothly

#### Test 2.3: Auto-Squaring Detection

**Steps:**
1. Place 4 anchors forming a roughly rectangular shape
2. Ensure corners are close to 90° angles (within 10° threshold)
3. Observe the shape type indicator

**Expected Results:**
- ✅ Shape type shows "Rectangle ⬛"
- ✅ Angles are automatically adjusted to exactly 90°
- ✅ Polygon appears with clean, perpendicular edges

**Other Shape Types to Test:**
- **Triangle** (3 anchors): Should show "Triangle 🔺"
- **L-Shape** (6 anchors forming an L): Should show "L-Shape 📐"
- **Irregular** (5+ random anchors): Should show "Custom 🔷"

#### Test 2.4: Edit Anchors (Drag to Adjust)

**Steps:**
1. Hover over an existing anchor marker
2. Click and drag the marker to a new position
3. Release to update

**Expected Results:**
- ✅ Marker follows cursor while dragging
- ✅ Polygon preview updates in real-time
- ✅ Stats panel updates (area, perimeter, shape type)
- ✅ Backend is notified of anchor position change

#### Test 2.5: Delete Anchors

**Steps:**
1. Hover over an anchor marker
2. Delete button (×) appears on the marker
3. Click the × button

**Expected Results:**
- ✅ Hover reveals delete button (×) on marker
- ✅ Clicking × removes the anchor immediately
- ✅ Remaining anchors are re-numbered (e.g., if anchor 2 is deleted, anchor 3 becomes anchor 2)
- ✅ Polygon preview updates
- ✅ Stats panel updates

#### Test 2.6: Complete Anchor Recording and Save Zone

**Steps:**
1. With 3+ anchors placed, click **"Stop Recording"**
2. Enter a zone name (e.g., "Backyard")
3. Click **"Save Zone"**

**Expected Results:**
- ✅ Name input screen shows with final polygon preview
- ✅ Preview displays interpolated boundary (not just anchor points)
- ✅ Stats show final area, perimeter, and shape type
- ✅ Success notification: "Zone 'Backyard' created successfully"
- ✅ Modal closes
- ✅ New zone appears in zones list with correct geometry

#### Test 2.7: Validation Errors

**Minimum Anchors Test:**
1. Start anchor recording
2. Place only 2 anchors
3. Try to complete recording

**Expected Results:**
- ❌ "Stop Recording" button should be disabled (or show error)
- ❌ Backend rejects completion with error: "Need at least 3 anchors"

**Maximum Anchors Test:**
1. Try to place more than 20 anchors (default max)
2. Click to add anchor #21

**Expected Results:**
- ❌ Error notification: "Maximum 20 anchors allowed"
- ❌ Anchor is not added

---

## API Testing (Optional - Advanced)

If you want to test the backend API directly without the UI:

### Prerequisites
```bash
# Get a valid JWT token by logging in via the frontend
# Then extract the token from localStorage or browser DevTools
TOKEN="your-jwt-token-here"
```

### Test Perimeter Recording API

```bash
# Start session
SESSION_ID=$(curl -X POST http://localhost:8000/api/zones/recording/start \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "mode": "perimeter",
    "sampleRate": 1.0,
    "minAccuracy": 3.0,
    "autoClose": true,
    "autoSimplify": true,
    "simplifyTolerance": 0.5
  }' | python3 -c "import sys, json; print(json.load(sys.stdin)['session_id'])")

echo "Session ID: $SESSION_ID"

# Add waypoints
curl -X POST "http://localhost:8000/api/zones/recording/$SESSION_ID/waypoint" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "lat": 37.7749,
    "lon": -122.4194,
    "accuracy": 2.5,
    "timestamp": 1673308800000000
  }'

# Get status
curl "http://localhost:8000/api/zones/recording/$SESSION_ID/status" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# Complete recording
curl -X POST "http://localhost:8000/api/zones/recording/$SESSION_ID/complete" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

### Test Anchor Recording API

```bash
# Start anchor session
SESSION_ID=$(curl -X POST http://localhost:8000/api/zones/recording/start \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "mode": "anchor",
    "autoSquare": true,
    "snapAngleThreshold": 10.0,
    "minAnchors": 3,
    "maxAnchors": 20
  }' | python3 -c "import sys, json; print(json.load(sys.stdin)['session_id'])")

# Add anchors (rectangle corners)
curl -X POST "http://localhost:8000/api/zones/recording/$SESSION_ID/anchor" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"lat": 37.7749, "lon": -122.4194, "index": 0, "timestamp": 1673308800000000}'

curl -X POST "http://localhost:8000/api/zones/recording/$SESSION_ID/anchor" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"lat": 37.7750, "lon": -122.4194, "index": 1, "timestamp": 1673308800000000}'

curl -X POST "http://localhost:8000/api/zones/recording/$SESSION_ID/anchor" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"lat": 37.7750, "lon": -122.4195, "index": 2, "timestamp": 1673308800000000}'

curl -X POST "http://localhost:8000/api/zones/recording/$SESSION_ID/anchor" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"lat": 37.7749, "lon": -122.4195, "index": 3, "timestamp": 1673308800000000}'

# Get status (should show shape type "rectangle")
curl "http://localhost:8000/api/zones/recording/$SESSION_ID/status" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# Complete recording
curl -X POST "http://localhost:8000/api/zones/recording/$SESSION_ID/complete" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

---

## Troubleshooting

### Issue: "Not connected to device"

**Cause:** Frontend can't access the client instance

**Solutions:**
1. Ensure backend is running on `http://localhost:8000`
2. Check that you've completed authentication setup
3. Verify connection store has a valid client:
   ```javascript
   console.log(window.__app__?.$stores?.connection?.client)
   ```

### Issue: "Authentication required"

**Cause:** Missing or invalid JWT token

**Solutions:**
1. Log in via the frontend UI
2. Check browser DevTools → Application → Local Storage for auth token
3. Ensure `Authorization: Bearer <token>` header is set

### Issue: TypeScript errors during build

**Cause:** Pre-existing type safety issues (not related to zone recording)

**Solutions:**
- These errors don't block the build (`npm run build-only` succeeds)
- Use `npm run build-only` to skip type checking
- Type errors can be fixed incrementally (not blocking for testing)

### Issue: Map doesn't show anchors/waypoints

**Possible Causes:**
1. Leaflet not initialized properly
2. Coordinates out of map bounds
3. CSS z-index issues

**Solutions:**
1. Check browser console for Leaflet errors
2. Verify map component is rendering: look for `<div class="leaflet-container">`
3. Try zooming out on the map
4. Check that coordinates are valid GPS coordinates (lat: -90 to 90, lon: -180 to 180)

### Issue: Polygon preview doesn't appear

**Possible Causes:**
1. Less than 3 anchors placed
2. Backend interpolation error

**Solutions:**
1. Ensure you have at least 3 anchors
2. Check backend logs for interpolation errors
3. Verify API `/status` endpoint returns `estimated_area` and `estimated_perimeter`

---

## Success Criteria

### Phase 1 (Perimeter Recording) - Complete When:
- ✅ Can start a perimeter recording session
- ✅ Waypoints are captured and displayed on map
- ✅ Can pause/resume recording
- ✅ Can complete recording and see simplified path
- ✅ Can save zone with a name
- ✅ Zone appears in zones list with correct geometry
- ✅ Can cancel recording without saving

### Phase 2 (Anchor Recording) - Complete When:
- ✅ Can start an anchor recording session
- ✅ Can place anchor points by clicking on map
- ✅ Numbered markers appear for each anchor
- ✅ Polygon preview shows interpolated boundary
- ✅ Shape detection works (rectangle, L-shape, triangle, custom)
- ✅ Auto-squaring works for near-90° angles
- ✅ Can drag anchors to adjust position
- ✅ Can delete anchors via × button
- ✅ Can complete recording and save zone
- ✅ Validation prevents completion with <3 anchors

---

## Next Steps After Testing

1. **Bug Fixes**: Document any bugs found and create issues
2. **UX Improvements**: Note any confusing interactions
3. **Performance**: Check for slowdowns with many waypoints/anchors
4. **Edge Cases**: Test with invalid data, network errors, etc.
5. **Documentation**: Update main docs with testing results
6. **Production Readiness**: Add unit/integration tests for critical paths

---

## Quick Reference: API Endpoints

### Common Endpoints
- `POST /api/zones/recording/start` - Start session (perimeter or anchor mode)
- `GET /api/zones/recording/{id}/status` - Get session status
- `POST /api/zones/recording/{id}/pause` - Pause session
- `POST /api/zones/recording/{id}/resume` - Resume session
- `POST /api/zones/recording/{id}/complete` - Complete and process zone
- `DELETE /api/zones/recording/{id}` - Cancel session

### Perimeter Mode Specific
- `POST /api/zones/recording/{id}/waypoint` - Add GPS waypoint

### Anchor Mode Specific
- `POST /api/zones/recording/{id}/anchor` - Add anchor point
- `PUT /api/zones/recording/{id}/anchor/{index}` - Update anchor position
- `DELETE /api/zones/recording/{id}/anchor/{index}` - Remove anchor

---

**Happy Testing! 🚀**
