/**
 * Stand-in note for the boilerplate workspace, shaped exactly like a real row
 * plus its blocks so swapping in `GET /api/notes/[id]` is a one-line change.
 */
export const MOCK_NOTE = {
  id: "00000000-0000-0000-0000-000000000001",
  space_id: "00000000-0000-0000-0000-0000000000aa",
  title: "Eigenvectors & Eigenvalues",
  created_at: "2026-07-28T09:12:00.000Z",
  updated_at: "2026-07-31T14:03:00.000Z",
  blocks: [
    {
      id: "b1",
      order_index: 1024,
      block_type: "heading",
      content_json: { text: "Why does Av = λv matter?", level: 2 },
    },
    {
      id: "b2",
      order_index: 2048,
      block_type: "text",
      content_json: {
        text: "An eigenvector is a direction that a transformation doesn't rotate — it only stretches or squashes it. The eigenvalue λ is how much.",
      },
    },
    {
      id: "b3",
      order_index: 3072,
      block_type: "socratic",
      content_json: {
        concept: "Eigenvectors",
        prompt:
          "I can restate the definition, but I couldn't explain why a shear matrix has only one eigenvector direction.",
        sessionId: null,
      },
    },
    {
      id: "b4",
      order_index: 4096,
      block_type: "media",
      content_json: {
        url: "",
        caption: "Lecture 7 whiteboard — the 2×2 worked example",
        kind: "image",
      },
    },
    {
      id: "b5",
      order_index: 5120,
      block_type: "text",
      content_json: {
        text: "TODO: come back to the characteristic polynomial once the determinant intuition is solid.",
      },
    },
  ],
};

export default MOCK_NOTE;
