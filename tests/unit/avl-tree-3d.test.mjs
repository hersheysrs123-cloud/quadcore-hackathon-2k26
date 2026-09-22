import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  balanceOf,
  buildTree,
  comparisonPath,
  insert,
  isAvlBalanced,
  rotateLeft,
  rotateRight,
  traverse,
  treeHeight,
} from "../../lib/binaryTree.js";

// The tree logic under test is imported, not re-declared. This file used to
// carry its own copy of it, which is why it went on passing while the scene
// advertised AVL rotations it had never implemented: the copy and the shipping
// code were free to disagree and nothing here could notice.
//
// `layoutTree` below is the one exception. It is rendering code and still lives
// in the canvas, so this remains a mirror of it — kept only so the coordinate
// assertions have something to run against.

function layoutTree(root) {
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

  const scale = Math.max(0.15, Math.min(1, 13 / (spanX + 4), 9 / (spanY + 3)));

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
    assert.ok(layout.scale >= 0.15 && layout.scale <= 1.0);

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

describe("the unbalanced case the AVL toggle exists to fix", () => {
  const ascending = [10, 20, 30, 40, 50];

  it("degenerates into a linked list when values arrive in order", () => {
    const tree = buildTree(ascending);
    assert.strictEqual(treeHeight(tree), 5);
    // Every node hangs off its predecessor's right: there is no left child at all.
    let node = tree;
    while (node.right) {
      assert.strictEqual(node.left, null);
      node = node.right;
    }
    // Searching the last value has to walk all five nodes — the O(n) worst case.
    assert.deepStrictEqual(comparisonPath(tree, 50), [10, 20, 30, 40, 50]);
  });

  it("fits the same values into three levels once balancing is on", () => {
    const tree = buildTree(ascending, true);
    assert.strictEqual(treeHeight(tree), 3);
    assert.ok(isAvlBalanced(tree));
    // Three comparisons instead of five, for the identical set of values.
    assert.ok(comparisonPath(tree, 50).length <= 3);
  });

  it("leaves the ordering untouched while rearranging the shape", () => {
    const plain = buildTree(ascending);
    const avl = buildTree(ascending, true);
    assert.deepStrictEqual(traverse(plain, "in"), traverse(avl, "in"));
    assert.deepStrictEqual(traverse(avl, "in"), ascending);
  });
});

describe("AVL rotations", () => {
  it("rotates right without disturbing the in-order sequence", () => {
    const leftHeavy = buildTree([30, 20, 10]);
    const rotated = rotateRight(leftHeavy);
    assert.strictEqual(rotated.value, 20);
    assert.strictEqual(rotated.left.value, 10);
    assert.strictEqual(rotated.right.value, 30);
    assert.deepStrictEqual(traverse(rotated, "in"), [10, 20, 30]);
  });

  it("rotates left without disturbing the in-order sequence", () => {
    const rightHeavy = buildTree([10, 20, 30]);
    const rotated = rotateLeft(rightHeavy);
    assert.strictEqual(rotated.value, 20);
    assert.strictEqual(rotated.left.value, 10);
    assert.strictEqual(rotated.right.value, 30);
    assert.deepStrictEqual(traverse(rotated, "in"), [10, 20, 30]);
  });

  it("handles all four imbalance cases", () => {
    // left-left, right-right, left-right, right-left
    const cases = [
      [30, 20, 10],
      [10, 20, 30],
      [30, 10, 20],
      [10, 30, 20],
    ];
    for (const seq of cases) {
      const tree = buildTree(seq, true);
      assert.strictEqual(tree.value, 20, `root after ${seq.join(",")}`);
      assert.strictEqual(treeHeight(tree), 2);
      assert.ok(isAvlBalanced(tree));
      assert.deepStrictEqual(traverse(tree, "in"), [10, 20, 30]);
    }
  });

  it("keeps every node within ±1 across a long ascending run", () => {
    let tree = null;
    for (let v = 1; v <= 24; v += 1) {
      tree = insert(tree, v, true);
      assert.ok(isAvlBalanced(tree), `unbalanced after inserting ${v}`);
      assert.ok(Math.abs(balanceOf(tree)) <= 1);
    }
    // 24 nodes fit in 5 levels balanced; unbalanced they would need 24.
    assert.strictEqual(treeHeight(tree), 5);
    assert.strictEqual(traverse(tree, "in").length, 24);
  });

  it("stays balanced for descending and shuffled input too", () => {
    const descending = Array.from({ length: 20 }, (_, i) => 20 - i);
    const shuffled = [13, 2, 19, 7, 1, 16, 9, 4, 20, 11, 6, 18, 3, 15, 8];
    for (const seq of [descending, shuffled]) {
      const tree = buildTree(seq, true);
      assert.ok(isAvlBalanced(tree));
      assert.deepStrictEqual(
        traverse(tree, "in"),
        [...seq].sort((a, b) => a - b),
      );
    }
  });
});
