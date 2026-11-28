// Unit tests for the Week 11 friendly error messages (src/lib/errors.ts).
// Run them with:  npm test

import { describe, expect, it } from "@jest/globals";
import { friendlyError } from "../errors";

const firebaseError = (code: string) => Object.assign(new Error("FirebaseError"), { code });

describe("friendlyError", () => {
  it("says you're offline when the device has no internet", () => {
    expect(friendlyError(new Error("anything"), "save this item", true)).toBe(
      "You're offline, so we couldn't save this item. Check your internet and try again."
    );
  });

  it("says you're offline when Firebase can't reach the server", () => {
    expect(friendlyError(firebaseError("unavailable"), "load your pantry", false)).toMatch(/^You're offline/);
    expect(friendlyError(firebaseError("auth/network-request-failed"), "sign in", false)).toMatch(/^You're offline/);
  });

  it("says you're offline when a web request fails", () => {
    expect(friendlyError(new TypeError("Failed to fetch"), "load recipes", false)).toMatch(/^You're offline/);
  });

  it("suggests signing in again when permission is denied", () => {
    expect(friendlyError(firebaseError("permission-denied"), "delete this item", false)).toBe(
      "You don't have permission to delete this item. Try signing out and back in."
    );
  });

  it("explains when something was already deleted", () => {
    expect(friendlyError(firebaseError("not-found"), "update this item", false)).toMatch(/no longer exists/);
  });

  it("asks the user to wait when there are too many requests", () => {
    expect(friendlyError(firebaseError("resource-exhausted"), "save", false)).toMatch(/Wait a minute/);
  });

  it("falls back to a general message for anything else", () => {
    expect(friendlyError("weird", "save your recipe", false)).toBe(
      "Something went wrong, so we couldn't save your recipe. Please try again."
    );
  });
});
