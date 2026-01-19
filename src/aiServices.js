import { normalizeLang } from "./languageUtils.js";

let detectorPromise = null;

const translatorCache = new Map();

export async function getDetector({ onProgress } = {}) {
  if (!("LanguageDetector" in window))
    throw new Error("LanguageDetector not supported");

  if (!detectorPromise) {
    detectorPromise = (async () => {
      const availability = await LanguageDetector.availability();
      if (availability !== "available" && availability !== "downloadable") {
        throw new Error(`LanguageDetector availability: ${availability}`);
      }
      return LanguageDetector.create({
        monitor(m) {
          if (!onProgress) return;
          m.addEventListener("downloadProgress", (e) => onProgress(e.loaded));
        },
      });
    })();
  }

  return detectorPromise;
}

function withTimeout(promise, ms, label = "operation") {
  let t;
  const timeout = new Promise((_, reject) => {
    t = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
}

export async function getTranslator(options, { onProgress, onStage } = {}) {
  if (!("Translator" in window)) throw new Error("Translator not supported");

  const sourceLanguage = normalizeLang(options.sourceLanguage);
  const targetLanguage = normalizeLang(options.targetLanguage);
  const key = `${sourceLanguage}->${targetLanguage}`;

  if (translatorCache.has(key)) return translatorCache.get(key);

  const promise = (async () => {
    onStage?.("Checking availability…");

    const availability = await Translator.availability({
      sourceLanguage,
      targetLanguage,
    });

    if (availability !== "available" && availability !== "downloadable") {
      throw new Error(`Translator availability: ${availability}`);
    }

    onStage?.(
      availability === "downloadable"
        ? "Download required…"
        : "Preparing model…",
    );

    const instance = await withTimeout(
      Translator.create({
        sourceLanguage,
        targetLanguage,
        monitor(m) {
          if (!onProgress) return;
          m.addEventListener("downloadProgress", (e) => onProgress(e.loaded));
        },
      }),
      60_000,
      `Translator.create(${key})`,
    );

    return instance;
  })();

  translatorCache.set(key, promise);
  promise.catch(() => translatorCache.delete(key));

  return promise;
}

export async function getTargetAvailability({ sourceLanguage, targets }) {
  if (!("Translator" in window)) return [];

  const source = normalizeLang(sourceLanguage);

  const checks = await Promise.all(
    targets.map(async (t) => {
      const target = normalizeLang(t);
      if (target === source) return { target, availability: "unavailable" };

      const availability = await Translator.availability({
        sourceLanguage: source,
        targetLanguage: target,
      });

      return { target, availability };
    }),
  );

  return checks;
}
