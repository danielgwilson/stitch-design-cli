import test from "node:test";
import assert from "node:assert/strict";
import {
  collectStrings,
  createScreenMutationResult,
  extractOutputMessages,
  extractScreensFromOutput,
  serializeProject,
  serializeScreen,
  splitCsv,
} from "../src/normalize.js";

test("splitCsv trims and removes empty values", () => {
  assert.deepEqual(splitCsv("a, b ,,c"), ["a", "b", "c"]);
});

test("collectStrings appends repeated option values", () => {
  assert.deepEqual(collectStrings("a,b", ["z"]), ["z", "a", "b"]);
});

test("serializeProject resolves project id from resource name", () => {
  const result = serializeProject({
    name: "projects/4044680601076201931",
    title: "Sandbox",
  });
  assert.equal(result.projectId, "4044680601076201931");
  assert.equal(result.title, "Sandbox");
});

test("serializeScreen resolves screen id from resource name", () => {
  const result = serializeScreen({
    name: "projects/4044680601076201931/screens/98b50e2ddc9943efb387052637738f61",
    projectId: "4044680601076201931",
    title: "Landing Page",
  });
  assert.equal(result.screenId, "98b50e2ddc9943efb387052637738f61");
  assert.equal(result.projectId, "4044680601076201931");
});

test("extractOutputMessages preserves text output components", () => {
  const raw = {
    outputComponents: [{ text: "Created a clean landing page." }, { text: "Try another direction?" }],
  };
  assert.deepEqual(extractOutputMessages(raw), ["Created a clean landing page.", "Try another direction?"]);
});

test("extractScreensFromOutput lifts nested design screens onto the project", () => {
  const raw = {
    outputComponents: [
      {
        design: {
          screens: [{ id: "screen-1", title: "One" }, { id: "screen-2", title: "Two" }],
        },
      },
    ],
  };
  assert.deepEqual(extractScreensFromOutput(raw, "project-1"), [
    { id: "screen-1", title: "One", projectId: "project-1" },
    { id: "screen-2", title: "Two", projectId: "project-1" },
  ]);
});

test("createScreenMutationResult produces a stable list envelope", () => {
  const result = createScreenMutationResult(
    "project-1",
    ["screen-a"],
    [
      {
        id: "variant-1",
        title: "Variant 1",
        projectId: "project-1",
        htmlCode: { downloadUrl: "https://example.com/variant-1.html" },
      },
    ],
    ["Generated one variant."],
    { includeHtml: true },
  ) as {
    projectId: string;
    selectedScreenIds?: string[];
    count: number;
    messages: string[];
    items: Array<{ screenId: string; htmlUrl: string | null }>;
  };

  assert.equal(result.projectId, "project-1");
  assert.deepEqual(result.selectedScreenIds, ["screen-a"]);
  assert.equal(result.count, 1);
  assert.deepEqual(result.messages, ["Generated one variant."]);
  assert.equal(result.items[0]?.screenId, "variant-1");
  assert.equal(result.items[0]?.htmlUrl, "https://example.com/variant-1.html");
});
