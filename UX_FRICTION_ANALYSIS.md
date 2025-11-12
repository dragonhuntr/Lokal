# LOKAL UI - UX Friction Points & Recommendations

## Critical Friction Points

### 1. Authentication Wall on Search (CRITICAL)

**Issue**: User cannot search routes or locations without authentication
- Any click on search input triggers `requireAuth()` check
- Routes sidebar requires sign-in to type in search box
- Blocks casual exploration

**Impact**: 
- New users might bounce without trying app
- Can't preview what routes are available before signing up
- Forces signup before understanding app value

**Recommended Fixes**:
1. Allow unauthenticated route browsing (show list of all routes without search)
2. Allow public route detail pages without auth (already exists at `/route/[id]`)
3. Only require auth when saving
4. Show "Sign in to save" prompt on bookmark button, not on search input

**Code Location**: `/src/app/_components/routes-sidebar.tsx` line 630, 730-731
```typescript
// Current problematic code:
onChange={(event) => requireAuth(() => setRouteQuery(event.target.value))}

// Better approach:
onChange={(event) => setRouteQuery(event.target.value)}
// Only require auth when clicking save button
```

---

### 2. Mandatory Location Permission (HIGH)

**Issue**: App won't plan journeys without geolocation
- User must enable location before planning works
- No fallback for manual origin entry
- "Waiting for your location…" message shows indefinitely if permission denied

**Impact**:
- Safari may block geolocation silently
- Privacy-conscious users can't use planning feature
- Mobile users might deny permission reflexively

**Recommended Fixes**:
1. Add manual origin entry fallback (search for origin location)
2. Show "Enable location permission to plan" with helpful instructions
3. Add "Use my location" vs "Enter location manually" toggle
4. Cache last known location if available

**Code Location**: `/src/app/page.tsx` lines 189-214
```typescript
// Add fallback origin option:
const [manualOrigin, setManualOrigin] = useState<LocationSearchResult | null>(null)
const effectiveOrigin = userLocation || manualOrigin
```

---

### 3. No Optimistic Save UI (MEDIUM)

**Issue**: Saving journeys/routes has awkward UX
- Save button changes after 2-3 second delay
- No immediate feedback user action succeeded
- User might click button multiple times

**Impact**:
- Feels slow and unresponsive
- Could create duplicate saves if user impatient

**Recommended Fixes**:
1. Show bookmark icon change immediately (optimistic update)
2. Add success toast notification
3. Disable button while saving to prevent double-clicks
4. Show loading spinner during save

**Code Location**: `/src/app/_components/routes-sidebar.tsx` lines 656-681
```typescript
// Add optimistic update:
const [optimisticSaved, setOptimisticSaved] = useState(false)
setOptimisticSaved(true)
saveRoute().catch(() => setOptimisticSaved(false))
```

---

### 4. Complex Journey Saving Flow (MEDIUM)

**Issue**: Too many steps to save a journey
1. Plan journey in sidebar
2. Click itinerary
3. See step-by-step directions
4. Click "Save Journey" button
5. SaveJourneyDialog opens
6. Enter optional nickname
7. Click "Save Journey" again

**Impact**:
- Feels cumbersome
- User might forget they're saving
- Two dialogs open in sequence (confusing)

**Recommended Fixes**:
1. Add "Save" button directly on itinerary card (before clicking it)
2. Combine SaveJourneyDialog into sidebar or step-by-step view
3. Skip nickname dialog for quick save (add option to edit later)
4. Show "Saved!" confirmation inline

**Code Location**: `/src/app/_components/routes-sidebar.tsx` lines 920-956
```typescript
// Add inline save button on itinerary card:
<button onClick={() => requireAuth(() => setSaveJourneyOpen(true))}>
  Save Journey
</button>
// Instead of nested in step-by-step view
```

---

## Performance Chokepoints

### 1. RoutesSidebar Component is Monolithic (HIGH)

**Issue**: Single component with 1200+ lines
- Handles: route search, place search, itinerary display, save dialogs, auth
- Multiple large effects (location search, view transitions, etc.)
- Hard to debug and maintain

**Impact**:
- Component re-renders unnecessarily on any state change
- Large component = larger bundle size
- Difficult for new developers to understand

**Recommended Refactoring**:
```typescript
// Break into:
├─ RoutesSidebar (orchestrator, 300 lines)
├─ RoutesList (250 lines)
├─ PlaceSearch (300 lines)
├─ ItineraryOptions (250 lines)
├─ DirectionsSteps (200 lines)
└─ SidebarFooter (100 lines)
```

**Benefits**:
- Each component ~250 lines (manageable)
- Easier to memoize and optimize
- Parallel development possible
- Easier testing

---

### 2. Real-time Vehicle Updates Every 10 Seconds (MEDIUM)

**Issue**: `api.bus.getRouteDetails` refetches every 10 seconds
- Means 6 requests per minute per selected route
- If user keeps app open for hour with route selected: 360 requests
- Vehicle positions likely update less frequently than that

**Impact**:
- Battery drain on mobile
- Bandwidth consumption
- Server load

