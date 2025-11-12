# LOKAL TRANSIT APP - Comprehensive UI Architecture Map

## Executive Summary

Lokal is a transit planning application built with Next.js (React), Mapbox, and TRPC. The app operates in two main modes: **Explore Mode** (browse bus routes) and **Plan Mode** (find journeys). It features real-time bus tracking, journey planning, saved journeys/routes, user authentication, and sharing capabilities.

---

## 1. Main Pages & Entry Points

### 1.1 Home Page (`/` - `/src/app/page.tsx`)

**Purpose**: Main application hub with map and sidebar navigation

**Key Features**:
- Two-mode UI: Explore vs Plan mode
- Real-time geolocation tracking (navigator.geolocation.watchPosition)
- Journey planning with multiple destinations
- Itinerary selection and visualization
- Support for loading saved items via URL parameter (`?itemId=`)

**State Management**:
```typescript
- mode: "explore" | "plan"
- userLocation: { latitude, longitude } | null
- selectedRoute: RouteSummary | null
- journeyStops: LocationSearchResult[]
- planItineraries: PlanItinerary[] | null
- planStatus: "idle" | "loading" | "success" | "error"
- selectedItineraryIndex: number
```

**Data Flow**:
1. User enables location → Mapbox map centers on user
2. User searches for destination → Add stop
3. Journey stops updated → Auto-plan triggered (debounced)
4. Directions API called → Itineraries generated
5. User selects itinerary → Map visualizes route with legs

**Key Interactions**:
- Mode toggle: Explore Bus Lines ↔ Plan Journey
- Add/remove destinations via sidebar search
- Click itinerary → View step-by-step directions
- Save journey → Opens SaveJourneyDialog

---

### 1.2 Route Detail Page (`/route/[id]` - `/src/app/route/[id]/page.tsx`)

**Purpose**: Shareable public route detail page

**Features**:
- Public access (no auth required to view)
- Display all stops with sequence and estimated times
- Save/bookmark functionality (requires auth)
- Share button (copy to clipboard)
- "View on Map" navigation to home page with selected route

**Interactions**:
- Save/Unsave route → Updates saved items
- Share button → Copy URL to clipboard with confirmation feedback
- View on Map → Navigates to `/?routeId=[id]`

**Auth Flow**:
- If unauthenticated, shows sign-up prompt when trying to save

---

### 1.3 API Documentation (`/docs` - `/src/app/docs/page.tsx`)

**Purpose**: Interactive Swagger UI for HTTP API

**Implementation**:
- Dynamic import with SSR disabled (client-side only)
- Serves OpenAPI spec from `/api/docs`
- No user interaction with main app

---

### 1.4 Deleted Pages (In Git)

Pages marked for deletion (visible in git status):
- `journeys/page.tsx` - Likely replaced by sidebar button linking to saved items
- No explicit replacement, handled via SavedItemsDialog instead

---

## 2. Core Components Architecture

### 2.1 RoutesSidebar (`/src/app/_components/routes-sidebar.tsx`)

**The main orchestrator** - Handles 90% of user interactions

**Sidebar Views** (mutually exclusive):
1. **routes** - Explore mode: browse bus lines
2. **places** - Plan mode: search destinations
3. **route-options** - Plan mode: show available itineraries
4. **step-by-step** - Plan mode: detailed leg-by-leg directions
5. **saved** - View saved items (dialog, not sidebar view)

**View Transitions**:
```
routes ↔ places ↔ route-options → step-by-step ↔ route-options
                                     ↓
                            SaveJourneyDialog
```

**Key Functionality**:

#### Location Search (Mapbox Search Box API)
- Debounced search (300ms)
- Session token management for billing
- Distance calculation using haversine formula
- Result retrieval with full coordinates

#### Route Browse
- Real-time vehicle count per route
- Save/unsave routes with bookmark icon
- Filter routes by name/number
- Display route color, number, status

#### Journey Planning
- Multi-stop journey building
- Plan Journey button (manual trigger)
- Itinerary display with duration, distance, stops
- Leg breakdown: walk vs bus

