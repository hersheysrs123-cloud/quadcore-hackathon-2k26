/**
 * Empty starting note shape.
 */
export const MOCK_NOTE = {
  id: "00000000-0000-0000-0000-000000000001",
  space_id: "00000000-0000-0000-0000-0000000000aa",
  title: "Untitled Note",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  blocks: [
    {
      id: "b1",
      order_index: 1024,
      block_type: "heading",
      content_json: { text: "", level: 1 },
    },
    {
      id: "b2",
      order_index: 2048,
      block_type: "text",
      content_json: { text: "" },
    },
  ],
};

export default MOCK_NOTE;
