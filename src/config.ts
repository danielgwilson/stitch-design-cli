import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export type StitchCliConfig = {
  apiKey?: string;
  accessToken?: string;
  projectId?: string;
  baseUrl?: string;
  timeoutMs?: number;
};

export type AuthMode = "apiKey" | "oauth" | "none";

export type ResolvedConfig = StitchCliConfig & {
  source: "env" | "config" | "mixed" | "none";
  authMode: AuthMode;
};

const DEFAULT_BASE_URL = "https://stitch.googleapis.com/mcp";
const DEFAULT_TIMEOUT_MS = 300_000;

function getConfigDir(): string {
  const xdg = process.env.XDG_CONFIG_HOME?.trim();
  return xdg ? xdg : path.join(os.homedir(), ".config");
}

export function getConfigPath(): string {
  return path.join(getConfigDir(), "stitch", "config.json");
}

function cleanBaseUrl(value: string | undefined): string {
  const raw = (value || "").trim();
  if (!raw) return DEFAULT_BASE_URL;
  return raw.replace(/\/+$/, "");
}

function cleanTimeoutMs(value: unknown): number {
  const raw = typeof value === "number" ? value : Number(String(value || "").trim());
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_TIMEOUT_MS;
  return Math.round(raw);
}

export function inferAuthMode(config: StitchCliConfig): AuthMode {
  if (config.apiKey?.trim()) return "apiKey";
  if (config.accessToken?.trim() && config.projectId?.trim()) return "oauth";
  return "none";
}

export async function readConfig(): Promise<StitchCliConfig> {
  try {
    const raw = await fs.readFile(getConfigPath(), "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const config = parsed as StitchCliConfig;
    return {
      apiKey: config.apiKey?.trim() || undefined,
      accessToken: config.accessToken?.trim() || undefined,
      projectId: config.projectId?.trim() || undefined,
      baseUrl: cleanBaseUrl(config.baseUrl),
      timeoutMs: cleanTimeoutMs(config.timeoutMs),
    };
  } catch {
    return {};
  }
}

export async function writeConfig(config: StitchCliConfig): Promise<void> {
  const filePath = getConfigPath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const normalized: StitchCliConfig = {
    apiKey: config.apiKey?.trim() || undefined,
    accessToken: config.accessToken?.trim() || undefined,
    projectId: config.projectId?.trim() || undefined,
    baseUrl: cleanBaseUrl(config.baseUrl),
    timeoutMs: cleanTimeoutMs(config.timeoutMs),
  };
  await fs.writeFile(filePath, JSON.stringify(normalized, null, 2), { mode: 0o600 });
  try {
    await fs.chmod(filePath, 0o600);
  } catch {
    // ignore
  }
}

export async function clearConfig(): Promise<void> {
  try {
    await fs.unlink(getConfigPath());
  } catch {
    // ignore
  }
}

export async function resolveConfig(): Promise<ResolvedConfig> {
  const fileConfig = await readConfig();

  const envApiKey = process.env.STITCH_API_KEY?.trim();
  const envAccessToken = process.env.STITCH_ACCESS_TOKEN?.trim();
  const envProjectId = process.env.GOOGLE_CLOUD_PROJECT?.trim();
  const envBaseUrl = process.env.STITCH_HOST?.trim();
  const envTimeoutMs = process.env.STITCH_TIMEOUT_MS?.trim();

  const resolved: StitchCliConfig = {
    apiKey: envApiKey || fileConfig.apiKey,
    accessToken: envAccessToken || fileConfig.accessToken,
    projectId: envProjectId || fileConfig.projectId,
    baseUrl: cleanBaseUrl(envBaseUrl || fileConfig.baseUrl),
    timeoutMs: cleanTimeoutMs(envTimeoutMs || fileConfig.timeoutMs),
  };

  const fromEnv = Boolean(envApiKey || envAccessToken || envProjectId || envBaseUrl || envTimeoutMs);
  const fromConfig = Boolean(
    fileConfig.apiKey || fileConfig.accessToken || fileConfig.projectId || fileConfig.baseUrl || fileConfig.timeoutMs,
  );

  const source: ResolvedConfig["source"] = fromEnv && fromConfig ? "mixed" : fromEnv ? "env" : fromConfig ? "config" : "none";

  return {
    ...resolved,
    source,
    authMode: inferAuthMode(resolved),
  };
}

export function redactSecret(value: string | undefined): string | null {
  const clean = value?.trim();
  if (!clean) return null;
  if (clean.length <= 10) return `${clean.slice(0, 3)}…`;
  return `${clean.slice(0, 4)}…${clean.slice(-4)}`;
}
