/**
 * Telling the editor's own saves apart from changes made elsewhere.
 *
 * BlockNoteEditor keeps the note's title, banner and emoji in local state and
 * saves them on a debounce. The workspace then hands the saved values back as
 * props. A prop can also change because the note was renamed from the notes
 * panel or the command palette while it was open. The editor must adopt that
 * change (or its next autosave writes the old title back), but must ignore its
 * own echo, which can arrive after the user has typed further.
 *
 * So the editor remembers the values it has sent. A prop value it sent itself
 * is an echo; anything else that differs from what it shows is outside news.
 */

export const SENT_HISTORY_LIMIT = 50;

/** `list` with `value` added at the end, keeping at most `limit` entries. */
export function rememberSent(list, value, limit = SENT_HISTORY_LIMIT) {
  const next = list.length && list[list.length - 1] === value ? list : [...list, value];
  return next.length > limit ? next.slice(next.length - limit) : next;
}

/** True when a prop value is a change made outside the editor. */
export function isExternalPropChange(next, current, sent) {
  return next !== current && !sent.includes(next);
}
