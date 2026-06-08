import type { DocumentDefinition } from "./types";

export const DOCUMENTS: DocumentDefinition[] = [
  { id: "bab1", title: "BAB 1", shortTitle: "BAB 1", kind: "bab" },
  { id: "bab2", title: "BAB 2", shortTitle: "BAB 2", kind: "bab" },
  { id: "bab3a", title: "BAB 3a - Lift", shortTitle: "BAB 3a", kind: "bab" },
  { id: "bab3b", title: "BAB 3b - Trappemaskine", shortTitle: "BAB 3b", kind: "bab" },
  { id: "bab4", title: "BAB 4 - Opfølgning", shortTitle: "BAB 4", kind: "bab" },
  { id: "driver", title: "Chaufførkort", shortTitle: "Chaufførkort", kind: "driver" }
];

export const getDocumentDefinition = (id: string) =>
  DOCUMENTS.find((document) => document.id === id);
