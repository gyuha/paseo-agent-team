import type { Role } from "./team";
import type { ProviderInfo } from "./validate";

export function parseFolders(text: string): string[] {
  return text
    .split(",")
    .map((folder) => folder.trim())
    .filter(Boolean);
}

export function foldersText(folders: readonly string[]): string {
  return folders.join(", ");
}

/** A blank role on the first ready provider, named so it doesn't clash with the others, sharing the orchestrator's workspace. */
export function newRole(catalog: readonly ProviderInfo[], takenNames: readonly string[]): Role {
  const taken = new Set(takenNames.map((name) => name.toLowerCase()));
  let index = 1;
  while (taken.has(`role-${index}`)) index += 1;
  const provider = catalog.find((entry) => entry.ready);
  return { name: `role-${index}`, workspace: "", provider: provider?.id ?? "", model: provider?.models[0]?.id ?? "", folders: [], instructions: "" };
}
