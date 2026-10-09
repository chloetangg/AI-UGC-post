/**
 * ModelArk-only output shape. The public /api/generate body still uses caption
 * and the existing strategy fields. Paragraphs are joined locally so a caption
 * does not have to contain a raw line break inside one JSON string.
 * Template ids and strategy ids are filled by existing local selection.
 */
export const modelArkPostSchema = {
  name: "xiaohongshu_ugc_post",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "titles",
      "captionParagraphs",
      "hashtags",
      "mainTitle",
      "subTitle",
      "selectedPhotoIndex",
      "selectedPhotoIndexes",
      "photoSelectionReason",
      "remainingPhotoOrder",
      "remainingOrderPattern",
    ],
    properties: {
      titles: { type: "array", minItems: 3, maxItems: 3, items: { type: "string", minLength: 1 } },
      captionParagraphs: { type: "array", minItems: 1, maxItems: 8, items: { type: "string" } },
      hashtags: { type: "array", minItems: 5, maxItems: 5, items: { type: "string" } },
      mainTitle: { type: "string" },
      subTitle: { type: "string" },
      selectedPhotoIndex: { type: "integer", minimum: 0, maximum: 4 },
      selectedPhotoIndexes: {
        type: "array",
        minItems: 1,
        maxItems: 4,
        items: { type: "integer", minimum: 0, maximum: 4 },
      },
      photoSelectionReason: { type: "string" },
      remainingPhotoOrder: {
        type: "array",
        minItems: 0,
        maxItems: 5,
        items: { type: "integer", minimum: 0, maximum: 4 },
      },
      remainingOrderPattern: { type: "string", enum: ["1", "2", "3", "4", "5", "6"] },
    },
  },
};

export const modelArkRewriteSchema = {
  name: "xiaohongshu_compliance_rewrite",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["titles", "captionParagraphs", "hashtags", "mainTitle", "subTitle"],
    properties: {
      titles: { type: "array", minItems: 3, maxItems: 3, items: { type: "string", minLength: 1 } },
      captionParagraphs: { type: "array", minItems: 1, maxItems: 8, items: { type: "string" } },
      hashtags: { type: "array", minItems: 5, maxItems: 5, items: { type: "string" } },
      mainTitle: { type: "string" },
      subTitle: { type: "string" },
    },
  },
};

export const MODELARK_OUTPUT_APPENDIX = `OUTPUT SHAPE FOR THIS CALL ONLY. This replaces the sample JSON at the end of the instructions. Do not change the story, the titles, or the paragraph breaks.
Return captionParagraphs as an array. Each item is one paragraph and must not contain a line break. The server joins the items with a blank line.
Do not return evidenceSource, customerEvidenceUsed, selectedTemplateId, suitableTemplateIds, selectedKspId, selectedStorylineId, selectedContentAngleId, or selectedSearchKeyword. Those are chosen locally.
titles has exactly 3 strings. hashtags has exactly 5 strings. mainTitle and subTitle stay separate strings.`;

export const MODELARK_TITLE_RETRY_HINT = `The previous output was rejected because it did not contain exactly 3 non-empty titles. Return titles as an array of exactly 3 non-empty strings. Do not leave a title blank and do not return only 2 titles.`;

export const MODELARK_JSON_RETRY_HINT = `The previous output was rejected because it was not valid JSON. Return one complete JSON object that matches the required schema. Use double-quoted property names and put an ASCII colon after every property name. Do not use Markdown fences. Do not put a raw line break inside a string. Do not add text before or after the JSON object.`;

