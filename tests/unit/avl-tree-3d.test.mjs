import { describe, it } from "node:test";
import assert from "node:assert/strict";

// BST / AVL Core Logic
export function insert(node, value) {
  if (!node) return { value, left: null, right: null };
  if (value === node.value) return node; // no duplicate values
  if (value < node.value) return { ...node, left: insert(node.left, value) };
  return { ...node, right: insert(node.right, value) };
}

export function buildTree(values) {
  return values.reduce((root, value) => insert(root, value), null);
}

export function comparisonPath(root, value) {
  const path = [];
  let node = root;
  while (node) {
    path.push(node.value);
    if (value === node.value) break;
    node = value < node.value ? node.left : node.right;
  }
  return path;
}

export function traverse(root, order) {
  const out = [];
  const walk = (node) => {
    if (!node) return;
    if (order === "pre") out.push(node.value);
    walk(node.left);
    if (order === "in") out.push(node.value);
    walk(node.right);
    if (order === "post") out.push(node.value);
  };
  walk(root);
  return out;
}

export function layoutTree(root) {
  if (!root) return { nodes: [], edges: [], count: 0, height: 0, scale: 1 };
  const nodes = [];
  let column = 0;
  let maxDepth = 0;

  const walk = (node, depth, parent) => {
    if (!node) return;
    walk(node.left, depth + 1, node.value);
    maxDepth = Math.max(maxDepth, depth);
    nodes.push({ value: node.value, depth, column: column++, parent });
    walk(node.right, depth + 1, node.value);
  };
  walk(root, 0, null);

  const SPACING_X = 1.9;
  const SPACING_Y = 2.0;
  const DEPTH_Z = -0.55;

  const count = nodes.length;
  const spanX = Math.max(0, count - 1) * SPACING_X;
  const spanY = maxDepth * SPACING_Y;

  const positioned = nodes.map((n) => ({
    ...n,
    position: [
      n.column * SPACING_X - spanX / 2,
      spanY / 2 - n.depth * SPACING_Y,
      n.depth * DEPTH_Z,
    ],
  }));

  const byValue = new Map(positioned.map((n) => [n.value, n]));
  const edges = positioned
    .filter((n) => n.parent !== null)
    .map((n) => ({
      key: `${n.parent}-${n.value}`,
      from: byValue.get(n.parent).position,
      to: n.position,
      parent: n.parent,
      child: n.value,
    }));

  const scale = Math.max(0.4, Math.min(1, 13 / (spanX + 4), 9 / (spanY + 3)));

  return { nodes: positioned, edges, count, height: maxDepth + 1, scale };
}

// ─── TEST SUITE ─────────────────────────────────────────────────────────────

describe("3D Binary Search Tree (BST) & AVL Engine", () => {
  const values = [50, 30, 70, 20, 40, 60, 80];

  it("builds a balanced BST with correct root and children", () => {
    const tree = buildTree(values);
    assert.strictEqual(tree.value, 50);
    assert.strictEqual(tree.left.value, 30);
    assert.strictEqual(tree.right.value, 70);
    assert.strictEqual(tree.left.left.value, 20);
    assert.strictEqual(tree.left.right.value, 40);
    assert.strictEqual(tree.right.left.value, 60);
    assert.strictEqual(tree.right.right.value, 80);
  });

  it("handles duplicate node insertions idempotently", () => {
    const tree = buildTree([50, 50, 50, 30, 30]);
    const inOrder = traverse(tree, "in");
    assert.deepStrictEqual(inOrder, [30, 50]);
  });

  it("guarantees In-Order traversal returns sorted array", () => {
    const tree = buildTree([42, 12, 88, 5, 23, 67, 99]);
    const inOrder = traverse(tree, "in");
    assert.deepStrictEqual(inOrder, [5, 12, 23, 42, 67, 88, 99]);
  });

  it("correctly produces Pre-Order and Post-Order traversal arrays", () => {
    const tree = buildTree([50, 30, 70]);
    assert.deepStrictEqual(traverse(tree, "pre"), [50, 30, 70]);
    assert.deepStrictEqual(traverse(tree, "post"), [30, 70, 50]);
  });

  it("computes accurate comparison paths for found and missing search targets", () => {
    const tree = buildTree(values);
    // Path to 40: 50 -> 30 -> 40
    assert.deepStrictEqual(comparisonPath(tree, 40), [50, 30, 40]);
    // Path to 80: 50 -> 70 -> 80
    assert.deepStrictEqual(comparisonPath(tree, 80), [50, 70, 80]);
    // Path to 25 (not present): 50 -> 30 -> 20
    assert.deepStrictEqual(comparisonPath(tree, 25), [50, 30, 20]);
  });

  it("calculates 3D layout coordinates and bounds without NaN", () => {
    const tree = buildTree(values);
    const layout = layoutTree(tree);

    assert.strictEqual(layout.count, 7);
    assert.strictEqual(layout.height, 3);
    assert.ok(layout.scale >= 0.4 && layout.scale <= 1.0);

    // Verify all positioned nodes have finite [x, y, z] vectors
    for (const node of layout.nodes) {
      assert.strictEqual(node.position.length, 3);
      assert.ok(Number.isFinite(node.position[0]));
      assert.ok(Number.isFinite(node.position[1]));
      assert.ok(Number.isFinite(node.position[2]));
    }

    // Verify edges connect parents to children accurately
    assert.strictEqual(layout.edges.length, 6);
    for (const edge of layout.edges) {
      assert.ok(Array.isArray(edge.from) && edge.from.length === 3);
      assert.ok(Array.isArray(edge.to) && edge.to.length === 3);
    }
  });

  it("handles empty tree layout gracefully", () => {
    const layout = layoutTree(null);
    assert.strictEqual(layout.count, 0);
    assert.strictEqual(layout.height, 0);
    assert.deepStrictEqual(layout.nodes, []);
    assert.deepStrictEqual(layout.edges, []);
  });
});
