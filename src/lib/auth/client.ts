import { createAuthClient } from "better-auth/react";

// Defaults to the current origin with the `/api/auth` base path, so no explicit
// base URL is required on the client.
export const authClient = createAuthClient();
