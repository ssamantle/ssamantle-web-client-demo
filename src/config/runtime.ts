const TRUTHY_ENV_VALUES = new Set(["1", "true", "yes", "on"]);

function readBooleanEnv(value: string | undefined): boolean {
  if (!value) return false;

  return TRUTHY_ENV_VALUES.has(value.trim().toLowerCase());
}

export const apiBaseUrl = process.env.REACT_APP_API_BASE_URL?.trim() ?? "";
export const isMockApiEnabled = readBooleanEnv(process.env.REACT_APP_USE_MOCK_API);
