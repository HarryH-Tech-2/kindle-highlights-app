export type Book = {
  id: number;
  title: string;
  author: string | null;
  created_at: number;
};

export type Highlight = {
  id: number;
  book_id: number;
  text: string;
  note: string | null;
  created_at: number;
  updated_at: number;
};

export type Tag = {
  id: number;
  name: string;
};

export type HighlightWithRelations = Highlight & {
  book: Book;
  tags: Tag[];
};

export type NewBookInput = { title: string; author?: string | null };
export type NewHighlightInput = {
  book_id: number;
  text: string;
  note?: string | null;
  tag_names?: string[];
};
