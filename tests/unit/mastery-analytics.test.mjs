import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  STATUS,
  STATUS_ORDER,
  statusOf,
  scoreStatus,
  relativeTime,
  summariseMastery,
} from "../../lib/mastery.js";

describe("Mastery Analytics & Heatmap Algorithm (lib/mastery.js)", () => {
  describe("Status Vocabulary & Glyphs", () => {
    it("provides distinct shapes, labels, and color classes for all 3 levels", () => {
      assert.strictEqual(STATUS.green.label, "Solid");
      assert.strictEqual(STATUS.green.shape, "●");
      assert.strictEqual(STATUS.yellow.label, "Shaky");
      assert.strictEqual(STATUS.yellow.shape, "◐");
      assert.strictEqual(STATUS.red.label, "Gap");
      assert.strictEqual(STATUS.red.shape, "○");
    });

    it("statusOf safely falls back to Shaky for unknown statuses without crashing", () => {
      assert.strictEqual(statusOf("green").label, "Solid");
      assert.strictEqual(statusOf("red").label, "Gap");
      assert.strictEqual(statusOf("unknown_status").label, "Shaky");
      assert.strictEqual(statusOf(null).label, "Shaky");
    });

    it("scoreStatus categorizes percentage scores accurately", () => {
      assert.strictEqual(scoreStatus(100).label, "Solid");
      assert.strictEqual(scoreStatus(70).label, "Solid");
      assert.strictEqual(scoreStatus(69).label, "Shaky");
      assert.strictEqual(scoreStatus(40).label, "Shaky");
      assert.strictEqual(scoreStatus(39).label, "Gap");
      assert.strictEqual(scoreStatus(0).label, "Gap");
    });
  });

  describe("Relative Time Formatter", () => {
    it("formats relative timestamps gracefully", () => {
      const now = new Date().toISOString();
      assert.strictEqual(relativeTime(now), "just now");
      assert.strictEqual(relativeTime(null), "");
      assert.strictEqual(relativeTime("invalid-date"), "");

      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      assert.strictEqual(relativeTime(twoDaysAgo), "2 days ago");
    });
  });

  describe("summariseMastery(sessions) Rollup Engine", () => {
    const mockSessions = [
      {
        id: "sess_1",
        noteId: "note_101",
        noteTitle: "Electromagnetism",
        space: "School",
        score: 40,
        createdAt: "2026-08-01T10:00:00Z",
        heatmap: [
          { subtopic: "Faraday's Law", status: "red", feedback: "Confused flux derivative" },
          { subtopic: "Lenz's Law", status: "yellow", feedback: "Right sign, weak mechanism" },
        ],
      },
      {
        id: "sess_2",
        noteId: "note_101",
        noteTitle: "Electromagnetism",
        space: "School",
        score: 85,
        createdAt: "2026-08-05T10:00:00Z",
        heatmap: [
          // Faraday improved from red to green
          { subtopic: "Faraday's Law", status: "green", feedback: "Clear mechanism stated" },
          // New subtopic
          { subtopic: "Lorentz Force", status: "red", feedback: "Forgot cross product direction" },
        ],
      },
    ];

    it("rolls multiple sessions into unified topic records preserving history", () => {
      const summary = summariseMastery(mockSessions);

      assert.strictEqual(summary.sessionCount, 2);
      assert.strictEqual(summary.averageScore, 63); // round((40+85)/2) = 63
      assert.strictEqual(summary.totalTopics, 3); // Faraday, Lenz, Lorentz
    });

    it("accurately scores topic based on latest evidence while tracking trends", () => {
      const summary = summariseMastery(mockSessions);
      const faraday = summary.topics.find((t) => t.subtopic === "Faraday's Law");

      assert.ok(faraday);
      assert.strictEqual(faraday.status, "green"); // Updated to green in sess_2
      assert.strictEqual(faraday.timesSeen, 2);
      assert.strictEqual(faraday.strength, 1.0);
      assert.strictEqual(faraday.trend, 1.0); // improved from 0.0 (red) to 1.0 (green)
    });

    it("sorts topics weakest-first (Gaps before Shaky before Solid)", () => {
      const summary = summariseMastery(mockSessions);
      const statuses = summary.topics.map((t) => t.status);

      // Lorentz (red) should come first, then Lenz (yellow), then Faraday (green)
      assert.strictEqual(statuses[0], "red");
      assert.strictEqual(statuses[1], "yellow");
      assert.strictEqual(statuses[2], "green");
    });

    it("handles empty session histories gracefully", () => {
      const summary = summariseMastery([]);
      assert.strictEqual(summary.sessionCount, 0);
      assert.strictEqual(summary.averageScore, null);
      assert.strictEqual(summary.totalTopics, 0);
      assert.deepStrictEqual(summary.topics, []);
      assert.deepStrictEqual(summary.strengths, []);
      assert.deepStrictEqual(summary.weaknesses, []);
    });
  });
});
