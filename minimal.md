Added Progressive Web App (PWA) support:

Added manifest.json with standalone display mode, portrait orientation, theme colors, and maskable icons

Enhanced layout.tsx with Apple Web App meta tags for iOS home screen integration

Added multi-stop journey planning:

Implemented sequential segment planning in routing service for multiple destinations

Automatic route combination across journey segments with buffer time integration

Added JourneyStop model to database schema with bufferMinutes, purpose, arrival/departure times, and sequence ordering

Created JourneyStopsList component with visual stop indicators (A, B, C), drag-and-drop reordering, buffer time configuration (hours/minutes), purpose tracking, and quick presets (15min, 30min, 1hr, 2hr, 4hr)

Added departure time selection:

Created DepartureTimePicker component with toggle between "Leave now" and "Leave at specific time"

DateTime picker with 5-minute rounding and 7-day future planning window

Data source indicator showing realtime vs GTFS source

Integrated departure time with routing service for GTFS schedule lookup on future trips

Added drag-and-drop stop reordering:

Implemented @dnd-kit for touch-friendly drag handles with keyboard accessibility

Visual feedback during drag (opacity, shadow) with Framer Motion animations

Auto-replanning after stop reorder

Enhanced geolocation handling:

Auto-request location on first load with improved error handling

Manual origin override support with location persistence across sessions

Integrated location permission request in onboarding overlay

Implemented mobile bottom sheet layout:

Replaced sidebar with Framer Motion bottom sheet on mobile screens

Native-feeling drag gestures with spring animations

Height adjustment (600px default) with drag handle indicator

Desktop fallback to traditional sidebar

Added numeric ID support for GTFS integration:

Added routeNumericId field to Route model and stopNumericId field to Stop model

Database indexes for performance with backward compatibility for string IDs

Automatic numeric ID extraction from string IDs with type-safe conversion

Added data source orchestration:

Created DepartureOrchestrator with automatic real-time → GTFS fallback

Future trip detection (GTFS for trips >24hrs) with error handling and graceful degradation

Source indicator in UI showing data source

GTFS schedule integration with scheduled departure lookup, date-based trip filtering, and route-specific stop departures

Enhanced map rendering:

Added viewingSavedJourney prop for special rendering mode when viewing saved journeys

Origin/destination highlighting with preserved view state

Improved route search functionality:

Real-time search filtering with better result highlighting

Enhanced search state management

Added public journey sharing:

Public access to saved journeys via URL with shareable links containing journey ID

Destination name preservation in shared journeys

Extracted JourneyStopsList component for reusability across views with compact mode support

Added calculateMultiStopJourneyTimes() utility function for buffer time separation and stop-level time tracking

