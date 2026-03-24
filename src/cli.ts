#!/usr/bin/env node
import { createRequire } from "node:module";
import { createInterface } from "node:readline/promises";
import { Command } from "commander";
import { clearConfig, getConfigPath, redactSecret, resolveConfig, type ResolvedConfig } from "./config.js";
import { saveAndValidateConfig, validateAuth } from "./auth.js";
import {
  collectStrings,
  createScreenMutationResult,
  extractOutputMessages,
  extractScreensFromOutput,
  serializeProject,
  serializeScreen,
  splitCsv,
} from "./normalize.js";
import { createSdkContext, hasAuth, AUTH_HELP_TEXT } from "./stitch-client.js";
import { exitCodeFor, fail, makeError, ok, printJson } from "./output.js";
import { withSuppressedTransportNoise } from "./transport-noise.js";

type CommonJsonOptions = { json?: boolean };
type DeviceType = "DEVICE_TYPE_UNSPECIFIED" | "MOBILE" | "DESKTOP" | "TABLET" | "AGNOSTIC";
type ModelId = "MODEL_ID_UNSPECIFIED" | "GEMINI_3_PRO" | "GEMINI_3_FLASH";
type CreativeRange = "CREATIVE_RANGE_UNSPECIFIED" | "REFINE" | "EXPLORE" | "REIMAGINE";
type VariantAspect = "VARIANT_ASPECT_UNSPECIFIED" | "LAYOUT" | "COLOR_SCHEME" | "IMAGES" | "TEXT_FONT" | "TEXT_CONTENT";

const DEVICE_TYPES: DeviceType[] = ["DEVICE_TYPE_UNSPECIFIED", "MOBILE", "DESKTOP", "TABLET", "AGNOSTIC"];
const MODEL_IDS: ModelId[] = ["MODEL_ID_UNSPECIFIED", "GEMINI_3_PRO", "GEMINI_3_FLASH"];
const CREATIVE_RANGES: CreativeRange[] = ["CREATIVE_RANGE_UNSPECIFIED", "REFINE", "EXPLORE", "REIMAGINE"];
const VARIANT_ASPECTS: VariantAspect[] = [
  "VARIANT_ASPECT_UNSPECIFIED",
  "LAYOUT",
  "COLOR_SCHEME",
  "IMAGES",
  "TEXT_FONT",
  "TEXT_CONTENT",
];

function getCliVersion(): string {
  try {
    const require = createRequire(import.meta.url);
    const pkg = require("../package.json") as { version?: unknown };
    return typeof pkg.version === "string" ? pkg.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function promptForApiKey(): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stderr,
    terminal: true,
  });
  try {
    process.stderr.write(`Saving to ${getConfigPath()}\n`);
    return (await rl.question("Stitch API key: ")).trim();
  } finally {
    rl.close();
  }
}

function printHuman(value: unknown): void {
  if (typeof value === "string") {
    // eslint-disable-next-line no-console
    console.log(value);
    return;
  }
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(value, null, 2));
}

function emitFailure(error: unknown, json = false, meta?: Record<string, unknown>): void {
  const cliError = makeError(error);
  if (json) printJson(fail(cliError, meta));
  else process.stderr.write(`${cliError.code}: ${cliError.message}\n`);
  if (cliError.detail && !json) process.stderr.write(`${cliError.detail}\n`);
  process.exitCode = exitCodeFor(cliError.code);
}

async function requireAuthConfig(json = false): Promise<ResolvedConfig | null> {
  const config = await resolveConfig();
  if (hasAuth(config)) return config;
  emitFailure({ code: "AUTH_MISSING", message: AUTH_HELP_TEXT }, json);
  return null;
}

async function runWithSdk<T>(
  options: CommonJsonOptions,
  task: (ctx: ReturnType<typeof createSdkContext> & { config: ResolvedConfig }) => Promise<T>,
  humanPrinter?: (data: T) => void,
): Promise<void> {
  const config = await requireAuthConfig(Boolean(options.json));
  if (!config) return;

  const ctx = createSdkContext(config);
  try {
    const data = await withSuppressedTransportNoise(() => task({ ...ctx, config }));
    if (options.json) printJson(ok(data));
    else if (humanPrinter) humanPrinter(data);
    else printHuman(data);
  } catch (error) {
    emitFailure(error, Boolean(options.json));
  } finally {
    await ctx.client.close();
  }
}

