import type {
  PreparedWorldInfoEntry,
  WorldInfoDepthEntry,
  WorldInfoResolvePromptOutput,
  WorldInfoSettingsDto,
} from "./world-info-types";

function sortActivated(entries: PreparedWorldInfoEntry[]): PreparedWorldInfoEntry[] {
  return entries.slice().sort((a, b) => {
    if (a.order !== b.order) return b.order - a.order;
    return a.uid - b.uid;
  });
}

function renderContent(entry: PreparedWorldInfoEntry, settings: WorldInfoSettingsDto): string {
  const content = entry.content.trim();
  if (!content) return "";
  if (!settings.includeNames) return content;
  const prefix = entry.comment?.trim() || entry.bookName?.trim();
  if (!prefix) return content;
  return `${prefix}: ${content}`;
}

export function assembleWorldInfoPromptOutput(params: {
  activatedEntries: PreparedWorldInfoEntry[];
  settings: WorldInfoSettingsDto;
}): WorldInfoResolvePromptOutput {
  const before: string[] = [];
  const after: string[] = [];
  const depthEntries: WorldInfoDepthEntry[] = [];
  const outletEntries: Record<string, string[]> = {};
  const anTop: string[] = [];
  const anBottom: string[] = [];
  const emTop: string[] = [];
  const emBottom: string[] = [];

  for (const entry of sortActivated(params.activatedEntries)) {
    const content = renderContent(entry, params.settings);
    if (!content) continue;

    switch (entry.position) {
      case 0:
        before.push(content);
        break;
      case 1:
        after.push(content);
        break;
      case 2:
        anTop.push(content);
        break;
      case 3:
        anBottom.push(content);
        break;
      case 4:
        depthEntries.push({
          depth: entry.depth,
          role: entry.role,
          content,
          bookId: entry.bookId,
          uid: entry.uid,
        });
        break;
      case 5:
        emTop.push(content);
        break;
      case 6:
        emBottom.push(content);
        break;
      case 7: {
        const key = entry.outletName?.trim() || "default";
        if (!outletEntries[key]) outletEntries[key] = [];
        outletEntries[key].push(content);
        break;
      }
      default:
        before.push(content);
        break;
    }
  }

  return {
    worldInfoBefore: before.join("\n"),
    worldInfoAfter: after.join("\n"),
    depthEntries,
    outletEntries,
    anTop,
    anBottom,
    emTop,
    emBottom,
  };
}