#### Authentication Integration
- Auth dialog for unauthenticated users
- Pending action queue (waits for auth completion)
- Auth required for: search, save, plan journey

#### Saved Items Management
- Display saved item count
- Button to open SavedItemsDialog
- Profile and logout buttons

**Critical Props Interface**:
```typescript
interface RoutesSidebarProps {
  mode: AppMode
  onModeChange: (mode: AppMode) => void
  selectedRouteId?: number
  onSelectRoute?: (route: RouteSummary) => void
  journeyStops?: LocationSearchResult[]
  onAddStop?: (location: LocationSearchResult) => void
  onRemoveStop?: (id: string) => void
  onPlanJourney?: () => void
  itineraries?: PlanItinerary[] | null
  planStatus?: PlanStatus
  selectedItineraryIndex?: number
  onSelectItinerary?: (index: number, itinerary: PlanItinerary) => void
}
```

---

### 2.2 MapboxMap (`/src/app/_components/map.tsx`)

**The visualization layer** - Renders all map data and interactions

**Responsibilities**:

#### Route Visualization
- Display selected bus route (KML shape)
- Route outline (white) + colored line (route color)
- Auto-fit map bounds when route selected

#### Journey Visualization
- Walking legs: blue lines
- Bus legs: orange/colored lines
- Split path rendering for different leg types
- Zoom/pan to fit full itinerary

#### User Location
- Blue marker at current location
- Auto-center map on first geolocation fix

#### Markers
- User location marker
- Journey stop markers
- Destination marker

#### Interactive Elements
- Bus info popup when clicking on vehicle
- 3D bus models on map (custom layer)
- Click handlers for vehicle selection

**Key State**:
```typescript
- viewState: { longitude, latitude, zoom, pitch, bearing }
- navigationRoute: NavigationRouteGeoJSON | null (walking directions)
- selectedVehicle: RouteDetails["Vehicles"][number] | null
- itineraryDirections: NavigationRouteGeoJSON | null
```

**Data Sources**:
- TRPC: `api.bus.getRouteKML` (bus route shape, cached 5 min)
- TRPC: `api.bus.getRouteDetails` (vehicles, refreshed every 10s)
- Mapbox Directions API: Walking directions
- Custom itinerary visualization

**Map Interaction**:
- Camera animations (flyTo, fitBounds) with 900ms duration
- No direct click handlers on map (unused code comment)
- Bus 3D layer click handling exists but commented out

---

### 2.3 Dialogs (Modal Components)

#### AuthDialog (`/src/app/_components/auth-dialog.tsx`)
- Sign in / Sign up toggle
- Form fields: name (signup only), email, password
- Error messages
- Default mode prop: "signin" | "signup"
- Triggers session invalidation on success

#### SaveJourneyDialog (`/src/app/_components/save-journey-dialog.tsx`)
- Preview itinerary details (distance, duration, legs breakdown)
- Optional nickname input
- Save button with loading state
- Calls `useSavedItems().saveJourney()`

#### SavedItemsDialog (`/src/app/_components/saved-items-dialog.tsx`)
- Tabs: All | Journeys | Routes
- Grid layout of saved items
- Each item shows:
  - Nickname or "Untitled"
  - Type badge (Journey vs Route)
  - Creation date
  - Details (distance, bus count, etc.)
- Actions: View on Map, Delete with confirmation
- Empty state messaging

#### ProfileDialog (`/src/app/_components/profile-dialog.tsx`)
- Edit profile name
- Toggle notifications enabled
- Save changes (calls PATCH `/api/user/[id]`)
- Error handling

---

### 2.4 Support Components

#### OnboardingOverlay (`/src/app/_components/onboarding-overlay.tsx`)
- 4-step carousel tutorial
- Shows on first visit (localStorage: `lokal_onboarding_completed`)
- Step indicators and navigation
- Skip option
- Steps: Welcome, Find Route, Save Favorites, Track History

#### BusInfoPopup (`/src/app/_components/bus-info-popup.tsx`)
- Fixed position top-center popup
- Displays when user clicks bus 3D model
- Shows:
  - Vehicle name and ID
  - Destination, direction, speed
  - Last stop, occupancy status
  - Last updated timestamp
