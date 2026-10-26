export async function api(path, method = "GET", data) {
  let response;
  try {
    response = await fetch("/api" + path, {
      method,
      ...(data instanceof FormData
        ? { body: data }
        : data === undefined
          ? {}
          : {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(data),
            }),
    });
  } catch {
    throw new Error(
      "Unable to connect. Your changes are still here. Please retry.",
    );
  }
  let result = null;
  if (response.status !== 204) {
    try {
      result = await response.json();
    } catch {
      throw new Error(
        "The server returned an unexpected response. Please retry.",
      );
    }
  }
  if (!response.ok) {
    const error = new Error(
      typeof result?.detail === "string"
        ? result.detail
        : result?.detail?.message ||
            result?.detail?.[0]?.msg ||
            `Request failed (${response.status}). Please retry.`,
    );
    error.status = response.status;
    throw error;
  }
  return result;
}
export const lines = (value) =>
  String(value || "")
    .replace(/\\n/g, "\n")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
export function readStored(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}
export function writeStored(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
export function readDraft(key) {
  try {
    return sessionStorage.getItem(key) || "";
  } catch {
    return "";
  }
}
export function saveDraft(key, value) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* The live form still retains its contents. */
  }
}
