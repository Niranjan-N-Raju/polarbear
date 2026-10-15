type OpenAPIDocument = import("openapi-types").OpenAPIV3.Document;

const cookieAuth = {
  type: "apiKey" as const,
  in: "cookie" as const,
  name: "em_session",
  description: "HttpOnly JWT cookie set on successful login.",
};

const spec: OpenAPIDocument = {
  openapi: "3.0.3",
  info: {
    title: "Polar Bear Management API",
    version: "1.0.0",
    description:
      "REST API for the Polar Bear store management platform. All protected routes require an active `em_session` cookie obtained via `POST /api/auth/login`.",
  },
  servers: [{ url: "/api", description: "Current origin" }],
  components: {
    securitySchemes: {
      cookieAuth,
    },
    schemas: {
      Role: {
        type: "string",
        enum: ["admin", "sub_admin", "franchise_admin", "employee"],
        description:
          "`admin` = Super Admin · `sub_admin` = Global Admin · `franchise_admin` = Store Admin · `employee` = Staff",
      },
      StoreType: {
        type: "string",
        enum: ["franchise", "company"],
      },
      UserSummary: {
        type: "object",
        properties: {
          _id: { type: "string", example: "664a1b2c3d4e5f6789abcdef" },
          name: { type: "string", example: "Ravi Kumar" },
          email: { type: "string", format: "email", example: "ravi@abc.in" },
          role: { $ref: "#/components/schemas/Role" },
          franchises: {
            type: "array",
            items: {
              type: "object",
              properties: {
                _id: { type: "string" },
                name: { type: "string" },
              },
            },
          },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Store: {
        type: "object",
        properties: {
          _id: { type: "string", example: "664a1b2c3d4e5f6789abcdef" },
          name: { type: "string", example: "ABC Koramangala" },
          storeCode: { type: "string", example: "KOR001" },
          storeType: { $ref: "#/components/schemas/StoreType" },
          isActive: { type: "boolean", example: true },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Error: {
        type: "object",
        properties: {
          message: { type: "string" },
        },
      },
    },
    responses: {
      Unauthorized: {
        description: "Missing or invalid session cookie.",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
            example: { message: "Unauthorized" },
          },
        },
      },
      Forbidden: {
        description: "Authenticated but insufficient role.",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
            example: { message: "Forbidden" },
          },
        },
      },
      NotFound: {
        description: "Resource not found.",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
            example: { message: "User not found." },
          },
        },
      },
    },
  },
  security: [{ cookieAuth: [] }],
  paths: {
    // ── Auth ────────────────────────────────────────────────────────────────
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Log in",
        description:
          "Authenticates with email + password. Sets an `em_session` HttpOnly cookie on success.",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: {
                    type: "string",
                    format: "email",
                    example: "admin@example.com",
                  },
                  password: { type: "string", example: "Admin@1234" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Login successful.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                    user: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        name: { type: "string" },
                        email: { type: "string" },
                        role: { $ref: "#/components/schemas/Role" },
                      },
                    },
                  },
                },
                example: {
                  message: "Login successful.",
                  user: {
                    id: "664abc",
                    name: "Super Admin",
                    email: "admin@example.com",
                    role: "admin",
                  },
                },
              },
            },
          },
          "400": {
            description: "Email or password missing.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "401": {
            description: "Invalid credentials.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Log out",
        description:
          "Clears the `em_session`, `em_franchise`, and `em_franchise_name` cookies.",
        responses: {
          "200": {
            description: "Logged out successfully.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { message: { type: "string" } },
                },
                example: { message: "Logged out" },
              },
            },
          },
        },
      },
    },

    // ── Me ──────────────────────────────────────────────────────────────────
    "/me": {
      get: {
        tags: ["Profile"],
        summary: "Get current user",
        description:
          "Returns the profile of the currently logged-in user from the JWT.",
        responses: {
          "200": {
            description: "Current user profile.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    name: { type: "string" },
                    email: { type: "string" },
                    role: { $ref: "#/components/schemas/Role" },
                  },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
      patch: {
        tags: ["Profile"],
        summary: "Update current user",
        description:
          "Update the logged-in user's name and/or password. Re-issues the session cookie if name is changed.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: {
                    type: "string",
                    description: "New display name.",
                    example: "Ravi Kumar",
                  },
                  currentPassword: {
                    type: "string",
                    description: "Required when changing password.",
                  },
                  newPassword: {
                    type: "string",
                    minLength: 6,
                    description: "New password (min 6 chars).",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Profile updated.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { message: { type: "string" } },
                },
                example: { message: "Profile updated" },
              },
            },
          },
          "400": {
            description:
              "Validation error (empty name, wrong current password, etc.).",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    // ── Dashboard ───────────────────────────────────────────────────────────
    "/dashboard": {
      get: {
        tags: ["Dashboard"],
        summary: "Get dashboard stats",
        description:
          "Returns role-scoped statistics.\n\n**admin / sub_admin**: global store + user counts.\n\n**franchise_admin**: stats for their assigned stores.",
        responses: {
          "200": {
            description: "Dashboard statistics.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    totalStores: { type: "integer" },
                    activeStores: { type: "integer" },
                    franchiseStores: { type: "integer" },
                    companyStores: { type: "integer" },
                    totalUsers: { type: "integer" },
                    storeAdmins: { type: "integer" },
                    subAdmins: { type: "integer" },
                    employees: { type: "integer" },
                    assignedStores: {
                      type: "integer",
                      description: "franchise_admin only",
                    },
                  },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    // ── Stores ──────────────────────────────────────────────────────────────
    "/stores": {
      get: {
        tags: ["Stores"],
        summary: "List stores",
        description:
          "**admin / sub_admin**: all stores.\n\n**franchise_admin / employee**: only their assigned stores.",
        responses: {
          "200": {
            description: "Array of stores.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    franchises: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Store" },
                    },
                  },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
      post: {
        tags: ["Stores"],
        summary: "Create a store",
        description: "Creates a new store. **admin / sub_admin** only.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "storeCode", "storeType"],
                properties: {
                  name: {
                    type: "string",
                    example: "ABC Koramangala",
                  },
                  storeCode: {
                    type: "string",
                    example: "KOR001",
                    description: "Unique uppercase store code.",
                  },
                  storeType: {
                    $ref: "#/components/schemas/StoreType",
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Store created.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                    franchise: { $ref: "#/components/schemas/Store" },
                  },
                },
              },
            },
          },
          "400": {
            description: "Missing required fields.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "409": {
            description: "Store code already exists.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
                example: { message: "Store code KOR001 is already taken." },
              },
            },
          },
        },
      },
    },
    "/stores/select": {
      post: {
        tags: ["Stores"],
        summary: "Select active store",
        description:
          "Sets the `em_franchise` and `em_franchise_name` cookies for the active store. **admin / sub_admin** can select any store; others can only select assigned stores.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["franchiseId", "franchiseName"],
                properties: {
                  franchiseId: { type: "string", example: "664abc123" },
                  franchiseName: {
                    type: "string",
                    example: "ABC Koramangala",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Active store set.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { message: { type: "string" } },
                },
                example: { message: "Store selected." },
              },
            },
          },
          "400": {
            description: "Missing franchiseId or franchiseName.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
        },
      },
    },

    // ── Users ───────────────────────────────────────────────────────────────
    "/users": {
      get: {
        tags: ["Users"],
        summary: "List users",
        description:
          "Returns users visible to the caller (excludes the caller themselves).\n\n**admin / sub_admin**: all users, optionally filtered by `franchiseId`.\n\n**franchise_admin**: employees in their own stores only.",
        parameters: [
          {
            name: "franchiseId",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "Filter users by a specific store ID.",
          },
        ],
        responses: {
          "200": {
            description: "Array of users.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    users: {
                      type: "array",
                      items: { $ref: "#/components/schemas/UserSummary" },
                    },
                  },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
        },
      },
      post: {
        tags: ["Users"],
        summary: "Create a user",
        description:
          "Creates a new user.\n\n**Role hierarchy**: admin → sub_admin/franchise_admin · sub_admin → franchise_admin · franchise_admin → employee.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "email", "password", "role"],
                properties: {
                  name: { type: "string", example: "Ravi Kumar" },
                  email: {
                    type: "string",
                    format: "email",
                    example: "ravi@abc.in",
                  },
                  password: {
                    type: "string",
                    minLength: 6,
                    example: "Secret@123",
                  },
                  role: { $ref: "#/components/schemas/Role" },
                  franchiseIds: {
                    type: "array",
                    items: { type: "string" },
                    description:
                      "Store IDs to assign (not required for sub_admin).",
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "User created.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                    user: { $ref: "#/components/schemas/UserSummary" },
                  },
                },
              },
            },
          },
          "400": {
            description: "Validation error.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "409": {
            description: "Email already in use.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
                example: { message: "Email already in use." },
              },
            },
          },
        },
      },
    },
    "/users/{id}": {
      patch: {
        tags: ["Users"],
        summary: "Update a user",
        description:
          "Updates a user's name, role, or assigned stores. Caller must have authority over the target user's role.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "MongoDB ObjectId of the user.",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string", example: "Ravi Kumar" },
                  role: { $ref: "#/components/schemas/Role" },
                  franchiseIds: {
                    type: "array",
                    items: { type: "string" },
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "User updated.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                    user: { $ref: "#/components/schemas/UserSummary" },
                  },
                },
              },
            },
          },
          "400": {
            description: "No fields to update.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
      delete: {
        tags: ["Users"],
        summary: "Delete a user",
        description:
          "Deletes a user. Caller must have authority over the target's role. Cannot delete yourself.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "MongoDB ObjectId of the user.",
          },
        ],
        responses: {
          "200": {
            description: "User deleted.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { message: { type: "string" } },
                },
                example: { message: "User deleted." },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
  },
  tags: [
    { name: "Auth", description: "Login and logout" },
    { name: "Profile", description: "Logged-in user self-management" },
    { name: "Dashboard", description: "Role-scoped stats" },
    { name: "Stores", description: "Store CRUD and active store selection" },
    { name: "Users", description: "User CRUD with role-based access control" },
  ],
};

export default spec;