function printProjectList(items: Record<string, unknown>[]): void {
  for (const item of items) {
    // eslint-disable-next-line no-console
    console.log(`${item.projectId}\t${item.title ?? ""}`);
  }
}

function printScreenList(items: Record<string, unknown>[]): void {
  for (const item of items) {
    // eslint-disable-next-line no-console
    console.log(`${item.screenId}\t${item.projectId}\t${item.title ?? ""}`);
  }
}

function printToolList(items: Record<string, unknown>[]): void {
  for (const item of items) {
    // eslint-disable-next-line no-console
    console.log(`${item.name}\t${item.description ?? ""}`);
  }
}

function parsePositiveInteger(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`Expected a positive number, got ${value}`);
  return Math.round(parsed);
}

function validateEnum<T extends string>(value: string | undefined, allowed: readonly T[], label: string): void {
  if (value && !allowed.includes(value as T)) {
    const error = new Error(`Invalid ${label}: ${value}`);
    (error as Error & { code?: string }).code = "VALIDATION_ERROR";
    throw error;
  }
}

function validateVariantAspects(aspects: string[]): void {
  for (const aspect of aspects) validateEnum(aspect, VARIANT_ASPECTS, "aspect");
}

async function main(): Promise<void> {
  const program = new Command();

  program
    .name("stitch")
    .description("Agent-first CLI for Google's official Stitch SDK")
    .version(getCliVersion())
    .showHelpAfterError();

  const auth = program.command("auth").description("Manage Stitch credentials");

  auth
    .command("set")
    .description("Save Stitch credentials locally")
    .option("--api-key <value>", "API key to save")
    .option("--access-token <value>", "OAuth access token to save")
    .option("--project-id <value>", "Project id to pair with OAuth access token")
    .option("--stdin", "Read API key from stdin")
    .option("--base-url <url>", "Override Stitch MCP base URL")
    .option("--timeout-ms <ms>", "Override request timeout in milliseconds", parsePositiveInteger)
    .option("--json", "Print JSON output")
    .action(
      async (options: {
        apiKey?: string;
        accessToken?: string;
        projectId?: string;
        stdin?: boolean;
        baseUrl?: string;
        timeoutMs?: number;
        json?: boolean;
      }) => {
      try {
        const accessToken = options.accessToken?.trim();
        const projectId = options.projectId?.trim();
        const usingOauth = Boolean(accessToken || projectId);

        if (usingOauth && (!accessToken || !projectId)) {
          emitFailure(
            {
              code: "VALIDATION_ERROR",
              message: "OAuth auth requires both --access-token and --project-id",
            },
            Boolean(options.json),
          );
          return;
        }

        const apiKey = usingOauth
          ? undefined
          : options.stdin
            ? (await readStdin()).trim()
            : options.apiKey?.trim() || (await promptForApiKey());

        if (!usingOauth && !apiKey) {
          emitFailure({ code: "VALIDATION_ERROR", message: "Expected a non-empty API key" }, Boolean(options.json));
          return;
        }

        const { config, validation } = await withSuppressedTransportNoise(() =>
          saveAndValidateConfig({
            apiKey,
            accessToken,
            projectId,
            baseUrl: options.baseUrl,
            timeoutMs: options.timeoutMs,
          }),
        );

        const data = {
          saved: true,
          configPath: getConfigPath(),
          authMode: usingOauth ? "oauth" : "apiKey",
          apiKeyRedacted: redactSecret(config.apiKey),
          accessTokenRedacted: redactSecret(config.accessToken),
          projectId: config.projectId || null,
          baseUrl: config.baseUrl || null,
          timeoutMs: config.timeoutMs || null,
          validation,
        };

        if (options.json) printJson(ok(data));
        else printHuman(data);
      } catch (error) {
        emitFailure(error, Boolean(options.json));
      }
    });

  auth
    .command("status")
    .description("Show resolved Stitch auth state")
    .option("--json", "Print JSON output")
    .action(async (options: CommonJsonOptions) => {
      try {
        const config = await resolveConfig();
        const validation = hasAuth(config)
          ? await withSuppressedTransportNoise(() => validateAuth(config))
          : { ok: false, reason: "Missing Stitch credentials" };
        const data = {
          authMode: config.authMode,
          source: config.source,
          hasApiKey: Boolean(config.apiKey),
          hasAccessToken: Boolean(config.accessToken),
          hasProjectId: Boolean(config.projectId),
          apiKeyRedacted: redactSecret(config.apiKey),
          accessTokenRedacted: redactSecret(config.accessToken),
          projectId: config.projectId || null,
          baseUrl: config.baseUrl || null,
          timeoutMs: config.timeoutMs || null,
          validation,
        };
        if (options.json) printJson(ok(data));
        else printHuman(data);
      } catch (error) {
        emitFailure(error, Boolean(options.json));
      }
    });

  auth
    .command("clear")
    .description("Remove locally saved Stitch credentials")
    .option("--json", "Print JSON output")
    .action(async (options: CommonJsonOptions) => {
      try {
        await clearConfig();
        const data = {
          cleared: true,
          configPath: getConfigPath(),
        };
        if (options.json) printJson(ok(data));
        else printHuman(data);
      } catch (error) {
        emitFailure(error, Boolean(options.json));
      }
    });

  program
    .command("doctor")
    .description("Run basic Stitch environment and API checks")
    .option("--json", "Print JSON output")
    .action(async (options: CommonJsonOptions) => {
      const config = await resolveConfig();
      const checks: Array<{ name: string; ok: boolean; detail?: string }> = [
        {
          name: "auth.present",
          ok: hasAuth(config),
          detail: hasAuth(config) ? undefined : AUTH_HELP_TEXT,
        },
      ];

      if (!hasAuth(config)) {
        const error = makeError(null, { code: "CHECK_FAILED", message: "One or more checks failed" });
        if (options.json) printJson(fail(error, { checks }));
        else {
          process.stderr.write("CHECK_FAILED: One or more checks failed\n");
          process.stderr.write(`${AUTH_HELP_TEXT}\n`);
        }
        process.exitCode = 1;
        return;
      }

      const ctx = createSdkContext(config);
      try {
        await withSuppressedTransportNoise(async () => {
          try {
            const toolResponse = await ctx.client.listTools();
            checks.push({ name: "api.tools.list", ok: true, detail: `${toolResponse.tools.length} tools` });
          } catch (error: any) {
            checks.push({ name: "api.tools.list", ok: false, detail: makeError(error).message });
          }

          try {
            const projects = await ctx.sdk.projects();
            checks.push({ name: "api.projects.list", ok: true, detail: `${projects.length} projects` });
          } catch (error: any) {
            const normalized = makeError(error);
            checks.push({
              name: "api.projects.list",
              ok: false,
              detail: normalized.detail || normalized.message,
            });
          }
        });

        const allOk = checks.every((check) => check.ok);
        if (allOk) {
          if (options.json) printJson(ok({ checks }));
          else printHuman({ checks });
        } else {
          const error = makeError(null, { code: "CHECK_FAILED", message: "One or more checks failed" });
          if (options.json) printJson(fail(error, { checks }));
          else printHuman({ checks });
          process.exitCode = 1;
        }
      } catch (error) {
        emitFailure(error, Boolean(options.json));
      } finally {
        await ctx.client.close();
      }
    });

  const tool = program.command("tool").description("Inspect Stitch tools");

  tool
    .command("list")
    .description("List available Stitch tools")
    .option("--json", "Print JSON output")
    .action(async (options: CommonJsonOptions) => {
      await runWithSdk(
        options,
        async ({ client }) => {
          const result = await client.listTools();
          return {
            count: result.tools.length,
            items: result.tools.map((item) => ({
              name: item.name,
              title: item.title || null,
              description: item.description || null,
              readOnlyHint: item.annotations?.readOnlyHint ?? null,
              destructiveHint: item.annotations?.destructiveHint ?? null,
              idempotentHint: item.annotations?.idempotentHint ?? null,
            })),
          };
        },
        (data) => printToolList(data.items),
      );
    });

  const project = program.command("project").description("Manage Stitch projects");

  project
    .command("list")
    .description("List accessible Stitch projects")
    .option("--json", "Print JSON output")
    .action(async (options: CommonJsonOptions) => {
      await runWithSdk(
        options,
        async ({ sdk }) => {
          const projects = await sdk.projects();
          const items = projects.map(serializeProject);
          return {
            count: items.length,
            items,
          };
        },
        (data) => printProjectList(data.items),
      );
    });

  project
    .command("create")
    .description("Create a Stitch project")
    .requiredOption("--title <title>", "Project title")
    .option("--json", "Print JSON output")
    .action(async (options: { title: string; json?: boolean }) => {
      await runWithSdk(options, async ({ sdk }) => {
        const created = await sdk.createProject(options.title);
        return serializeProject(created);
      });
    });

  project
    .command("get")
    .description("Get one Stitch project by id")
    .argument("<project-id>", "Project id")
    .option("--json", "Print JSON output")
    .action(async (projectId: string, options: CommonJsonOptions) => {
      await runWithSdk(options, async ({ client }) => {
        const raw = await client.callTool<any>("get_project", { name: `projects/${projectId}` });
        return serializeProject(raw);
      });
    });

  const screen = program.command("screen").description("Inspect and generate Stitch screens");

  screen
    .command("list")
    .description("List screens in a project")
    .requiredOption("--project-id <projectId>", "Project id")
    .option("--json", "Print JSON output")
    .action(async (options: { projectId: string; json?: boolean }) => {
      await runWithSdk(
        options,
        async ({ sdk }) => {
          const screens = await sdk.project(options.projectId).screens();
          const items = screens.map((item) => serializeScreen(item));
          return {
            projectId: options.projectId,
            count: items.length,
            items,
          };
        },
        (data) => printScreenList(data.items),
      );
    });

  screen
    .command("get")
    .description("Get one or more screens in a project")
    .requiredOption("--project-id <projectId>", "Project id")
    .requiredOption("--screen-id <screenId>", "One or more screen ids; repeat or pass comma-separated values", collectStrings, [])
    .option("--include-html", "Include the HTML artifact URL")
    .option("--include-image", "Include the screenshot artifact URL")
    .option("--json", "Print JSON output")
    .action(
      async (options: {
        projectId: string;
        screenId: string[];
        includeHtml?: boolean;
        includeImage?: boolean;
        json?: boolean;
      }) => {
        await runWithSdk(options, async ({ config, sdk }) => {
          const requestedScreenIds = splitCsv(options.screenId);
          const items: Record<string, unknown>[] = [];
          for (const screenId of requestedScreenIds) {
            const isolated = requestedScreenIds.length > 1 ? createSdkContext(config) : null;
            const activeSdk = isolated?.sdk ?? sdk;
            try {
              const item = await activeSdk.project(options.projectId).getScreen(screenId);
              const [htmlUrl, imageUrl] = await Promise.all([
                options.includeHtml ? item.getHtml() : Promise.resolve(undefined),
                options.includeImage ? item.getImage() : Promise.resolve(undefined),
              ]);
              items.push(serializeScreen(item, { htmlUrl, imageUrl }));
            } finally {
              if (isolated) await isolated.client.close();
            }
          }

          if (items.length === 1) return items[0];
          return {
            projectId: options.projectId,
            count: items.length,
            items,
          };
        });
      },
    );

  screen
    .command("generate")
    .description("Generate a new screen from a prompt")
    .requiredOption("--project-id <projectId>", "Project id")
    .requiredOption("--prompt <prompt>", "Generation prompt")
    .option("--device-type <deviceType>", "Device type", "DESKTOP")
    .option("--model-id <modelId>", "Model id")
    .option("--include-html", "Include the HTML artifact URL")
    .option("--include-image", "Include the screenshot artifact URL")
    .option("--json", "Print JSON output")
    .action(
      async (options: {
        projectId: string;
        prompt: string;
        deviceType?: DeviceType;
        modelId?: ModelId;
        includeHtml?: boolean;
        includeImage?: boolean;
        json?: boolean;
      }) => {
        try {
          validateEnum(options.deviceType, DEVICE_TYPES, "device type");
          validateEnum(options.modelId, MODEL_IDS, "model id");
        } catch (error) {
          emitFailure(error, Boolean(options.json));
          return;
        }

        await runWithSdk(options, async ({ client }) => {
          const raw = await client.callTool<any>("generate_screen_from_text", {
            projectId: options.projectId,
            prompt: options.prompt,
            deviceType: options.deviceType,
            modelId: options.modelId,
          });
          const screens = extractScreensFromOutput(raw, options.projectId);
          return createScreenMutationResult(
            options.projectId,
            undefined,
            screens,
            extractOutputMessages(raw),
            options,
            { kind: "generate" },
          );
        });
      },
    );

  screen
    .command("edit")
    .description("Edit an existing screen from a prompt")
    .requiredOption("--project-id <projectId>", "Project id")
    .requiredOption("--screen-id <screenId>", "One or more screen ids; repeat or pass comma-separated values", collectStrings, [])
    .requiredOption("--prompt <prompt>", "Edit prompt")
    .option("--device-type <deviceType>", "Device type")
    .option("--model-id <modelId>", "Model id")
    .option("--include-html", "Include the HTML artifact URL")
    .option("--include-image", "Include the screenshot artifact URL")
    .option("--json", "Print JSON output")
    .action(
      async (options: {
        projectId: string;
        screenId: string[];
        prompt: string;
        deviceType?: DeviceType;
        modelId?: ModelId;
        includeHtml?: boolean;
        includeImage?: boolean;
        json?: boolean;
      }) => {
        try {
          validateEnum(options.deviceType, DEVICE_TYPES, "device type");
          validateEnum(options.modelId, MODEL_IDS, "model id");
        } catch (error) {
          emitFailure(error, Boolean(options.json));
          return;
        }

        await runWithSdk(options, async ({ client }) => {
          const selectedScreenIds = splitCsv(options.screenId);
          const raw = await client.callTool<any>("edit_screens", {
            projectId: options.projectId,
            selectedScreenIds,
            prompt: options.prompt,
            deviceType: options.deviceType,
            modelId: options.modelId,
          });
          const screens = extractScreensFromOutput(raw, options.projectId);
          return createScreenMutationResult(
            options.projectId,
            selectedScreenIds,
            screens,
            extractOutputMessages(raw),
            options,
            { kind: "edit" },
          );
        });
      },
    );

  screen
    .command("variants")
    .description("Generate variants for one or more existing screens")
    .requiredOption("--project-id <projectId>", "Project id")
    .requiredOption("--screen-id <screenId>", "One or more screen ids; repeat or pass comma-separated values", collectStrings, [])
    .requiredOption("--prompt <prompt>", "Variant prompt")
    .option("--variant-count <count>", "Number of variants to generate (1-5)", parsePositiveInteger)
    .option("--creative-range <creativeRange>", "Creative range")
    .option("--aspect <aspect>", "Variant aspect; repeat or pass comma-separated values", collectStrings, [])
    .option("--device-type <deviceType>", "Device type")
    .option("--model-id <modelId>", "Model id")
    .option("--include-html", "Include the HTML artifact URL")
    .option("--include-image", "Include the screenshot artifact URL")
    .option("--json", "Print JSON output")
    .action(
      async (options: {
        projectId: string;
        screenId: string[];
        prompt: string;
        variantCount?: number;
        creativeRange?: CreativeRange;
        aspect?: string[];
        deviceType?: DeviceType;
        modelId?: ModelId;
        includeHtml?: boolean;
        includeImage?: boolean;
        json?: boolean;
      }) => {
        try {
          validateEnum(options.deviceType, DEVICE_TYPES, "device type");
          validateEnum(options.modelId, MODEL_IDS, "model id");
          validateEnum(options.creativeRange, CREATIVE_RANGES, "creative range");
          validateVariantAspects(splitCsv(options.aspect));
          if (typeof options.variantCount === "number" && (options.variantCount < 1 || options.variantCount > 5)) {
            throw Object.assign(new Error("variant count must be between 1 and 5"), { code: "VALIDATION_ERROR" });
          }
        } catch (error) {
          emitFailure(error, Boolean(options.json));
          return;
        }

        await runWithSdk(options, async ({ client }) => {
          const selectedScreenIds = splitCsv(options.screenId);
          const aspects = splitCsv(options.aspect) as VariantAspect[];
          const raw = await client.callTool<any>("generate_variants", {
            projectId: options.projectId,
            selectedScreenIds,
            prompt: options.prompt,
            variantOptions: {
              variantCount: options.variantCount,
              creativeRange: options.creativeRange,
              aspects,
            },
            deviceType: options.deviceType,
            modelId: options.modelId,
          });
          const screens = extractScreensFromOutput(raw, options.projectId);
          return createScreenMutationResult(
            options.projectId,
            selectedScreenIds,
            screens,
            extractOutputMessages(raw),
            options,
            { kind: "variants" },
          );
        });
      },
    );

  await program.parseAsync(process.argv);
}

main().catch((error) => {
  emitFailure(error, false);
});
