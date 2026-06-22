import { Request } from "express";

export type CurrentUser = {
  sub: string;
  role: "ADMIN" | "MANAGER" | "FINANCIAL" | "CLIENT";
};

export type AuthenticatedRequest = Request & { user?: CurrentUser };

export function currentUser(request: AuthenticatedRequest) {
  return request.user;
}

export function clientScope(user?: CurrentUser) {
  if (!user) return {};
  if (user.role === "CLIENT") return { users: { some: { id: user.sub } } };
  if (user.role === "ADMIN") return { OR: [{ ownerId: user.sub }, { ownerId: null }] };
  return {};
}

export function projectScope(user?: CurrentUser) {
  if (!user) return {};
  if (user.role === "CLIENT") return { client: { users: { some: { id: user.sub } } } };
  if (user.role === "ADMIN") return { client: { OR: [{ ownerId: user.sub }, { ownerId: null }] } };
  return {};
}

export function serviceScope(user?: CurrentUser) {
  if (!user) return {};
  if (user.role === "CLIENT") return { client: { users: { some: { id: user.sub } } } };
  if (user.role === "ADMIN") return { client: { OR: [{ ownerId: user.sub }, { ownerId: null }] } };
  return {};
}

export function contractScope(user?: CurrentUser) {
  if (!user) return {};
  if (user.role === "CLIENT") {
    return {
      OR: [
        { client: { users: { some: { id: user.sub } } } },
        { participants: { some: { userId: user.sub } } },
      ],
    };
  }
  if (user.role === "ADMIN") return { OR: [{ client: { ownerId: user.sub } }, { clientId: null }] };
  return {};
}
