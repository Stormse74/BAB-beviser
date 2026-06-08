import { DOCUMENTS } from "./documents";
import type { BackupFile, DocumentId, StoredDocument } from "./types";

const DB_NAME = "bab-beviser";
const DB_VERSION = 1;
const STORE_NAME = "documents";

const openDatabase = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const transaction = async (mode: IDBTransactionMode) => {
  const database = await openDatabase();
  return database.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
};

export const getDocuments = async () => {
  const store = await transaction("readonly");

  const records = await new Promise<StoredDocument[]>((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return DOCUMENTS.map((definition) => {
    const existing = records.find((record) => record.id === definition.id);
    return existing || { id: definition.id };
  });
};

export const saveDocument = async (document: StoredDocument) => {
  const store = await transaction("readwrite");
  await new Promise<void>((resolve, reject) => {
    const request = store.put({ ...document, updatedAt: new Date().toISOString() });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const clearDocumentFile = async (document: StoredDocument) => {
  await saveDocument({
    ...document,
    dataUrl: undefined,
    fileName: undefined,
    fileType: undefined
  });
};

export const replaceAllDocuments = async (documents: StoredDocument[]) => {
  const database = await openDatabase();
  const tx = database.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);

  // Clear og gendan i samme transaktion, så en backup ikke ender halvt importeret.
  await new Promise<void>((resolve, reject) => {
    const clearRequest = store.clear();
    clearRequest.onsuccess = () => {
      documents.forEach((document) => store.put(document));
    };
    clearRequest.onerror = () => reject(clearRequest.error);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
};

export const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

export const buildBackup = (documents: StoredDocument[]): BackupFile => ({
  app: "BAB Beviser",
  version: 1,
  exportedAt: new Date().toISOString(),
  documents
});

export const parseBackup = (raw: string): BackupFile => {
  const parsed = JSON.parse(raw) as Partial<BackupFile>;
  const validIds = new Set<DocumentId>(DOCUMENTS.map((document) => document.id));

  if (
    parsed.app !== "BAB Beviser" ||
    parsed.version !== 1 ||
    !Array.isArray(parsed.documents) ||
    parsed.documents.some((document) => !document || !validIds.has(document.id))
  ) {
    throw new Error("Ugyldig backupfil.");
  }

  return parsed as BackupFile;
};