- Close button and backdrop click to dismiss

#### Bus3DLayer (`/src/app/_components/bus-3d-layer.ts`)
- Custom Mapbox layer for 3D bus models
- Renders glTF models at vehicle coordinates
- Manages bus instance lifecycle
- Updates vehicle positions in real-time

---

## 3. State Management & Data Flow Patterns

### 3.1 Session Management (`/src/trpc/session.ts`)

**Hook: `useSession()`**

Returns:
```typescript
{
  user: UserSafe | null
  status: "loading" | "authenticated" | "unauthenticated"
  signIn(email, password)
  signUp(email, password, name?)
  signOut()
  refresh()
  refetch()
}
```

**Implementation Details**:
- Uses React Query with queryKey: `["session", "me"]`
- Auto-refreshes on 401 response
- Invalidates on sign in/up/out
- Fetches from `/api/auth/me`

**Auth Flow**:
1. POST `/api/auth/login` or `/api/auth/register`
2. Sets HTTP-only cookie
3. Invalidates session query
4. Query refetch loads new user data
5. Components re-render with new user

---

### 3.2 Saved Items Management (`/src/trpc/saved-items.ts`)

**Hook: `useSavedItems()`**

Returns:
```typescript
{
  items: SavedItem[]
  journeys: SavedJourneyItem[]
  routes: SavedRouteItem[]
  isFetching: boolean
  refetch()
  saveJourney(itinerary, originLat, originLng, nickname?)
  saveRoute(routeId, nickname?)
  remove(itemId)
}
```

**Key Points**:
- Query key: `["savedItems", user?.id]`
- Disabled when unauthenticated
- POST to `/api/user/[id]/saved-items` for save
- DELETE to `/api/user/[id]/saved-items/[itemId]` for remove
- Auto-refetches after mutations

**Saved Item Types**:
```typescript
SavedRouteItem = { type: "ROUTE", routeId, itineraryData: null }
SavedJourneyItem = { type: "JOURNEY", routeId: null, itineraryData, originLat, originLng, totalDistance, totalDuration }
```

---

### 3.3 Journey Planning Flow

**Triggers**:
1. User adds destination → `journeyStops` updated
2. `journeyStops` changes + `userLocation` available → Auto-plan triggered
3. User clicks "Plan Journey" button → Manual trigger

**Process** (in `/src/app/page.tsx` useEffect):
```
1. POST /api/directions with origin + destinations
2. Receive itineraries array
3. Extract PlanItinerary objects
4. Set planItineraries state
5. Set selectedItineraryIndex = 0
6. Sidebar displays route options
```

**Cancellation**:
- New request sent before previous completes → abort previous
- User navigates away → cleanup abort controller

**Error Handling**:
- Zod validation errors → user-friendly message
- Network errors → planStatus = "error"
- No routes found → empty itineraries array

---

## 4. User Interaction Flows (Complete Journeys)

### 4.1 Flow: Search & Explore Bus Routes

```
1. [Home page loads]
   - Sidebar opens (default open)
   - Mode: "explore"
   - View: "routes"

2. [User searches route]
   - Types in route search box
   - RequireAuth callback checks auth
   - Filters routes by name/number/description

3. [User sees active bus count]
   - Fetched from api.bus.getAllVehicles (refreshed every 60s)
   - Displayed as "N buses active" under route

4. [User clicks route]
   - onSelectRoute callback fires
   - selectedRoute updated
   - Map: fetchRouteKML + fetchRouteDetails
   - Map: fit bounds to route shape
   - Map: render route with vehicles

5. [User clicks bus on map]
   - Mapbox click event → bus 3D layer handler
   - BusInfoPopup renders
   - Shows vehicle details
   - Backdrop click → closes popup
```

---

### 4.2 Flow: Plan a Journey

