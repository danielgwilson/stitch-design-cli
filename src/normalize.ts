export function splitCsv(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value.flatMap((item) => splitCsv(item));
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function collectStrings(value: string, previous: string[] = []): string[] {
  return [...previous, ...splitCsv(value)];
}

export function buildScreenGetCommand(
  projectId: string,
  screenIds: string[],
  options: { includeHtml?: boolean; includeImage?: boolean; json?: boolean } = {},
): string | null {
  const resolved = splitCsv(screenIds);
  if (!resolved.length) return null;
  const parts = ["stitch", "screen", "get", "--project-id", projectId];
  for (const screenId of resolved) parts.push("--screen-id", screenId);
  if (options.includeHtml) parts.push("--include-html");
  if (options.includeImage) parts.push("--include-image");
  if (options.json) parts.push("--json");
  return parts.join(" ");
}

export function toProjectId(data: any): string | null {
  if (!data) return null;
  if (typeof data.projectId === "string" && data.projectId) return data.projectId;
  if (typeof data.id === "string" && data.id) return data.id;
  if (typeof data.name === "string" && data.name.startsWith("projects/")) return data.name.slice("projects/".length);
  return null;
}

export function toScreenId(data: any): string | null {
  if (!data) return null;
  if (typeof data.screenId === "string" && data.screenId) return data.screenId;
  if (typeof data.id === "string" && data.id) return data.id;
  if (typeof data.name === "string" && data.name.includes("/screens/")) {
    return data.name.split("/screens/")[1] || null;
  }
  return null;
}

export function serializeProject(project: { id?: string; projectId?: string; data?: any } | any): Record<string, unknown> {
  const raw = project as any;
  const projectId = raw.projectId || raw.id || toProjectId(raw);
  const data = raw.data ?? raw;
  return {
    id: projectId,
    projectId,
    title: typeof data?.title === "string" ? data.title : null,
    data: data ?? null,
  };
}

export function serializeScreen(
  screen: { id?: string; screenId?: string; projectId?: string; data?: any } | any,
  extras: { htmlUrl?: string; imageUrl?: string } = {},
): Record<string, unknown> {
  const raw = screen as any;
  const screenId = raw.screenId || raw.id || toScreenId(raw);
  const projectId = raw.projectId || toProjectId(raw);
  const data = raw.data ?? raw;
  return {
    id: screenId,
    screenId,
    projectId,
    title: typeof data?.title === "string" ? data.title : null,
    htmlUrl: extras.htmlUrl ?? null,
    imageUrl: extras.imageUrl ?? null,
    data: data ?? null,
  };
}

export function artifactUrlsFromData(
  data: any,
  options: { includeHtml?: boolean; includeImage?: boolean },
): { htmlUrl?: string; imageUrl?: string } {
  return {
    htmlUrl: options.includeHtml ? data?.htmlCode?.downloadUrl || undefined : undefined,
    imageUrl: options.includeImage ? data?.screenshot?.downloadUrl || undefined : undefined,
  };
}

export function extractOutputMessages(raw: any): string[] {
  if (!Array.isArray(raw?.outputComponents)) return [];
  const messages: string[] = [];
  for (const component of raw.outputComponents) {
    if (typeof component?.text === "string" && component.text.trim()) messages.push(component.text.trim());
    if (Array.isArray(component?.texts)) {
      for (const text of component.texts) {
        if (typeof text === "string" && text.trim()) messages.push(text.trim());
      }
    }
  }
  return messages;
}

export function extractScreensFromOutput(raw: any, projectId: string): any[] {
  if (!Array.isArray(raw?.outputComponents)) return [];
  const screens: any[] = [];
  for (const component of raw.outputComponents) {
    const candidates = component?.design?.screens;
    if (!Array.isArray(candidates)) continue;
    for (const item of candidates) {
      screens.push({ ...item, projectId });
    }
  }
  return screens;
}

export function createScreenMutationResult(
  projectId: string,
  selectedScreenIds: string[] | undefined,
  screens: any[],
  messages: string[],
  options: { includeHtml?: boolean; includeImage?: boolean },
  meta: { kind?: "generate" | "edit" | "variants" } = {},
): Record<string, unknown> {
  const items = screens.map((item, index) => {
    const serialized = serializeScreen(item, artifactUrlsFromData(item, options)) as Record<string, unknown>;
    serialized.resultIndex = index + 1;
    if (meta.kind === "variants") serialized.variantIndex = index + 1;
    if (meta.kind === "variants" && selectedScreenIds?.length === 1) {
      serialized.sourceScreenId = selectedScreenIds[0];
    }
    return serialized;
  });
  const returnedScreenIds = items
    .map((item) => (typeof item.screenId === "string" ? item.screenId : null))
    .filter((value): value is string => Boolean(value));
  return {
    kind: meta.kind || null,
    projectId,
    selectedScreenIds: selectedScreenIds && selectedScreenIds.length ? selectedScreenIds : undefined,
    count: items.length,
    messages,
    items,
    notes:
      meta.kind === "variants"
        ? ["Returned screen IDs are authoritative even if project or screen listings lag behind."]
        : [],
    followUp: returnedScreenIds.length
      ? {
          screenIds: returnedScreenIds,
          getCommand: buildScreenGetCommand(projectId, returnedScreenIds, {
            includeHtml: true,
            includeImage: true,
            json: true,
          }),
        }
      : null,
  };
}
