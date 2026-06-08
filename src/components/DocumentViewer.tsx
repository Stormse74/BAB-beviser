import { ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { TouchEvent } from "react";
import * as pdfjsLib from "pdfjs-dist";
import type { StoredDocument } from "../types";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

interface DocumentViewerProps {
  document: StoredDocument;
}

export function DocumentViewer({ document }: DocumentViewerProps) {
  const [zoom, setZoom] = useState(1);
  const isPdf = document.fileType?.includes("pdf") || document.dataUrl?.startsWith("data:application/pdf");

  useEffect(() => {
    setZoom(1);
  }, [document.id, document.dataUrl]);

  if (!document.dataUrl) {
    return (
      <div className="empty-viewer">
        <strong>Intet bevis gemt endnu</strong>
        <span>Importer en PDF eller tag et billede med kameraet.</span>
      </div>
    );
  }

  return (
    <div className="viewer-shell">
      <div className="viewer-toolbar">
        <span>{document.fileName || "Gem bevis"}</span>
        <div>
          <button aria-label="Zoom ud" onClick={() => setZoom((value) => Math.max(0.6, value - 0.2))}>
            <ZoomOut size={18} />
          </button>
          <output>{Math.round(zoom * 100)}%</output>
          <button aria-label="Zoom ind" onClick={() => setZoom((value) => Math.min(3, value + 0.2))}>
            <ZoomIn size={18} />
          </button>
        </div>
      </div>
      {isPdf ? (
        <PdfViewer dataUrl={document.dataUrl} zoom={zoom} setZoom={setZoom} />
      ) : (
        <ImageViewer dataUrl={document.dataUrl} zoom={zoom} setZoom={setZoom} />
      )}
    </div>
  );
}

interface ZoomProps {
  dataUrl: string;
  zoom: number;
  setZoom: (updater: number | ((value: number) => number)) => void;
}

function ImageViewer({ dataUrl, zoom, setZoom }: ZoomProps) {
  const lastTapRef = useRef(0);
  const pinchRef = useRef<number | null>(null);

  return (
    <div
      className="document-viewport"
      onDoubleClick={() => setZoom((value) => (value > 1 ? 1 : 2))}
      onTouchStart={(event) => {
        if (event.touches.length === 2) {
          pinchRef.current = getTouchDistance(event);
          return;
        }
        const now = Date.now();
        if (now - lastTapRef.current < 280) {
          setZoom((value) => (value > 1 ? 1 : 2));
        }
        lastTapRef.current = now;
      }}
      onTouchMove={(event) => {
        if (event.touches.length !== 2 || !pinchRef.current) return;
        // Kun dokumentområdet zoomer; resten af appens layout bliver stående.
        const distance = getTouchDistance(event);
        const delta = distance / pinchRef.current;
        pinchRef.current = distance;
        setZoom((value) => Math.min(3, Math.max(0.6, value * delta)));
      }}
      onTouchEnd={() => {
        pinchRef.current = null;
      }}
    >
      <img
        src={dataUrl}
        alt="Gemt bevis"
        style={{ transform: `scale(${zoom})` }}
        className="zoomed-image"
      />
    </div>
  );
}

function PdfViewer({ dataUrl, zoom, setZoom }: ZoomProps) {
  const [pages, setPages] = useState<number[]>([]);
  const [error, setError] = useState("");
  const pinchRef = useRef<number | null>(null);
  const binary = useMemo(() => dataUrlToUint8Array(dataUrl), [dataUrl]);

  useEffect(() => {
    let cancelled = false;
    setError("");

    pdfjsLib
      .getDocument({ data: binary.slice() }).promise
      .then((pdf) => {
        if (!cancelled) {
          setPages(Array.from({ length: pdf.numPages }, (_, index) => index + 1));
        }
      })
      .catch(() => setError("PDF'en kunne ikke vises i appen."));

    return () => {
      cancelled = true;
    };
  }, [binary]);

  if (error) return <div className="empty-viewer">{error}</div>;

  return (
    <div
      className="document-viewport"
      onTouchStart={(event) => {
        if (event.touches.length === 2) {
          pinchRef.current = getTouchDistance(event);
        }
      }}
      onTouchMove={(event) => {
        if (event.touches.length !== 2 || !pinchRef.current) return;
        // Kun dokumentområdet zoomer; resten af appens layout bliver stående.
        const distance = getTouchDistance(event);
        const delta = distance / pinchRef.current;
        pinchRef.current = distance;
        setZoom((value) => Math.min(3, Math.max(0.6, value * delta)));
      }}
      onTouchEnd={() => {
        pinchRef.current = null;
      }}
    >
      <div className="pdf-pages">
        {pages.length === 0 && <span>Indlæser PDF...</span>}
        {pages.map((pageNumber) => (
          <PdfPage key={`${pageNumber}-${zoom}`} data={binary} pageNumber={pageNumber} zoom={zoom} />
        ))}
      </div>
    </div>
  );
}

function PdfPage({
  data,
  pageNumber,
  zoom
}: {
  data: Uint8Array;
  pageNumber: number;
  zoom: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;

    pdfjsLib.getDocument({ data: data.slice() }).promise.then(async (pdf) => {
      const page = await pdf.getPage(pageNumber);
      if (cancelled || !canvasRef.current) return;

      const viewport = page.getViewport({ scale: zoom * 1.35 });
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      if (!context) return;

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: context, viewport }).promise;
    });

    return () => {
      cancelled = true;
    };
  }, [data, pageNumber, zoom]);

  return <canvas ref={canvasRef} className="pdf-page" aria-label={`PDF side ${pageNumber}`} />;
}

function dataUrlToUint8Array(dataUrl: string) {
  const base64 = dataUrl.split(",")[1] || "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function getTouchDistance(event: TouchEvent) {
  const [first, second] = [event.touches[0], event.touches[1]];
  return Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
}
