import {
  CalendarPlus,
  Camera,
  Download,
  FileText,
  Info,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload
} from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { DocumentViewer } from "./components/DocumentViewer";
import { DOCUMENTS, getDocumentDefinition } from "./documents";
import { calculateDates, createGoogleCalendarUrl, formatDate } from "./dateLogic";
import { isInstalledMode } from "./pwa";
import {
  buildBackup,
  clearDocumentFile,
  fileToDataUrl,
  getDocuments,
  parseBackup,
  replaceAllDocuments,
  saveDocument
} from "./storage";
import type { DocumentId, StoredDocument } from "./types";

const getCalendarText = (document: StoredDocument) => {
  const definition = getDocumentDefinition(document.id);
  if (!definition) return { title: "Genbestil bevis", description: "" };

  if (definition.kind === "driver") {
    return {
      title: "Genbestil chaufførkort",
      description: "Chaufførkortet nærmer sig udløb. Bestil nyt i god tid."
    };
  }

  return {
    title: `Bestil opfølgning til ${definition.shortTitle}`,
    description: `${definition.title} nærmer sig udløb. Bestil opfølgning i god tid.`
  };
};

const downloadFile = (content: string, fileName: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

function App() {
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [selectedId, setSelectedId] = useState<DocumentId>("bab1");
  const [isInstalled] = useState(isInstalledMode);
  const [message, setMessage] = useState("");
  const backupInputRef = useRef<HTMLInputElement>(null);

  const selectedDocument = documents.find((document) => document.id === selectedId);

  const refreshDocuments = async () => {
    setDocuments(await getDocuments());
  };

  useEffect(() => {
    refreshDocuments().catch(() =>
      setMessage("Kunne ikke åbne den lokale lagring i browseren.")
    );
  }, []);

  const nextActions = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return documents
      .map((document) => {
        const definition = getDocumentDefinition(document.id);
        const dates = calculateDates(document);
        return { document, definition, dates };
      })
      .filter(
        (item) =>
          item.definition &&
          item.dates.orderBy &&
          (item.dates.status === "red" || item.dates.orderBy >= today)
      )
      .sort((a, b) => String(a.dates.orderBy).localeCompare(String(b.dates.orderBy)))
      .slice(0, 4);
  }, [documents]);

  const updateDocument = async (document: StoredDocument) => {
    await saveDocument(document);
    await refreshDocuments();
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>, document: StoredDocument) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const dataUrl = await fileToDataUrl(file);
    await updateDocument({
      ...document,
      fileName: file.name,
      fileType: file.type || "application/octet-stream",
      dataUrl
    });
    event.target.value = "";
  };

  const exportBackup = () => {
    const backup = buildBackup(documents);
    const date = new Date().toISOString().slice(0, 10);
    downloadFile(
      JSON.stringify(backup, null, 2),
      `bab-beviser-backup-${date}.json`,
      "application/json"
    );
  };

  const importBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (file.name.toLowerCase().endsWith(".mht")) {
      setMessage(
        "Dette er en gemt webside, ikke en BAB Beviser-backup. Eksporter backup fra appens backupfunktion."
      );
      return;
    }

    try {
      const backup = parseBackup(await file.text());
      await replaceAllDocuments(backup.documents);
      await refreshDocuments();
      setMessage("Backup er importeret.");
    } catch {
      setMessage("Backupfilen er ugyldig og kunne ikke importeres.");
    }
  };

  return (
    <div className="app-shell">
      {!isInstalled && <WebsiteIntro />}

      <header className="topbar">
        <div>
          <p className="eyebrow">Lokal PWA</p>
          <h1>BAB Beviser</h1>
        </div>
        <a href="#info" className="icon-link" aria-label="Info">
          <Info size={22} />
        </a>
      </header>

      <main>
        <nav className="document-tabs" aria-label="Dokumenttyper">
          {DOCUMENTS.map((definition) => (
            <button
              key={definition.id}
              className={definition.id === selectedId ? "active" : ""}
              onClick={() => setSelectedId(definition.id)}
            >
              <FileText size={18} />
              <span>{definition.title}</span>
            </button>
          ))}
        </nav>

        <section className="next-actions" aria-labelledby="next-actions-title">
          <div>
            <p className="eyebrow">Overblik</p>
            <h2 id="next-actions-title">Næste handlinger</h2>
          </div>

          {nextActions.length === 0 ? (
            <p className="quiet success">Grøn: Ingen kommende handlinger</p>
          ) : (
            <div className="action-list">
              {nextActions.map(({ document, definition, dates }) => (
                <button
                  key={document.id}
                  className={`action-row ${dates.status}`}
                  onClick={() => setSelectedId(document.id)}
                >
                  <span>{dates.status === "red" ? "Rød" : dates.status === "yellow" ? "Gul" : "Grøn"}</span>
                  <strong>{definition?.title}</strong>
                  <span>
                    {definition?.kind === "driver" ? "bestilles senest" : "bestil opfølgning senest"}{" "}
                    {formatDate(dates.orderBy)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        {selectedDocument && (
          <DocumentPanel
            document={selectedDocument}
            onChange={updateDocument}
            onFile={handleFile}
            onDeleteFile={async () => {
              await clearDocumentFile(selectedDocument);
              await refreshDocuments();
            }}
          />
        )}

        <section className="backup-panel" aria-labelledby="backup-title">
          <div>
            <p className="eyebrow">Telefonskifte</p>
            <h2 id="backup-title">Backup</h2>
          </div>
          <div className="button-row">
            <button onClick={exportBackup}>
              <Download size={18} />
              Eksporter backup
            </button>
            <button onClick={() => backupInputRef.current?.click()}>
              <Upload size={18} />
              Importer backup
            </button>
            <input
              ref={backupInputRef}
              className="visually-hidden"
              type="file"
              accept="application/json,.json,.mht"
              onChange={importBackup}
            />
          </div>
          {message && <p className="message">{message}</p>}
        </section>

        <InfoPanel />
      </main>
    </div>
  );
}

function WebsiteIntro() {
  return (
    <section className="website-intro">
      <div className="intro-copy">
        <p className="eyebrow">Installerbar app</p>
        <h2>Gem dine BAB-beviser på telefonen</h2>
        <p>
          Appen kan installeres på telefon eller tablet, virker offline efter installation og
          gemmer beviser, billeder, datoer og backupdata lokalt på din egen enhed.
        </p>
      </div>
      <div className="intro-grid">
        <div>
          <ShieldCheck size={24} />
          <strong>Privat</strong>
          <span>Ingen login, upload, cookies, analytics, tracking eller serverdatabase.</span>
        </div>
        <div>
          <RefreshCw size={24} />
          <strong>Manuel backup</strong>
          <span>Ved telefonskifte eksporteres og importeres backup manuelt.</span>
        </div>
        <div>
          <CalendarPlus size={24} />
          <strong>Kalender</strong>
          <span>Påmindelser oprettes kun via brugerens egen Google Kalender.</span>
        </div>
      </div>
      <div className="install-guides">
        <div>
          <h3>Android</h3>
          <ol>
            <li>Åbn siden i Chrome</li>
            <li>Tryk på de tre prikker</li>
            <li>Vælg Installer app eller Føj til startskærm</li>
          </ol>
        </div>
        <div>
          <h3>iPhone/iPad</h3>
          <ol>
            <li>Åbn siden i Safari</li>
            <li>Tryk Del</li>
            <li>Vælg Føj til hjemmeskærm</li>
          </ol>
        </div>
      </div>
    </section>
  );
}

interface DocumentPanelProps {
  document: StoredDocument;
  onChange: (document: StoredDocument) => Promise<void>;
  onFile: (event: ChangeEvent<HTMLInputElement>, document: StoredDocument) => Promise<void>;
  onDeleteFile: () => Promise<void>;
}

function DocumentPanel({ document, onChange, onFile, onDeleteFile }: DocumentPanelProps) {
  const definition = getDocumentDefinition(document.id);
  const dates = calculateDates(document);
  const importInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  if (!definition) return null;

  const calendarText = getCalendarText(document);
  const calendarUrl = dates.orderBy
    ? createGoogleCalendarUrl(calendarText.title, dates.orderBy, calendarText.description)
    : undefined;

  return (
    <section className="document-panel" aria-labelledby="document-title">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Valgt dokument</p>
          <h2 id="document-title">{definition.title}</h2>
        </div>
        <span className={`status-pill ${dates.status}`}>{dates.statusText}</span>
      </div>

      <div className="control-grid">
        <label>
          <span>Gyldig fra</span>
          <input
            type="date"
            value={document.validFrom || ""}
            onChange={(event) => onChange({ ...document, validFrom: event.target.value })}
          />
        </label>

        {definition.kind === "driver" ? (
          <label>
            <span>Gyldighed i måneder</span>
            <input
              type="number"
              min="1"
              inputMode="numeric"
              placeholder="60"
              value={document.validityMonths || ""}
              onChange={(event) =>
                onChange({
                  ...document,
                  validityMonths: event.target.value ? Number(event.target.value) : undefined
                })
              }
            />
          </label>
        ) : (
          <label>
            <span>Gyldighed</span>
            <select
              value={document.validityYears || 5}
              onChange={(event) =>
                onChange({ ...document, validityYears: Number(event.target.value) })
              }
            >
              {[1, 2, 3, 4, 5, 6].map((year) => (
                <option key={year} value={year}>
                  {year} år
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="date-card">
          <span>Udløb</span>
          <strong>{formatDate(dates.expiresOn)}</strong>
        </div>
        <div className="date-card">
          <span>Bestillingsdato</span>
          <strong>{formatDate(dates.orderBy)}</strong>
        </div>
      </div>

      <div className="button-row">
        <button onClick={() => importInputRef.current?.click()}>
          <Upload size={18} />
          Importer PDF/billede
        </button>
        <button onClick={() => cameraInputRef.current?.click()}>
          <Camera size={18} />
          Tag billede
        </button>
        <button disabled={!document.dataUrl} onClick={onDeleteFile}>
          <Trash2 size={18} />
          Slet bevis
        </button>
        <a
          className={`button ${calendarUrl ? "" : "disabled"}`}
          href={calendarUrl}
          target="_blank"
          rel="noreferrer"
          aria-disabled={!calendarUrl}
        >
          <CalendarPlus size={18} />
          Opret kalenderaftale
        </a>
        <input
          ref={importInputRef}
          className="visually-hidden"
          type="file"
          accept="application/pdf,image/*"
          onChange={(event) => onFile(event, document)}
        />
        <input
          ref={cameraInputRef}
          className="visually-hidden"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(event) => onFile(event, document)}
        />
      </div>

      <DocumentViewer document={document} />
    </section>
  );
}

function InfoPanel() {
  return (
    <section id="info" className="info-panel" aria-labelledby="info-title">
      <p className="eyebrow">Info</p>
      <h2 id="info-title">Privatliv og ansvar</h2>
      <ul>
        <li>Alle beviser gemmes lokalt på enheden.</li>
        <li>Der uploades intet til server, og udvikleren kan ikke se brugerens beviser.</li>
        <li>Skifter man telefon, skal man eksportere og importere backup.</li>
        <li>Kalenderpåmindelser gemmes i brugerens egen kalender.</li>
        <li>Gyldighed kan variere efter trafikselskab, region og kontrakt.</li>
        <li>Brugeren skal selv vælge den gyldighed, der gælder for deres område.</li>
      </ul>
    </section>
  );
}

export default App;
