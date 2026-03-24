import { inferAuthMode, type ResolvedConfig, type StitchCliConfig, writeConfig } from "./config.js";
import { createSdkContext } from "./stitch-client.js";

export type AuthValidation = {
  ok: boolean;
  reason?: string;
  sample?: {
    projectCount: number;
  };
};

function normalizeConfig(config: StitchCliConfig | ResolvedConfig): StitchCliConfig {
  return {
    apiKey: config.apiKey,
    accessToken: config.accessToken,
    projectId: config.projectId,
    baseUrl: config.baseUrl,
    timeoutMs: config.timeoutMs,
  };
}

export async function validateAuth(config: StitchCliConfig | ResolvedConfig): Promise<AuthValidation> {
  const normalized = normalizeConfig(config);
  if (inferAuthMode(normalized) === "none") return { ok: false, reason: "Missing Stitch credentials" };

  const { client, sdk } = createSdkContext(normalized);
  try {
    const projects = await sdk.projects();
    return {
      ok: true,
      sample: {
        projectCount: projects.length,
      },
    };
  } catch (error: any) {
    return {
      ok: false,
      reason: error?.message || "Validation failed",
    };
  } finally {
    await client.close();
  }
}

export async function saveAndValidateConfig(
  config: StitchCliConfig,
): Promise<{ config: StitchCliConfig; validation: AuthValidation }> {
  await writeConfig(config);
  const validation = await validateAuth(config);
  return { config, validation };
}
