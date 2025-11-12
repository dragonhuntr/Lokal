# LOKAL UI Architecture - Documentation Summary

## What Has Been Created

You now have **three comprehensive guides** documenting the complete UI architecture of the Lokal transit application:

### 1. **UI_ARCHITECTURE_MAP.md** (847 lines)
Comprehensive technical reference covering:
- All main pages and entry points
- Complete component architecture with dependencies
- State management patterns (session, saved items, journey planning)
- Full user interaction flows (4 critical user journeys)
- API routes and data sources
- Loading states and async operations
- Mobile vs desktop considerations
- Component interaction diagrams
- State flow visualizations

**Use this when**: You need to understand HOW the app works, trace data flow, understand component relationships.

---

### 2. **QUICK_REFERENCE.md** (325 lines)
Quick lookup guide for developers:
- File organization with brief descriptions
- Component dependencies tree
- Key state props interfaces
- Critical flows (Explore, Plan, Auth) in diagram format
- API endpoint quick lookup table
- TRPC hooks reference
- View state transitions
- Component size and complexity reference
- Loading states checklist
- Debugging tips with code locations
- Performance notes
- Browser APIs and external dependencies

**Use this when**: You're working on the codebase and need quick answers (find a hook, trace a callback, understand view states).

---

### 3. **UX_FRICTION_ANALYSIS.md** (376 lines)
Detailed analysis of UX problems and recommendations:
- **Critical friction points** (authentication wall, mandatory location)
- **Performance chokepoints** (monolithic sidebar, frequent API polling)
- **Data consistency issues** (cache invalidation, stale data)
- **Mobile-specific problems**
- **Priority list** for fixes (MUST, SHOULD, NICE TO, LOW PRIORITY)
- **Testing recommendations** for each issue
- Code locations and specific fix suggestions

**Use this when**: Planning improvements, understanding performance issues, prioritizing refactoring work.

---

## Quick Facts About LOKAL

### Architecture
- **Framework**: Next.js (React 18+)
- **Styling**: Tailwind CSS
- **State Management**: React Hook + React Query + TRPC
- **Map**: Mapbox GL with custom layers
- **UI Components**: Radix UI primitives
- **Forms**: React forms (no external library)
- **Icons**: Lucide React
- **API Calls**: REST (fetch) + TRPC

### Main Components
```
Home Page (330 lines)
├─ RoutesSidebar (1200+ lines) - THE ORCHESTRATOR
│  └─ Contains 4 dialogs (Auth, Save, Saved Items, Profile)
├─ MapboxMap (800+ lines) - Visualization layer
└─ OnboardingOverlay (143 lines) - Tutorial

Route Detail Page (/route/[id])
└─ Public route sharing page
```

### Two User Modes
1. **Explore Mode**: Browse and filter bus routes, see real-time vehicles on map
2. **Plan Mode**: Multi-stop journey planning with step-by-step directions

### Key Flows
- Route exploration → Select route → See vehicles on map
- Journey planning → Search destinations → Get itineraries → Save journey
- Authentication → Required for search, saving; blocks casual discovery
- Saved items → View, delete, share, re-plan past journeys

---

## Top UX Issues (Summary)

### Blocking Issues
1. **Authentication Wall**: Must sign in to search routes (blocks discovery)
2. **Mandatory Location**: Can't plan without geolocation (no fallback)

### High Impact Issues
3. **Monolithic Sidebar**: 1200+ lines in one component (hard to maintain)
4. **Complex Save Flow**: 7 steps to save a journey (unnecessary friction)
5. **Frequent API Polls**: Vehicle updates every 10s (battery drain)

### Medium Impact Issues
6. **No Optimistic Updates**: Bookmark changes feel slow
7. **Stale Cache**: Saved items may show old data briefly

### Low Impact Issues
8. **Slow Search Debounce**: 300ms when 200ms is standard
9. **Heavy Itinerary Rendering**: Path splitting on every render
10. **Vehicle Age Not Shown**: Users don't know how old data is

---

## File Locations Reference

### Core App
- **Home page**: `/src/app/page.tsx`
- **Route details**: `/src/app/route/[id]/page.tsx`
- **Layout**: `/src/app/layout.tsx`

### Components (all in `/src/app/_components/`)
- **Sidebar** (MONOLITHIC): `routes-sidebar.tsx` (1200 lines)
- **Map**: `map.tsx` (800 lines)
- **Dialogs**: `auth-dialog.tsx`, `save-journey-dialog.tsx`, `saved-items-dialog.tsx`, `profile-dialog.tsx`
- **Overlays**: `onboarding-overlay.tsx`, `bus-info-popup.tsx`
- **Layers**: `bus-3d-layer.ts`

### State Management (in `/src/trpc/`)
- **Session hook**: `session.ts` - Authentication
- **Saved items hook**: `saved-items.ts` - Bookmarks
- **TRPC router**: `server.ts` - Procedure definitions
- **React Query setup**: `react.ts`

### API Routes (in `/src/app/api/`)
- **Auth**: `/auth/register`, `/auth/login`, `/auth/logout`, `/auth/me`, `/auth/refresh`
- **Directions**: `/directions` (POST) - Journey planning
- **Routes**: `/routes` (GET all), `/routes/[id]` (GET one)
- **User**: `/user/[id]/*` - Profile, preferences, saved items
- **TRPC**: `/trpc/[trpc]` - TRPC endpoint