```
1. [User clicks "Plan Journey" mode button]
   - mode: "explore" → "plan"
   - View: "routes" → "places"

2. [User searches for destination]
   - Types in place search box
   - Mapbox Search Box API (debounced 300ms)
   - Results include distance to user
   - Results sorted by distance

3. [User selects a destination]
   - handleAddPlace callback
   - Fetches full location details if needed
   - journeyStops updated
   - View: "places" → "route-options"
   - Auto-plan triggered:
     - POST /api/directions called
     - Returns itineraries
     - planStatus: "loading" → "success"

4. [User sees multiple itinerary options]
   - Each itinerary shows:
     - Total duration (minutes)
     - Total distance (km)
     - Number of stops
     - Number of bus rides vs walk segments
   - User can select one
   - View: "route-options" → "step-by-step"

5. [User views step-by-step directions]
   - Each leg shows:
     - Walk: distance + duration
     - Bus: route number, stops, duration
     - Start/end stop names
   - Summary at bottom: arrival destination
   - Save button → SaveJourneyDialog opens
   - Bookmark itinerary → saveJourney API call

6. [User can add more stops]
   - Click "Back to search" button
   - View: "step-by-step" → "places"
   - Add another destination
   - planStatus auto-updates with new route
```

---

### 4.3 Flow: Save & Manage Journeys

```
1. [User clicks "Save Journey" button]
   - SaveJourneyDialog opens
   - Shows: distance, duration, leg breakdown
   - Input: optional nickname

2. [User saves]
   - saveJourney() API called
   - POST /api/user/[id]/saved-items
   - Payload: { type: "JOURNEY", itineraryData, originLat, originLng, nickname }
   - useSavedItems() refetch triggered
   - Dialog closes

3. [User accesses saved items]
   - Clicks "My Saved Items" button (if authenticated)
   - SavedItemsDialog opens
   - Can filter: All | Journeys | Routes
   - Each item card shows details
   - Actions:
     - View on Map → navigates home with ?itemId=
     - Delete with confirmation

4. [Viewing saved journey on map]
   - URL parameter: ?itemId=[id]
   - Home page useEffect loads item
   - Reconstructs journey state
   - Sets planItineraries
   - Sidebar shows saved journey details
```

---

### 4.4 Flow: Authentication

```
1. [User tries action requiring auth]
   - Sign in, save, search, plan
   - requireAuth() callback invoked
   - Checks session.status

2. [If unauthenticated]
   - Stores action in pendingActionRef
   - Sets authOpen = true
   - Shows AuthDialog

3. [User signs up/in]
   - Form submitted → handleSubmit
   - POST /api/auth/register or /api/auth/login
   - HTTP-only cookie set
   - useSession() invalidated
   - Session refetch loads new user

4. [After auth succeeds]
   - Dialog closes
   - useEffect watches session.status
   - Executes pendingAction
   - User doesn't lose their place

5. [User signs out]
   - session.signOut() called
   - POST /api/auth/logout
   - HTTP-only cookie cleared
   - useSession() invalidated
   - User state becomes null
```

---

## 5. API Routes & Data Sources

### 5.1 Direction Planning

**POST `/api/directions`**
- Consumes: origin + array of destinations
- Returns: `{ itineraries: PlanItinerary[] }`
- Calls: `planItineraries()` from routing service
- Uses: GTFS data + routing algorithm

**Request Schema**:
```typescript
{
  origin: { latitude, longitude },
  destinations: [{ latitude, longitude }],
  limit?: number (default 3),
  departureTime?: ISO datetime,
  maxWalkingDistanceMeters?: number
}
```

---

### 5.2 Route Information

**GET `/api/routes`**
- Returns list of all bus routes
- Used by: sidebar to populate route list

**GET `/api/routes/[id]`**
- Returns single route with all stops
- Used by: route detail page (/route/[id])
- Includes: stops ordered by sequence with lat/lng

**TRPC: `api.bus.getRouteKML`**
- Returns route geometry/shape
- Cached 5 minutes
- Used by: map to draw route path

**TRPC: `api.bus.getRouteDetails`**
- Returns vehicles (with position, speed, occupancy)
- Refetch every 10 seconds
- Used by: map to show real-time vehicle positions

---

### 5.3 Authentication

