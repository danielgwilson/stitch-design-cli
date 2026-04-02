import test from "node:test";
import assert from "node:assert/strict";
import { inferAuthMode, redactSecret } from "../src/config.js";

const SAMPLE_SECRET = "test_secret_for_redaction_0123456789";

test("redactSecret keeps only a small prefix and suffix", () => {
  assert.equal(redactSecret(SAMPLE_SECRET), "test…6789");
});

test("inferAuthMode prefers apiKey when present", () => {
  assert.equal(inferAuthMode({ apiKey: "abc123" }), "apiKey");
});

test("inferAuthMode accepts oauth only when access token and project id are both present", () => {
  assert.equal(inferAuthMode({ accessToken: "token", projectId: "project-1" }), "oauth");
  assert.equal(inferAuthMode({ accessToken: "token" }), "none");
  assert.equal(inferAuthMode({ projectId: "project-1" }), "none");
});