---

## How to Use These Documents

### For New Team Members
1. Start with **QUICK_REFERENCE.md** - Get oriented
2. Read **UI_ARCHITECTURE_MAP.md** sections 1-4 - Understand pages and components
3. Look at **UI_ARCHITECTURE_MAP.md** section 4 - Trace a user journey
4. Reference **UX_FRICTION_ANALYSIS.md** when you notice problems

### For Bug Fixing
1. Look up component in **QUICK_REFERENCE.md** - Find file location
2. Check **UX_FRICTION_ANALYSIS.md** - Is this a known issue?
3. Use **UI_ARCHITECTURE_MAP.md** to trace data flow
4. Use **QUICK_REFERENCE.md** debugging tips

### For Feature Development
1. Check **UI_ARCHITECTURE_MAP.md** section 5 - Can I reuse an API?
2. Check **QUICK_REFERENCE.md** - Find similar component pattern
3. Check **UX_FRICTION_ANALYSIS.md** - Will this conflict with known issues?
4. Reference **UI_ARCHITECTURE_MAP.md** state patterns - Follow the pattern

### For Performance Work
1. Read **UX_FRICTION_ANALYSIS.md** "Performance Chokepoints"
2. Check **QUICK_REFERENCE.md** "Component Size Reference"
3. Use **QUICK_REFERENCE.md** "Performance Notes"

### For Refactoring
1. Read **UX_FRICTION_ANALYSIS.md** - Understand the problems
2. Check **QUICK_REFERENCE.md** - See component dependencies
3. Use **UI_ARCHITECTURE_MAP.md** to verify impact of changes

---

## Key Insights

### What Works Well
- Two-mode UI (Explore vs Plan) is intuitive
- Step-by-step directions are clear and helpful
- Map visualization is clean
- Onboarding tutorial sets expectations
- Public route sharing (no auth needed)
- Saved items persist across sessions

### What Needs Improvement
- Authentication blocking discovery (FIX: allow unauthenticated browsing)
- No fallback for location permission (FIX: manual origin entry)
- Sidebar is a monolithic 1200-line component (FIX: break into 5-6 components)
- Journey save has too many steps (FIX: add save button on itinerary card)
- Frequent vehicle polling drains battery (FIX: increase to 30-60s interval)

### Technical Debt
- Routes sidebar needs refactoring (high priority)
- Map component could use performance optimization
- Missing optimistic updates on save operations
- Vehicle position data doesn't indicate freshness

---

## Next Steps (Recommended)

### Immediate (Week 1)
- [ ] Fix auth wall on route search (allow browsing without login)
- [ ] Add manual origin entry fallback
- [ ] Review the friction analysis with team

### Short Term (Weeks 2-4)
- [ ] Break down RoutesSidebar into 5-6 smaller components
- [ ] Implement optimistic updates for save operations
- [ ] Reduce vehicle refetch interval from 10s to 30-60s

### Medium Term (Month 1-2)
- [ ] Simplify journey save flow (fewer steps)
- [ ] Add performance optimizations to map component
- [ ] Implement vehicle position age indicator

### Long Term (Month 2+)
- [ ] Consider WebSocket for real-time vehicle updates
- [ ] Add ability to predict vehicle movement
- [ ] Mobile-specific optimizations

---

## Document Files Created

All three documents are in the repository root:
1. `UI_ARCHITECTURE_MAP.md` - Complete technical reference
2. `QUICK_REFERENCE.md` - Quick lookup guide
3. `UX_FRICTION_ANALYSIS.md` - Problems and solutions
4. `DOCUMENTATION_SUMMARY.md` - This file

---

## Questions This Documentation Answers

"Where is the code for...?"
→ Use **QUICK_REFERENCE.md** file organization section

"How does the user journey work?"
→ Use **UI_ARCHITECTURE_MAP.md** section 4

"What's the component hierarchy?"
→ Use **QUICK_REFERENCE.md** component dependencies

"How does state flow through the app?"
→ Use **UI_ARCHITECTURE_MAP.md** section 3

"What are the performance issues?"
→ Use **UX_FRICTION_ANALYSIS.md** performance section

"How do I trace a bug?"
→ Use **QUICK_REFERENCE.md** debugging tips

"What's the priority for fixing things?"
→ Use **UX_FRICTION_ANALYSIS.md** recommendations priority list

"How do I add a new feature?"
→ Use **QUICK_REFERENCE.md** critical flows + **UI_ARCHITECTURE_MAP.md** state patterns

---

## Questions? Refer to...

- Component locations → QUICK_REFERENCE
- Data flow → UI_ARCHITECTURE_MAP
- Performance issues → UX_FRICTION_ANALYSIS
- State management → UI_ARCHITECTURE_MAP section 3
- User flows → UI_ARCHITECTURE_MAP section 4
- API endpoints → QUICK_REFERENCE
- Debugging → QUICK_REFERENCE
- Refactoring → UX_FRICTION_ANALYSIS

---

Generated: November 10, 2025
Lokal Transit App - Complete UI Architecture Analysis

