import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatMarkdownInline } from "../../lib/editorCaret.js";
import { tryParseMarkdownToBlocks } from "../../lib/exportImport.js";

describe("Markdown Formatting in Bullets and Lists", () => {
  describe("Inline Markdown Formatting (formatMarkdownInline)", () => {
    it("formats standard bold and italic in a bullet line", () => {
      const input = "- **bold** and *italic*";
      const result = formatMarkdownInline(input);
      assert.ok(result.includes('<strong class="font-bold text-ink-100">bold</strong>'));
      assert.ok(result.includes('<em class="italic text-ink-200">italic</em>'));
      assert.ok(!result.includes("**bold**"));
      assert.ok(!result.includes("*italic*"));
    });

    it("formats bold text containing italic words inside (**bold with *italic* inside**)", () => {
      const input = "**bold with *italic* inside**";
      const result = formatMarkdownInline(input);
      assert.ok(result.includes('<strong class="font-bold text-ink-100">bold with <em class="italic text-ink-200">italic</em> inside</strong>'));
      assert.ok(!result.includes("**"));
      assert.ok(!result.includes("*italic*"));
    });

    it("formats italic text containing bold words inside (*italic with **bold** inside*)", () => {
      const inputRaw = "*italic with **bold** inside*";
      const result = formatMarkdownInline(inputRaw);
      assert.ok(result.includes('<em class="italic text-ink-200">italic with <strong class="font-bold text-ink-100">bold</strong> inside</em>'));
      assert.ok(!result.includes("**bold**"));
    });

    it("formats combined bold and italic with asterisks and underscores (**_text_** and _**text**_)", () => {
      const r1 = formatMarkdownInline("**_both bold and italic_**");
      assert.ok(r1.includes('<strong class="font-bold text-ink-100"><em class="italic text-ink-200">both bold and italic</em></strong>'));

      const r2 = formatMarkdownInline("_**both bold and italic**_");
      assert.ok(r2.includes('<strong class="font-bold text-ink-100"><em class="italic text-ink-200">both bold and italic</em></strong>'));

      const r3 = formatMarkdownInline("***triple asterisk***");
      assert.ok(r3.includes('<strong class="font-bold text-ink-100"><em class="italic text-ink-200">triple asterisk</em></strong>'));
    });

    it("formats double underscores and single underscores (__bold__ and _italic_)", () => {
      const input = "__bold text__ and _italic text_";
      const result = formatMarkdownInline(input);
      assert.ok(result.includes('<strong class="font-bold text-ink-100">bold text</strong>'));
      assert.ok(result.includes('<em class="italic text-ink-200">italic text</em>'));
    });

    it("does not corrupt mathematical multiplication asterisks inside bold", () => {
      const input = "**5 * 2 = 10**";
      const result = formatMarkdownInline(input);
      assert.ok(result.includes('<strong class="font-bold text-ink-100">5 * 2 = 10</strong>'));
    });
  });

  describe("Markdown Bullet Parsing and Preservation (tryParseMarkdownToBlocks)", () => {
    it("preserves bold bullets as bullet blocks instead of turning them into headings", () => {
      const markdown = "- **First Concept**\n- **Second Concept**\n- **Third Concept**";
      const blocks = tryParseMarkdownToBlocks(markdown);
      assert.equal(blocks.length, 3);
      assert.equal(blocks[0].type, "bullet");
      assert.equal(blocks[0].content, "**First Concept**");
      assert.equal(blocks[1].type, "bullet");
      assert.equal(blocks[1].content, "**Second Concept**");
      assert.equal(blocks[2].type, "bullet");
      assert.equal(blocks[2].content, "**Third Concept**");
    });

    it("preserves asterisks-style bullets with bold and italic (* **bold** and *italic*)", () => {
      const markdown = "* **Bold Item**\n* *Italic Item*\n* Normal with **bold** and *italic*";
      const blocks = tryParseMarkdownToBlocks(markdown);
      assert.equal(blocks.length, 3);
      assert.equal(blocks[0].type, "bullet");
      assert.equal(blocks[0].content, "**Bold Item**");
      assert.equal(blocks[1].type, "bullet");
      assert.equal(blocks[1].content, "*Italic Item*");
      assert.equal(blocks[2].type, "bullet");
      assert.equal(blocks[2].content, "Normal with **bold** and *italic*");
    });

    it("only classifies bold lines as h3 headings when they explicitly end with a colon", () => {
      const markdown = "* **Eye Structures:**\n- **Cornea:** Refracts light\n- **Lens**\n**Key Takeaways:**";
      const blocks = tryParseMarkdownToBlocks(markdown);

      // Standalone category lines ending with colon become h3
      const eyeHeading = blocks.find((b) => b.type === "h3" && b.content === "Eye Structures");
      assert.ok(eyeHeading, "Line ending with colon should become h3");

      const takeawaysHeading = blocks.find((b) => b.type === "h3" && b.content === "Key Takeaways");
      assert.ok(takeawaysHeading, "Line ending with colon should become h3");

      // Bullets with definitions or simple bold remain bullets
      const corneaBullet = blocks.find((b) => b.type === "bullet" && b.content.includes("Cornea"));
      assert.ok(corneaBullet, "Bullet with definition should remain bullet");
      assert.equal(corneaBullet.content, "**Cornea:** Refracts light");

      const lensBullet = blocks.find((b) => b.type === "bullet" && b.content === "**Lens**");
      assert.ok(lensBullet, "Bullet without colon should remain bullet");
    });

    it("maintains nested bullet indentation hierarchy with bold and italic", () => {
      const markdown = "- **Parent Bullet**\n  - *Nested Italic Bullet*\n    - ***Deep Nested Bold Italic***";
      const blocks = tryParseMarkdownToBlocks(markdown);
      assert.equal(blocks.length, 3);
      assert.equal(blocks[0].type, "bullet");
      assert.equal(blocks[0].content, "**Parent Bullet**");
      assert.equal(blocks[0].level || 0, 0);

      assert.equal(blocks[1].type, "bullet");
      assert.equal(blocks[1].content, "*Nested Italic Bullet*");
      assert.equal(blocks[1].level, 1);

      assert.equal(blocks[2].type, "bullet");
      assert.equal(blocks[2].content, "***Deep Nested Bold Italic***");
      assert.equal(blocks[2].level, 2);
    });
  });

  describe("HTML List Marker Stripping Logic", () => {
    function cleanBullet(text) {
      return text
        .trim()
        .replace(/^[•◦▪▫⁃]\s*/, "")
        .replace(/^[-*+]\s+/, "")
        .replace(/^\d+[.)]\s+/, "")
        .trim();
    }

    it("strips bullet markers without stripping bold (**) or italic (*) delimiters", () => {
      assert.equal(cleanBullet("• **Bold text**"), "**Bold text**");
      assert.equal(cleanBullet("- **Bold text**"), "**Bold text**");
      assert.equal(cleanBullet("* **Bold text**"), "**Bold text**");
      assert.equal(cleanBullet("• *Italic text*"), "*Italic text*");
      assert.equal(cleanBullet("- *Italic text*"), "*Italic text*");
      assert.equal(cleanBullet("* *Italic text*"), "*Italic text*");
      assert.equal(cleanBullet("1. **Numbered bold**"), "**Numbered bold**");
      assert.equal(cleanBullet("2) *Numbered italic*"), "*Numbered italic*");
    });

    it("never alters text when there are no bullet markers", () => {
      assert.equal(cleanBullet("**Bold text**"), "**Bold text**");
      assert.equal(cleanBullet("*Italic text*"), "*Italic text*");
      assert.equal(cleanBullet("***Bold and italic***"), "***Bold and italic***");
      assert.equal(cleanBullet("**bold** and *italic*"), "**bold** and *italic*");
    });
  });
});
