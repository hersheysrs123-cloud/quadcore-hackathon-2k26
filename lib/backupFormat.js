/**
 * Backup file identity, kept free of IndexedDB so the import dispatcher in
 * exportImport.js can sniff a file without loading the database.
 *
 * New backups are written as `learnory-backup-v2` with a `.learnory`
 * extension. Files written before the Learnory rename say
 * `socratic-backup-v1` / `-v2` and use `.socratic`; both must keep restoring.
 */

export const BACKUP_FORMAT = "learnory-backup-v2";

/** Format prefixes an import accepts, current name first. */
export const BACKUP_FORMAT_PREFIXES = ["learnory-backup", "socratic-backup"];

/** File extensions that are always workspace backups. `.json` is sniffed. */
export const BACKUP_EXTENSIONS = ["learnory", "socratic"];

/** True when `format` names a backup from this app, under either name. */
export function isBackupFormat(format) {
  return typeof format === "string" && BACKUP_FORMAT_PREFIXES.some((p) => format.startsWith(p));
}

/**
 * True when a file name alone marks a workspace backup: a `.learnory` or
 * `.socratic` extension, or a `.json` whose name carries either brand.
 */
export function isBackupFileName(filename) {
  const name = String(filename || "").toLowerCase();
  const ext = name.includes(".") ? name.split(".").pop() : "";
  if (BACKUP_EXTENSIONS.includes(ext)) return true;
  return ext === "json" && BACKUP_EXTENSIONS.some((brand) => name.includes(brand));
}
