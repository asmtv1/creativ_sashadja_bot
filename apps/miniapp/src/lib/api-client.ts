import {
  CourseAccessResponse,
  TelegramAuthResponse,
  TelegramAuthResponseSchema
} from "@course/shared";
import { getMiniAppToken, setMiniAppToken } from "./session";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export async function authenticateTelegram(initData: string): Promise<TelegramAuthResponse> {
  const payload = await request("/api/auth/telegram", {
    method: "POST",
    body: { initData }
  });
  const parsed = TelegramAuthResponseSchema.parse(payload);
  setMiniAppToken(parsed.token);
  return parsed;
}

export async function getMyCourse(): Promise<CourseAccessResponse> {
  return requestWithSession("/api/me/course");
}

async function requestWithSession(path: string, init: { method?: string; body?: unknown } = {}) {
  const token = getMiniAppToken();
  if (!token) {
    throw new Error("Mini App session is missing");
  }
  return request(path, {
    ...init,
    headers: { Authorization: `Bearer ${token}` }
  });
}

async function request(
  path: string,
  init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}
) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: init.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...init.headers
    },
    body: init.body ? JSON.stringify(init.body) : undefined
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message ?? `Request failed with ${response.status}`);
  }
  return payload;
}
