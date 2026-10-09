import { getDb } from "@/lib/mongodb";

/** Private diagnostic records. Not returned by /api/generate and not shown to consumers. */
export const GENERATION_DIAGNOSTICS_COLLECTION = "generation_diagnostics";
export const GENERATION_DIAGNOSTICS_TTL_DAYS = 7;

export const DIAGNOSTIC_STAGE_ORDER = [
  "parseGeneratedContent",
  "ensureTitleFormats+fixFruitEmojisInTitles",
  "stripGeneratedLocationTime",
  "ensureCaptionEmojis",
  "enforceXiaohongshuCompliance",
  "ensureTitleFormats+fixFruitEmojisInTitles",
  "ensureCaptionEmojis",
  "ensureEvidenceLedCopy",
  "ensureTitleFormats+fixFruitEmojisInTitles",
  "ensureGroundedHeadlineCopy",
  "ensureTitleFormats+fixFruitEmojisInTitles",
  "ensureGroundedHeadlineCopy",
  "ensureTitleFormats+fixFruitEmojisInTitles",
  "ensureGenerationVariation",
  "ensureTitleFormats+fixFruitEmojisInTitles",
  "ensureGroundedHeadlineCopy",
  "ensureTitleFormats+fixFruitEmojisInTitles",
  "ensureContentLock",
  "ensureTitleFormats+fixFruitEmojisInTitles",
  "separateHeadlinesFromNote",
  "enforceCustomerEvidence",
  "ensureCaptionEmojis",
  "finalizeOfficialLocationTime",
  "ensureTitleFormats+fixFruitEmojisInTitles",
  "applyBrandSpelling",
  "response",
] as const;

export type DiagnosticCopy = {
  titles: string[];
  caption: string;
};

export type CaptionDiff = {
  sentencesAdded: string[];
  sentencesRemoved: string[];
  orderChanged: boolean;
  emojiChanged: boolean;
  punctuationChanged: boolean;
  locationChanged: boolean;
  dishOrServiceAdded: boolean;
  userDetailLost: boolean;
};

export type DiagnosticSnapshot = {
  stage: string;
  before: DiagnosticCopy;
  after: DiagnosticCopy;
  changed: boolean;
  changedFields: Array<"titles" | "caption">;
  diff: CaptionDiff;
};

export type RawModelOutput = {
  attempt: number;
  outputText: string;
  parseStatus: string;
  capturedAt: string;
};

export type GenerationDiagnosticRecord = {
  generationId: string;
  provider: "openai" | "modelark";
  model: string;
  createdAt: Date;
  expiresAt: Date;
  modelCalls: number;
  complianceCalls: number;
  parseStatus: string;
  diningExperienceNote: string;
  rawOutputs: RawModelOutput[];
  stages: DiagnosticSnapshot[];
  finalResponse?: {
    titles: string[];
    caption: string;
    hashtags: string[];
  };
  failure?: {
    stage: string;
    message: string;
  };
};

export function generationDiagnosticsEnabled() {
  const value = process.env.GENERATION_DIAGNOSTICS?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "on";
}

export function redactDiagnosticSecrets(text: string) {
  return text
    .replace(/bearer\s+\S+/gi, "bearer [redacted]")
    .replace(/\bsk-[A-Za-z0-9_\-]{8,}\b/g, "[redacted]")
    .replace(/authorization\s*:\s*\S+/gi, "authorization: [redacted]");
}

function copyOf(value: DiagnosticCopy): DiagnosticCopy {
  return {
    titles: value.titles.map((title) => title),
    caption: value.caption,
  };
}

function sentencesOf(text: string) {
  return text
    .split(/\n+|(?<=[。！？!?])/)
    .map((part) => part.trim())
    .filter((part) => part.replace(/[。！？!?\s]/g, "").length > 0);
}

function sameSentences(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  const a = [...left].sort();
  const b = [...right].sort();
  return a.every((item, index) => item === b[index]);
}

function withoutEmoji(text: string) {
  return text.replace(/\p{Extended_Pictographic}/gu, "");
}

