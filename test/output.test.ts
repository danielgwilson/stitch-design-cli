import test from "node:test";
import assert from "node:assert/strict";
import { exitCodeFor, makeError } from "../src/output.js";

test("makeError preserves explicit code and message from plain objects", () => {
  const error = makeError({ code: "NOT_FOUND", message: "missing" });
  assert.equal(error.code, "NOT_FOUND");
  assert.equal(error.message, "missing");
  assert.equal(error.retryable, false);
});

test("makeError normalizes invalid credential transport errors", () => {
  const error = makeError({
    message:
      'Streamable HTTP error: Error POSTing to endpoint: {"result":{"content":[{"text":"Request had invalid authentication credentials. Expected OAuth 2 access token, login cookie or other valid authentication credential.","type":"text"}],"isError":true}}',
  });
  assert.equal(error.code, "AUTH_FAILED");
  assert.equal(error.message, "Stitch rejected the configured credentials");
  assert.match(error.detail || "", /authorized for project access/i);
});

test("exitCodeFor uses code 2 for user-actionable failures", () => {
  assert.equal(exitCodeFor("AUTH_MISSING"), 2);
  assert.equal(exitCodeFor("VALIDATION_ERROR"), 2);
  assert.equal(exitCodeFor("AUTH_FAILED"), 2);
});

test("exitCodeFor uses code 1 for request and upstream failures", () => {
  assert.equal(exitCodeFor("NOT_FOUND"), 1);
  assert.equal(exitCodeFor("RATE_LIMITED"), 1);
});
