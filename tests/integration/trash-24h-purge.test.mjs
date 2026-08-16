import { describe, it } from "node:test";
import assert from "node:assert/strict";

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export function filterActiveAndExpiredTrash(trashList, now = Date.now()) {
  const active = [];
  const expiredIds = [];

  for (const item of trashList) {
    const deletedTime = new Date(item.deletedAt).getTime();
    if (!deletedTime || now - deletedTime > TWENTY_FOUR_HOURS_MS) {
      expiredIds.push(item.id);
    } else {
      active.push(item);
    }
  }

  return { active, expiredIds };
}

export function formatTimeRemaining(deletedAt, now = Date.now()) {
  const deletedTime = new Date(deletedAt).getTime();
  if (!deletedTime) return "expiring soon";
  const elapsed = now - deletedTime;
  const remaining = TWENTY_FOUR_HOURS_MS - elapsed;
  if (remaining <= 0) return "expiring soon";

  const hours = Math.floor(remaining / (60 * 60 * 1000));
  const mins = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
  if (hours > 0) return `${hours}h ${mins}m left`;
  return `${mins}m left`;
}

// ─── TEST SUITE ─────────────────────────────────────────────────────────────

describe("24-Hour Auto-Purge Trash Lifecycle Engine", () => {
  const baseNow = new Date("2026-08-16T12:00:00Z").getTime();

  it("retains notes deleted less than 24 hours ago in the trash drawer", () => {
    const trashList = [
      { id: "note_1", title: "Note 1", deletedAt: new Date(baseNow - 1 * 60 * 60 * 1000).toISOString() }, // 1h ago
      { id: "note_2", title: "Note 2", deletedAt: new Date(baseNow - 23.5 * 60 * 60 * 1000).toISOString() }, // 23.5h ago
    ];

    const { active, expiredIds } = filterActiveAndExpiredTrash(trashList, baseNow);
    assert.strictEqual(active.length, 2);
    assert.strictEqual(expiredIds.length, 0);
  });

  it("identifies notes deleted more than 24 hours ago for automated permanent purge", () => {
    const trashList = [
      { id: "recent", title: "Recent", deletedAt: new Date(baseNow - 2 * 60 * 60 * 1000).toISOString() },
      { id: "expired_1", title: "Expired 1", deletedAt: new Date(baseNow - 24.1 * 60 * 60 * 1000).toISOString() }, // 24.1h ago
      { id: "expired_2", title: "Expired 2", deletedAt: new Date(baseNow - 72 * 60 * 60 * 1000).toISOString() }, // 3 days ago
    ];

    const { active, expiredIds } = filterActiveAndExpiredTrash(trashList, baseNow);
    assert.strictEqual(active.length, 1);
    assert.strictEqual(active[0].id, "recent");
    assert.deepStrictEqual(expiredIds, ["expired_1", "expired_2"]);
  });

  it("formats countdown time strings accurately", () => {
    const oneHourAgo = new Date(baseNow - 1 * 60 * 60 * 1000).toISOString();
    const twentyThreeHoursAgo = new Date(baseNow - 23 * 60 * 60 * 1000).toISOString();
    const expired = new Date(baseNow - 25 * 60 * 60 * 1000).toISOString();

    assert.strictEqual(formatTimeRemaining(oneHourAgo, baseNow), "23h 0m left");
    assert.strictEqual(formatTimeRemaining(twentyThreeHoursAgo, baseNow), "1h 0m left");
    assert.strictEqual(formatTimeRemaining(expired, baseNow), "expiring soon");
  });
});
