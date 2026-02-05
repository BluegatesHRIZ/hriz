const API_BASE = "/api";

export class ApiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "ApiError";
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  body?: string | Record<string, unknown>;
}

/**
 * Centralized API client for calling Next.js API routes.
 * Prepends /api to the path, sends JSON when body is an object, and throws ApiError on non-OK responses.
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const url = path.startsWith("http")
    ? path
    : `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;

  const { body, headers: customHeaders, ...rest } = options;

  const headers: Record<string, string> = {};
  if (customHeaders) {
    if (customHeaders instanceof Headers) {
      customHeaders.forEach((value, key) => {
        headers[key] = value;
      });
    } else if (Array.isArray(customHeaders)) {
      customHeaders.forEach(([key, value]) => {
        headers[key] = value;
      });
    } else {
      Object.assign(headers, customHeaders);
    }
  }

  let resolvedBody: string | undefined;
  if (body !== undefined) {
    if (typeof body === "string") {
      resolvedBody = body;
      if (!("Content-Type" in headers)) {
        headers["Content-Type"] = "application/json";
      }
    } else {
      resolvedBody = JSON.stringify(body);
      headers["Content-Type"] = "application/json";
    }
  }

  const response = await fetch(url, {
    ...rest,
    headers,
    body: resolvedBody,
  });

  if (!response.ok) {
    let message = response.statusText || "Request failed";
    const contentType = response.headers.get("Content-Type");
    if (contentType?.includes("application/json")) {
      try {
        const data = await response.json();
        message = (data as { message?: string }).message ?? message;
      } catch {
        // use statusText
      }
    }
    throw new ApiError(message, response.status);
  }

  const contentType = response.headers.get("Content-Type");
  if (contentType?.includes("application/json")) {
    const text = await response.text();
    if (!text.trim()) {
      return undefined as T;
    }
    return JSON.parse(text) as T;
  }

  return undefined as T;
}
