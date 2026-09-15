const PREFERRED_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/aac",
  "audio/mpeg",
];

export class SpeechRecorderError extends Error {
  constructor(
    public readonly code: "permission_denied" | "unsupported" | "empty",
    message: string,
  ) {
    super(message);
    this.name = "SpeechRecorderError";
  }
}

export type AudioRecording = {
  blob: Blob;
  filename: string;
};

function pickRecorderMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  return PREFERRED_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function extensionForMime(mime: string) {
  if (mime.includes("mp4") || mime.includes("aac") || mime.includes("m4a")) return "m4a";
  if (mime.includes("mpeg")) return "mp3";
  if (mime.includes("wav")) return "wav";
  return "webm";
}

export function canRecordAudio() {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    typeof MediaRecorder !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

export async function startAudioRecording() {
  if (!canRecordAudio()) {
    throw new SpeechRecorderError("unsupported", "Speech recording is not supported");
  }

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        channelCount: 1,
      },
    });
  } catch (error) {
    const name = error instanceof DOMException ? error.name : "";
    if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") {
      throw new SpeechRecorderError("permission_denied", "Microphone permission denied");
    }
    if (name === "NotFoundError" || name === "NotReadableError") {
      throw new SpeechRecorderError("permission_denied", "Microphone is unavailable");
    }
    throw new SpeechRecorderError("unsupported", "Speech recording is not supported");
  }

  const mimeType = pickRecorderMimeType();
  const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
  const chunks: BlobPart[] = [];

  recorder.addEventListener("dataavailable", (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  });

  function release() {
    stream.getTracks().forEach((track) => track.stop());
  }

  const stopped = new Promise<AudioRecording>((resolve, reject) => {
    recorder.addEventListener("error", () => {
      release();
      reject(new SpeechRecorderError("unsupported", "Speech recording failed"));
    });
    recorder.addEventListener("stop", () => {
      release();
      const type = recorder.mimeType || mimeType || "audio/webm";
      const blob = new Blob(chunks, { type });
      if (blob.size === 0) {
        reject(new SpeechRecorderError("empty", "Empty recording"));
        return;
      }
      resolve({
        blob,
        filename: `feel-note.${extensionForMime(type)}`,
      });
    });
  });

  recorder.start();

  return {
    stop() {
      if (recorder.state === "recording") recorder.stop();
      return stopped;
    },
    cancel() {
      try {
        if (recorder.state === "recording") recorder.stop();
      } catch {
        /* ignore */
      }
      release();
    },
  };
}
