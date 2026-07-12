"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Camera,
  Images,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { ScanResultCard } from "@/components/ScanResultCard";
import { addScanDb, getAllergensDb } from "@/lib/db";
import { resultVerdict, type Allergen, type ScanResult } from "@/lib/storage";
import { useProfile } from "@/lib/useProfile";

type Status = "capture" | "preview" | "analyzing" | "result" | "error";

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

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setStatus("capture");
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
          {cameraReady && (
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
              Ingredient scan
            </span>
            <span className="h-10 w-10" aria-hidden />
          </div>
        </div>

        {/* Dock */}
        <div className="flex items-center justify-between px-10 pt-5 pb-[max(2rem,env(safe-area-inset-bottom))]">
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
          {status === "result" ? "Scan result" : "Scan a label"}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {status === "result"
            ? result && resultVerdict(result) === "unreadable"
              ? "That photo wasn't clear enough."
              : "Here's what Canopy found."
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
