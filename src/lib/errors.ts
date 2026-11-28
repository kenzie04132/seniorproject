// ---------- Friendly error messages (Week 11) ----------
//
// Turns a technical error (like "FirebaseError: permission-denied") into a short
// message that tells the user what happened and what to do next.
//
//   friendlyError(error, "save this item")
//     -> "You're offline, so we couldn't save this item. Check your internet and try again."
//
// Plain logic with no internet or database calls, so it is easy to unit test.

// Does the browser say we're offline? (React Native has no navigator.onLine, so assume online.)
function browserIsOffline() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

// Firebase errors have a code like "permission-denied" or "auth/network-request-failed"
function errorCode(error: unknown) {
  const code = (error as { code?: unknown })?.code;
  return typeof code === "string" ? code.replace(/^(firestore|auth)\//, "") : "";
}

// fetch() fails with a TypeError like "Failed to fetch" when there's no internet
function isNetworkFailure(error: unknown) {
  const message = String((error as { message?: unknown })?.message ?? "").toLowerCase();
  return error instanceof TypeError && /fetch|network|load failed/.test(message);
}

// `action` finishes the sentence "we couldn't ___", e.g. "load your pantry"
export function friendlyError(error: unknown, action: string, offline = browserIsOffline()): string {
  const code = errorCode(error);

  if (offline || code === "unavailable" || code === "network-request-failed" || isNetworkFailure(error)) {
    return `You're offline, so we couldn't ${action}. Check your internet and try again.`;
  }
  switch (code) {
    case "permission-denied":
    case "unauthenticated":
      return `You don't have permission to ${action}. Try signing out and back in.`;
    case "not-found":
      return `We couldn't ${action} because it no longer exists. It may have been deleted.`;
    case "deadline-exceeded":
      return `It took too long to ${action}. Please try again.`;
    case "resource-exhausted":
    case "too-many-requests":
      return `Too many requests right now, so we couldn't ${action}. Wait a minute and try again.`;
    default:
      return `Something went wrong, so we couldn't ${action}. Please try again.`;
  }
}
