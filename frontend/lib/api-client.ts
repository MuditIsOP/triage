"use client";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000/api";

type ApiClientOptions = Omit<RequestInit, "headers"> & {
  token?: string | null;
  headers?: HeadersInit;
};

export class ApiClientError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const emitUnauthorizedEvent = (message: string) => {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent("auth:unauthorized", {
      detail: {
        message,
      },
    }),
  );
};

export const apiFetch = async <T>(path: string, options: ApiClientOptions = {}): Promise<T> => {
  const { token, headers, ...rest } = options;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  const data = (await response.json().catch(() => null)) as T | { message?: string } | null;

  if (response.status === 401) {
    const message =
      data && typeof data === "object" && "message" in data && data.message
        ? data.message
        : "Session expired or invalid. Please login again.";

    emitUnauthorizedEvent(message);
    throw new ApiClientError(401, message);
  }

  if (!response.ok) {
    const message =
      data && typeof data === "object" && "message" in data && data.message
        ? data.message
        : "Request failed";

    throw new ApiClientError(response.status, message);
  }

  return data as T;
};
