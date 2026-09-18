// ─── Binary search trees, plain and self-balancing ──────────────────
// Insertion, search paths, traversals, and the AVL rotations that stop a tree
// degenerating into a linked list.
//
// It lives in `lib/` rather than inside the canvas for the same reason the
// physics engines do: the unit tests import the very code that ships. The
// previous arrangement had the scene's tree logic inline and the test file
// holding its own copy of it, so the tests went on passing while the scene
// claimed to do AVL rotations it had never actually implemented.
// ─────────────────────────────────────────────────────────────────────

export const heightOf = (n) => (n ? n.height : 0);

/** Left height minus right height. Outside ±1 an AVL tree has to rotate. */
export const balanceOf = (n) => (n ? heightOf(n.left) - heightOf(n.right) : 0);

/** A node with its height derived from its children rather than passed in. */
export function makeNode(value, left = null, right = null) {
  return { value, left, right, height: 1 + Math.max(heightOf(left), heightOf(right)) };
}

/**
 * The two rotations.
 *
 * Each rearranges three subtrees without ever breaking the search property:
 * everything left of a node stays smaller than it and everything right stays
 * larger, whichever way the node itself moves. That invariance is the whole
 * reason rotation is a legal repair rather than a rebuild.
 */
export function rotateRight(n) {
  const pivot = n.left;
  return makeNode(pivot.value, pivot.left, makeNode(n.value, pivot.right, n.right));
}

export function rotateLeft(n) {
  const pivot = n.right;
  return makeNode(pivot.value, makeNode(n.value, n.left, pivot.left), pivot.right);
}

/**
 * The four AVL cases.
 *
 * Left-left and right-right are one rotation each. The two zig-zag cases need
 * their inner child straightened first, because rotating a zig-zag directly
 * just produces the mirror-image zig-zag and the height never comes down.
 */
export function rebalance(n) {
  const balance = balanceOf(n);
  if (balance > 1) {
    return rotateRight(balanceOf(n.left) < 0 ? makeNode(n.value, rotateLeft(n.left), n.right) : n);
  }
  if (balance < -1) {
    return rotateLeft(balanceOf(n.right) > 0 ? makeNode(n.value, n.left, rotateRight(n.right)) : n);
  }
  return n;
}

/** Insert, rebalancing on the way back up when `balanced` is set. */
export function insert(node, value, balanced = false) {
  if (!node) return makeNode(value, null, null);
  if (value === node.value) return node;
  const grown =
    value < node.value
      ? makeNode(node.value, insert(node.left, value, balanced), node.right)
      : makeNode(node.value, node.left, insert(node.right, value, balanced));
  return balanced ? rebalance(grown) : grown;
}

export function buildTree(values, balanced = false) {
  return values.reduce((root, value) => insert(root, value, balanced), null);
}

/** The comparison path a search or insert walks, ending at `value` if present. */
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

/** Deepest path length, in nodes. What the HUD prints as the tree's height. */
export function treeHeight(root) {
  return heightOf(root);
}

/** True when every node in the tree satisfies the AVL condition. */
export function isAvlBalanced(root) {
  if (!root) return true;
  if (Math.abs(balanceOf(root)) > 1) return false;
  return isAvlBalanced(root.left) && isAvlBalanced(root.right);
}
