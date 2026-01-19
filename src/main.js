import "./style.css";
import {
  getDetector,
  getTranslator,
  getTargetAvailability,
} from "./aiServices.js";
import { languageToFlag, languages, normalizeLang } from "./languageUtils.js";

const translateInputElement = document.querySelector("#translateInput");
const translatedOutputElement = document.querySelector("#translatedOutput");
const detectedLanguageElement = document.querySelector("#detectedLanguage");
const clearBtn = document.querySelector("#clearTranslationInput");
const wordCountElement = document.querySelector("#wordCount");
const langSelect = document.querySelector("#langSelect");
const triggerTranslate = document.querySelector("#triggerTranslate");
const translateStatus = document.querySelector("#translateStatus");

let translateOptions = { sourceLanguage: "de", targetLanguage: "en" };
let inputLanguage = normalizeLang("de");
let targetLanguage = normalizeLang("en");
let lastSource = null;

let detectedOk = false;

function optionLabel({ flag, name }, availability) {
  return availability === "downloadable"
    ? `${flag} ${name} ⬇`
    : `${flag} ${name}`;
}

if (window.Translator) {
  await refreshTargetLanguageOptions({ sourceLanguage: inputLanguage });
}

async function refreshTargetLanguageOptions({ sourceLanguage }) {
  const avail = await getTargetAvailability({
    sourceLanguage,
    targets: languages.map((l) => l.code),
  });

  const availabilityByCode = new Map(
    avail.map((x) => [x.target, x.availability]),
  );

  const selected = targetLanguage;

  langSelect.replaceChildren(
    ...languages.map(({ code, name, flag }) => {
      const availability = availabilityByCode.get(code) ?? "unavailable";

      const opt = document.createElement("option");
      opt.value = code;

      if (availability === "downloadable") {
        opt.textContent = `${flag} ${name} ⬇`;
      } else if (availability === "unavailable") {
        opt.textContent = `${flag} ${name} (not supported)`;
      } else {
        opt.textContent = `${flag} ${name}`;
      }

      opt.disabled = availability === "unavailable";

      opt.dataset.availability = availability;

      return opt;
    }),
  );

  if ([...langSelect.options].some((o) => o.value === selected)) {
    langSelect.value = selected;
  }
  updateTranslateEnabled();
}

async function detectLanguage(text) {
  const detector = await getDetector();
  return detector.detect(text);
}

clearBtn?.addEventListener("click", () => {
  translatedOutputElement.innerText = "";
  translateInputElement.value = "";
  wordCountElement.innerText = 0;
});

translateInputElement.addEventListener("input", async (e) => {
  const text = e.target.value;
  const results = await detectLanguage(text);
  const first = results?.[0];

  if (first?.confidence > 0.5 && first.detectedLanguage) {
    const detectedBase = normalizeLang(first.detectedLanguage);
    detectedLanguageElement.innerHTML = languageToFlag(detectedBase);

    if (detectedBase !== lastSource) {
      lastSource = detectedBase;
      inputLanguage = detectedBase;
      if (window.Translator)
        await refreshTargetLanguageOptions({ sourceLanguage: inputLanguage });
      detectedOk = true;
    }
  } else {
    detectedOk = false;
  }
});

async function translateStreaming(text, options) {
  setBusy(true);
  hideDownloadProgress();
  setStatus("Preparing model…");
  translatedOutputElement.textContent = "";

  let sawProgress = false;

  try {
    const translator = await getTranslator(options, {
      onStage: (s) => setStatus(s),

      onProgress: (p) => {
        sawProgress = true;
        setStatus("Downloading model…");
        showDownloadProgress(p);
      },
    });

    if (!sawProgress) hideDownloadProgress();

    setStatus("Translating…");
    for await (const chunk of translator.translateStreaming(text)) {
      translatedOutputElement.textContent += chunk;
    }

    setStatus("");
  } catch (e) {
    console.error(e);
    setStatus("Translation failed (see console).");
  } finally {
    hideDownloadProgress();
    setBusy(false);
  }
  await refreshTargetLanguageOptions({ sourceLanguage: inputLanguage });
}

triggerTranslate.addEventListener("click", async () => {
  if (!detectedOk) {
    setStatus("Cannot translate: language not detected.");
    return;
  }

  const availability = getSelectedAvailability();
  if (availability === "unavailable") {
    setStatus("Cannot translate: selected language pair not supported.");
    return;
  }

  const options = {
    sourceLanguage: inputLanguage,
    targetLanguage: targetLanguage,
  };

  await translateStreaming(translateInputElement.value, options);
});

detectedLanguageElement.innerHTML = languageToFlag(inputLanguage);
await refreshTargetLanguageOptions({ sourceLanguage: inputLanguage });

langSelect.value = targetLanguage;
langSelect.addEventListener("change", (e) => {
  targetLanguage = normalizeLang(e.target.value);
  updateTranslateEnabled();
});

translateInputElement?.addEventListener("input", () => {
  const text = translateInputElement.value.trim();
  const count = text ? text.split(/\s+/).length : 0;
  wordCountElement.textContent = String(count);
});

function setStatus(text) {
  translateStatus.textContent = text;
  translateStatus.hidden = !text;
}
function setTranslating(isOn) {
  triggerTranslate.disabled = isOn;
  translateInputElement.disabled = isOn;
}

// PROGRESS INDICATOR
const modelProgress = document.querySelector("#modelProgress");
const modelProgressBar = document.querySelector("#modelProgressBar");
const modelProgressText = document.querySelector("#modelProgressText");

function setBusy(isBusy) {
  triggerTranslate.disabled = isBusy;
  translateInputElement.disabled = isBusy;
  langSelect.disabled = isBusy;
  clearBtn.disabled = isBusy;
}

function showDownloadProgress(p01) {
  const pct = Math.max(0, Math.min(100, Math.round(p01 * 100)));
  modelProgress.hidden = false;
  modelProgressBar.value = pct;
  modelProgressText.textContent = `${pct}%`;
}

function hideDownloadProgress() {
  modelProgress.hidden = true;
  modelProgressBar.value = 0;
  modelProgressText.textContent = "";
}

modelProgress.hidden = true;

const warningEl = document.querySelector("#browserWarning");

function isChromeLike() {
  const ua = navigator.userAgent;
  const isChrome =
    /Chrome\//.test(ua) && !/Edg\//.test(ua) && !/OPR\//.test(ua);
  return isChrome;
}

function showBrowserWarning(reason) {
  if (!warningEl) return;
  warningEl.hidden = false;
  if (reason) warningEl.textContent = reason;
}

const hasAI = "Translator" in window || "LanguageDetector" in window;

if (!isChromeLike()) {
  showBrowserWarning(
    "These features require Google Chrome (built-in on-device AI). In this browser, translation/detection may not work.",
  );
} else if (!hasAI) {
  showBrowserWarning(
    "Chrome detected, but Translator/LanguageDetector APIs are not available. Ensure you are on a compatible Chrome version and a secure context (https or localhost).",
  );
}

function getSelectedAvailability() {
  const opt = langSelect.selectedOptions?.[0];
  return opt?.dataset?.availability ?? "unavailable";
}

function updateTranslateEnabled() {
  const availability = getSelectedAvailability();
  triggerTranslate.disabled = !detectedOk || availability === "unavailable";
}
