import OpenAI from "openai";
import { toSimplifiedChinese } from "@/lib/speech/to-simplified";

export const maxDuration = 30;

const MAX_AUDIO_BYTES = 8 * 1024 * 1024;

function speechLanguage(value: FormDataEntryValue | null): "zh" | "th" {
  return value === "th" ? "th" : "zh";
}

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }
  return new OpenAI({ apiKey });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const audio = formData.get("audio");
    if (!(audio instanceof File) || audio.size === 0) {
      return Response.json({ error: "missing_audio" }, { status: 400 });
    }
    if (audio.size > MAX_AUDIO_BYTES) {
      return Response.json({ error: "too_large" }, { status: 413 });
    }

    const openai = getClient();
    const language = speechLanguage(formData.get("language"));
    const namedAudio = new File([audio], audio.name || "feel-note.webm", {
      type: audio.type || "audio/webm",
    });
    const transcription = await openai.audio.transcriptions.create({
      file: namedAudio,
      model: "whisper-1",
      language,
      prompt: language === "zh" ? "这是一段简体中文普通话口述。" : undefined,
      response_format: "json",
    });

    const text = transcription.text.trim();
    return Response.json({
      text: language === "zh" ? toSimplifiedChinese(text) : text,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Transcription failed";
    if (/sk-|api[_-]?key/i.test(message)) {
      return Response.json({ error: "Transcription failed" }, { status: 500 });
    }
    return Response.json({ error: "Transcription failed" }, { status: 502 });
  }
}
