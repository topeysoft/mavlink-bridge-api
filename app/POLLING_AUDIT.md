# Polling Usage Audit

This document tracks all polling usage in the YardRover app and justifies each case.

**Last Updated:** 2026-01-10

## Summary

✅ **WebSocket-First Architecture Implemented**
- All device state updates use WebSocket events
- Polling only used for external APIs and UI animations
- No internal device polling (RTCM, peripherals, monitoring all use WebSocket)

## Legitimate Polling Use Cases

### 1. **Weather Store** (`app/src/stores/weather.ts`)

**Location:** Lines 312-324
**Interval:** User-configurable (default: 10 minutes)
**Justification:** ✅ External API (OpenWeatherMap) - WebSocket not available

```typescript
function startAutoUpdate() {
  if (!isConfigured.value) return
  stopAutoUpdate()

  // Initial fetch
  fetchWeather()

  // Set up periodic updates
  const intervalMs = settings.value.updateInterval * 60 * 1000
  updateTimer.value = window.setInterval(() => {
    fetchWeather()
  }, intervalMs)
}
```

**Notes:**
- Has 10-minute cache to reduce API calls
- User can configure update frequency
- No alternative for external weather API

### 2. **Auth Store - Session Monitoring** (`app/src/stores/auth.ts`)

**Location:** Lines 287-297, 344-427
**Interval:** 60 seconds (session check), calculated auto-refresh
**Justification:** ✅ Client-side token expiry monitoring - not a backend poll

```typescript
// Check every minute for session expiry warning
sessionCheckInterval = window.setInterval(() => {
  checkSessionExpiry()
}, 60 * 1000)

// Auto-refresh access token before expiry
autoRefreshTimeout = window.setTimeout(async () => {
  await authClient.refreshAccessToken()
  startAutoRefresh(authClient)
}, actualDelay)
```

**Notes:**
- Not polling the backend - checking local token expiry
- Auto-refresh prevents session timeout
- Required for security UX (warnings before logout)

### 3. **useAutoRefresh Composable** (`app/src/composables/useAutoRefresh.ts`)

**Status:** ⚠️ **DEPRECATED for internal use**
**Interval:** User-configurable
**Justification:** ✅ Only for external APIs, kept for compatibility

```typescript
// Generic auto-refresh composable
// USE ONLY for external APIs (weather, maps, etc.)
// DO NOT use for device data - use WebSocket events instead
```

**Current Usage:**
- Weather store (external API) ✅
- No internal device usage ✅

### 4. **UI Animation Timers**

**Location:** Various UI components
**Justification:** ✅ UI animation, not data polling

Examples:
- Theme store color transitions
- Map animation updates
- Toast auto-dismiss timers
- Loading skeleton animations

**Notes:**
- These are UI effects, not data fetches
- No backend communication
- Acceptable use of setInterval/setTimeout

## Removed Polling (Now Using WebSocket)

### ✅ RTCM Status Polling - REMOVED
- **Was:** Polling every 2 seconds (`rtcm.ts:435`)
- **Now:** WebSocket `rtcm.status.changed` events
- **Commit:** 2026-01-10 - "Replace polling with WebSocket events"

### ✅ Monitoring Health Polling - REMOVED
- **Was:** Manual refresh calls
- **Now:** WebSocket `health.update` events
- **Commit:** 2026-01-10 - "Replace polling with WebSocket events"

### ✅ Peripheral Status - ALWAYS WEBSOCKET
- **Never had polling** - always used WebSocket events
- Events: `peripheral.connected`, `peripheral.telemetry`, `peripheral.status.changed`

## WebSocket Coverage

All device-related real-time data uses WebSocket events:

| Data Type | Event | Store | Status |
|-----------|-------|-------|--------|
| Battery | `mavlink.message` | battery | ✅ |
| GPS | `mavlink.message` | gps | ✅ |
| IMU | `mavlink.message` | imu | ✅ |
| Compass | `mavlink.message` | compass | ✅ |
| System Health | `health.update`, `status` | monitoring | ✅ |
| RTCM | `rtcm.status.changed` | rtcm | ✅ |
| Peripherals | `peripheral.*` | peripherals | ✅ |
| Zones | `zone.created/updated/deleted` | zones | ✅ |
| Missions | `mission.*` | missions | ✅ |
| WiFi | `wifi.*` | connection | ✅ |
| Logs | `log` | monitoring | ✅ |
| Errors | `error` | monitoring | ✅ |

## Backend WebSocket Event Coverage

From `backend/src/yardrover/models/websocket.py`:

**System Events:**
- `heartbeat` - Connection keepalive
- `health.update` - System health changes
- `status` - General status updates
- `log` - System logs
- `error` - Error messages

**Network Events:**
- `wifi.connected`, `wifi.disconnected`, `wifi.signal.update`
- `mdns.service.discovered`

**MAVLink Events:**
- `mavlink.message` - All MAVLink messages
- `telemetry.update` - Processed telemetry

**Resource Events:**
- `zone.created/updated/deleted`
- `mission.created/updated/deleted`

**RTCM Events:**
- `rtcm.status.changed`
- `rtcm.data.received`
- `rtcm.state.change`

**Peripheral Events:**
- `peripheral.connected/disconnected`
- `peripheral.status.changed`
- `peripheral.telemetry`
- `peripheral.enabled/disabled`

## Best Practices

### ✅ DO Use WebSocket For:
- Device state changes (health, status, errors)
- Real-time telemetry (battery, GPS, IMU)
- Resource updates (zones, missions)
- Connection status (WiFi, peripherals)
- RTCM data and status

### ❌ DON'T Use Polling For:
- Any device data that changes in real-time
- Status checks that can be event-driven
- Data that the backend can push via WebSocket

### ✅ DO Use Polling For:
- External APIs without WebSocket (weather, maps)
- Client-side timers (animations, UI effects)
- Token expiry checks (local validation)

## Migration Pattern

When replacing polling with WebSocket:

```typescript
// OLD: Polling pattern
const pollInterval = setInterval(async () => {
  const data = await client.getData()
  localState.value = data
}, 2000)

// NEW: WebSocket pattern
client.onDataChange((data) => {
  localState.value = data
})

// Initial fetch on mount
async function init() {
  localState.value = await client.getData()
  setupWebSocketListeners()
}
```

## Monitoring

To ensure no regressions:

1. **Browser DevTools Network Tab:**
   - Should see WebSocket connection (ws://)
   - Should NOT see repeated GET requests to same endpoint

2. **Console Logs:**
   - Look for "[Store] WebSocket event listeners setup"
   - No "polling" or "interval" messages for device data

3. **Backend Logs:**
   - WebSocket subscription messages
   - Event broadcasts to connected clients
   - No repeated API calls from same client

## Future Improvements

1. **Backend health broadcasts:** Implement periodic `health.update` events (every 10s)
2. **Telemetry throttling:** Rate-limit high-frequency MAVLink messages
3. **Reconnection handling:** Improve WebSocket reconnect UX
4. **Event buffering:** Queue events during connection loss

## Conclusion

✅ **Polling eliminated for all device data**
✅ **WebSocket-first architecture implemented**
✅ **Only external APIs and UI effects use polling**
✅ **Documentation and patterns established**

The app now follows a WebSocket-first pattern, reducing network traffic, improving real-time responsiveness, and simplifying code.
