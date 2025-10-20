import type { OpenAPIV3 } from "openapi-types";

const errorReference = "#/components/schemas/ErrorResponse";
const validationErrorReference = "#/components/schemas/ValidationErrorResponse";

export const openApiDocument: OpenAPIV3.Document = {
  openapi: "3.0.3",
  info: {
    title: "Lokal Transit API",
    description:
      "HTTP API for Lokal.",
    version: "0.1.0",
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
      name: "Alerts",
      description: "Service alerts subscription and management.",
    },
    {
      name: "Stops",
      description: "Transit stop metadata and management endpoints.",
    },
    {
      name: "Trips",
      description: "Planned journeys and commuting preferences.",
    },
    {
      name: "Users",
      description: "User profile and personalization endpoints.",
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
    "/api/directions": {
      post: {
        tags: ["Routing"],
        summary: "Plan an itinerary",
        description:
          "Builds suggested itineraries between two geographic coordinates. All distances are expressed in meters and durations in minutes.",
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
          "Fetches the transit routes stored in the system, including ordered stop information.",
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
    "/api/routes/{id}/bus": {
      get: {
        tags: ["Routing"],
        summary: "Get route details",
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
          "400": {
            description: "Missing route identifier.",
            content: {
              "application/json": {
                schema: { $ref: errorReference },
                examples: {
                  missing: { value: { error: "Route id is required" } },
                },
              },
            },
          },
          "404": {
            description: "Route not found.",
            content: {
              "application/json": {
                schema: { $ref: errorReference },
                examples: {
                  notFound: { value: { error: "Route 123 not found" } },
                },
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
    "/api/routes/schedule": {
      get: {
        tags: ["Routing"],
        summary: "Get schedule overview",
        description: "Endpoint stub for publishing route schedule data.",
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
    "/api/alerts": {
      get: {
        tags: ["Alerts"],
        summary: "List service alerts",
        description: "Endpoint stub for listing current alerts.",
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
      post: {
        tags: ["Alerts"],
        summary: "Create an alert",
        description: "Endpoint stub for creating service alerts.",
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
    "/api/alerts/{id}": {
      get: {
        tags: ["Alerts"],
        summary: "Get alert details",
        description: "Endpoint stub for retrieving a specific alert.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Alert identifier.",
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
      delete: {
        tags: ["Alerts"],
        summary: "Delete an alert",
        description: "Endpoint stub for deleting a saved alert.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Alert identifier.",
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
    "/api/stops": {
      get: {
        tags: ["Stops"],
        summary: "List stops",
        description: "Endpoint stub for listing all stops.",
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
    "/api/stops/{id}": {
      get: {
        tags: ["Stops"],
        summary: "Get stop details",
        description: "Endpoint stub for retrieving stop information.",
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
    "/api/trip": {
      get: {
        tags: ["Trips"],
        summary: "List trips",
        description: "Endpoint stub for listing planned trips for a user.",
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
    "/api/trip/{id}": {
      get: {
        tags: ["Trips"],
        summary: "Get trip details",
        description: "Endpoint stub for retrieving a specific trip.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Trip identifier.",
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
      post: {
        tags: ["Trips"],
        summary: "Create a trip occurrence",
        description: "Endpoint stub for creating trip occurrences or actions.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Trip identifier.",
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
      put: {
        tags: ["Trips"],
        summary: "Update a trip",
        description: "Endpoint stub for updating trip details.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Trip identifier.",
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
      delete: {
        tags: ["Trips"],
        summary: "Delete a trip",
        description: "Endpoint stub for deleting a trip.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Trip identifier.",
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
        description: "Endpoint stub for retrieving a user profile.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "User identifier.",
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
      put: {
        tags: ["Users"],
        summary: "Update user profile",
        description: "Endpoint stub for updating a user profile.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "User identifier.",
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
      delete: {
        tags: ["Users"],
        summary: "Delete user profile",
        description: "Endpoint stub for deleting a user account.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "User identifier.",
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
    "/api/user/{id}/preferences": {
      put: {
        tags: ["Users"],
        summary: "Update user preferences",
        description: "Endpoint stub for persisting user travel preferences.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "User identifier.",
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
        },
      },
      DirectionsRequest: {
        type: "object",
        required: ["origin", "destination"],
        properties: {
          origin: {
            $ref: "#/components/schemas/Coordinate",
          },
          destination: {
            $ref: "#/components/schemas/Coordinate",
          },
          departureTime: {
            type: "string",
            format: "date-time",
            description:
              "Optional ISO-8601 timestamp representing the desired departure time. Defaults to the current time if omitted.",
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
          startStopId: {
            type: "string",
            description: "Identifier of the boarding stop for transit legs.",
          },
          endStopId: {
            type: "string",
            description: "Identifier of the alighting stop for transit legs.",
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
