// Hand-rolled in-memory Firestore stand-in. Implements just enough surface
// area for our sync orchestrator: collection().doc(), batch().set()/commit(),
// where('updated_at','>', n).get(). Lives in non-test source so both the
// firestore.test.ts and sync.test.ts can share it; the only entry point that
// reaches it in production code is _setFirestoreForTests, which is otherwise
// inert.

type Doc = Record<string, unknown> & { updated_at?: number };

type Collection = Map<string, Doc>;

export type FakeFirestore = {
  __collections: Map<string, Collection>;
  collection: (path: string) => CollectionRef;
  batch: () => WriteBatch;
};

type DocRef = {
  __collection: Collection;
  __id: string;
};

type CollectionRef = {
  doc: (id: string) => DocRef;
  where: (field: string, op: '>', value: number) => Query;
};

type Query = {
  get: () => Promise<{ docs: { data: () => Doc }[] }>;
};

type WriteBatch = {
  set: (ref: DocRef, data: Doc, opts?: { merge?: boolean }) => void;
  commit: () => Promise<void>;
};

export function makeFakeFirestore(): FakeFirestore {
  const collections = new Map<string, Collection>();

  const getCollection = (path: string): Collection => {
    let c = collections.get(path);
    if (!c) {
      c = new Map();
      collections.set(path, c);
    }
    return c;
  };

  const collectionRef = (path: string): CollectionRef => {
    const col = getCollection(path);
    return {
      doc: (id) => ({ __collection: col, __id: id }),
      where: (field, op, value) => ({
        get: async () => {
          const docs: { data: () => Doc }[] = [];
          for (const d of col.values()) {
            const v = (d as Record<string, unknown>)[field];
            if (op === '>' && typeof v === 'number' && v > value) {
              docs.push({ data: () => d });
            }
          }
          return { docs };
        },
      }),
    };
  };

  return {
    __collections: collections,
    collection: collectionRef,
    batch: () => {
      const ops: Array<() => void> = [];
      return {
        set: (ref, data, opts) => {
          ops.push(() => {
            if (opts?.merge) {
              const existing = ref.__collection.get(ref.__id) ?? {};
              ref.__collection.set(ref.__id, { ...existing, ...data });
            } else {
              ref.__collection.set(ref.__id, { ...data });
            }
          });
        },
        commit: async () => {
          for (const op of ops) op();
        },
      };
    },
  };
}
