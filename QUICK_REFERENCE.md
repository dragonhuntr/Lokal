# LOKAL UI - Quick Reference Guide

## File Organization

```
src/app/
├── page.tsx                          [HOME] Main map + sidebar
├── layout.tsx                        [LAYOUT] TRPC provider setup
├── route/[id]/page.tsx               [ROUTE DETAIL] Shareable route page
├── docs/page.tsx                     [DOCS] Swagger API docs
│
├── _components/
│   ├── map.tsx                       [MAP] Mapbox visualization & interactions
│   ├── routes-sidebar.tsx            [SIDEBAR] Main UI orchestrator (1000+ lines)
│   ├── auth-dialog.tsx               [AUTH] Sign in/up form
│   ├── save-journey-dialog.tsx       [SAVE] Journey save dialog
│   ├── saved-items-dialog.tsx        [VIEW] Saved journeys/routes manager
│   ├── profile-dialog.tsx            [PROFILE] User settings
│   ├── onboarding-overlay.tsx        [TUTORIAL] 4-step guide
│   ├── bus-info-popup.tsx            [POPUP] Vehicle details
│   └── bus-3d-layer.ts               [3D] Custom Mapbox layer for buses
│
├── api/
│   ├── auth/                         [AUTH ENDPOINTS]
│   │   ├── register/
│   │   ├── login/
│   │   ├── logout/
│   │   ├── me/
│   │   └── refresh/
│   ├── directions/route.ts           [ROUTING] Journey planning
│   ├── routes/route.ts               [ROUTES] Get all routes
│   ├── routes/[id]/route.ts          [ROUTE] Get single route
│   ├── bus/[id]/route.ts             [BUS] Bus details (DEPRECATED?)
│   ├── stops/route.ts                [STOPS] Get all stops
│   ├── user/[id]/                    [USER] Profile + saved items
│   │   ├── route.ts
│   │   ├── preferences/
│   │   └── saved-items/
│   └── trpc/[trpc]/route.ts          [TRPC] TRPC endpoint

src/trpc/
├── session.ts                        [HOOK] useSession() - auth state
├── saved-items.ts                    [HOOK] useSavedItems() - bookmarks
├── react.ts                          [PROVIDER] React Query setup
├── server.ts                         [ROUTER] TRPC procedure definitions
└── query-client.ts                   [CLIENT] Query client config
```

---

## Component Dependencies

```
HOME PAGE (page.tsx)
  │
  ├─→ RoutesSidebar (orchestrator)
  │    ├─→ AuthDialog
  │    ├─→ ProfileDialog
  │    ├─→ SavedItemsDialog
  │    ├─→ SaveJourneyDialog
  │    └─→ Uses hooks:
  │         ├─ useSession()
  │         ├─ useSavedItems()
  │         └─ api.bus.getRoutes
  │
  ├─→ MapboxMap (visualization)
  │    ├─→ BusInfoPopup
  │    ├─→ Bus3DLayer
  │    └─→ Uses hooks:
  │         ├─ api.bus.getRouteKML
  │         └─ api.bus.getRouteDetails
  │
  └─→ OnboardingOverlay (tutorial)
```

---

## Key State Props

### Home Page → Sidebar
```typescript
mode: "explore" | "plan"
userLocation: { latitude, longitude } | null
selectedRoute: RouteSummary | null
journeyStops: LocationSearchResult[]
planItineraries: PlanItinerary[] | null
planStatus: "idle" | "loading" | "success" | "error"
selectedItineraryIndex: number
```

### Sidebar → Map
```typescript
selectedRoute: RouteSummary | null
selectedLocation: LocationSearchResult | null
journeyStops: LocationSearchResult[]
userLocation: { latitude, longitude } | null
selectedItinerary: PlanItinerary | null
```

---

## Critical Flows

### Explore Flow
```
User opens app
  ↓
See routes list (scrollable)
  ↓
Click route
  ↓
Map shows: route shape + active vehicles
  ↓
Click vehicle on map
  ↓
BusInfoPopup shows vehicle details
```

### Plan Flow
```
User clicks "Plan Journey"
  ↓
Search for destination (Mapbox)
  ↓
Click destination → added as journeyStop
  ↓
Auto-plan triggered: POST /api/directions
  ↓
See itinerary options
  ↓
Click itinerary → see step-by-step legs
  ↓
Click "Save Journey" button
  ↓
SaveJourneyDialog opens (nickname input)
  ↓
Click "Save Journey"
  ↓
POST /api/user/[id]/saved-items
```

### Auth Flow
```
User needs to: search, save, or plan
  ↓
AuthDialog opens
  ↓
Form: email, password (+ name for signup)
  ↓
POST /api/auth/login or /api/auth/register
  ↓
HTTP-only cookie set
  ↓
useSession() invalidated
  ↓
Session refetch loads new user
  ↓
pendingAction executes
```

---

