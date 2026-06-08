import { ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
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
  const isPdf =
    document.fileType?.includes("pdf") || document.dataUrl?.startsWith("data:application/pdf");

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
        <span>{document.fileName || "Gemt bevis"}</span>
        <div>
          <button
            aria-label="Zoom ud"
            onClick={() => setZoom((value) => Math.max(0.6, value - 0.2))}
          >
            <ZoomOut size={18} />
          </button>
          <output>{Math.round(zoom * 100)}%</output>
          <button
            aria-label="Zoom ind"
            onClick={() => setZoom((value) => Math.min(3, value + 0.2))}
          >
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
  const viewportRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [imageSize, setImageSize] = useState({ width: 1, height: 1 });

  useDocumentGestures(viewportRef, setZoom);

  return (
    <div ref={viewportRef} className="document-viewer">
      <div
        className="document-content image-content"
        style={{
          width: imageSize.width * zoom,
          height: imageSize.height * zoom
        }}
      >
        <img
          ref={imageRef}
          src={dataUrl}
          alt="Gemt bevis"
          className="zoomed-image"
          style={{
            width: imageSize.width,
            height: imageSize.height,
            transform: `scale(${zoom})`
          }}
          onLoad={() => {
            const image = imageRef.current;
            if (!image) return;
            setImageSize({
              width: image.naturalWidth || 1,
              height: image.naturalHeight || 1
            });
          }}
        />
      </div>
    </div>
  );
}

function PdfViewer({ dataUrl, zoom, setZoom }: ZoomProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<number[]>([]);
  const [error, setError] = useState("");
  const binary = useMemo(() => dataUrlToUint8Array(dataUrl), [dataUrl]);

  useDocumentGestures(viewportRef, setZoom);

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
    <div ref={viewportRef} className="document-viewer">
      <div className="document-content pdf-pages">
        {pages.length === 0 && <span>Indlæser PDF...</span>}
        {pages.map((pageNumber) => (
          <PdfPage
            key={`${pageNumber}-${zoom}`}
            data={binary}
            pageNumber={pageNumber}
            zoom={zoom}
          />
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

function useDocumentGestures(
  viewportRef: RefObject<HTMLDivElement>,
  setZoom: (updater: number | ((value: number) => number)) => void
) {
  const pinchDistanceRef = useRef<number | null>(null);
  const panRef = useRef<{
    x: number;
    y: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const preventGesture = (event: Event) => {
      event.preventDefault();
    };

    const onTouchStart = (event: globalThis.TouchEvent) => {
      if (event.touches.length === 2) {
        event.preventDefault();
        pinchDistanceRef.current = getTouchDistance(event);
        panRef.current = null;
        return;
      }

      if (event.touches.length === 1) {
        const touch = event.touches[0];
        panRef.current = {
          x: touch.clientX,
          y: touch.clientY,
          scrollLeft: viewport.scrollLeft,
          scrollTop: viewport.scrollTop
        };
      }
    };

    const onTouchMove = (event: globalThis.TouchEvent) => {
      if (event.touches.length === 2 && pinchDistanceRef.current) {
        event.preventDefault();
        const distance = getTouchDistance(event);
        const delta = distance / pinchDistanceRef.current;
        pinchDistanceRef.current = distance;
        setZoom((value) => Math.min(3, Math.max(0.6, value * delta)));
        return;
      }

      if (event.touches.length === 1 && panRef.current) {
        event.preventDefault();
        const touch = event.touches[0];
        viewport.scrollLeft = panRef.current.scrollLeft + panRef.current.x - touch.clientX;
        viewport.scrollTop = panRef.current.scrollTop + panRef.current.y - touch.clientY;
      }
    };

    const onTouchEnd = () => {
      pinchDistanceRef.current = null;
      panRef.current = null;
    };

    viewport.addEventListener("touchstart", onTouchStart, { passive: false });
    viewport.addEventListener("touchmove", onTouchMove, { passive: false });
    viewport.addEventListener("touchend", onTouchEnd, { passive: false });
    viewport.addEventListener("touchcancel", onTouchEnd, { passive: false });
    viewport.addEventListener("gesturestart", preventGesture, { passive: false });
    viewport.addEventListener("gesturechange", preventGesture, { passive: false });
    viewport.addEventListener("gestureend", preventGesture, { passive: false });

    return () => {
      viewport.removeEventListener("touchstart", onTouchStart);
      viewport.removeEventListener("touchmove", onTouchMove);
      viewport.removeEventListener("touchend", onTouchEnd);
      viewport.removeEventListener("touchcancel", onTouchEnd);
      viewport.removeEventListener("gesturestart", preventGesture);
      viewport.removeEventListener("gesturechange", preventGesture);
      viewport.removeEventListener("gestureend", preventGesture);
    };
  }, [setZoom, viewportRef]);
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

function getTouchDistance(event: globalThis.TouchEvent) {
  const [first, second] = [event.touches[0], event.touches[1]];
  return Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
}