function withoutPunctuation(text: string) {
  return text.replace(/[。！？!?，,、；;：:.\s]/g, "");
}

function locationFingerprint(text: string) {
  return (text.match(/📍|⏰|\d{1,2}:\d{2}|[0-9一二三四五六七八九十]+楼|central\s*world|siam\s*center|baan\s*ying|尚泰|暹罗/gi) ?? [])
    .join("|")
    .toLowerCase();
}

const DISH_OR_SERVICE = /咖喱|芒果|菠萝|冬阴功|鲈鱼|炒饭|糯米|服务|店员|新鲜|下饭|配料|开胃|甜/;

export function summarizeCaptionChange(before: string, after: string, note = ""): CaptionDiff {
  const beforeSentences = sentencesOf(before);
  const afterSentences = sentencesOf(after);
  const sentencesAdded = afterSentences.filter((sentence) => !beforeSentences.includes(sentence));
  const sentencesRemoved = beforeSentences.filter((sentence) => !afterSentences.includes(sentence));
  const beforeEmoji = withoutEmoji(before);
  const afterEmoji = withoutEmoji(after);
  const noteClauses = note
    .split(/[。！？!?\n，,]/)
    .map((clause) => clause.trim())
    .filter((clause) => clause.length >= 4);
  return {
    sentencesAdded,
    sentencesRemoved,
    orderChanged: sameSentences(beforeSentences, afterSentences) && beforeSentences.join("\u0000") !== afterSentences.join("\u0000"),
    emojiChanged: (before.match(/\p{Extended_Pictographic}/gu) ?? []).join("") !== (after.match(/\p{Extended_Pictographic}/gu) ?? []).join(""),
    punctuationChanged: withoutPunctuation(beforeEmoji) === withoutPunctuation(afterEmoji) && beforeEmoji !== afterEmoji,
    locationChanged: locationFingerprint(before) !== locationFingerprint(after),
    dishOrServiceAdded: sentencesAdded.some((sentence) => DISH_OR_SERVICE.test(sentence)),
    userDetailLost: noteClauses.some((clause) => before.includes(clause) && !after.includes(clause)),
  };
}

function snapshotOf(stage: string, before: DiagnosticCopy, after: DiagnosticCopy, note: string): DiagnosticSnapshot {
  const left = copyOf(before);
  const right = copyOf(after);
  const changedFields: Array<"titles" | "caption"> = [];
  if (left.titles.join("\u0000") !== right.titles.join("\u0000")) changedFields.push("titles");
  if (left.caption !== right.caption) changedFields.push("caption");
  return {
    stage,
    before: left,
    after: right,
    changed: changedFields.length > 0,
    changedFields,
    diff: summarizeCaptionChange(left.caption, right.caption, note),
  };
}

function redactCopy(value: DiagnosticCopy): DiagnosticCopy {
  return {
    titles: value.titles.map((title) => redactDiagnosticSecrets(title)),
    caption: redactDiagnosticSecrets(value.caption),
  };
}

function redactRecord(record: GenerationDiagnosticRecord): GenerationDiagnosticRecord {
  return {
    ...record,
    diningExperienceNote: redactDiagnosticSecrets(record.diningExperienceNote),
    rawOutputs: record.rawOutputs.map((item) => ({
      ...item,
      outputText: redactDiagnosticSecrets(item.outputText),
    })),
    stages: record.stages.map((stage) => ({
      ...stage,
      before: redactCopy(stage.before),
      after: redactCopy(stage.after),
      diff: {
        ...stage.diff,
        sentencesAdded: stage.diff.sentencesAdded.map((sentence) => redactDiagnosticSecrets(sentence)),
        sentencesRemoved: stage.diff.sentencesRemoved.map((sentence) => redactDiagnosticSecrets(sentence)),
      },
    })),
    finalResponse: record.finalResponse
      ? {
          titles: record.finalResponse.titles.map((title) => redactDiagnosticSecrets(title)),
          caption: redactDiagnosticSecrets(record.finalResponse.caption),
          hashtags: record.finalResponse.hashtags.map((tag) => redactDiagnosticSecrets(tag)),
        }
      : undefined,
    failure: record.failure
      ? { stage: record.failure.stage, message: redactDiagnosticSecrets(record.failure.message) }
      : undefined,
  };
}

