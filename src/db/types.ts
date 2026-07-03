export type Book = {
  id: number;
  title: string;
  author: string | null;
  created_at: number;
  updated_at: number;
  remote_id: string | null;
  deleted_at: number | null;
};

export type Highlight = {
  id: number;
  book_id: number;
  text: string;
  note: string | null;
  created_at: number;
  updated_at: number;
  remote_id: string | null;
  deleted_at: number | null;
  // JSON-encoded HighlightStyle (or null). Stored as a string so the column
  // stays schema-stable as we add more styling knobs over time.
  style: string | null;
};

export type Tag = {
  id: number;
  name: string;
  // Sync fields. `remote_id` is the same string as `name` — tag identity is
  // its lowercased name, both locally (UNIQUE constraint on name) and in
  // Firestore (doc id == name), so two devices that mint the same tag name
  // converge on the same document rather than duplicating.
  remote_id: string | null;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
};

// Visual style for a saved highlight. All fields are optional so the absence
// of a value means "use the theme default".
export type HighlightStyle = {
  color?: string | null;
  italic?: boolean;
  // Key into the FONT_OPTIONS map (e.g. 'lora', 'mono'). Null/undefined
  // means use the default font (Space Grotesk).
  font?: string | null;
};

export type HighlightWithRelations = Highlight & {
  book: Book;
  tags: Tag[];
  // Parsed view of `style`. UI components read from here; the raw `style`
  // string is only used by the sync layer.
  styleParsed: HighlightStyle | null;
};

export type NewBookInput = { title: string; author?: string | null };
export type NewHighlightInput = {
  book_id: number;
  text: string;
  note?: string | null;
  tag_names?: string[];
  style?: HighlightStyle | null;
};
