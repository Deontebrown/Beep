const DEFAULT_API_URL = "http://localhost:3000";

export function apiUrl() {
  return process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_URL;
}

export async function api(path, { token, ...options } = {}) {
  const response = await fetch(`${apiUrl()}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}