let ttlIndex: Promise<void> | null = null;

async function saveGenerationDiagnostic(record: GenerationDiagnosticRecord) {
  const db = await getDb();
  const collection = db.collection(GENERATION_DIAGNOSTICS_COLLECTION);
  if (!ttlIndex) {
    ttlIndex = collection
      .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
      .then(() => undefined)
      .catch((error) => {
        ttlIndex = null;
        throw error;
      });
  }
  await ttlIndex;
  await collection.replaceOne({ generationId: record.generationId }, record, { upsert: true });
}

export type GenerationDiagnostics = {
  enabled: boolean;
  recordRaw: (outputText: string, parseStatus: string) => void;
  markLatest: (parseStatus: string) => void;
  snapshot: (stage: string, before: DiagnosticCopy, after: DiagnosticCopy, note?: string) => void;
  setNote: (note: string) => void;
  finish: (input: {
    titles: string[];
    caption: string;
    hashtags: string[];
    modelCalls: number;
    complianceCalls: number;
  }) => Promise<void>;
  fail: (stage: string, message: string) => Promise<void>;
  inspect: () => GenerationDiagnosticRecord;
};

export function createGenerationDiagnostics(input: {
  generationId: string;
  provider: "openai" | "modelark";
  model: string;
  enabled?: boolean;
  now?: () => Date;
  save?: (record: GenerationDiagnosticRecord) => Promise<void>;
}): GenerationDiagnostics {
  const enabled = input.enabled ?? false;
  const now = input.now ?? (() => new Date());
  const createdAt = now();
  const record: GenerationDiagnosticRecord = {
    generationId: input.generationId,
    provider: input.provider,
    model: input.model,
    createdAt,
    expiresAt: new Date(createdAt.getTime() + GENERATION_DIAGNOSTICS_TTL_DAYS * 24 * 60 * 60 * 1000),
    modelCalls: 0,
    complianceCalls: 0,
    parseStatus: "pending",
    diningExperienceNote: "",
    rawOutputs: [],
    stages: [],
  };
  let saved = false;
  const persist = async () => {
    if (!enabled || saved) return;
    saved = true;
    const sink = input.save ?? saveGenerationDiagnostic;
    try {
      await sink(redactRecord(record));
      console.info(
        `[generate] diagnostics generationId=${record.generationId} stages=${record.stages.length} parse=${record.parseStatus}`,
      );
    } catch {
      saved = false;
      console.error("[generate] diagnostics save failed");
    }
  };
  return {
    enabled,
    recordRaw(outputText, parseStatus) {
      if (!enabled) return;
      record.rawOutputs.push({
        attempt: record.rawOutputs.length + 1,
        outputText,
        parseStatus,
        capturedAt: now().toISOString(),
      });
    },
    markLatest(parseStatus) {
      const latest = record.rawOutputs.at(-1);
      if (!enabled || !latest) return;
      latest.parseStatus = parseStatus;
    },
    snapshot(stage, before, after, note = "") {
      if (!enabled) return;
      if (note && !record.diningExperienceNote) record.diningExperienceNote = note;
      record.stages.push(snapshotOf(stage, before, after, note || record.diningExperienceNote));
    },
    setNote(note) {
      if (!enabled) return;
      record.diningExperienceNote = note;
    },
    async finish(result) {
      if (!enabled) return;
      record.parseStatus = "ok";
      record.modelCalls = result.modelCalls;
      record.complianceCalls = result.complianceCalls;
      record.finalResponse = {
        titles: [...result.titles],
        caption: result.caption,
        hashtags: [...result.hashtags],
      };
      await persist();
    },
    async fail(stage, message) {
      if (!enabled) return;
      record.parseStatus = stage;
      record.failure = { stage, message };
      record.modelCalls = record.rawOutputs.length;
      await persist();
    },
    inspect: () => record,
  };
}
