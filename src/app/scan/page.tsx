"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  Camera,
  Images,
  Info,
  Loader2,
  RefreshCw,
  ScanBarcode,
  SearchX,
  X,
} from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { ScanResultCard } from "@/components/ScanResultCard";
import type { BarcodeLookupResult } from "@/lib/barcode";
import { addScanDb, getAllergensDb } from "@/lib/db";
import { resultVerdict, type Allergen, type ScanResult } from "@/lib/storage";
import { useProfile } from "@/lib/useProfile";

type Status =
  | "capture"
  | "preview"
  | "analyzing"
  | "result"
  | "error"
  | "lookup"
  | "barcodeResult";

/**
 * Two ways to scan: photograph the ingredients label (the original flow,
 * goes through the vision model), or point at the barcode (free, instant,
 * looks the product up in Open Food Facts). Barcode results can prove an
 * allergen IS present but never that it's absent, so their UI always offers
 * the label scan as the confirmation step.
 */
type Mode = "label" | "barcode";

export default function ScanPage() {
  const router = useRouter();
  const { supabase, user, profile } = useProfile();
  const [allergens, setAllergens] = useState<Allergen[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [status, setStatus] = useState<Status>("capture");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [foodName, setFoodName] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [mode, setMode] = useState<Mode>("label");
  const [barcodeResult, setBarcodeResult] =
    useState<BarcodeLookupResult | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Once a barcode is spotted, this stops the detect loop from firing the
  // same lookup several times before React re-renders out of capture mode.
  const lookupLockRef = useRef(false);

  useEffect(() => {
    if (!user) return; // wait for auth to resolve before fetching
    let cancelled = false;
    getAllergensDb(supabase).then((list) => {
      if (cancelled) return;
      setAllergens(list);
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [supabase, user]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(false);
    setCameraReady(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setCameraReady(true);
    } catch {
      setCameraError(true);
      setCameraReady(false);
    }
  }, []);

  // Camera runs only during live capture, and only once allergens are set.
  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    if (status === "capture" && allergens.length > 0) {
      void (async () => {
        if (!cancelled) await startCamera();
      })();
    }
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [status, hydrated, allergens.length, startCamera, stopCamera]);

  const lookupBarcode = useCallback(
    async (code: string) => {
      stopCamera();
      setStatus("lookup");
      setError("");
      try {
        const res = await fetch("/api/barcode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            barcode: code,
            allergens,
            flagMayContain: profile?.flag_may_contain ?? true,
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          setError(json.error ?? "Something went wrong");
          setStatus("error");
          return;
        }
        setBarcodeResult(json as BarcodeLookupResult);
        setStatus("barcodeResult");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Network error");
        setStatus("error");
      } finally {
        lookupLockRef.current = false;
      }
    },
    [allergens, profile, stopCamera],
  );

  // Barcode detect loop: while the camera is live in barcode mode, ask the
  // detector every 250ms whether the current video frame contains a retail
  // barcode. The detector module is imported on demand so the label flow
  // never pays for its WebAssembly bundle. `barcode-detector` uses the
  // browser's native BarcodeDetector where it exists (Chrome/Android) and
  // its own WASM decoder everywhere else (iPhones, importantly).
  useEffect(() => {
    if (status !== "capture" || mode !== "barcode" || !cameraReady) return;
    let cancelled = false;
    let inFlight = false;
    let interval: ReturnType<typeof setInterval> | undefined;

    void (async () => {
      const { BarcodeDetector } = await import("barcode-detector/ponyfill");
      if (cancelled) return;
      const detector = new BarcodeDetector({
        formats: ["ean_13", "ean_8", "upc_a", "upc_e"],
      });
      interval = setInterval(() => {
        const video = videoRef.current;
        if (!video || video.readyState < 2) return;
        if (inFlight || lookupLockRef.current) return;
        inFlight = true;
        detector
          .detect(video)
          .then((codes) => {
            const hit = codes.find((c) => /^\d{8,14}$/.test(c.rawValue));
            if (hit && !cancelled && !lookupLockRef.current) {
              lookupLockRef.current = true;
              navigator.vibrate?.(80);
              void lookupBarcode(hit.rawValue);
            }
          })
          .catch(() => {
            // Transient frame the decoder couldn't handle; the next tick
            // gets a fresh one.
          })
          .finally(() => {
            inFlight = false;
          });
      }, 250);
    })();

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [status, mode, cameraReady, lookupBarcode]);

  const applyPhoto = (dataUrl: string) => {
    setImageDataUrl(dataUrl);
    setResult(null);
    setError("");
    stopCamera();
    setStatus("preview");
  };

  // Shared by both capture paths so a gallery pick gets the same downscale
  // the camera already did: full-res phone photos (12+ MP) upload slower and
  // burn mobile data for no benefit, since the model caps out at a fixed
  // internal resolution regardless of what's sent.
  const MAX_PHOTO_WIDTH = 1280;
  const JPEG_QUALITY = 0.85;

  const encodeFromSource = (
    source: CanvasImageSource,
    srcWidth: number,
    srcHeight: number,
  ): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const scale = Math.min(1, MAX_PHOTO_WIDTH / srcWidth);
    canvas.width = Math.round(srcWidth * scale);
    canvas.height = Math.round(srcHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const dataUrl = encodeFromSource(video, video.videoWidth, video.videoHeight);
    if (dataUrl) applyPhoto(dataUrl);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      const dataUrl = encodeFromSource(img, img.naturalWidth, img.naturalHeight);
      URL.revokeObjectURL(objectUrl);
      if (dataUrl) applyPhoto(dataUrl);
    };
    img.onerror = () => URL.revokeObjectURL(objectUrl);
    img.src = objectUrl;
  };

  const handleAnalyze = async () => {
    if (!imageDataUrl || !user) return;
    setStatus("analyzing");
    setError("");
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageDataUrl,
          allergens,
          flagMayContain: profile?.flag_may_contain ?? true,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Something went wrong");
        setStatus("error");
        return;
      }
      const newResult = json as ScanResult;
      // Show the verdict immediately — don't make the user wait on the
      // database write to see their result. The save happens in the
      // background; /api/scan itself never touches the database (see
      // src/lib/db.ts), so this is the one place a scan actually gets saved.
      setResult(newResult);
      setStatus("result");
      addScanDb(
        supabase,
        user.id,
        foodName.trim() || undefined,
        newResult,
        allergens,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
      setStatus("error");
    }
  };

  const resetToCapture = () => {
    setImageDataUrl(null);
    setFoodName("");
    setResult(null);
    setBarcodeResult(null);
    setError("");
    lookupLockRef.current = false;
    if (fileInputRef.current) fileInputRef.current.value = "";
    setStatus("capture");
  };

  /** Barcode results can't prove absence; this is their "go verify" exit. */
  const switchToLabelScan = () => {
    setMode("label");
    resetToCapture();
  };

  // --- Pre-hydration: quiet shell, no flash ---
  if (!hydrated) {
    return (
      <div className="flex min-h-dvh flex-col">
        <main className="flex-1" />
        <BottomNav />
      </div>
    );
  }

  // --- No allergens saved yet ---
  if (allergens.length === 0) {
    return (
      <div className="flex min-h-dvh flex-col">
        <header className="mx-auto w-full max-w-md px-6 pt-12">
          <h1 className="text-[1.9rem] font-bold tracking-tight">
            Almost ready
          </h1>
        </header>
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 pb-28 text-center">
          <div className="w-full rounded-3xl border border-border bg-card p-6 shadow-soft">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
              <AlertCircle className="h-6 w-6" />
            </div>
            <p className="font-semibold">Tell Canopy what to flag</p>
            <p className="mt-1 text-sm text-muted">
              Pick your allergens first. That&apos;s what we&apos;ll watch for
              in every scan.
            </p>
            <Link
              href="/profile"
              className="mt-4 inline-block rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-white"
            >
              Set up allergens
            </Link>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  // --- Live camera (full-screen) ---
  if (status === "capture") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-[#0b0f0d] text-white">
        <div className="relative flex-1 overflow-hidden">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
              cameraReady ? "opacity-100" : "opacity-0"
            }`}
          />

          {/* Starting */}
          {!cameraReady && !cameraError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/70">
              <Loader2 className="h-7 w-7 animate-spin" />
              <p className="text-sm">Starting camera…</p>
            </div>
          )}

          {/* Camera unavailable → photo fallback */}
          {cameraError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
                <Camera className="h-7 w-7 text-white/80" />
              </div>
              <div>
                <p className="font-semibold">Camera not available here</p>
                <p className="mt-1 text-sm text-white/60">
                  Allow camera access, or pick a photo of the label instead.
                </p>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-1 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#0b0f0d] active:scale-95"
              >
                <Images className="h-4 w-4" />
                Choose a photo
              </button>
              <button
                type="button"
                onClick={startCamera}
                className="text-sm text-white/60 underline underline-offset-2"
              >
                Try camera again
              </button>
            </div>
          )}

          {/* Viewfinder overlay */}
          {cameraReady && mode === "label" && (
            <>
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute left-8 top-[22%] h-8 w-8 rounded-tl-lg border-l-[3px] border-t-[3px] border-white/90" />
                <div className="absolute right-8 top-[22%] h-8 w-8 rounded-tr-lg border-r-[3px] border-t-[3px] border-white/90" />
                <div className="absolute bottom-[28%] left-8 h-8 w-8 rounded-bl-lg border-b-[3px] border-l-[3px] border-white/90" />
                <div className="absolute bottom-[28%] right-8 h-8 w-8 rounded-br-lg border-b-[3px] border-r-[3px] border-white/90" />
              </div>
              <div className="absolute inset-x-0 top-[calc(22%-52px)] flex justify-center">
                <span className="rounded-full bg-black/45 px-4 py-2 text-xs font-medium backdrop-blur">
                  Line up the ingredients panel
                </span>
              </div>
            </>
          )}

          {/* Barcode reticle: a wide band the shape of a barcode, with a
              pulsing scan line so it reads as "watching", since there is no
              shutter to press in this mode. */}
          {cameraReady && mode === "barcode" && (
            <>
              <div className="pointer-events-none absolute inset-x-10 top-1/2 -translate-y-1/2">
                <div className="relative h-36 rounded-2xl border-2 border-white/90">
                  <div className="absolute inset-x-4 top-1/2 h-0.5 -translate-y-1/2 animate-pulse rounded-full bg-accent" />
                </div>
              </div>
              <div className="absolute inset-x-0 top-[calc(50%-100px)] flex justify-center">
                <span className="rounded-full bg-black/45 px-4 py-2 text-xs font-medium backdrop-blur">
                  Point at the barcode. It scans on its own
                </span>
              </div>
            </>
          )}

          {/* Top bar */}
          <div className="absolute inset-x-0 top-0 flex items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))]">
            <button
              type="button"
              onClick={() => {
                stopCamera();
                router.push("/");
              }}
              aria-label="Close camera"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 backdrop-blur active:scale-95"
            >
              <X className="h-5 w-5" />
            </button>
            <span className="rounded-full bg-black/40 px-3 py-1.5 text-xs font-medium backdrop-blur">
              {mode === "barcode" ? "Barcode scan" : "Ingredient scan"}
            </span>
            <span className="h-10 w-10" aria-hidden />
          </div>
        </div>

        {/* Dock */}
        <div className="px-10 pt-4 pb-[max(2rem,env(safe-area-inset-bottom))]">
          {/* Mode toggle */}
          <div className="mx-auto mb-4 flex w-fit rounded-full bg-white/[0.12] p-1 backdrop-blur">
            <button
              type="button"
              onClick={() => setMode("label")}
              aria-pressed={mode === "label"}
              className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                mode === "label" ? "bg-white text-[#0b0f0d]" : "text-white/80"
              }`}
            >
              <Camera className="h-3.5 w-3.5" />
              Label
            </button>
            <button
              type="button"
              onClick={() => setMode("barcode")}
              aria-pressed={mode === "barcode"}
              className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                mode === "barcode" ? "bg-white text-[#0b0f0d]" : "text-white/80"
              }`}
            >
              <ScanBarcode className="h-3.5 w-3.5" />
              Barcode
            </button>
          </div>

          {mode === "label" ? (
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Choose a photo from your library"
                className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.12] backdrop-blur active:scale-95"
              >
                <Images className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={capturePhoto}
                disabled={!cameraReady}
                aria-label="Capture photo"
                className="relative flex h-[72px] w-[72px] items-center justify-center rounded-full transition-transform active:scale-95 disabled:opacity-40"
              >
                <span className="absolute inset-0 rounded-full border-4 border-white" />
                <span className="h-14 w-14 rounded-full bg-white" />
              </button>
              <span className="h-12 w-12" aria-hidden />
            </div>
          ) : (
            <p className="flex h-[72px] items-center justify-center text-center text-sm text-white/60">
              Free and instant. No photo needed.
            </p>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    );
  }

  // --- Preview / analyzing / result / error ---
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto w-full max-w-md px-6 pt-12">
        <h1 className="text-[1.9rem] font-bold tracking-tight">
          {status === "result" || status === "barcodeResult"
            ? "Scan result"
            : status === "lookup"
              ? "One sec"
              : "Scan a label"}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {status === "result"
            ? result && resultVerdict(result) === "unreadable"
              ? "That photo wasn't clear enough."
              : "Here's what Canopy found."
            : status === "lookup"
              ? "Checking the product database…"
              : status === "barcodeResult"
                ? barcodeResult?.verdict === "flagged"
                  ? "Found it. Here's what to know."
                  : barcodeResult?.verdict === "no_hits"
                    ? "Found it, but double-check."
                    : "The database came up short."
                : status === "analyzing"
                  ? "Reading the label…"
                  : "Check the photo, then analyze."}
        </p>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 space-y-4 px-6 pb-28 pt-5">
        {(status === "preview" || status === "analyzing") && imageDataUrl && (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-3xl border border-border bg-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageDataUrl}
                alt="Label preview"
                className="max-h-[46dvh] w-full object-contain"
              />
            </div>
            <div>
              <label className="px-1 font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
                Name this scan (optional)
              </label>
              <input
                type="text"
                value={foodName}
                onChange={(e) => setFoodName(e.target.value)}
                disabled={status === "analyzing"}
                placeholder="e.g. Trail mix"
                className="mt-1.5 w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-accent/60 disabled:opacity-50"
              />
            </div>
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={status === "analyzing"}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-accent py-3.5 text-base font-semibold text-white shadow-soft transition active:scale-[0.99] disabled:opacity-60"
            >
              {status === "analyzing" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing…
                </>
              ) : (
                `Analyze (${allergens.length} allergen${
                  allergens.length !== 1 ? "s" : ""
                })`
              )}
            </button>
            <button
              type="button"
              onClick={resetToCapture}
              disabled={status === "analyzing"}
              className="w-full py-1 text-sm text-muted transition-colors hover:text-foreground disabled:opacity-50"
            >
              Retake
            </button>
          </div>
        )}

        {status === "result" && result && (
          <div className="space-y-4">
            <ScanResultCard result={result} />
            <button
              type="button"
              onClick={resetToCapture}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-accent py-3.5 text-base font-semibold text-white shadow-soft active:scale-[0.99]"
            >
              <RefreshCw className="h-4 w-4" />
              Scan another
            </button>
          </div>
        )}

        {status === "lookup" && (
          <div className="rounded-3xl border border-border bg-card p-8 text-center">
            <Loader2 className="mx-auto h-7 w-7 animate-spin text-accent" />
            <p className="mt-3 font-semibold">Looking up this product</p>
            <p className="mt-1 text-sm text-muted">
              Checking Open Food Facts for its ingredients.
            </p>
          </div>
        )}

        {status === "barcodeResult" && barcodeResult && (
          <div className="space-y-4">
            {/* Product identity, when the database knows it */}
            {barcodeResult.verdict !== "not_found" && (
              <div className="flex items-center gap-3 rounded-3xl border border-border bg-card p-4">
                {barcodeResult.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={barcodeResult.imageUrl}
                    alt=""
                    className="h-14 w-14 shrink-0 rounded-xl bg-background object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-accent-soft">
                    <ScanBarcode className="h-6 w-6 text-accent" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {barcodeResult.productName ?? "Unnamed product"}
                  </p>
                  {barcodeResult.brand && (
                    <p className="truncate text-sm text-muted">
                      {barcodeResult.brand}
                    </p>
                  )}
                  <p className="font-mono text-[11px] text-faint">
                    {barcodeResult.barcode}
                  </p>
                </div>
              </div>
            )}

            {barcodeResult.verdict === "flagged" && (
              <div className="rounded-3xl border border-danger/20 bg-danger-soft p-5">
                <div className="flex items-center gap-2 text-danger">
                  <AlertTriangle className="h-5 w-5" />
                  <p className="text-lg font-bold">Avoid this</p>
                </div>
                <p className="mt-1 text-sm text-foreground">
                  The product database declares allergens from your list.
                </p>
                {barcodeResult.flaggedAllergies.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {barcodeResult.flaggedAllergies.map((a) => (
                      <span
                        key={a}
                        className="rounded-full bg-danger px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-white"
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                )}
                {barcodeResult.flaggedIntolerances.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {barcodeResult.flaggedIntolerances.map((a) => (
                      <span
                        key={a}
                        className="rounded-full bg-warning-soft px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-warning ring-1 ring-warning/30"
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                )}
                {barcodeResult.advisories.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {barcodeResult.advisories.map((adv) => (
                      <li
                        key={adv.allergen}
                        className="text-sm text-foreground"
                      >
                        Heads up: {adv.phrase}.
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {barcodeResult.verdict === "no_hits" && (
              <div className="rounded-3xl border border-border bg-card p-5">
                <div className="flex items-center gap-2">
                  <Info className="h-5 w-5 text-accent" />
                  <p className="font-semibold">Nothing declared for your list</p>
                </div>
                <p className="mt-2 text-sm text-muted">
                  The database doesn&apos;t list any of your allergens for this
                  product. That&apos;s a good first sign, but the database is
                  filled in by volunteers and can be incomplete. Scan the
                  ingredients label to be sure.
                </p>
              </div>
            )}

            {barcodeResult.verdict === "no_data" && (
              <div className="rounded-3xl border border-border bg-card p-5">
                <div className="flex items-center gap-2">
                  <SearchX className="h-5 w-5 text-warning" />
                  <p className="font-semibold">No ingredient info on file</p>
                </div>
                <p className="mt-2 text-sm text-muted">
                  The database knows this product but has no ingredient list
                  for it, so nothing could be checked. Scan the ingredients
                  label instead.
                </p>
              </div>
            )}

            {barcodeResult.verdict === "not_found" && (
              <div className="rounded-3xl border border-border bg-card p-5">
                <div className="flex items-center gap-2">
                  <SearchX className="h-5 w-5 text-warning" />
                  <p className="font-semibold">Not in the database yet</p>
                </div>
                <p className="mt-2 text-sm text-muted">
                  Open Food Facts doesn&apos;t have this barcode. Scan the
                  ingredients label instead and Canopy will read it directly.
                </p>
              </div>
            )}

            {barcodeResult.ingredients.length > 0 && (
              <div className="rounded-3xl border border-border bg-card p-5">
                <h3 className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
                  Ingredients on file
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-foreground">
                  {barcodeResult.ingredients.join(", ")}
                </p>
              </div>
            )}

            {barcodeResult.verdict === "flagged" ? (
              <>
                <button
                  type="button"
                  onClick={resetToCapture}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-accent py-3.5 text-base font-semibold text-white shadow-soft active:scale-[0.99]"
                >
                  <RefreshCw className="h-4 w-4" />
                  Scan another barcode
                </button>
                <button
                  type="button"
                  onClick={switchToLabelScan}
                  className="w-full py-1 text-sm text-muted transition-colors hover:text-foreground"
                >
                  Scan the label too
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={switchToLabelScan}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-accent py-3.5 text-base font-semibold text-white shadow-soft active:scale-[0.99]"
                >
                  <Camera className="h-4 w-4" />
                  Scan the label to be sure
                </button>
                <button
                  type="button"
                  onClick={resetToCapture}
                  className="w-full py-1 text-sm text-muted transition-colors hover:text-foreground"
                >
                  Scan another barcode
                </button>
              </>
            )}

            <p className="text-center text-[11px] text-muted">
              Product data from Open Food Facts, a free community database.
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="rounded-3xl border border-danger/20 bg-danger-soft p-6 text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-danger/10 text-danger">
              <AlertCircle className="h-6 w-6" />
            </div>
            <p className="font-semibold text-danger">Couldn&apos;t analyze</p>
            <p className="mt-1 text-sm text-foreground">{error}</p>
            <button
              type="button"
              onClick={resetToCapture}
              className="mt-4 rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-white"
            >
              Try again
            </button>
          </div>
        )}
      </main>

      <canvas ref={canvasRef} className="hidden" />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
      <BottomNav />
    </div>
  );
}
