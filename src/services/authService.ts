import { authApi } from "../api/client";
import { isMockApiEnabled } from "../config/runtime";
import { validateMockSession } from "../mocks/mockApi";

export async function validateSession(sessionId: string): Promise<boolean> {
  if (isMockApiEnabled) {
    return validateMockSession(sessionId);
  }

  const response = await authApi.validateTokenAuthValidateGet(sessionId);

  if (typeof response === "boolean") {
    return response;
  }

  throw new Error("Unexpected session validation response");
}
