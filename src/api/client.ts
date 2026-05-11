import { AuthApi, Configuration, GamesV1Api } from "@ssamantle/sdk-typescript";
import { apiBaseUrl, isMockApiEnabled } from "../config/runtime";

const missingApiBaseUrlError =
  "REACT_APP_API_BASE_URL is required unless REACT_APP_USE_MOCK_API=true";

function createMissingApiClient<T extends object>(): T {
  return new Proxy(
    {},
    {
      get() {
        return () => Promise.reject(new Error(missingApiBaseUrlError));
      },
    },
  ) as T;
}

function createApiClient<T extends object>(
  factory: (config: Configuration) => T,
): T {
  if (!apiBaseUrl && !isMockApiEnabled) {
    return createMissingApiClient<T>();
  }

  if (!apiBaseUrl) {
    return createMissingApiClient<T>();
  }

  return factory(
    new Configuration({
      basePath: apiBaseUrl,
    }),
  );
}

export const gamesApi = createApiClient((config) => new GamesV1Api(config));
export const authApi = createApiClient((config) => new AuthApi(config));
