import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { isErr } from "@/domain/shared/result";
import {
  loginBodySchema,
  onboardingBodySchema,
  registerBodySchema,
} from "@/presentation/dto/auth";
import { requireAuth } from "@/presentation/middleware/require-auth";
import {
  clearAuthCookies,
  getSessionId,
  setAuthCookies,
  toUserDto,
} from "@/infrastructure/auth/sessionCookies";

export const authRoutes = new Hono<{ Bindings: Env }>();

authRoutes.post("/register", zValidator("json", registerBodySchema), async (c) => {
  const container = c.get("container");
  const body = c.req.valid("json");
  const result = await container.registerUser.execute(body);

  if (isErr(result)) {
    throw result.error;
  }

  setAuthCookies(c, result.value.sessionId, result.value.csrfToken);

  return c.json({ user: toUserDto(result.value.user) }, 201);
});

authRoutes.post("/login", zValidator("json", loginBodySchema), async (c) => {
  const container = c.get("container");
  const body = c.req.valid("json");
  const result = await container.loginUser.execute(body);

  if (isErr(result)) {
    throw result.error;
  }

  setAuthCookies(c, result.value.sessionId, result.value.csrfToken);

  return c.json({ user: toUserDto(result.value.user) });
});

authRoutes.delete("/account", requireAuth(), async (c) => {
  const container = c.get("container");
  const user = c.get("currentUser");
  const result = await container.deleteAccount.execute(user.id);

  if (isErr(result)) {
    throw result.error;
  }

  clearAuthCookies(c);
  return c.body(null, 204);
});

authRoutes.post("/logout", requireAuth(), async (c) => {
  const container = c.get("container");
  const sessionId = getSessionId(c);
  await container.logoutUser.execute(sessionId);
  clearAuthCookies(c);
  return c.body(null, 204);
});

authRoutes.get("/me", requireAuth(), (c) => {
  return c.json({ user: toUserDto(c.get("currentUser")) });
});

authRoutes.post(
  "/onboarding",
  requireAuth(),
  zValidator("json", onboardingBodySchema),
  async (c) => {
    const container = c.get("container");
    const body = c.req.valid("json");
    const user = c.get("currentUser");
    const { complete, ...draft } = body;
    const result = await container.saveOnboarding.execute(user.id, draft, complete);

    if (isErr(result)) {
      throw result.error;
    }

    return c.json({
      onboarding: result.value,
      user: toUserDto({
        ...user,
        onboardingCompleted: result.value.completedAt != null,
      }),
    });
  },
);