**Recommended Fixes**:
1. Increase refetch interval to 30-60 seconds (vehicles don't move that fast)
2. Pause refetch when app in background
3. Use WebSocket for real updates (if backend supports)
4. Track last update time on vehicle and skip refetch if too recent

**Code Location**: `/src/app/_components/map.tsx` line 108
```typescript
// Current:
{ refetchInterval: 10_000 }

// Better:
{ refetchInterval: 30_000 } // 30 seconds instead

// Or implement activity detector:
const isUserActive = useRef(true)
{ refetchInterval: isUserActive.current ? 30_000 : false }
```

---

### 3. Mapbox Search Debounce Too Long (LOW)

**Issue**: 300ms debounce on location search
- Modern apps use 150-200ms
- User types quickly → feels slow

**Impact**:
- Minor UX degradation
- Users might type address faster than results appear

**Recommended Fixes**:
```typescript
// Current:
const DEBOUNCE_MS = 300

// Better:
const DEBOUNCE_MS = 200
```

---

### 4. Large Itinerary Path Splitting (MEDIUM)

**Issue**: Leg-by-leg path splitting uses coordinate distance matching
- For complex itineraries (10+ legs): computationally expensive
- Happens on every map render

**Impact**:
- Jank when viewing complex journeys
- Mobile performance degrades

**Code Location**: `/src/app/_components/map.tsx` lines 474-520

**Recommended Fix**:
```typescript
// Memoize more aggressively:
const itineraryGeoJson = useMemo(() => {
  // Use requestIdleCallback for heavy computation
  return new Promise(resolve => {
    requestIdleCallback(() => {
      const result = buildItineraryGeoJson(...)
      resolve(result)
    })
  })
}, [selectedItinerary, itineraryDirections])
```

---

## Data Consistency Issues

### 1. Saved Items Cache Not Invalidated (MEDIUM)

**Issue**: Manual cache invalidation on save/delete
- User saves journey
- SavedItemsDialog might show stale data if opened immediately
- Could be 100-500ms delay

**Impact**:
- User confusion ("Did I save this?")
- Might try to save again

**Recommended Fixes**:
```typescript
// Add optimistic update:
const savedItems = useSavedItems()

const handleSaveJourney = async () => {
  const newItem = {
    id: generateId(),
    type: "JOURNEY",
    itineraryData,
    createdAt: new Date().toISOString(),
    // ... other fields
  }
  
  // Optimistically add to cache
  queryClient.setQueryData(
    ["savedItems", user.id],
    (old) => [...(old ?? []), newItem]
  )
  
  try {
    await saveJourney(...)
  } catch {
    // Revert on error
    queryClient.refetch()
  }
}
```

---

### 2. Vehicle Position Staleness (LOW)

**Issue**: Positions are 10-30 seconds old
- User sees bus moved slower than it did
- Real-time position might be different

**Impact**:
- User plans to catch bus that's already at next stop
- Not critical but affects trust in real-time data

**Recommended Fixes**:
1. Show "Last updated X seconds ago" on vehicle popup
2. Add visual indicator (older position = faded)
3. Implement predicted position (extrapolate movement)

**Code Location**: `/src/app/_components/bus-info-popup.tsx` lines 16-33

---

## Mobile-Specific Friction

### 1. Sidebar Doesn't Close When Route Selected (LOW)

**Issue**: On mobile, sidebar still visible after selecting route
- User can't see full map
- Have to manually close sidebar

**Recommended Fix**:
```typescript
// Auto-close sidebar on route selection on mobile:
const isMobile = window.innerWidth < 768

const handleSelectRoute = (route) => {
  onSelectRoute(route)
  if (isMobile) {
    setOpen(false) // Close sidebar
  }
}
```

---

### 2. Dialog Width on Mobile (LOW)

**Issue**: Some dialogs might be too wide on small screens
- SaveJourneyDialog: `max-w-md` is good
- SavedItemsDialog: `max-w-3xl` might overflow

**Recommended Fix**:
```typescript
className="w-[90vw] max-w-[95vw] md:max-w-3xl"
```

---

## Recommendations Priority List

### MUST FIX (Blocking)
1. Add manual origin entry fallback (blocks journey planning for location-denied users)
2. Fix authentication wall on search (blocks app discovery)

### SHOULD FIX (High Impact)
3. Refactor RoutesSidebar into smaller components
4. Simplify journey save flow
5. Reduce vehicle update interval (battery drain)

### NICE TO FIX (Quality of Life)
6. Add optimistic save UI
7. Show loading states more clearly
8. Mobile sidebar auto-close

### LOW PRIORITY (Polish)
9. Reduce search debounce to 200ms
10. Optimize itinerary path computation
11. Show vehicle age on popup

---

## Testing Recommendations

### Test These User Flows
1. **Auth wall test**: Can new user browse routes without signing up?
2. **Location denied test**: Can user plan journey with manual origin?
3. **Slow network test**: How long until "Searching…" shows? (should be <500ms)
4. **Save flow test**: Count clicks from itinerary to saved item (should be ≤3)

### Performance Tests
1. Open app with 10+ saved items → measure SavedItemsDialog render time
2. Select route with 100+ vehicles → measure popup responsiveness
3. Plan journey with 5+ legs → measure map render smoothness

### Mobile Tests
1. Sidebar closes after route selection ✓ / ✗
2. Dialogs fit on iPhone SE (375px) ✓ / ✗
3. Touch targets ≥44px ✓ / ✗

