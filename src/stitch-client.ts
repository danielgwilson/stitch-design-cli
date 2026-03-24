import { Stitch, StitchToolClient, type StitchConfigInput } from "@google/stitch-sdk";
import type { StitchCliConfig } from "./config.js";

export const AUTH_HELP_TEXT =
  "No Stitch credentials. Run `stitch auth set` to save an API key locally, `stitch auth set --stdin` to pipe one in, or export `STITCH_API_KEY`.";

export function hasAuth(config: StitchCliConfig): boolean {
  return Boolean(config.apiKey?.trim() || (config.accessToken?.trim() && config.projectId?.trim()));
}

function toSdkConfig(config: StitchCliConfig): Partial<StitchConfigInput> {
  return {
    apiKey: config.apiKey,
    accessToken: config.accessToken,
    projectId: config.projectId,
    baseUrl: config.baseUrl,
    timeout: config.timeoutMs,
  };
}

export function createSdkContext(config: StitchCliConfig): { client: StitchToolClient; sdk: Stitch } {
  const client = new StitchToolClient(toSdkConfig(config));
  return {
    client,
    sdk: new Stitch(client),
  };
}