**POST `/api/auth/register`**
- Payload: { email, password, name? }
- Creates user + sets HTTP-only cookie
- Returns: user data

**POST `/api/auth/login`**
- Payload: { email, password }
- Validates credentials + sets cookie
- Returns: user data

**GET `/api/auth/me`**
- Returns current authenticated user
- Returns: null if unauthenticated (401 → null)

**POST `/api/auth/refresh`**
- Refreshes auth token
- Used by: session hook on initial load

**POST `/api/auth/logout`**
- Clears HTTP-only cookie

---

### 5.4 Saved Items

**GET `/api/user/[id]/saved-items`**
- Returns all saved items for user
- Filters by type: JOURNEY vs ROUTE
- Returns: SavedItem[]

**POST `/api/user/[id]/saved-items`**
- Saves new journey or route
- Payload: { type, itineraryData?, routeId?, nickname? }
- Creates SavedItem record in DB

**DELETE `/api/user/[id]/saved-items/[itemId]`**
- Removes saved item
- Authorization checked

---

### 5.5 User Profile

**GET `/api/auth/me`** (also returns user data)
**PUT `/api/user/[id]`**
- Updates: name
- Payload: { name }

**PUT `/api/user/[id]/preferences`**
- Updates: notificationsEnabled
- Payload: { notificationsEnabled }

---

## 6. Loading States & Async Operations

### 6.1 Location Search Loading
- **State**: `isPlacesLoading`
- **Debounce**: 300ms before request
- **Cancellation**: AbortController for previous request
- **UI Feedback**: Status message "Searching…"

### 6.2 Journey Planning Loading
- **State**: `planStatus` ("idle" | "loading" | "success" | "error")
- **Trigger**: journeyStops + userLocation changes
- **Messages**:
  - No origin: "Waiting for your location…"
  - Loading: "Calculating routes…"
  - Error: planError message displayed
  - Success: itineraries shown

### 6.3 Route Loading
- **TRPC Queries**: Automatic loading state via React Query
- **Display**: Disabled UI elements while loading
- **Caching**: 5 min for route shapes, 10s refresh for vehicles

### 6.4 Save Operations
- **Journey Save**: Button disabled during `isSaving`
- **Route Save**: Optimistic UI update (bookmark icon changes immediately)
- **Delete**: Confirmation dialog before deletion

---

## 7. Mobile vs Desktop Considerations

### Desktop Layout
- Sidebar: Fixed width, full height, scrollable content
- Map: Fills remaining space
- Dialogs: Centered overlay, fixed dimensions

### Mobile Layout
- Sidebar: Slide-out drawer (Radix Dialog)
- Map: Full viewport
- Dialogs: Full-width or centered overlay
- Search inputs: Touch-friendly heights

### Responsive Breakpoints
- Sidebar max-width: 600px
- Map padding adjusts for viewport
- Dialog widths: `w-[90vw] max-w-[600px]`
- Grid layouts: 1 column on mobile, 2+ on desktop

### Touch Interactions
- No hover states required (fallback to active states)
- Large touch targets (min 44px)
- Swipe to dismiss dialogs (Radix handles)

---

## 8. UX Friction Points & Potential Chokepoints

### 8.1 Critical Friction Points

1. **Authentication Requirement on Every Search**
   - User must auth to search routes or places
   - Blocks casual browsing
   - Workaround: Public route detail page exists

2. **Mandatory Location Permission**
   - User must enable geolocation to plan journeys
   - App won't work properly without it
   - No fallback for manual origin specification

3. **Multi-Step Journey Modal Flow**
   - SaveJourneyDialog requires opening another dialog
   - Extra steps to save a journey

### 8.2 Performance Chokepoints

1. **Real-time Vehicle Updates**
   - Refetch every 10s for each route
   - Multiple queries if user has many routes open
   - Mitigation: Only query when route is selected

2. **Mapbox Search API Latency**
   - Round-trip for each character typed (debounced)
   - Session token management adds complexity
   - Mitigation: 300ms debounce prevents most redundant requests

3. **Large Itinerary Visualization**
   - Multiple GeoJSON features + path splitting
   - Heavy computation for leg-by-leg path splitting
   - Mitigation: Memoized computations

