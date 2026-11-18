"use client";

import { BookmarkPlus, Captions, CaptionsOff, Maximize, Minimize, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";
import type { VideoBlock } from "../blocks";

/**
 * The lesson video player (FE-STU-04).
 *
 * - Streaming: HLS (adaptive quality). Safari plays it natively; elsewhere hls.js is loaded only when a
 *   video needs it (a separate chunk, FE-PERF-04). Without HLS support, or if the stream fails, the MP4.
 * - Captions on by default when the author marked a default track; a button turns them on and off.
 * - Speed 0.5× to 2×, volume and mute, full screen.
 * - Keyboard, when the player has focus: Space or K play/pause, ← → or J L jump 5 s / 10 s, Home / End,
 *   0–9 jump to 0–90 %, M mute, C captions, F full screen, < > slower / faster. Buttons and the slider
 *   work with the keyboard as usual.
 * - Remembers position: starts where the student left it (`startAt`), reports the position every 10 s of
 *   playing, on pause and at the end (`onPosition`), through the offline-safe progress queue.
 * - States: poster before playing, a spinner while loading or buffering, and an error with "Try again"
 *   and the transcript to fall back on.
 */

export const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
const REPORT_EVERY_SECONDS = 10;

/** 75 → "1:15", 3725 → "1:02:05". */
export function formatTime(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/** Where to start: the saved position, unless it's so close to either end that starting over makes sense. */
export function resumePosition(saved: number | undefined, duration: number): number {
  if (!saved || !Number.isFinite(saved) || saved < 3) return 0;
  if (duration > 0 && saved > duration - 3) return 0;
  return saved;
}

interface VideoPlayerProps {
  video: VideoBlock;
  /** The saved position in seconds. */
  startAt?: number;
  /** The current position, every few seconds of playing and on pause / end. */
  onPosition?: (seconds: number) => void;
  /** Shows "Bookmark this moment"; called with the current time (FE-STU-06). */
  onBookmark?: (seconds: number) => void;
  /** Bookmarked moments, shown as buttons that jump there. */
  moments?: Array<{ id: string; seconds: number; label?: string | null }>;
  /** Jump to a moment from outside (a bookmark link); a new `key` jumps again. */
  jumpTo?: { seconds: number; key: number } | null;
}

type LoadState = "loading" | "ready" | "error";

export function VideoPlayer({ video, startAt, onPosition, onBookmark, moments = [], jumpTo }: VideoPlayerProps) {
  const ids = useId();
  const container = useRef<HTMLDivElement>(null);
  const element = useRef<HTMLVideoElement>(null);
  const [load, setLoad] = useState<LoadState>("loading");
  const [attempt, setAttempt] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(video.duration_seconds);
  const [speed, setSpeed] = useState(1);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [captionsOn, setCaptionsOn] = useState(video.captions.some((track) => track.default));
  const [fullscreen, setFullscreen] = useState(false);
  const [resumedAt, setResumedAt] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const lastReported = useRef(0);
  /** A jump asked for before the video could seek (metadata not loaded yet): applied when it can. */
  const pendingJump = useRef<number | null>(null);
  /** The MP4 is playing (or failed): its errors are final. Streams fall back to it first. */
  const onMp4 = useRef(false);
  const onPositionRef = useRef(onPosition);
  useEffect(() => {
    onPositionRef.current = onPosition;
  }, [onPosition]);

  const report = useCallback((seconds: number) => {
    lastReported.current = seconds;
    onPositionRef.current?.(Math.round(seconds * 10) / 10);
  }, []);

  // Attach the source: native HLS, hls.js, or the MP4.
  useEffect(() => {
    const media = element.current;
    if (!media) return;
    let destroyed = false;
    let hls: { destroy(): void } | null = null;
    setLoad("loading");

    onMp4.current = false;
    const playMp4 = () => {
      onMp4.current = true;
      if (video.mp4) {
        media.src = video.mp4;
        media.load();
      } else setLoad("error");
    };

    if (video.hls && media.canPlayType("application/vnd.apple.mpegurl")) {
      media.src = video.hls;
    } else if (video.hls) {
      void import("hls.js")
        .then(({ default: Hls }) => {
          if (destroyed) return;
          if (!Hls.isSupported()) return playMp4();
          const instance = new Hls({ capLevelToPlayerSize: true, startLevel: -1 });
          hls = instance;
          instance.on(Hls.Events.ERROR, (_event, data) => {
            if (!data.fatal) return;
            instance.destroy();
            hls = null;
            playMp4(); // the stream failed: the plain file may still work
          });
          instance.loadSource(video.hls!);
          instance.attachMedia(media);
        })
        .catch(playMp4);
    } else {
      playMp4();
    }
    return () => {
      destroyed = true;
      hls?.destroy();
      media.removeAttribute("src");
      media.load();
    };
  }, [video.hls, video.mp4, attempt]);

  // Captions follow the toggle (and the author's default).
  useEffect(() => {
    const media = element.current;
    if (!media) return;
    const tracks = Array.from(media.textTracks).filter((track) => track.kind === "captions" || track.kind === "subtitles");
    const preferred = video.captions.findIndex((track) => track.default);
    tracks.forEach((track, index) => {
      track.mode = captionsOn && index === Math.max(0, preferred) ? "showing" : "disabled";
    });
  }, [captionsOn, video.captions, load]);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === container.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    if (!jumpTo) return;
    const target = element.current;
    if (target && target.readyState >= 1) {
      target.currentTime = jumpTo.seconds;
      setTime(jumpTo.seconds);
      setResumedAt(null);
    } else {
      pendingJump.current = jumpTo.seconds;
    }
  }, [jumpTo]);

  const media = () => element.current!;
  const seek = (seconds: number) => {
    const target = Math.min(Math.max(0, seconds), duration || 0);
    media().currentTime = target;
    setTime(target);
  };
  const togglePlay = () => {
    if (media().paused) void media().play().catch(() => setAnnouncement("The video didn't start. Press play again."));
    else media().pause();
  };
  const changeSpeed = (next: number) => {
    media().playbackRate = next;
    setSpeed(next);
    setAnnouncement(`Speed ${next}×`);
  };
  const stepSpeed = (direction: 1 | -1) => {
    const index = SPEEDS.indexOf(speed as (typeof SPEEDS)[number]);
    const next = SPEEDS[Math.min(SPEEDS.length - 1, Math.max(0, (index === -1 ? 2 : index) + direction))]!;
    changeSpeed(next);
  };
  const toggleMute = () => {
    media().muted = !media().muted;
    setMuted(media().muted);
  };
  const toggleCaptions = () => {
    setCaptionsOn((on) => !on);
    setAnnouncement(captionsOn ? "Captions off" : "Captions on");
  };
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void container.current?.requestFullscreen?.().catch(() => {});
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Only for the player itself or the video: buttons, the slider and the speed menu keep their own keys.
    const target = event.target as HTMLElement;
    if (target !== container.current && target !== element.current) return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const actions: Record<string, () => void> = {
      " ": togglePlay,
      k: togglePlay,
      ArrowLeft: () => seek(time - 5),
      ArrowRight: () => seek(time + 5),
      j: () => seek(time - 10),
      l: () => seek(time + 10),
      Home: () => seek(0),
      End: () => seek(duration),
      m: toggleMute,
      c: toggleCaptions,
      f: toggleFullscreen,
      ">": () => stepSpeed(1),
      ".": () => stepSpeed(1),
      "<": () => stepSpeed(-1),
      ",": () => stepSpeed(-1),
    };
    const key = event.key.length === 1 && /[A-Z]/.test(event.key) ? event.key.toLowerCase() : event.key;
    const action = /^[0-9]$/.test(key) ? () => seek((Number(key) / 10) * duration) : actions[key];
    if (!action) return;
    event.preventDefault();
    action();
  };

  const hasCaptions = video.captions.length > 0;
  const showSpinner = load === "loading" || buffering;

  return (
    <figure className="grid gap-2">
      <div
        ref={container}
        role="group"
        aria-roledescription="video player"
        aria-label={`Video: ${video.title}`}
        aria-describedby={`${ids}-keys`}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className={cn("relative overflow-hidden rounded-card border-2 border-line bg-black shadow-sticker", fullscreen && "flex flex-col rounded-none border-0")}
      >
        <p id={`${ids}-keys`} className="sr-only">
          Keyboard: space to play or pause, arrows to jump 5 seconds, M to mute, C for captions, F for full screen.
        </p>
        <video
          ref={element}
          className={cn("block aspect-video w-full bg-black", fullscreen && "min-h-0 flex-1")}
          poster={video.poster}
          preload="metadata"
          playsInline
          onClick={togglePlay}
          onLoadedMetadata={(event) => {
            const media = event.currentTarget;
            if (Number.isFinite(media.duration) && media.duration > 0) setDuration(media.duration);
            const jump = pendingJump.current;
            pendingJump.current = null;
            const resume = jump ?? resumePosition(startAt, media.duration);
            if (resume > 0) {
              media.currentTime = resume;
              setTime(resume);
              if (jump === null) setResumedAt(resume);
            }
            media.playbackRate = speed;
            setLoad("ready");
          }}
          onCanPlay={() => {
            setBuffering(false);
            setLoad("ready");
          }}
          onWaiting={() => setBuffering(true)}
          onPlaying={() => setBuffering(false)}
          onPlay={() => setPlaying(true)}
          onPause={(event) => {
            setPlaying(false);
            report(event.currentTarget.currentTime);
          }}
          onEnded={(event) => {
            setPlaying(false);
            report(event.currentTarget.duration);
          }}
          onTimeUpdate={(event) => {
            const now = event.currentTarget.currentTime;
            setTime(now);
            if (Math.abs(now - lastReported.current) >= REPORT_EVERY_SECONDS) report(now);
          }}
          onVolumeChange={(event) => {
            setMuted(event.currentTarget.muted);
            setVolume(event.currentTarget.volume);
          }}
          onError={() => {
            // A failed MP4 (hls.js failures fall back to the MP4 first).
            if (!video.hls || onMp4.current) setLoad("error");
          }}
        >
          {video.captions.map((track) => (
            <track key={track.src} kind="captions" src={track.src} srcLang={track.lang} label={track.label} default={track.default} />
          ))}
        </video>

        {showSpinner && load !== "error" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="rounded-full bg-black/60 p-3 text-white">
              <Spinner label={load === "loading" ? "Loading the video" : "Buffering"} className="size-8" />
            </span>
          </div>
        )}

        {load === "ready" && !playing && time === 0 && (
          <button
            type="button"
            onClick={togglePlay}
            className="absolute inset-0 m-auto flex size-20 items-center justify-center rounded-full border-2 border-line bg-accent text-accent-fg shadow-sticker"
          >
            <Play aria-hidden className="size-9 translate-x-0.5" />
            <span className="sr-only">Play {video.title}</span>
          </button>
        )}

        {load === "error" && (
          <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 p-6 text-center text-white">
            <p className="font-bold">This video can&apos;t play right now.</p>
            <p className="text-small">Check your connection and try again{video.transcript ? ", or read the transcript below" : ""}.</p>
            <Button size="sm" onClick={() => setAttempt((count) => count + 1)}>
              <RotateCcw aria-hidden />
              Try again
            </Button>
          </div>
        )}

        {/* Controls */}
        <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 bg-surface px-2 py-1.5 text-fg", load === "error" && "invisible")}>
          <Button variant="ghost" size="icon" onClick={togglePlay} aria-label={playing ? "Pause" : "Play"} disabled={load !== "ready"}>
            {playing ? <Pause aria-hidden /> : <Play aria-hidden />}
          </Button>
          <label htmlFor={`${ids}-seek`} className="sr-only">
            Position
          </label>
          <input
            id={`${ids}-seek`}
            type="range"
            min={0}
            max={Math.max(1, Math.floor(duration))}
            step={1}
            value={Math.floor(time)}
            aria-valuetext={`${formatTime(time)} of ${formatTime(duration)}`}
            onChange={(event) => seek(Number(event.target.value))}
            disabled={load !== "ready"}
            className="h-2 min-w-24 flex-1 cursor-pointer accent-primary"
          />
          <span className="text-caption font-bold tabular-nums" aria-hidden>
            {formatTime(time)} / {formatTime(duration)}
          </span>
          <Button variant="ghost" size="icon" onClick={toggleMute} aria-label={muted || volume === 0 ? "Unmute" : "Mute"} aria-pressed={muted}>
            {muted || volume === 0 ? <VolumeX aria-hidden /> : <Volume2 aria-hidden />}
          </Button>
          <label htmlFor={`${ids}-speed`} className="sr-only">
            Playback speed
          </label>
          <select
            id={`${ids}-speed`}
            value={speed}
            onChange={(event) => changeSpeed(Number(event.target.value))}
            className="h-9 rounded-control border-2 border-line bg-surface px-1.5 text-small font-bold"
          >
            {SPEEDS.map((value) => (
              <option key={value} value={value}>
                {value}×
              </option>
            ))}
          </select>
          {hasCaptions && (
            <Button variant="ghost" size="icon" onClick={toggleCaptions} aria-label="Captions" aria-pressed={captionsOn}>
              {captionsOn ? <Captions aria-hidden /> : <CaptionsOff aria-hidden />}
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={toggleFullscreen} aria-label={fullscreen ? "Exit full screen" : "Full screen"}>
            {fullscreen ? <Minimize aria-hidden /> : <Maximize aria-hidden />}
          </Button>
        </div>
        <p className="sr-only" aria-live="polite">
          {announcement}
        </p>
      </div>

      <figcaption className="grid gap-1 text-small">
        <span className="font-bold">{video.title}</span>
        {resumedAt !== null && (
          <span className="flex flex-wrap items-center gap-2 text-fg-muted">
            Carrying on from {formatTime(resumedAt)}.
            <button
              type="button"
              className="font-bold text-fg underline underline-offset-4 hover:no-underline"
              onClick={() => {
                seek(0);
                setResumedAt(null);
              }}
            >
              Start over
            </button>
          </span>
        )}
        {!hasCaptions && <span className="text-fg-muted">This video has no captions yet.</span>}
        {(onBookmark || moments.length > 0) && (
          <span className="flex flex-wrap items-center gap-2">
            {onBookmark && (
              <Button size="sm" onClick={() => onBookmark(Math.floor(element.current?.currentTime ?? time))} disabled={load !== "ready"}>
                <BookmarkPlus aria-hidden />
                Bookmark this moment ({formatTime(time)})
              </Button>
            )}
            {moments.length > 0 && (
              <span className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Bookmarked moments">
                {[...moments]
                  .sort((a, b) => a.seconds - b.seconds)
                  .map((moment) => (
                    <button
                      key={moment.id}
                      type="button"
                      onClick={() => {
                        seek(moment.seconds);
                        setResumedAt(null);
                      }}
                      className="rounded-control border-2 border-line-subtle bg-surface px-2 py-0.5 text-caption font-bold tabular-nums hover:bg-surface-sunken"
                    >
                      <span className="sr-only">Jump to</span> {formatTime(moment.seconds)}
                      {moment.label ? ` · ${moment.label}` : ""}
                    </button>
                  ))}
              </span>
            )}
          </span>
        )}
      </figcaption>
      {video.transcript && (
        <details className="rounded-control border-2 border-line-subtle bg-surface px-3 py-2">
          <summary className="cursor-pointer font-bold">Transcript</summary>
          <p className="mt-2 whitespace-pre-line">{video.transcript}</p>
        </details>
      )}
    </figure>
  );
}
