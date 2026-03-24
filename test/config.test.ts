import test from "node:test";
import assert from "node:assert/strict";
import { inferAuthMode, redactSecret } from "../src/config.js";

test("redactSecret keeps only a small prefix and suffix", () => {
  assert.equal(redactSecret("AQ.Ab8RN6IK7vhBDNdsnbJa1AKooJ64Lr0LuOJFQQkSs7_h3i1hDw"), "AQ.A…1hDw");
});

test("inferAuthMode prefers apiKey when present", () => {
  assert.equal(inferAuthMode({ apiKey: "abc123" }), "apiKey");
});

test("inferAuthMode accepts oauth only when access token and project id are both present", () => {
  assert.equal(inferAuthMode({ accessToken: "token", projectId: "project-1" }), "oauth");
  assert.equal(inferAuthMode({ accessToken: "token" }), "none");
  assert.equal(inferAuthMode({ projectId: "project-1" }), "none");
});
