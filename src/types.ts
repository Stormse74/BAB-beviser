export type DocumentId = "bab1" | "bab2" | "bab3a" | "bab3b" | "bab4" | "driver";

export type DocumentKind = "bab" | "driver";

export interface DocumentDefinition {
  id: DocumentId;
  title: string;
  shortTitle: string;
  kind: DocumentKind;
}

export interface StoredDocument {
  id: DocumentId;
  fileName?: string;
  fileType?: string;
  dataUrl?: string;
  validFrom?: string;
  validityYears?: number;
  validityMonths?: number;
  updatedAt?: string;
}

export interface CalculatedDates {
  expiresOn?: string;
  orderBy?: string;
  status: "empty" | "green" | "yellow" | "red";
  statusText: string;
}

export interface BackupFile {
  app: "BAB Beviser";
  version: 1;
  exportedAt: string;
  documents: StoredDocument[];
}
