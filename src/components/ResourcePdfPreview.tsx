import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; document: PDFDocumentProxy }
  | { status: "failed" };

function PdfPage({ document, pageNumber }: { document: PDFDocumentProxy; pageNumber: number }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    let active = true;
    let renderTask: { cancel: () => void; promise: Promise<unknown> } | null = null;
    let resizeTimer: ReturnType<typeof setTimeout> | undefined;

    const render = async () => {
      const canvas = canvasRef.current;
      if (!canvas || !active) return;
      renderTask?.cancel();

      try {
        const page = await document.getPage(pageNumber);
        if (!active) return;
        const original = page.getViewport({ scale: 1 });
        const availableWidth = Math.max(wrapper.clientWidth, 1);
        const cssScale = Math.min(1.6, availableWidth / original.width);
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = page.getViewport({ scale: cssScale * pixelRatio });
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) throw new Error("Canvas is unavailable");

        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        canvas.style.width = `${Math.ceil(viewport.width / pixelRatio)}px`;
        canvas.style.height = `${Math.ceil(viewport.height / pixelRatio)}px`;
        renderTask = page.render({ canvas, canvasContext: context, viewport });
        await renderTask.promise;
        if (active) setFailed(false);
      } catch (error) {
        if (active && !(error instanceof Error && error.name === "RenderingCancelledException")) {
          setFailed(true);
        }
      }
    };

    const observer = new ResizeObserver(() => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => void render(), 80);
    });
    observer.observe(wrapper);
    void render();

    return () => {
      active = false;
      clearTimeout(resizeTimer);
      observer.disconnect();
      renderTask?.cancel();
    };
  }, [document, pageNumber]);

  return (
    <div ref={wrapperRef} className="w-full" aria-label={`Page ${pageNumber}`}>
      {failed ? (
        <p className="py-8 text-center text-sm text-slate">Page {pageNumber} couldn't be displayed.</p>
      ) : (
        <canvas ref={canvasRef} className="mx-auto block max-w-full bg-background shadow-card" />
      )}
    </div>
  );
}

/** Renders PDF pages inside the app without relying on Chrome's embedded PDF viewer. */
export function ResourcePdfPreview({ url, name }: { url: string; name: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    let loadedDocument: PDFDocumentProxy | null = null;

    const load = async () => {
      setState({ status: "loading" });
      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        const response = await fetch(url, { credentials: "same-origin" });
        if (!response.ok) throw new Error("PDF request failed");
        const data = new Uint8Array(await response.arrayBuffer());
        const task = pdfjs.getDocument({ data });
        loadedDocument = await task.promise;
        if (active) setState({ status: "ready", document: loadedDocument });
        else void loadedDocument.destroy();
      } catch {
        if (active) setState({ status: "failed" });
      }
    };

    void load();
    return () => {
      active = false;
      if (loadedDocument) void loadedDocument.destroy();
    };
  }, [url]);

  if (state.status === "loading") {
    return <p className="py-12 text-center text-sm text-slate">Loading {name}…</p>;
  }
  if (state.status === "failed") {
    return (
      <p className="py-12 text-center text-sm text-slate">
        We couldn't display this PDF here. Open it in a new tab or download it instead.
      </p>
    );
  }

  return (
    <div className="max-h-[70vh] space-y-4 overflow-auto rounded-lg border border-border bg-surface p-2 sm:p-4">
      {Array.from({ length: state.document.numPages }, (_, index) => (
        <PdfPage key={index + 1} document={state.document} pageNumber={index + 1} />
      ))}
    </div>
  );
}