### 8.3 Data Consistency Issues

1. **Saved Items Cache**
   - Manual invalidation required after save/delete
   - Optimistic updates not implemented
   - Could show stale data briefly

2. **Vehicle Position Staleness**
   - 10s refresh rate means 10s old data
   - No real-time WebSocket fallback
   - Users might see "historical" positions

---

## 9. Component Interaction Diagram

```
Home (page.tsx)
├─ RoutesSidebar
│  ├─ AuthDialog
│  ├─ ProfileDialog
│  ├─ SavedItemsDialog
│  │  ├─ JourneyDetails component
│  │  └─ RouteDetails component
│  ├─ SaveJourneyDialog
│  └─ View states:
│     ├─ routes (browse)
│     ├─ places (search)
│     ├─ route-options (itinerary list)
│     └─ step-by-step (directions)
│
├─ MapboxMap
│  ├─ Route visualization layer
│  ├─ Navigation route layer
│  ├─ Itinerary route layer (colored by leg type)
│  ├─ User location marker
│  ├─ Journey stop markers
│  ├─ Bus 3D layer
│  └─ BusInfoPopup
│
└─ OnboardingOverlay

Route Detail Page (/route/[id])
├─ Header with route info
├─ Save/Share buttons
├─ Stops list with vertical timeline
├─ AuthDialog (for saving)
└─ "View on Map" button

Shared Providers:
- TRPCReactProvider (React Query + TRPC)
- useSession hook (authentication state)
- useSavedItems hook (saved data)
```

---

## 10. State Flow Summary

```
┌─────────────────────────────────────────────────────────────┐
│                    HOME PAGE STATE                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  USER LOCATION                                               │
│  ├─ Geolocation.watchPosition()                             │
│  └─ Updates: userLocation state                             │
│                                                               │
│  MODE TOGGLE                                                │
│  ├─ Explore: Browse routes                                  │
│  └─ Plan: Multi-stop journey                               │
│                                                               │
│  ROUTE SELECTION (Explore Mode)                            │
│  ├─ User clicks route                                       │
│  ├─ Fetches: KML shape + vehicles                          │
│  └─ Map: Draws route + shows vehicles                      │
│                                                               │
│  JOURNEY PLANNING (Plan Mode)                               │
│  ├─ User adds destinations                                  │
│  ├─ journeyStops updated                                    │
│  ├─ Auto-plan triggered: POST /api/directions              │
│  ├─ Itineraries loaded                                      │
│  └─ User selects itinerary → Step-by-step view             │
│                                                               │
│  SAVE ACTIONS                                               │
│  ├─ Save route → savedItems.saveRoute()                    │
│  ├─ Save journey → SaveJourneyDialog.saveJourney()         │
│  └─ Delete item → savedItems.remove()                      │
│                                                               │
│  SESSION STATE                                              │
│  ├─ Load: useSession() → /api/auth/me                      │
│  ├─ Sign in/up → invalidate session                         │
│  ├─ Sign out → clear session                               │
│  └─ All protected actions check session.status             │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 11. Summary: Critical User Journeys

### User Story 1: Casual Route Explorer
1. Land on home page
2. See onboarding (first time)
3. Browse bus routes in sidebar
4. Click route → See on map with active vehicles
5. Click vehicle → See popup with details
6. Exit (no account needed)

### User Story 2: Commute Planner
1. Enable location permission
2. Click "Plan Journey"
3. Search for home address → add stop
4. Search for office → add stop
5. See itinerary options
6. Click itinerary → See step-by-step directions
7. Save journey with nickname
8. Access saved journey later via "My Saved Items"

### User Story 3: Casual Sharer
1. Find route they like
2. Copy shareable link (no login needed)
3. Send to friend
4. Friend opens `/route/[id]` page
5. Friend saves route (may require signup)

### User Story 4: Returning User
1. Open app → Already logged in
2. Click "My Saved Items"
3. See saved journeys + routes
4. Click "View on Map" for saved journey
5. See previously planned route visualized
6. Can modify and re-save

