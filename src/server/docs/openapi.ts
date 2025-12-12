import type { OpenAPIV3 } from "openapi-types";

const errorReference = "#/components/schemas/ErrorResponse";
const validationErrorReference = "#/components/schemas/ValidationErrorResponse";

export const openApiDocument: OpenAPIV3.Document = {
  openapi: "3.0.3",
  info: {
    title: "Lokal Transit API",
    description:
      "HTTP API for Lokal.",
    version: "0.2.0",
  },
  servers: [
    {
      url: "http://localhost:3000",
      description: "Local development",
    },
    {
      url: "https://{domain}",
      description: "Production",
      variables: {
        domain: {
          default: "api.example.com",
          description: "Replace with the deployed domain for the API.",
        },
      },
    },
  ],
  tags: [
    {
      name: "Auth",
      description: "Authentication and session lifecycle endpoints.",
    },
    {
      name: "Routing",
      description: "Trip planning and transit network helpers.",
    },
    {
      name: "Stops",
      description: "Transit stop metadata and departure information.",
    },
    {
      name: "Users",
      description: "User profile and personalization endpoints.",
    },
    {
      name: "Journeys",
      description: "Saved journey retrieval endpoints.",
    },
  ],
  paths: {
    "/api/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Register a user",
        description:
          "Creates a new user account, issues an access token, and stores access/refresh tokens in HTTP-only cookies.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RegisterRequest" },
              examples: {
                basic: {
                  value: {
                    email: "user@example.com",
                    password: "asdf1234",
                    name: "Wai Soon",
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "User registered successfully.",
            headers: {
              "Set-Cookie": {
                description:
                  "Contains `access_token` and `refresh_token` HTTP-only cookies used by the client for subsequent requests.",
                schema: { type: "string" },
              },
            },
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthSuccessResponse" },
              },
            },
          },
          "400": {
            description: "Validation failed.",
            content: {
              "application/json": {
                schema: { $ref: validationErrorReference },
              },
            },
          },
          "409": {
            description: "A user with the supplied email already exists.",
            content: {
              "application/json": {
                schema: { $ref: errorReference },
                examples: {
                  conflict: {
                    value: { error: "A user with that email already exists." },
                  },
                },
              },
            },
          },
          "500": {
            description: "Unexpected error while registering the user.",
            content: {
              "application/json": {
                schema: { $ref: errorReference },
              },
            },
          },
        },
      },
    },
    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Authenticate a user",
        description:
          "Validates a user's credentials, returns a short-lived access token, and renews the session cookies.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LoginRequest" },
              examples: {
                credentials: {
                  value: {
                    email: "user@example.com",
                    password: "asdf1234",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Credentials accepted.",
            headers: {
              "Set-Cookie": {
                description:
                  "Updated `access_token` and `refresh_token` HTTP-only cookies.",
                schema: { type: "string" },
              },
            },
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthSuccessResponse" },
              },
            },
          },
          "400": {
            description: "Malformed payload.",
            content: {
              "application/json": {
                schema: { $ref: validationErrorReference },
              },
            },
          },
          "401": {
            description: "Invalid email or password.",
            content: {
              "application/json": {
                schema: { $ref: errorReference },
                examples: {
                  invalidCredentials: {
                    value: { error: "Invalid email or password." },
                  },
                },
              },
            },
          },
          "500": {
            description: "Unexpected error while logging in.",
            content: {
              "application/json": {
                schema: { $ref: errorReference },
              },
            },
          },
        },
      },
    },
    "/api/auth/refresh": {
      post: {
        tags: ["Auth"],
        summary: "Refresh an access token",
        description:
          "Exchanges a valid refresh token for a new access token and refresh token pair. The token is resolved from the `refresh_token` cookie or the optional JSON payload.",
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RefreshRequest" },
              examples: {
                explicitToken: {
                  value: {
                    refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Issued a new token pair.",
            headers: {
              "Set-Cookie": {
                description:
                  "Updated `access_token` and `refresh_token` HTTP-only cookies.",
                schema: { type: "string" },
              },
            },
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthSuccessResponse" },
              },
            },
          },
          "401": {
            description: "Refresh token is missing, invalid, or failed verification.",
            content: {
              "application/json": {
                schema: { $ref: errorReference },
                examples: {
                  missing: {
                    value: { error: "Refresh token missing." },
                  },
                  failure: {
                    value: { error: "Unable to refresh authentication token." },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Invalidate the current session",
        description:
          "Clears the access and refresh token cookies, ending the current session.",
        responses: {
          "200": {
            description: "Session cleared successfully.",
            headers: {
              "Set-Cookie": {
                description:
                  "Expires the `access_token` and `refresh_token` cookies.",
                schema: { type: "string" },
              },
            },
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SuccessResponse" },
              },
            },
          },
          "500": {
            description: "Unexpected error while clearing the session.",
            content: {
              "application/json": {
                schema: { $ref: errorReference },
              },
            },
          },
        },
      },
    },
    "/api/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Get current user",
        description: "Returns the authenticated user's profile derived from the access token cookie.",
        security: [{ CookieAuth: [] }],
        responses: {
          "200": {
            description: "Current user returned successfully.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["user"],
                  properties: { user: { $ref: "#/components/schemas/AuthUser" } },
                },
              },
            },
          },
          "401": {
            description: "Missing or invalid session.",
            content: { "application/json": { schema: { $ref: errorReference } } },
          },
        },
      },
    },
    "/api/directions": {
      post: {
        tags: ["Routing"],
        summary: "Plan an itinerary",
        description:
          "Builds suggested itineraries between coordinates, including optional multi-stop journeys. All distances are expressed in meters and durations in minutes.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/DirectionsRequest" },
              examples: {
                walkingWithBus: {
                  value: {
                    origin: { latitude: 14.5995, longitude: 120.9842 },
                    destination: { latitude: 14.5764, longitude: 121.0851 },
                    maxWalkingDistanceMeters: 800,
                    limit: 3,
                  },
                },
                multiStopJourney: {
                  summary: "Plan a journey with two intermediate stops",
                  value: {
                    origin: { latitude: 14.5995, longitude: 120.9842 },
                    destinations: [
                      { latitude: 14.5821, longitude: 121.0123, bufferMinutes: 15, purpose: "Meeting" },
                      { latitude: 14.5764, longitude: 121.0851 },
                    ],
                    limit: 3,
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Itineraries generated successfully.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/DirectionsResponse" },
              },
            },
          },
          "400": {
            description: "Invalid input provided.",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: errorReference },
                    { $ref: validationErrorReference },
                  ],
                },
              },
            },
          },
          "500": {
            description: "Planning failed due to an unexpected error.",
            content: {
              "application/json": {
                schema: { $ref: errorReference },
              },
            },
          },
        },
      },
    },
    "/api/routes": {
      get: {
        tags: ["Routing"],
        summary: "List available routes",
        description:
          "Fetches the transit routes stored in the system, including ordered stop information. Results are cached for 5 minutes.",
        responses: {
          "200": {
            description: "Routes returned successfully.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RoutesResponse" },
              },
            },
          },
          "500": {
            description: "Unexpected error while loading routes.",
            content: {
              "application/json": {
                schema: { $ref: errorReference },
              },
            },
          },
        },
      },
    },
    "/api/routes/{id}": {
      get: {
        tags: ["Routing"],
        summary: "Get route by ID",
        description: "Returns a specific transit route including its ordered stops. Results are cached for 5 minutes.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Unique identifier of the route.",
          },
        ],
        responses: {
          "200": {
            description: "Route returned successfully.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RouteDetailResponse" },
              },
            },
          },
          "404": {
            description: "Route not found.",
            content: {
              "application/json": {
                schema: { $ref: errorReference },
              },
            },
          },
          "500": {
            description: "Unexpected error while loading the route.",
            content: {
              "application/json": {
                schema: { $ref: errorReference },
              },
            },
          },
        },
      },
    },
    "/api/routes/{id}/bus": {
      get: {
        tags: ["Routing"],
        summary: "Get route bus info",
        description:
          "Returns a specific transit route including its ordered stops.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Unique identifier of the route.",
          },
        ],
        responses: {
          "200": {
            description: "Route returned successfully.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RouteDetailResponse" },
              },
            },
          },
          "404": {
            description: "Route not found.",
            content: {
              "application/json": {
                schema: { $ref: errorReference },
              },
            },
          },
        },
      },
    },
    "/api/routes/{id}/schedule": {
      get: {
        tags: ["Routing"],
        summary: "Get route schedule",
        description: "Returns the schedule for a specific route including trips and stop times. Results are cached for 5 minutes.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Unique identifier of the route.",
          },
          {
            name: "directionId",
            in: "query",
            required: false,
            schema: { type: "integer", enum: [0, 1] },
            description: "Filter trips by direction (0 or 1).",
          },
          {
            name: "date",
            in: "query",
            required: false,
            schema: { type: "string", format: "date" },
            description: "Date for the schedule in YYYY-MM-DD format. Defaults to today.",
          },
        ],
        responses: {
          "200": {
            description: "Schedule returned successfully.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ScheduleResponse" },
              },
            },
          },
          "404": {
            description: "Route not found.",
            content: {
              "application/json": {
                schema: { $ref: errorReference },
              },
            },
          },
        },
      },
    },
    "/api/routes/schedule": {
      get: {
        tags: ["Routing"],
        summary: "Get schedule by query",
        description: "Returns the schedule for a route specified by query parameter. Results are cached for 5 minutes.",
        parameters: [
          {
            name: "routeId",
            in: "query",
            required: true,
            schema: { type: "string" },
            description: "Unique identifier of the route.",
          },
          {
            name: "directionId",
            in: "query",
            required: false,
            schema: { type: "integer", enum: [0, 1] },
            description: "Filter trips by direction (0 or 1).",
          },
          {
            name: "date",
            in: "query",
            required: false,
            schema: { type: "string", format: "date" },
            description: "Date for the schedule in YYYY-MM-DD format. Defaults to today.",
          },
        ],
        responses: {
          "200": {
            description: "Schedule returned successfully.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ScheduleResponse" },
              },
            },
          },
          "400": {
            description: "Missing routeId parameter.",
            content: {
              "application/json": {
                schema: { $ref: errorReference },
              },
            },
          },
          "404": {
            description: "Route not found.",
            content: {
              "application/json": {
                schema: { $ref: errorReference },
              },
            },
          },
        },
      },
    },
    "/api/stops": {
      get: {
        tags: ["Stops"],
        summary: "List stops",
        description: "Returns a paginated list of transit stops. Supports search filtering. Results are cached for 5 minutes.",
        parameters: [
          {
            name: "limit",
            in: "query",
            required: false,
            schema: { type: "integer", minimum: 1, maximum: 500, default: 100 },
            description: "Maximum number of stops to return (max 500).",
          },
          {
            name: "offset",
            in: "query",
            required: false,
            schema: { type: "integer", minimum: 0, default: 0 },
            description: "Number of stops to skip for pagination.",
          },
          {
            name: "search",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "Search term to filter stops by name.",
          },
        ],
        responses: {
          "200": {
            description: "Stops returned successfully.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/StopsListResponse" },
              },
            },
          },
          "500": {
            description: "Unexpected error while loading stops.",
            content: {
              "application/json": {
                schema: { $ref: errorReference },
              },
            },
          },
        },
      },
    },
    "/api/stops/{id}": {
      get: {
        tags: ["Stops"],
        summary: "Get stop details",
        description: "Returns detailed information about a stop including upcoming departures. Results are cached for 1 minute.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Stop identifier.",
          },
          {
            name: "limit",
            in: "query",
            required: false,
            schema: { type: "integer", minimum: 1, maximum: 50, default: 10 },
            description: "Maximum number of upcoming departures to return (max 50).",
          },
        ],
        responses: {
          "200": {
            description: "Stop details returned successfully.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/StopDetailResponse" },
              },
            },
          },
          "404": {
            description: "Stop not found.",
            content: {
              "application/json": {
                schema: { $ref: errorReference },
              },
            },
          },
        },
      },
      put: {
        tags: ["Stops"],
        summary: "Update a stop",
        description: "Endpoint stub for updating stop metadata.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Stop identifier.",
          },
        ],
        responses: {
          "501": {
            description: "Not implemented.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/NotImplementedResponse" },
              },
            },
          },
        },
      },
    },
    "/api/user/{id}": {
      get: {
        tags: ["Users"],
        summary: "Get user profile",
        description: "Returns the authenticated user's profile. The path id must match the subject.",
        security: [{ CookieAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" }, description: "User identifier." },
        ],
        responses: {
          "200": {
            description: "Profile returned successfully.",
            content: { "application/json": { schema: { type: "object", required: ["user"], properties: { user: { $ref: "#/components/schemas/AuthUser" } } } } },
          },
          "401": { description: "Unauthorized.", content: { "application/json": { schema: { $ref: errorReference } } } },
          "404": { description: "User not found.", content: { "application/json": { schema: { $ref: errorReference } } } },
        },
      },
      put: {
        tags: ["Users"],
        summary: "Update user profile",
        description: "Updates the user's display name.",
        security: [{ CookieAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" }, description: "User identifier." },
        ],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/UpdateUserRequest" } } },
        },
        responses: {
          "200": { description: "Profile updated.", content: { "application/json": { schema: { type: "object", required: ["user"], properties: { user: { $ref: "#/components/schemas/AuthUser" } } } } } },
          "400": { description: "Validation failed.", content: { "application/json": { schema: { $ref: validationErrorReference } } } },
          "401": { description: "Unauthorized.", content: { "application/json": { schema: { $ref: errorReference } } } },
        },
      },
    },
    "/api/user/{id}/preferences": {
      put: {
        tags: ["Users"],
        summary: "Update user preferences",
        description: "Updates notification preferences for the user.",
        security: [{ CookieAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" }, description: "User identifier." },
        ],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/UpdatePreferencesRequest" } } },
        },
        responses: {
          "200": { description: "Preferences updated.", content: { "application/json": { schema: { type: "object", required: ["user"], properties: { user: { $ref: "#/components/schemas/AuthUser" } } } } } },
          "400": { description: "Validation failed.", content: { "application/json": { schema: { $ref: validationErrorReference } } } },
          "401": { description: "Unauthorized.", content: { "application/json": { schema: { $ref: errorReference } } } },
        },
      },
    },
    "/api/user/{id}/saved-items": {
      get: {
        tags: ["Users"],
        summary: "List saved items",
        description: "Returns all saved items (routes and journeys) for the user.",
        security: [{ CookieAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" }, description: "User identifier." },
        ],
        responses: {
          "200": {
            description: "Saved items returned.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SavedItemsResponse" },
              },
            },
          },
          "401": { description: "Unauthorized.", content: { "application/json": { schema: { $ref: errorReference } } } },
        },
      },
      post: {
        tags: ["Users"],
        summary: "Save an item",
        description: "Saves a route or journey for the user.",
        security: [{ CookieAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" }, description: "User identifier." },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SaveItemRequest" },
              examples: {
                saveRoute: {
                  summary: "Save a route",
                  value: {
                    type: "ROUTE",
                    routeId: "clxxxxxxxxxxxxxxxxxx",
                    nickname: "My commute route",
                  },
                },
                saveJourney: {
                  summary: "Save a journey",
                  value: {
                    type: "JOURNEY",
                    nickname: "Daily commute",
                    itineraryData: {
                      legs: [],
                      totalDistanceMeters: 5000,
                      totalDurationMinutes: 30,
                    },
                    originLat: 3.139,
                    originLng: 101.6869,
                    destinationLat: 3.1516,
                    destinationLng: 101.6942,
                    destinationName: "Office",
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Item saved.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["item"],
                  properties: { item: { $ref: "#/components/schemas/SavedItem" } },
                },
              },
            },
          },
          "400": { description: "Validation failed.", content: { "application/json": { schema: { $ref: validationErrorReference } } } },
          "401": { description: "Unauthorized.", content: { "application/json": { schema: { $ref: errorReference } } } },
        },
      },
    },
    "/api/user/{id}/saved-items/{itemId}": {
      get: {
        tags: ["Users"],
        summary: "Get saved item",
        description: "Returns a specific saved item.",
        security: [{ CookieAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" }, description: "User identifier." },
          { name: "itemId", in: "path", required: true, schema: { type: "string" }, description: "Saved item identifier." },
        ],
        responses: {
          "200": {
            description: "Item returned.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["item"],
                  properties: { item: { $ref: "#/components/schemas/SavedItem" } },
                },
              },
            },
          },
          "401": { description: "Unauthorized.", content: { "application/json": { schema: { $ref: errorReference } } } },
          "404": { description: "Item not found.", content: { "application/json": { schema: { $ref: errorReference } } } },
        },
      },
      delete: {
        tags: ["Users"],
        summary: "Delete saved item",
        description: "Deletes a saved item for the user.",
        security: [{ CookieAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" }, description: "User identifier." },
          { name: "itemId", in: "path", required: true, schema: { type: "string" }, description: "Saved item identifier." },
        ],
        responses: {
          "200": { description: "Item deleted.", content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessResponse" } } } },
          "401": { description: "Unauthorized.", content: { "application/json": { schema: { $ref: errorReference } } } },
          "404": { description: "Item not found.", content: { "application/json": { schema: { $ref: errorReference } } } },
        },
      },
    },
    "/api/journeys/{id}": {
      get: {
        tags: ["Journeys"],
        summary: "Get journey details",
        description: "Returns journey details. Authenticated users can access their own journeys with full details. Public access returns limited data for shared journeys only.",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Journey/saved item identifier." },
        ],
        responses: {
          "200": {
            description: "Journey returned successfully.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/JourneyDetailResponse" },
              },
            },
          },
          "404": {
            description: "Journey not found or not accessible.",
            content: { "application/json": { schema: { $ref: errorReference } } },
          },
          "500": {
            description: "Unexpected error.",
            content: { "application/json": { schema: { $ref: errorReference } } },
          },
        },
      },
    },
    "/api/bus/{id}": {
      get: {
        tags: ["Routing"],
        summary: "Get bus details",
        description: "Endpoint stub for per-bus service information.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Unique bus identifier.",
          },
        ],
        responses: {
          "501": {
            description: "Not implemented.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/NotImplementedResponse" },
              },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      CookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "access_token",
        description:
          "HTTP-only cookie issued by the authentication endpoints. Include it to call endpoints that require an authenticated user.",
      },
    },
    schemas: {
      RegisterRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: {
            type: "string",
            format: "email",
            description: "Unique email address of the new user.",
            example: "user@example.com",
          },
          password: {
            type: "string",
            minLength: 8,
            description: "Password with a minimum length of 8 characters.",
            example: "asdf1234",
          },
          name: {
            type: "string",
            minLength: 1,
            maxLength: 120,
            description: "Optional display name of the user.",
          },
        },
      },
      LoginRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: {
            type: "string",
            format: "email",
            description: "Email address associated with the account.",
          },
          password: {
            type: "string",
            minLength: 1,
            description: "Password for the account.",
          },
        },
      },
      RefreshRequest: {
        type: "object",
        properties: {
          refreshToken: {
            type: "string",
            description:
              "Refresh token issued by `/api/auth/login` or `/api/auth/refresh`. When omitted, the server attempts to read the `refresh_token` cookie.",
          },
        },
        additionalProperties: false,
      },
      AuthUser: {
        type: "object",
        required: ["id", "email"],
        properties: {
          id: {
            type: "string",
            description: "Unique user identifier.",
          },
          email: {
            type: "string",
            format: "email",
            description: "User email address.",
          },
          name: {
            type: "string",
            nullable: true,
            description: "Optional display name.",
          },
          notificationsEnabled: {
            type: "boolean",
            description: "Whether user opted in to notifications.",
          },
        },
      },
      UpdateUserRequest: {
        type: "object",
        required: ["name"],
        properties: {
          name: {
            type: "string",
            minLength: 1,
            maxLength: 120,
            description: "Display name of the user.",
          },
        },
      },
      UpdatePreferencesRequest: {
        type: "object",
        required: ["notificationsEnabled"],
        properties: {
          notificationsEnabled: {
            type: "boolean",
            description: "Enable or disable notifications.",
          },
        },
      },
      SaveItemRequest: {
        oneOf: [
          { $ref: "#/components/schemas/SaveJourneyRequest" },
          { $ref: "#/components/schemas/SaveRouteRequest" },
        ],
        discriminator: {
          propertyName: "type",
          mapping: {
            JOURNEY: "#/components/schemas/SaveJourneyRequest",
            ROUTE: "#/components/schemas/SaveRouteRequest",
          },
        },
      },
      SaveJourneyRequest: {
        type: "object",
        required: ["type", "itineraryData", "originLat", "originLng", "destinationLat", "destinationLng"],
        properties: {
          type: { type: "string", enum: ["JOURNEY"] },
          nickname: { type: "string", maxLength: 120 },
          itineraryData: {
            type: "object",
            required: ["legs", "totalDistanceMeters", "totalDurationMinutes"],
            properties: {
              legs: { type: "array", items: { type: "object" } },
              totalDistanceMeters: { type: "number" },
              totalDurationMinutes: { type: "number" },
              routeId: { type: "string" },
              routeName: { type: "string" },
              routeNumber: { type: "string" },
              startStopId: { type: "string" },
              endStopId: { type: "string" },
            },
          },
          originLat: { type: "number" },
          originLng: { type: "number" },
          destinationLat: { type: "number" },
          destinationLng: { type: "number" },
          destinationName: { type: "string", maxLength: 200 },
        },
      },
      SaveRouteRequest: {
        type: "object",
        required: ["type", "routeId"],
        properties: {
          type: { type: "string", enum: ["ROUTE"] },
          routeId: { type: "string", description: "ID of the route to save." },
          nickname: { type: "string", maxLength: 120 },
        },
      },
      SavedItem: {
        type: "object",
        required: ["id", "userId", "type", "createdAt"],
        properties: {
          id: { type: "string" },
          userId: { type: "string" },
          type: { type: "string", enum: ["ROUTE", "JOURNEY"] },
          nickname: { type: "string", nullable: true },
          routeId: { type: "string", nullable: true },
          itineraryData: { type: "object", nullable: true },
          originLat: { type: "number", nullable: true },
          originLng: { type: "number", nullable: true },
          destinationLat: { type: "number", nullable: true },
          destinationLng: { type: "number", nullable: true },
          destinationName: { type: "string", nullable: true },
          totalDistance: { type: "number", nullable: true },
          totalDuration: { type: "number", nullable: true },
          lastViewed: { type: "string", format: "date-time", nullable: true },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      SavedItemsResponse: {
        type: "object",
        required: ["items"],
        properties: {
          items: { type: "array", items: { $ref: "#/components/schemas/SavedItem" } },
        },
      },
      AuthSuccessResponse: {
        type: "object",
        required: ["user", "accessToken"],
        properties: {
          user: { $ref: "#/components/schemas/AuthUser" },
          accessToken: {
            type: "string",
            description:
              "Base64 encoded JSON Web Token (JWT) granted to the authenticated user.",
          },
        },
      },
      SuccessResponse: {
        type: "object",
        required: ["success"],
        properties: {
          success: {
            type: "boolean",
            description: "Indicates whether the operation completed successfully.",
          },
        },
        example: { success: true },
      },
      Coordinate: {
        type: "object",
        required: ["latitude", "longitude"],
        properties: {
          latitude: {
            type: "number",
            minimum: -90,
            maximum: 90,
            description: "Latitude expressed in decimal degrees.",
          },
          longitude: {
            type: "number",
            minimum: -180,
            maximum: 180,
            description: "Longitude expressed in decimal degrees.",
          },
          stopName: {
            type: "string",
            description: "Optional name for the stop/location.",
          },
          bufferMinutes: {
            type: "integer",
            minimum: 0,
            maximum: 1440,
            description: "Optional buffer time to spend at this location (max 24 hours).",
          },
          purpose: {
            type: "string",
            maxLength: 200,
            description: "Optional description of purpose at this stop.",
          },
        },
      },
      DirectionsRequest: {
        type: "object",
        required: ["origin"],
        allOf: [
          {
            anyOf: [
              { required: ["destination"] },
              { required: ["destinations"] },
            ],
          },
        ],
        properties: {
          origin: {
            $ref: "#/components/schemas/Coordinate",
          },
          destination: {
            $ref: "#/components/schemas/Coordinate",
            description:
              "Optional single destination. When provided with `destinations`, it is treated as the final stop in the journey.",
          },
          destinations: {
            type: "array",
            minItems: 1,
            items: { $ref: "#/components/schemas/Coordinate" },
            description:
              "Ordered list of stops to visit after the origin. If supplied, the planner will return multi-stop itineraries.",
          },
          departureTime: {
            type: "string",
            format: "date-time",
            description:
              "Optional ISO-8601 timestamp representing the desired departure time. Must not be in the past or more than 7 days in the future. Defaults to the current time if omitted.",
          },
          maxWalkingDistanceMeters: {
            type: "number",
            minimum: 1,
            description:
              "Optional cap (in meters) on the walking distance to or from stops. Defaults to 1000 meters.",
          },
          limit: {
            type: "integer",
            minimum: 1,
            maximum: 5,
            description:
              "Optional limit on the number of itineraries returned. Values above 5 are clamped to 5.",
          },
        },
      },
      DirectionsResponse: {
        type: "object",
        required: ["generatedAt", "itineraries"],
        properties: {
          generatedAt: {
            type: "string",
            format: "date-time",
            description: "ISO-8601 timestamp when the itineraries were generated.",
          },
          itineraries: {
            type: "array",
            items: { $ref: "#/components/schemas/PlanItinerary" },
            description: "Ordered itineraries sorted by total travel time.",
          },
        },
      },
      PlanItinerary: {
        type: "object",
        required: ["legs", "totalDistanceMeters", "totalDurationMinutes"],
        properties: {
          legs: {
            type: "array",
            items: { $ref: "#/components/schemas/PlanLeg" },
            description: "Ordered legs that comprise the itinerary.",
          },
          totalDistanceMeters: {
            type: "number",
            description: "Total travel distance across all legs, in meters.",
          },
          totalDurationMinutes: {
            type: "number",
            description: "Estimated travel duration across all legs, in minutes.",
          },
          routeId: {
            type: "string",
            description: "Identifier of the transit route taken, when applicable.",
          },
          routeName: {
            type: "string",
            description: "Display name of the transit route.",
          },
          routeNumber: {
            type: "string",
            description: "Public-facing route number (if applicable).",
          },
          routeColor: {
            type: "string",
            description: "Route display color in hex format.",
          },
          startStopId: {
            type: "string",
            description: "Identifier of the boarding stop for transit legs.",
          },
          endStopId: {
            type: "string",
            description: "Identifier of the getting off stop for transit legs.",
          },
          dataSource: {
            type: "string",
            enum: ["realtime", "scheduled", "estimated"],
            description: "Source of departure time data.",
          },
          stops: {
            type: "array",
            items: { $ref: "#/components/schemas/PlanStop" },
            description: "Multi-stop journey waypoints with arrival/departure times.",
          },
          totalBufferMinutes: {
            type: "number",
            description: "Total buffer time across all stops.",
          },
        },
      },
      PlanLeg: {
        type: "object",
        required: ["type", "distanceMeters", "durationMinutes", "start", "end"],
        properties: {
          type: {
            type: "string",
            enum: ["walk", "bus"],
            description: "Mode of travel for the leg.",
          },
          distanceMeters: {
            type: "number",
            description: "Distance traveled in the leg, in meters.",
          },
          durationMinutes: {
            type: "number",
            description: "Estimated duration to complete the leg, in minutes.",
          },
          start: {
            $ref: "#/components/schemas/Coordinate",
          },
          end: {
            $ref: "#/components/schemas/Coordinate",
          },
          routeId: {
            type: "string",
            description: "Transit route identifier for bus legs.",
          },
          routeName: {
            type: "string",
            description: "Transit route name for bus legs.",
          },
          routeNumber: {
            type: "string",
            description: "Transit route number for bus legs.",
          },
          routeColor: {
            type: "string",
            description: "Transit route color for bus legs.",
          },
          startStopId: {
            type: "string",
            description: "Stop identifier where the leg begins.",
          },
          startStopName: {
            type: "string",
            description: "Stop display name where the leg begins.",
          },
          endStopId: {
            type: "string",
            description: "Stop identifier where the leg ends.",
          },
          endStopName: {
            type: "string",
            description: "Stop display name where the leg ends.",
          },
          stopCount: {
            type: "integer",
            description: "Number of stops traversed on a bus leg.",
          },
          path: {
            type: "array",
            items: { $ref: "#/components/schemas/Coordinate" },
            description: "Path coordinates for the leg.",
          },
          departureTime: {
            type: "string",
            format: "date-time",
            description: "Departure time for this leg.",
          },
          waitTimeMinutes: {
            type: "number",
            description: "Wait time before this leg starts.",
          },
          dataSource: {
            type: "string",
            enum: ["realtime", "scheduled", "estimated"],
            description: "Source of departure time data.",
          },
        },
      },
      PlanStop: {
        type: "object",
        required: ["name", "latitude", "longitude", "sequence", "bufferMinutes"],
        properties: {
          name: { type: "string" },
          latitude: { type: "number" },
          longitude: { type: "number" },
          sequence: { type: "integer" },
          bufferMinutes: { type: "number" },
          purpose: { type: "string" },
          arrivalTime: { type: "string", format: "date-time" },
          departureTime: { type: "string", format: "date-time" },
        },
      },
      RoutesResponse: {
        type: "object",
        required: ["routes"],
        properties: {
          routes: {
            type: "array",
            items: { $ref: "#/components/schemas/Route" },
            description: "Collection of transit routes stored in the system.",
          },
        },
      },
      RouteDetailResponse: {
        type: "object",
        required: ["route"],
        properties: {
          route: {
            $ref: "#/components/schemas/Route",
          },
        },
      },
      Route: {
        type: "object",
        required: [
          "id",
          "name",
          "number",
          "origin",
          "destination",
          "totalStops",
          "duration",
          "stops",
        ],
        properties: {
          id: {
            type: "string",
            description: "Unique identifier assigned to the route.",
          },
          name: {
            type: "string",
            description: "Display name of the route.",
          },
          number: {
            type: "string",
            description: "Public-facing route number or code.",
          },
          origin: {
            type: "string",
            description: "Origin stop name or description.",
          },
          destination: {
            type: "string",
            description: "Destination stop name or description.",
          },
          totalStops: {
            type: "integer",
            description: "Total number of stops served by the route.",
          },
          duration: {
            type: "integer",
            description: "Approximate travel duration across the route (minutes).",
          },
          stops: {
            type: "array",
            items: { $ref: "#/components/schemas/RouteStop" },
            description: "Ordered list of stops covered by the route.",
          },
        },
      },
      RouteStop: {
        type: "object",
        required: ["id", "name", "latitude", "longitude", "sequence"],
        properties: {
          id: {
            type: "string",
            description: "Unique identifier for the stop.",
          },
          name: {
            type: "string",
            description: "Display name of the stop.",
          },
          latitude: {
            type: "number",
            description: "Latitude coordinate of the stop.",
          },
          longitude: {
            type: "number",
            description: "Longitude coordinate of the stop.",
          },
          sequence: {
            type: "integer",
            description:
              "Index of the stop within the route (starting from zero).",
          },
        },
      },
      ScheduleResponse: {
        type: "object",
        required: ["route", "date", "trips"],
        properties: {
          route: {
            type: "object",
            required: ["id", "name", "number"],
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              number: { type: "string" },
            },
          },
          date: {
            type: "string",
            format: "date",
            description: "The date for which the schedule is returned.",
          },
          activeServices: {
            type: "array",
            items: { type: "integer" },
            description: "Service IDs active on the given date.",
          },
          trips: {
            type: "array",
            items: { $ref: "#/components/schemas/ScheduleTrip" },
          },
        },
      },
      ScheduleTrip: {
        type: "object",
        required: ["id", "headsign", "directionId", "serviceId", "stopTimes"],
        properties: {
          id: { type: "string" },
          headsign: { type: "string" },
          directionId: { type: "integer" },
          serviceId: { type: "integer" },
          stopTimes: {
            type: "array",
            items: { $ref: "#/components/schemas/StopTime" },
          },
        },
      },
      StopTime: {
        type: "object",
        required: ["arrivalTime", "departureTime", "stopSequence", "isTimepoint"],
        properties: {
          arrivalTime: { type: "string", description: "Arrival time in HH:MM:SS format." },
          departureTime: { type: "string", description: "Departure time in HH:MM:SS format." },
          stopSequence: { type: "integer" },
          isTimepoint: { type: "boolean" },
          stop: { $ref: "#/components/schemas/RouteStop" },
        },
      },
      StopsListResponse: {
        type: "object",
        required: ["stops", "total", "limit", "offset"],
        properties: {
          stops: {
            type: "array",
            items: { $ref: "#/components/schemas/RouteStop" },
          },
          total: {
            type: "integer",
            description: "Total number of stops matching the query.",
          },
          limit: {
            type: "integer",
            description: "Number of stops returned.",
          },
          offset: {
            type: "integer",
            description: "Number of stops skipped.",
          },
        },
      },
      StopDetailResponse: {
        type: "object",
        required: ["stop"],
        properties: {
          stop: {
            allOf: [
              { $ref: "#/components/schemas/RouteStop" },
              {
                type: "object",
                properties: {
                  stopNumericId: { type: "integer" },
                  route: { $ref: "#/components/schemas/Route" },
                  upcomingDepartures: {
                    type: "array",
                    items: { $ref: "#/components/schemas/UpcomingDeparture" },
                  },
                },
              },
            ],
          },
        },
      },
      UpcomingDeparture: {
        type: "object",
        required: ["departureTime", "headsign", "directionId"],
        properties: {
          departureTime: { type: "string", description: "Departure time in HH:MM:SS format." },
          arrivalTime: { type: "string" },
          headsign: { type: "string" },
          directionId: { type: "integer" },
          route: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              number: { type: "string" },
            },
          },
        },
      },
      JourneyDetailResponse: {
        type: "object",
        required: ["journey"],
        properties: {
          journey: {
            type: "object",
            required: ["id"],
            properties: {
              id: { type: "string" },
              nickname: { type: "string", nullable: true },
              itineraryData: { type: "object", nullable: true },
              destinationName: { type: "string", nullable: true },
              totalDistance: { type: "number", nullable: true },
              totalDuration: { type: "number", nullable: true },
              createdAt: { type: "string", format: "date-time" },
              originLat: { type: "number" },
              originLng: { type: "number" },
              destinationLat: { type: "number" },
              destinationLng: { type: "number" },
            },
          },
        },
      },
      NotImplementedResponse: {
        type: "object",
        required: ["message"],
        properties: {
          message: {
            type: "string",
            description: "Placeholder message indicating the endpoint is not yet implemented.",
          },
        },
      },
      ErrorResponse: {
        type: "object",
        required: ["error"],
        properties: {
          error: {
            oneOf: [
              {
                type: "string",
                description: "Human readable error message.",
              },
              {
                type: "object",
                additionalProperties: true,
                description:
                  "Structured error payload (often produced by validation failures).",
              },
            ],
          },
        },
      },
      ValidationErrorResponse: {
        type: "object",
        required: ["error"],
        properties: {
          error: {
            type: "object",
            additionalProperties: true,
            description:
              "Validation issues keyed by field as produced by Zod's `flatten()` output.",
          },
          issues: {
            type: "array",
            description:
              "Optional list of granular issues returned by validation errors.",
            items: {
              type: "object",
              additionalProperties: true,
            },
          },
        },
      },
    },
  },
};

export type { OpenAPIV3 };
