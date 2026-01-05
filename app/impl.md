## Client Integration Plan

### Phase 1: Core Client Setup & Connection Management

1. **Add client library dependency** to UI-Prototype app package.json
   - Link to local `@mavlinkbridge/api-client` using `file:../../client`
   - Ensure client is built before app development

2. **Create connection store** ([app/src/stores/connection.ts](app/src/stores/connection.ts))
   - Import `MAVLinkBridgeClient`, `createClient`, `discoverDevices` from client
   - Manage device discovery (mDNS + network scanning)
   - Handle client connection/disconnection lifecycle
   - WebSocket connection state management
   - Store connected device URL and client instance

3. **Create device discovery service** ([app/src/services/device.ts](app/src/services/device.ts))
   - Wrap client's `discoverDevices()` function
   - Handle continuous discovery with `startContinuousDiscovery()`
   - Parse discovered device info (name, IP, services)

### Phase 2: Real-time Data Integration

1. **Update vehicle store** ([app/src/stores/vehicle.ts](app/src/stores/vehicle.ts))
   - Replace mock `sendCommand()` with `client.mavlink.arm()`, `client.mavlink.disarm()`, `client.mavlink.setMode()`
   - Subscribe to WebSocket events for real-time vehicle state updates
   - Use client's `MAVLinkCommandClient` for all MAVLink commands

2. **Update monitoring store** ([app/src/stores/monitoring.ts](app/src/stores/monitoring.ts))
   - Replace mock telemetry with `client.health.getHealth()` and WebSocket health events
   - Subscribe to `client.onStatus()`, `client.onError()`, `client.onLog()` events
   - Real-time MAVLink message streaming via WebSocket

3. **Update parameters store** ([app/src/stores/parameters.ts](app/src/stores/parameters.ts))
   - Replace mock parameters with `client.parameters.listParameters()`
   - Implement real `loadParametersFromVehicle()` using `client.parameters.getParameter()`
   - Implement real `saveParametersToVehicle()` using `client.parameters.setParameter()`
   - Use client's parameter validation and definitions

### Phase 3: Mission & Task Management

1. **Update missions store** ([app/src/stores/missions.ts](app/src/stores/missions.ts))
   - Replace mock mission upload with `client.mission.uploadMission()`
   - Replace mock mission download with `client.mission.downloadMission()`
   - Use `client.mission.clearMission()`, `client.mission.setCurrentItem()`
   - Subscribe to mission progress events via WebSocket

2. **Integrate task client** (new store: [app/src/stores/tasks.ts](app/src/stores/tasks.ts))
   - Use `client.tasks.createTask()`, `client.tasks.executeTask()`
   - Task list management with `client.tasks.listTasks()`
   - Task templates and zone-based task creation

### Phase 4: System Features

1. **WiFi & Configuration**
   - Create WiFi store using `client.wifi.connect()`, `client.wifi.scan()`, `client.wifi.getStatus()`
   - Create config store using `client.config.getConfiguration()`, `client.config.updateConfiguration()`
   - Real-time WiFi status updates via WebSocket events

2. **Health & RTCM**
    - Integrate `client.health.getHealth()` for comprehensive system health
    - RTCM corrections via `client.rtcm.start()`, `client.rtcm.stop()`, `client.rtcm.getStatus()`
    - Subscribe to RTCM data events

### Phase 5: Error Handling & UX

1. **Global error handling**
    - Catch `HttpError` from client API calls
    - Display user-friendly error notifications
    - Automatic reconnection on WebSocket disconnect

2. **Loading states**
    - Show spinners during API calls
    - Skeleton loaders for initial data fetching
    - Connection status indicators

### Implementation Order

1. Phase 1 (Connection) → Foundation for everything
2. Phase 2 (Real-time Data) → Core monitoring features
3. Phase 3 (Missions) → Primary user workflows
4. Phase 4 (System Features) → Complete integration
5. Phase 5 (Polish) → Production-ready UX