## API Quick Lookup

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/api/directions` | POST | Plan journey | NO |
| `/api/routes` | GET | List all routes | NO |
| `/api/routes/[id]` | GET | Route details + stops | NO |
| `/api/auth/register` | POST | Create account | NO |
| `/api/auth/login` | POST | Sign in | NO |
| `/api/auth/me` | GET | Current user | YES |
| `/api/auth/logout` | POST | Sign out | YES |
| `/api/user/[id]/saved-items` | GET | List saved items | YES |
| `/api/user/[id]/saved-items` | POST | Save item | YES |
| `/api/user/[id]/saved-items/[id]` | DELETE | Delete item | YES |
| `/api/user/[id]` | PUT | Update profile | YES |
| `/api/user/[id]/preferences` | PUT | Update preferences | YES |

---

## TRPC Hooks

```typescript
// Bus data
api.bus.getRoutes.useQuery()
api.bus.getRouteKML.useQuery({ routeId })
api.bus.getRouteDetails.useQuery({ routeId }, { refetchInterval: 10000 })
api.bus.getAllVehicles.useQuery(undefined, { refetchInterval: 60000 })

// Session
useSession() → { user, status, signIn(), signUp(), signOut() }

// Saved items
useSavedItems() → { items, journeys, routes, saveJourney(), saveRoute(), remove() }
```

---

## View States in Sidebar

```typescript
type SidebarView = "routes" | "places" | "route-options" | "step-by-step" | "saved"
```

### Transitions
```
routes ←→ places                (mode toggle)
       ↓
     route-options             (destination selected)
       ↓
    step-by-step               (itinerary selected)
       ↓
  SaveJourneyDialog            (save clicked)
```

---

## Component Size Reference

| Component | Lines | Complexity |
|-----------|-------|-----------|
| routes-sidebar.tsx | 1200+ | VERY HIGH |
| map.tsx | 800+ | VERY HIGH |
| page.tsx | 330 | HIGH |
| save-journey-dialog.tsx | 165 | LOW |
| saved-items-dialog.tsx | 227 | MEDIUM |
| auth-dialog.tsx | 128 | LOW |
| profile-dialog.tsx | 117 | LOW |
| onboarding-overlay.tsx | 143 | LOW |
| bus-info-popup.tsx | 132 | LOW |

---

## Loading States to Watch

```typescript
// Search locations
isPlacesLoading: boolean
placesError: string | null

// Journey planning
planStatus: "idle" | "loading" | "success" | "error"
planError: string | null

// TRPC queries
{ isLoading, isError, error }

// Save operations
isSaving: boolean (in dialog)
```

---

## Local Storage

```javascript
// Onboarding
localStorage.getItem('lokal_onboarding_completed')
localStorage.setItem('lokal_onboarding_completed', 'true')
```

---

## Debugging Tips

### To trace a click from Sidebar → Map update:
1. Find `onSelectRoute` callback in page.tsx
2. It updates `selectedRoute` state
3. Sidebar passes to MapboxMap as prop
4. Map component watches selectedRoute in useEffect
5. Calls `api.bus.getRouteKML.useQuery()`
6. Renders layers when data arrives

### To trace journey planning:
1. `journeyStops` state change triggers useEffect in page.tsx
2. AbortController cancels previous request
3. POST /api/directions with locations
4. Response parsed via `extractPlanItineraries()`
5. `planItineraries` state updated
6. Sidebar detects change → shows route-options view
7. Sidebar passes itineraries to map
8. Map calls `api.bus.directions` via Mapbox API
9. Renders colored leg segments

### Common Issues:
- **Map not centering**: Check if `hasCenteredUserRef` already set
- **Routes not showing**: Check `areRoutesLoading` state
- **Save not working**: Verify `session.status === "authenticated"`
- **Search not working**: Check Mapbox access token in .env
- **Dialog stuck**: Look for missing `onOpenChange` callback

---

## Performance Notes

- RoutesSidebar: VERY LARGE, consider breaking into smaller components
- Map: Heavy with GeoJSON manipulation, memoization in place
- Mapbox Search API: Debounced 300ms, limited to 10 results
- Vehicle updates: Every 10s per route, only when selected
- Route shapes: Cached 5 minutes
- Session: Auto-refresh on 401, minimal polling

---

## Browser APIs Used

- `navigator.geolocation.watchPosition()` - User location
- `localStorage` - Onboarding flag
- `AbortController` - Request cancellation
- `crypto.randomUUID()` - Session tokens
- `Mapbox GL` - Map rendering

---

## External Dependencies

- `react-map-gl` + `mapbox-gl` - Mapping
- `@radix-ui/react-dialog` - Modal dialogs
- `@radix-ui/react-scroll-area` - Scrollable areas
- `@tanstack/react-query` - Data fetching & caching
- `lucide-react` - Icons
- `zod` - Schema validation
- `next/navigation` - Client-side routing

