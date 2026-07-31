/**
 * Фиксированный рантайм интерактивного теста: читает JSON из #lesson-spec,
 * рендерит вопросы, проверяет ответы, показывает итог на странице.
 */
(function lessonRuntime() {
  "use strict";

  function readSpec() {
    const el = document.getElementById("lesson-spec");
    if (!el || !el.textContent) {
      throw new Error("Не найден элемент #lesson-spec с JSON теста");
    }
    const spec = JSON.parse(el.textContent);
    if (!spec || spec.version !== 1 || !Array.isArray(spec.parts)) {
      throw new Error("Некорректная спецификация теста (version/parts)");
    }
    if (!spec.runtime || typeof spec.runtime.localStorageKey !== "string") {
      throw new Error("Нет runtime.localStorageKey");
    }
    return spec;
  }

  var SPEC = null;
  try {
    SPEC = readSpec();
  } catch (e) {
    console.error("[lesson-test] spec parse failed", e);
    document.body.innerHTML =
      '<p style="padding:1rem;font-family:system-ui">Ошибка загрузки теста. Обновите страницу.</p>';
    return;
  }

  var TEST_BLUEPRINT = SPEC.parts;
  var LS_KEY = SPEC.runtime.localStorageKey;

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function escapeRegExp(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /** Убирает дублирующий префикс «Key)» в начале текста (в т.ч. для ключей из одной буквы). */
  function stripDuplicateOptionPrefix(key, text) {
    var t = String(text).trim();
    var k = String(key).trim();
    if (!k) return t;
    var re = new RegExp("^" + escapeRegExp(k) + "\\)\\s*", "i");
    var out = t.replace(re, "").trim();
    if (out.length > 0) return out;
    var letter = k.charAt(0);
    if (!letter) return t;
    var reLetter = new RegExp("^" + escapeRegExp(letter) + "\\)\\s*", "i");
    out = t.replace(reLetter, "").trim();
    return out.length > 0 ? out : t;
  }

  function optionCaption(key, text) {
    var cleaned = stripDuplicateOptionPrefix(key, text);
    return String(key) + ") " + cleaned;
  }

  function shuffleCopy(array) {
    var a = array.slice();
    for (var i = a.length - 1; i > 0; i -= 1) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a;
  }

  var FLAT_QUESTIONS = [];
  var serial = 1;
  for (var pi = 0; pi < TEST_BLUEPRINT.length; pi += 1) {
    var part = TEST_BLUEPRINT[pi];
    for (var ei = 0; ei < part.exercises.length; ei += 1) {
      var ex = part.exercises[ei];
      var inputKind = ex.inputKind || "radio";
      for (var qi = 0; qi < ex.questions.length; qi += 1) {
        var q = ex.questions[qi];
        FLAT_QUESTIONS.push({
          serial: serial,
          partTitle: part.title,
          exTitle: ex.title,
          ex: ex,
          q: q,
          inputKind: inputKind,
        });
        serial += 1;
      }
    }
  }

  function formatAnswerLine(key, options) {
    if (!options || !key) return "(нет вариантов)";
    for (var oi = 0; oi < options.length; oi += 1) {
      if (options[oi].key === key) {
        return optionCaption(options[oi].key, options[oi].text);
      }
    }
    return String(key) + ") (нет ответа)";
  }

  function gapSlotsCountFromTemplate(template) {
    var inner = String(template || "");
    if (inner.indexOf("___") < 0) return 0;
    return inner.split("___").length - 1;
  }

  /** Эталонные слова в пропусках (порядок слева направо); для совместимости один пропуск — gapCorrectToken. */
  function gapDragReferenceTokens(question) {
    var slots = gapSlotsCountFromTemplate(question.gapTemplate || "");
    if (slots <= 1) {
      var compact = question.gapCorrectTokens;
      if (compact && compact.length === 1 && String(compact[0]).trim()) {
        return [String(compact[0]).trim()];
      }
      var only = question.gapCorrectToken ? String(question.gapCorrectToken).trim() : "";
      return only ? [only] : [];
    }
    var list = question.gapCorrectTokens || [];
    var aggregated = [];
    for (var listIndex = 0; listIndex < list.length; listIndex += 1) {
      aggregated.push(String(list[listIndex]).trim());
    }
    return aggregated;
  }

  function parseGapDragAnswerStored(rawStored, slots) {
    var blanks = [];
    for (var fillIndex = 0; fillIndex < slots; fillIndex += 1) blanks.push("");
    var trimmed =
      rawStored === undefined || rawStored === null ? "" : String(rawStored).trim();
    if (!trimmed) return blanks;
    try {
      var jsonParsed = JSON.parse(trimmed);
      if (Array.isArray(jsonParsed) && jsonParsed.length === slots) {
        var rebuilt = [];
        for (var jsonIdx = 0; jsonIdx < jsonParsed.length; jsonIdx += 1) {
          rebuilt.push(String(jsonParsed[jsonIdx]).trim());
        }
        return rebuilt;
      }
    } catch (_) {
      /* один пропуск: старые сохранения как голый текст */
    }
    if (slots === 1) return [trimmed];
    return blanks;
  }

  function gapChosenDisplayed(placeholders) {
    var fragments = [];
    for (var displayIndex = 0; displayIndex < placeholders.length; displayIndex += 1) {
      fragments.push(placeholders[displayIndex] ? placeholders[displayIndex] : "___");
    }
    return fragments.join(" · ");
  }

  function normalizeGapToken(value) {
    return String(value).replace(/\s+/g, " ").trim().toLowerCase();
  }

  function gapTokensEquivalent(studentToken, referenceToken) {
    return normalizeGapToken(studentToken) === normalizeGapToken(referenceToken);
  }

  function gapSlotCountEffective(question) {
    var numbered = gapSlotsCountFromTemplate(question.gapTemplate || "");
    return numbered > 0 ? numbered : 1;
  }

  function correctAnswerDisplay(item) {
    var q = item.q;
    var inputKind = item.inputKind;
    if (inputKind === "wordOrder" && q.correctSentence) {
      return q.correctSentence;
    }
    if (inputKind === "gapDrag" || inputKind === "gapFill") {
      var refs = gapDragReferenceTokens(q);
      if (!refs.length) return "—";
      return refs.join(" · ");
    }
    if (inputKind === "matchPairs") {
      var stems = q.matchLeftItems || [];
      var corr = q.matchCorrectKeys || [];
      var rightOpts = q.matchRightOptions || [];
      if (!stems.length || !corr.length) return "—";
      var matchBits = [];
      for (var stemLoop = 0; stemLoop < stems.length; stemLoop += 1) {
        var answerKey = corr[stemLoop];
        matchBits.push(
          String(stemLoop + 1) +
            ") " +
            stems[stemLoop] +
            " → " +
            (rightOpts.length ? formatAnswerLine(String(answerKey), rightOpts) : String(answerKey)),
        );
      }
      return matchBits.join("; ");
    }
    if (inputKind === "checkbox" && q.correctKeys && q.correctKeys.length && q.options) {
      var parts = [];
      for (var ci = 0; ci < q.correctKeys.length; ci += 1) {
        parts.push(formatAnswerLine(q.correctKeys[ci], q.options));
      }
      return parts.join("; ");
    }
    if (q.correctKey && q.options) {
      return formatAnswerLine(q.correctKey, q.options);
    }
    return "—";
  }

  function normalizeSentence(s) {
    return String(s)
      .replace(/\s+/g, " ")
      .replace(/\s+([.,?!])/g, "$1")
      .trim();
  }

  function sortKeysString(keysStr) {
    if (!keysStr || typeof keysStr !== "string") return "";
    return keysStr
      .split(",")
      .map(function (k) {
        return k.trim();
      })
      .filter(Boolean)
      .sort()
      .join(",");
  }

  function isAnswerCorrect(item, chosen) {
    var q = item.q;
    var inputKind = item.inputKind;
    if (inputKind === "wordOrder") {
      var c = q.correctSentence ? normalizeSentence(q.correctSentence) : "";
      var s = chosen ? normalizeSentence(chosen) : "";
      return c.length > 0 && c === s;
    }
    if (inputKind === "gapDrag") {
      var refTokensDrag = gapDragReferenceTokens(q);
      if (!refTokensDrag.length) return false;
      var pickedDrag = parseGapDragAnswerStored(chosen, refTokensDrag.length);
      if (pickedDrag.length !== refTokensDrag.length) return false;
      for (var refLoopDrag = 0; refLoopDrag < refTokensDrag.length; refLoopDrag += 1) {
        if (String(pickedDrag[refLoopDrag]).trim() !== String(refTokensDrag[refLoopDrag]).trim()) return false;
      }
      return true;
    }
    if (inputKind === "gapFill") {
      var refTokensFill = gapDragReferenceTokens(q);
      if (!refTokensFill.length) return false;
      var pickedFill = parseGapDragAnswerStored(chosen, refTokensFill.length);
      if (pickedFill.length !== refTokensFill.length) return false;
      for (var refLoopFill = 0; refLoopFill < refTokensFill.length; refLoopFill += 1) {
        if (!gapTokensEquivalent(pickedFill[refLoopFill], refTokensFill[refLoopFill])) return false;
      }
      return true;
    }
    if (inputKind === "matchPairs") {
      var refMatch = q.matchCorrectKeys || [];
      var gotKeys = [];
      try {
        gotKeys = JSON.parse(typeof chosen === "string" ? chosen : "");
      } catch (_) {
        return false;
      }
      if (!Array.isArray(gotKeys) || gotKeys.length !== refMatch.length) return false;
      for (var matchCmp = 0; matchCmp < refMatch.length; matchCmp += 1) {
        if (String(refMatch[matchCmp]).trim() !== String(gotKeys[matchCmp]).trim()) return false;
      }
      return true;
    }
    if (inputKind === "checkbox" && q.correctKeys && q.correctKeys.length) {
      var ref = sortKeysString(q.correctKeys.join(","));
      var got = sortKeysString(chosen);
      return ref.length > 0 && ref === got;
    }
    return chosen === (q.correctKey || "");
  }

  function studentAnswerDisplay(item, chosen) {
    var q = item.q;
    var inputKind = item.inputKind;
    if (inputKind === "wordOrder") {
      return chosen.trim() === "" ? "(нет ответа)" : chosen;
    }
    if (inputKind === "gapDrag" || inputKind === "gapFill") {
      var slotTotalShown = gapSlotCountEffective(q);
      var placeholdersParsed = parseGapDragAnswerStored(chosen, slotTotalShown);
      var anyWord = placeholdersParsed.some(function (piece) {
        return String(piece || "").trim() !== "";
      });
      if (!anyWord) return "(нет ответа)";
      return gapChosenDisplayed(placeholdersParsed);
    }
    if (inputKind === "matchPairs") {
      var leftStems = q.matchLeftItems || [];
      var optionsRight = q.matchRightOptions || [];
      var picks = [];
      try {
        picks = JSON.parse(typeof chosen === "string" ? chosen : "");
      } catch (_) {
        return "(нет ответа)";
      }
      if (!Array.isArray(picks)) return "(нет ответа)";
      var nonempty = picks.some(function (letter) {
        return String(letter || "").trim() !== "";
      });
      if (!nonempty) return "(нет ответа)";
      var lines = [];
      for (var lineIndex = 0; lineIndex < leftStems.length && lineIndex < picks.length; lineIndex += 1) {
        var letterKey = picks[lineIndex];
        lines.push(
          String(lineIndex + 1) +
            ") " +
            (letterKey ? formatAnswerLine(String(letterKey), optionsRight) : "(пусто)"),
        );
      }
      return lines.join("; ");
    }
    if (inputKind === "checkbox") {
      if (!chosen || !String(chosen).trim()) return "(нет ответа)";
      if (!q.options) return chosen;
      var ks = String(chosen)
        .split(",")
        .map(function (k) {
          return k.trim();
        })
        .filter(Boolean);
      var bits = [];
      for (var bi = 0; bi < ks.length; bi += 1) {
        bits.push(formatAnswerLine(ks[bi], q.options));
      }
      return bits.join("; ");
    }
    if (!q.options) return chosen || "(нет ответа)";
    if (chosen === "") return "(нет ответа)";
    return formatAnswerLine(chosen, q.options);
  }

  var wordOrderRefreshers = {};
  var wordOrderState = {};
  var gapDragSlotAnswers = {};
  var gapDragRefreshers = {};
  var gapFillRefreshers = {};
  var matchPairsSlotKeysState = {};
  var matchPairsRefreshers = {};

  function getWordOrderSentence(qid) {
    var st = wordOrderState[qid];
    if (!st) return "";
    return st.answer.join(" ");
  }

  function syncWordOrderHiddenInput(qid) {
    var el = document.getElementById("wo_hidden_" + qid);
    if (el) el.value = getWordOrderSentence(qid);
  }

  function renderWordOrderQuestion(qEl, q) {
    var bank = shuffleCopy(q.wordBank || []);
    wordOrderState[q.id] = { bank: bank, answer: [] };

    var wrap = document.createElement("div");
    wrap.className = "word-order-wrap";
    wrap.innerHTML =
      '<p class="wo-bank-label">Слова (нажмите или перетащите в поле ниже)</p>' +
      '<div class="wo-bank" data-wo-bank="' +
      escapeHtml(q.id) +
      '" aria-label="Банк слов"></div>' +
      '<p class="wo-answer-label">Ваше предложение</p>' +
      '<div class="wo-answer" data-wo-answer="' +
      escapeHtml(q.id) +
      '" aria-label="Собранное предложение"></div>' +
      '<input type="hidden" class="wo-hidden" id="wo_hidden_' +
      escapeHtml(q.id) +
      '" name="answer_' +
      escapeHtml(q.id) +
      '" value="" />' +
      '<p class="wo-hint">Слово из нижней строки можно нажать, чтобы вернуть его в банк.</p>';
    qEl.appendChild(wrap);

    var bankEl = wrap.querySelector(".wo-bank");
    var answerEl = wrap.querySelector(".wo-answer");
    if (!bankEl || !answerEl) return;

    function renderChips() {
      var st = wordOrderState[q.id];
      if (!st) return;
      bankEl.innerHTML = "";
      answerEl.innerHTML = "";
      for (var bi = 0; bi < st.bank.length; bi += 1) {
        bankEl.appendChild(makeWordChip(q.id, st.bank[bi], "bank"));
      }
      for (var ai = 0; ai < st.answer.length; ai += 1) {
        answerEl.appendChild(makeWordChip(q.id, st.answer[ai], "answer"));
      }
      syncWordOrderHiddenInput(q.id);
      scheduleSave();
    }

    function makeWordChip(qid, token, zone) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "wo-chip";
      btn.textContent = token;
      btn.draggable = true;
      btn.dataset.token = token;
      btn.dataset.zone = zone;
      btn.dataset.qid = qid;
      btn.addEventListener("click", function () {
        if (document.body.classList.contains("test-locked")) return;
        var st2 = wordOrderState[qid];
        if (!st2) return;
        if (zone === "bank") {
          st2.bank = st2.bank.filter(function (t) {
            return t !== token;
          });
          st2.answer.push(token);
        } else {
          st2.answer = st2.answer.filter(function (t) {
            return t !== token;
          });
          st2.bank.push(token);
        }
        renderChips();
      });
      btn.addEventListener("dragstart", function (ev) {
        ev.dataTransfer.setData("text/plain", qid + "|" + token + "|" + zone);
        ev.dataTransfer.effectAllowed = "move";
      });
      return btn;
    }

    answerEl.addEventListener("dragover", function (ev) {
      ev.preventDefault();
      answerEl.classList.add("wo-drag-over");
    });
    answerEl.addEventListener("dragleave", function () {
      answerEl.classList.remove("wo-drag-over");
    });
    answerEl.addEventListener("drop", function (ev) {
      ev.preventDefault();
      answerEl.classList.remove("wo-drag-over");
      if (document.body.classList.contains("test-locked")) return;
      var raw = ev.dataTransfer.getData("text/plain");
      if (!raw) return;
      var parts = raw.split("|");
      var qid = parts[0];
      var token = parts[1];
      var zone = parts[2];
      if (qid !== q.id) return;
      var st2 = wordOrderState[q.id];
      if (!st2) return;
      if (zone === "bank") {
        st2.bank = st2.bank.filter(function (t) {
          return t !== token;
        });
        st2.answer.push(token);
      }
      renderChips();
    });

    bankEl.addEventListener("dragover", function (ev) {
      ev.preventDefault();
    });
    bankEl.addEventListener("drop", function (ev) {
      ev.preventDefault();
      if (document.body.classList.contains("test-locked")) return;
      var raw = ev.dataTransfer.getData("text/plain");
      if (!raw) return;
      var parts2 = raw.split("|");
      var qid2 = parts2[0];
      var token2 = parts2[1];
      var zone2 = parts2[2];
      if (qid2 !== q.id) return;
      var st3 = wordOrderState[q.id];
      if (!st3) return;
      if (zone2 === "answer") {
        st3.answer = st3.answer.filter(function (t) {
          return t !== token2;
        });
        st3.bank.push(token2);
      }
      renderChips();
    });

    renderChips();
    wordOrderRefreshers[q.id] = renderChips;
  }

  function initGapAnswersSlots(question) {
    var totalSlots = gapSlotCountEffective(question);
    var cleared = [];
    for (var initIdx = 0; initIdx < totalSlots; initIdx += 1) cleared.push("");
    gapDragSlotAnswers[question.id] = cleared;
    return totalSlots;
  }

  function syncGapSlotsHidden(questionId, expectedLength) {
    var el = document.getElementById("gd_hidden_" + questionId);
    if (!el) return;
    var working = gapDragSlotAnswers[questionId] || [];
    var sliceLen = expectedLength > 0 ? expectedLength : working.length;
    el.value = JSON.stringify(working.slice(0, sliceLen));
    scheduleSave();
  }

  function renderGapDragQuestion(qEl, q) {
    var slotCount = initGapAnswersSlots(q);
    var wordBankMixed = shuffleCopy(q.wordBank || []);
    var templateChunks = (q.gapTemplate || "").split("___");
    var wrap = document.createElement("div");
    wrap.className = "gap-drag-wrap";
    var instr =
      slotCount > 1
        ? "Перетащите слова из банка в пропуски по порядку."
        : "Перетащите подходящее слово в пропуск.";
    wrap.innerHTML =
      '<p class="instruction">' +
      escapeHtml(instr) +
      '</p>' +
      '<div class="gap-sentence" data-gd-sentence="' +
      escapeHtml(q.id) +
      '"></div>' +
      '<p class="wo-bank-label">Банк слов</p>' +
      '<div class="wo-bank gap-bank" data-gd-bank="' +
      escapeHtml(q.id) +
      '"></div>' +
      '<input type="hidden" id="gd_hidden_' +
      escapeHtml(q.id) +
      '" name="answer_' +
      escapeHtml(q.id) +
      '" value="" />';
    qEl.appendChild(wrap);
    var sentenceContainer = wrap.querySelector(".gap-sentence");
    var bankContainer = wrap.querySelector(".gap-bank");
    if (!sentenceContainer || !bankContainer) return;

    bankContainer.addEventListener("dragover", function (bankOver) {
      bankOver.preventDefault();
    });
    bankContainer.addEventListener("drop", function (bankDropEv) {
      bankDropEv.preventDefault();
      if (document.body.classList.contains("test-locked")) return;
      var gdPay = bankDropEv.dataTransfer.getData("text/plain");
      if (!gdPay || gdPay.indexOf("gd|") !== 0) return;
      var gdSegs = gdPay.split("|");
      if (gdSegs.length < 5 || gdSegs[1] !== q.id || gdSegs[2] !== "slot") return;
      var clearedIdx = Number.parseInt(gdSegs[3], 10);
      var activeLane = gapDragSlotAnswers[q.id];
      if (!activeLane || !Number.isFinite(clearedIdx)) return;
      activeLane[clearedIdx] = "";
      renderAllGaps();
    });

    function slotTokensChosen() {
      var row = gapDragSlotAnswers[q.id] || [];
      var selected = [];
      for (var pickIdx = 0; pickIdx < row.length; pickIdx += 1) {
        if (row[pickIdx]) selected.push(row[pickIdx]);
      }
      return selected;
    }

    function makeTokenChip(questionIdParam, gapToken, sourceKind, gapIndexNumber) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "wo-chip";
      chip.textContent = gapToken;
      chip.draggable = true;
      chip.addEventListener("click", function () {
        if (document.body.classList.contains("test-locked")) return;
        if (sourceKind === "bank") {
          var rowState = gapDragSlotAnswers[questionIdParam];
          if (!rowState) return;
          var placedTo = -1;
          for (var seek = 0; seek < rowState.length; seek += 1) {
            if (!rowState[seek]) {
              placedTo = seek;
              break;
            }
          }
          if (placedTo < 0) return;
          rowState[placedTo] = gapToken;
          renderAllGaps();
          return;
        }
        if (sourceKind === "slot") {
          var rows = gapDragSlotAnswers[questionIdParam];
          if (!rows || gapIndexNumber < 0 || gapIndexNumber >= rows.length) return;
          rows[gapIndexNumber] = "";
          renderAllGaps();
        }
      });
      chip.addEventListener("dragstart", function (evDrag) {
        evDrag.dataTransfer.setData(
          "text/plain",
          "gd|" + questionIdParam + "|" + sourceKind + "|" + String(gapIndexNumber) + "|" + gapToken,
        );
        evDrag.dataTransfer.effectAllowed = "move";
      });
      return chip;
    }

    function attachDropHandlersForSlot(spanNode, gapPosition) {
      spanNode.addEventListener("dragover", function (evOver) {
        evOver.preventDefault();
        spanNode.classList.add("wo-drag-over");
      });
      spanNode.addEventListener("dragleave", function () {
        spanNode.classList.remove("wo-drag-over");
      });
      spanNode.addEventListener("drop", function (evDrop) {
        evDrop.preventDefault();
        spanNode.classList.remove("wo-drag-over");
        if (document.body.classList.contains("test-locked")) return;
        var payload = evDrop.dataTransfer.getData("text/plain");
        if (!payload || payload.indexOf("gd|") !== 0) return;
        var bits = payload.split("|");
        if (bits.length < 5 || bits[1] !== q.id) return;
        var sourceZone = bits[2];
        var sourceIndexParsed = Number.parseInt(bits[3], 10);
        var tokenMoved = bits[4] || "";
        var lane = gapDragSlotAnswers[q.id];
        if (!lane) return;
        if (sourceZone === "bank") {
          lane[gapPosition] = tokenMoved;
        } else if (sourceZone === "slot") {
          if (!Number.isFinite(sourceIndexParsed)) return;
          if (sourceIndexParsed === gapPosition) return;
          var fromToken = lane[sourceIndexParsed] || "";
          var toToken = lane[gapPosition] || "";
          lane[sourceIndexParsed] = toToken;
          lane[gapPosition] = fromToken;
        }
        renderAllGaps();
      });
    }

    function renderAllGaps() {
      sentenceContainer.innerHTML = "";
      var laneNow = gapDragSlotAnswers[q.id] || [];
      for (var gapWalk = 0; gapWalk < slotCount; gapWalk += 1) {
        var textBefore = document.createElement("span");
        textBefore.textContent = templateChunks[gapWalk] || "";
        sentenceContainer.appendChild(textBefore);
        var slotSpan = document.createElement("span");
        slotSpan.className = "gap-drop wo-answer";
        slotSpan.dataset.gdDrop = q.id;
        slotSpan.dataset.gdSlot = String(gapWalk);
        var tokenHere = laneNow[gapWalk] || "";
        if (tokenHere) {
          slotSpan.appendChild(makeTokenChip(q.id, tokenHere, "slot", gapWalk));
        } else {
          slotSpan.textContent = "___";
        }
        attachDropHandlersForSlot(slotSpan, gapWalk);
        sentenceContainer.appendChild(slotSpan);
      }
      var tailPart = document.createElement("span");
      tailPart.textContent = templateChunks[slotCount] || "";
      sentenceContainer.appendChild(tailPart);

      bankContainer.innerHTML = "";
      var usedList = slotTokensChosen();
      var leftInBank = remainingBankTokens(wordBankMixed, usedList);
      for (var bankWalk = 0; bankWalk < leftInBank.length; bankWalk += 1) {
        bankContainer.appendChild(makeTokenChip(q.id, leftInBank[bankWalk], "bank", -1));
      }
      syncGapSlotsHidden(q.id, slotCount);
    }

    renderAllGaps();
    gapDragRefreshers[q.id] = renderAllGaps;
  }

  function syncGapFillSlotsHidden(questionId, expectedLength) {
    var el = document.getElementById("gf_hidden_" + questionId);
    if (!el) return;
    var working = gapDragSlotAnswers[questionId] || [];
    var sliceLen = expectedLength > 0 ? expectedLength : working.length;
    el.value = JSON.stringify(working.slice(0, sliceLen));
    scheduleSave();
  }

  function renderGapFillQuestion(qEl, q) {
    var slotCount = initGapAnswersSlots(q);
    var templateChunks = (q.gapTemplate || "").split("___");
    var wrap = document.createElement("div");
    wrap.className = "gap-fill-wrap";
    var instr =
      slotCount > 1
        ? "Введите пропущенные слова в каждый пропуск."
        : "Введите пропущенное слово.";
    wrap.innerHTML =
      '<p class="instruction">' +
      escapeHtml(instr) +
      '</p>' +
      '<div class="gap-sentence gap-fill-sentence" data-gf-sentence="' +
      escapeHtml(q.id) +
      '"></div>' +
      '<input type="hidden" id="gf_hidden_' +
      escapeHtml(q.id) +
      '" name="answer_' +
      escapeHtml(q.id) +
      '" value="" />';
    qEl.appendChild(wrap);
    var sentenceContainer = wrap.querySelector(".gap-fill-sentence");
    if (!sentenceContainer) return;

    function renderAllFillInputs() {
      sentenceContainer.innerHTML = "";
      var laneNow = gapDragSlotAnswers[q.id] || [];
      for (var gapWalk = 0; gapWalk < slotCount; gapWalk += 1) {
        var textBefore = document.createElement("span");
        textBefore.textContent = templateChunks[gapWalk] || "";
        sentenceContainer.appendChild(textBefore);
        var inputEl = document.createElement("input");
        inputEl.type = "text";
        inputEl.className = "gap-fill-input";
        inputEl.autocomplete = "off";
        inputEl.spellcheck = false;
        inputEl.setAttribute("aria-label", "Пропуск " + String(gapWalk + 1));
        inputEl.value = laneNow[gapWalk] || "";
        inputEl.dataset.gfSlot = String(gapWalk);
        inputEl.addEventListener("input", function (inputEvent) {
          if (document.body.classList.contains("test-locked")) return;
          var target = inputEvent.currentTarget;
          if (!target || !target.dataset) return;
          var slotIndex = Number.parseInt(target.dataset.gfSlot || "", 10);
          var row = gapDragSlotAnswers[q.id];
          if (!row || !Number.isFinite(slotIndex)) return;
          row[slotIndex] = target.value;
          syncGapFillSlotsHidden(q.id, slotCount);
        });
        sentenceContainer.appendChild(inputEl);
      }
      var tailPart = document.createElement("span");
      tailPart.textContent = templateChunks[slotCount] || "";
      sentenceContainer.appendChild(tailPart);
      syncGapFillSlotsHidden(q.id, slotCount);
    }

    renderAllFillInputs();
    gapFillRefreshers[q.id] = renderAllFillInputs;
  }

  function renderMatchPairsQuestion(qEl, q) {
    var stems = q.matchLeftItems || [];
    var rightSide = q.matchRightOptions || [];
    var initialEmpty = [];
    for (var clearMatch = 0; clearMatch < stems.length; clearMatch += 1) initialEmpty.push("");
    matchPairsSlotKeysState[q.id] = initialEmpty;

    var shell = document.createElement("div");
    shell.className = "match-pairs-wrap";
    shell.innerHTML =
      '<p class="instruction">Перетащите окончания к началам фраз (или нажмите на вариант, затем на слот).</p>' +
      '<div class="match-rows" data-mp-rows="' +
      escapeHtml(q.id) +
      '"></div>' +
      '<p class="wo-bank-label">Окончания (банк)</p>' +
      '<div class="wo-bank match-pairs-bank" data-mp-bank="' +
      escapeHtml(q.id) +
      '"></div>' +
      '<input type="hidden" id="mp_hidden_' +
      escapeHtml(q.id) +
      '" name="answer_' +
      escapeHtml(q.id) +
      '" value="" />' +
      '<p class="wo-hint">Нажмите на выбранное окончание в слоте, чтобы вернуть его в банк.</p>';
    qEl.appendChild(shell);
    var rowsHost = shell.querySelector(".match-rows");
    var bankHost = shell.querySelector(".match-pairs-bank");
    if (!rowsHost || !bankHost) return;

    bankHost.addEventListener("dragover", function (hostOver) {
      hostOver.preventDefault();
    });
    bankHost.addEventListener("drop", function (hostDropEv) {
      hostDropEv.preventDefault();
      if (document.body.classList.contains("test-locked")) return;
      var mpPayload = hostDropEv.dataTransfer.getData("text/plain");
      if (!mpPayload || mpPayload.indexOf("mp|") !== 0) return;
      var mpSeg = mpPayload.split("|");
      if (mpSeg.length < 5 || mpSeg[1] !== q.id || mpSeg[2] !== "slot") return;
      var rowFrom = Number.parseInt(mpSeg[3], 10);
      var board = matchPairsSlotKeysState[q.id];
      if (!board || !Number.isFinite(rowFrom)) return;
      board[rowFrom] = "";
      renderMatchBoard();
    });

    var bankOrder = shuffleCopy(
      rightSide.map(function (optItem) {
        return String(optItem.key);
      }),
    );

    function syncMatchHidden() {
      var syncEl = document.getElementById("mp_hidden_" + q.id);
      if (syncEl) syncEl.value = JSON.stringify(matchPairsSlotKeysState[q.id] || []);
      scheduleSave();
    }

    function optionLabelForKey(letterKey) {
      for (var search = 0; search < rightSide.length; search += 1) {
        if (rightSide[search].key === letterKey) return rightSide[search].text;
      }
      return "";
    }

    function keysNotInSlots() {
      var used = matchPairsSlotKeysState[q.id] || [];
      var counts = {};
      for (var countIdx = 0; countIdx < used.length; countIdx += 1) {
        var letterStored = String(used[countIdx] || "").trim();
        if (!letterStored) continue;
        counts[letterStored] = (counts[letterStored] || 0) + 1;
      }
      var availableKeys = [];
      for (var orderIdx = 0; orderIdx < bankOrder.length; orderIdx += 1) {
        var cand = bankOrder[orderIdx];
        var usedTimes = counts[cand] || 0;
        if (usedTimes > 0) {
          counts[cand] = usedTimes - 1;
        } else {
          availableKeys.push(cand);
        }
      }
      return availableKeys;
    }

    function makeEndingChip(questionInnerId, optionKeyLetter, chipSource, rowPosition) {
      var labelCaption = optionLabelForKey(optionKeyLetter);
      var btnChip = document.createElement("button");
      btnChip.type = "button";
      btnChip.className = "wo-chip";
      btnChip.textContent = optionCaption(optionKeyLetter, labelCaption || "—");
      btnChip.draggable = true;
      btnChip.dataset.mpKey = optionKeyLetter;
      btnChip.addEventListener("click", function () {
        if (document.body.classList.contains("test-locked")) return;
        var matrix = matchPairsSlotKeysState[questionInnerId];
        if (!matrix) return;
        if (chipSource === "bank") {
          var firstGap = -1;
          for (var findEmpty = 0; findEmpty < matrix.length; findEmpty += 1) {
            if (!matrix[findEmpty]) {
              firstGap = findEmpty;
              break;
            }
          }
          if (firstGap < 0) return;
          matrix[firstGap] = optionKeyLetter;
          renderMatchBoard();
          return;
        }
        if (chipSource === "slot" && rowPosition >= 0) {
          matrix[rowPosition] = "";
          renderMatchBoard();
        }
      });
      btnChip.addEventListener("dragstart", function (evStart) {
        evStart.dataTransfer.setData(
          "text/plain",
          "mp|" + questionInnerId + "|" + chipSource + "|" + String(rowPosition) + "|" + optionKeyLetter,
        );
        evStart.dataTransfer.effectAllowed = "move";
      });
      return btnChip;
    }

    function bindSlotDrop(slotElement, rowIndex) {
      slotElement.addEventListener("dragover", function (evSlotOver) {
        evSlotOver.preventDefault();
        slotElement.classList.add("wo-drag-over");
      });
      slotElement.addEventListener("dragleave", function () {
        slotElement.classList.remove("wo-drag-over");
      });
      slotElement.addEventListener("drop", function (evSlotDrop) {
        evSlotDrop.preventDefault();
        slotElement.classList.remove("wo-drag-over");
        if (document.body.classList.contains("test-locked")) return;
        var rawMp = evSlotDrop.dataTransfer.getData("text/plain");
        if (!rawMp || rawMp.indexOf("mp|") !== 0) return;
        var segments = rawMp.split("|");
        if (segments.length < 5 || segments[1] !== q.id) return;
        var zoneFrom = segments[2];
        var oldRow = Number.parseInt(segments[3], 10);
        var keyLetter = segments[4] || "";
        var matrixNow = matchPairsSlotKeysState[q.id];
        if (!matrixNow) return;
        if (zoneFrom === "bank") {
          matrixNow[rowIndex] = keyLetter;
        } else if (zoneFrom === "slot") {
          if (!Number.isFinite(oldRow)) return;
          if (oldRow === rowIndex) return;
          var tempSwap = matrixNow[rowIndex];
          matrixNow[rowIndex] = matrixNow[oldRow];
          matrixNow[oldRow] = tempSwap;
        }
        renderMatchBoard();
      });
    }

    function renderMatchBoard() {
      rowsHost.innerHTML = "";
      bankHost.innerHTML = "";
      var matrixView = matchPairsSlotKeysState[q.id] || [];
      for (var stemIdx = 0; stemIdx < stems.length; stemIdx += 1) {
        var rowDiv = document.createElement("div");
        rowDiv.className = "match-row";
        var num = document.createElement("span");
        num.className = "match-stem-num";
        num.textContent = String(stemIdx + 1) + ")";
        var stemBody = document.createElement("span");
        stemBody.className = "match-stem-text";
        stemBody.textContent = stems[stemIdx] || "";
        var slotBox = document.createElement("div");
        slotBox.className = "match-slot wo-answer";
        slotBox.dataset.mpSlot = String(stemIdx);
        var keyInSlot = matrixView[stemIdx] || "";
        if (keyInSlot) {
          slotBox.appendChild(makeEndingChip(q.id, keyInSlot, "slot", stemIdx));
        } else {
          slotBox.textContent = "— перетащите сюда —";
        }
        bindSlotDrop(slotBox, stemIdx);
        rowDiv.appendChild(num);
        rowDiv.appendChild(stemBody);
        rowDiv.appendChild(slotBox);
        rowsHost.appendChild(rowDiv);
      }
      var freeKeys = keysNotInSlots();
      for (var freeWalk = 0; freeWalk < freeKeys.length; freeWalk += 1) {
        bankHost.appendChild(makeEndingChip(q.id, freeKeys[freeWalk], "bank", -1));
      }
      syncMatchHidden();
    }

    renderMatchBoard();
    matchPairsRefreshers[q.id] = renderMatchBoard;
  }

  function renderCheckboxQuestion(qEl, q) {
    if (!q.options) return;
    var box = document.createElement("div");
    box.className = "options checkbox-options";
    for (var oi = 0; oi < q.options.length; oi += 1) {
      var op = q.options[oi];
      var inputId = q.id + "_cb_" + op.key;
      var lab = document.createElement("label");
      lab.className = "option";
      lab.htmlFor = inputId;
      var inp = document.createElement("input");
      inp.type = "checkbox";
      inp.id = inputId;
      inp.name = "answer_cb_" + q.id;
      inp.value = op.key;
      inp.addEventListener("change", scheduleSave);
      lab.appendChild(inp);
      var span = document.createElement("span");
      span.textContent = optionCaption(op.key, op.text);
      lab.appendChild(span);
      box.appendChild(lab);
    }
    qEl.appendChild(box);
  }

  function remainingBankTokens(wordBank, answer) {
    var counts = {};
    for (var wi = 0; wi < wordBank.length; wi += 1) {
      var w = wordBank[wi];
      counts[w] = (counts[w] || 0) + 1;
    }
    for (var ai = 0; ai < answer.length; ai += 1) {
      counts[answer[ai]] -= 1;
    }
    var bank = [];
    for (var wj = 0; wj < wordBank.length; wj += 1) {
      var w2 = wordBank[wj];
      while (counts[w2] > 0) {
        bank.push(w2);
        counts[w2] -= 1;
      }
    }
    return bank;
  }

  function multisetSameTokens(a, b) {
    return a
      .slice()
      .sort()
      .join("\u0001") === b.slice().sort().join("\u0001");
  }

  function gapStudentAnswerLooksEmpty(question, stored) {
    var filled = parseGapDragAnswerStored(
      typeof stored === "string" ? stored : "",
      gapSlotCountEffective(question),
    );
    return !filled.some(function (word) {
      return String(word || "").trim() !== "";
    });
  }

  function matchPairsAnswerLooksEmpty(stored, leftCount) {
    if (typeof stored !== "string" || !stored.trim()) return true;
    try {
      var keysArray = JSON.parse(stored.trim());
      if (!Array.isArray(keysArray) || keysArray.length !== leftCount) return true;
      return !keysArray.some(function (letter) {
        return String(letter || "").trim() !== "";
      });
    } catch (_) {
      return true;
    }
  }

  function applySavedWordOrder(qid, answerArr) {
    var flat = null;
    for (var fi = 0; fi < FLAT_QUESTIONS.length; fi += 1) {
      if (FLAT_QUESTIONS[fi].q.id === qid) {
        flat = FLAT_QUESTIONS[fi];
        break;
      }
    }
    if (!flat || flat.inputKind !== "wordOrder" || !flat.q.wordBank) return;
    var q = flat.q;
    var st = wordOrderState[qid];
    if (!st || !Array.isArray(answerArr)) return;
    var merged = answerArr.concat(remainingBankTokens(q.wordBank, answerArr));
    if (!multisetSameTokens(merged, q.wordBank)) return;
    st.answer = answerArr.slice();
    st.bank = remainingBankTokens(q.wordBank, answerArr);
    if (wordOrderRefreshers[qid]) wordOrderRefreshers[qid]();
  }

  var saveTimer = 0;
  var suppressSave = true;

  function scheduleSave() {
    if (suppressSave) return;
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(saveFormState, 200);
  }

  function loadFormState() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function saveFormState() {
    var nameInput = document.getElementById("student-name");
    var answers = collectAnswers();
    var payload = { v: 1, name: nameInput ? nameInput.value : "", answers: answers };
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(payload));
      console.log("[lesson-test] saved state", Object.keys(answers).length, "answers");
    } catch (e) {
      /* quota */
    }
  }

  function applyFormState(state) {
    if (!state || typeof state !== "object") return;
    var nameInput = document.getElementById("student-name");
    if (nameInput && typeof state.name === "string") nameInput.value = state.name;
    var ans = state.answers && typeof state.answers === "object" ? state.answers : {};
    for (var ii = 0; ii < FLAT_QUESTIONS.length; ii += 1) {
      var item = FLAT_QUESTIONS[ii];
      var q = item.q;
      var inputKind = item.inputKind;
      var v = ans[q.id];
      if (v === undefined || v === null) continue;
      if (inputKind === "wordOrder" && Array.isArray(v)) {
        applySavedWordOrder(q.id, v);
        continue;
      }
      if (inputKind === "gapDrag" && typeof v === "string" && v.trim()) {
        gapDragSlotAnswers[q.id] = parseGapDragAnswerStored(v.trim(), gapSlotCountEffective(q));
        if (gapDragRefreshers[q.id]) gapDragRefreshers[q.id]();
        continue;
      }
      if (inputKind === "gapFill" && typeof v === "string" && v.trim()) {
        gapDragSlotAnswers[q.id] = parseGapDragAnswerStored(v.trim(), gapSlotCountEffective(q));
        if (gapFillRefreshers[q.id]) gapFillRefreshers[q.id]();
        continue;
      }
      if (inputKind === "matchPairs" && typeof v === "string" && v.trim()) {
        var leftCountMp = (q.matchLeftItems || []).length;
        try {
          var mpArr = JSON.parse(v.trim());
          if (Array.isArray(mpArr) && mpArr.length === leftCountMp) {
            matchPairsSlotKeysState[q.id] = mpArr.map(function (letterPiece) {
              return String(letterPiece || "").trim();
            });
          }
        } catch (_) {
          /* ignore */
        }
        if (matchPairsRefreshers[q.id]) matchPairsRefreshers[q.id]();
        continue;
      }
      if (inputKind === "checkbox" && typeof v === "string" && v.trim()) {
        var keyParts = v
          .split(",")
          .map(function (k) {
            return k.trim();
          })
          .filter(Boolean);
        for (var ki = 0; ki < keyParts.length; ki += 1) {
          var esc2 =
            typeof CSS !== "undefined" && CSS.escape
              ? CSS.escape(keyParts[ki])
              : keyParts[ki].replace(/\\/g, "\\\\").replace(/"/g, '\\"');
          var cb = document.querySelector(
            'input[name="answer_cb_' + q.id + '"][value="' + esc2 + '"]',
          );
          if (cb) cb.checked = true;
        }
        continue;
      }
      if (inputKind === "select") {
        var sel = document.getElementById("answer_select_" + q.id);
        if (sel && typeof v === "string") sel.value = v;
        continue;
      }
      if (typeof v !== "string" || v === "") continue;
      var esc =
        typeof CSS !== "undefined" && CSS.escape
          ? CSS.escape(v)
          : v.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      var input = document.querySelector('input[name="answer_' + q.id + '"][value="' + esc + '"]');
      if (input) input.checked = true;
    }
  }

  function bindAutosave() {
    var root = ensureTestRoot();
    if (root) root.addEventListener("change", scheduleSave);
    var sn = document.getElementById("student-name");
    if (sn) sn.addEventListener("input", scheduleSave);
  }

  function ensureTestRoot() {
    var el = document.getElementById("test-root");
    if (el) return el;
    var page = document.querySelector(".page");
    var actions = document.querySelector(".actions");
    el = document.createElement("div");
    el.id = "test-root";
    el.className = "test-root";
    el.setAttribute("role", "main");
    if (page && actions && actions.parentNode === page) {
      page.insertBefore(el, actions);
    } else if (page) {
      page.appendChild(el);
    } else {
      document.body.appendChild(el);
    }
    return el;
  }

  function renderReadingPassageHtml(rp) {
    if (!rp || !rp.paragraphs || !rp.paragraphs.length) return "";
    var title = rp.title ? "<h3>" + escapeHtml(rp.title) + "</h3>" : "";
    var instr = rp.instruction ? '<p class="instruction">' + escapeHtml(rp.instruction) + "</p>" : "";
    var ps = "";
    for (var pi = 0; pi < rp.paragraphs.length; pi += 1) {
      ps += "<p>" + escapeHtml(rp.paragraphs[pi]) + "</p>";
    }
    return (
      '<article class="exercise reading-passage">' +
      title +
      instr +
      '<div class="passage" lang="en">' +
      ps +
      "</div></article>"
    );
  }

  function renderTest() {
    var root = ensureTestRoot();
    root.replaceChildren();

    for (var pi = 0; pi < TEST_BLUEPRINT.length; pi += 1) {
      var part = TEST_BLUEPRINT[pi];
      var partEl = document.createElement("section");
      partEl.className = "part";
      partEl.innerHTML = '<h2 class="part-title">' + escapeHtml(part.title) + "</h2>";
      root.appendChild(partEl);

      for (var ei = 0; ei < part.exercises.length; ei += 1) {
        var ex = part.exercises[ei];
        if (ex.readingPassage) {
          partEl.insertAdjacentHTML("beforeend", renderReadingPassageHtml(ex.readingPassage));
        }

        var exEl = document.createElement("article");
        exEl.className = "exercise";

        var html = "<h3>" + escapeHtml(ex.title) + "</h3>";
        if (ex.instruction) {
          html += '<p class="instruction">' + escapeHtml(ex.instruction) + "</p>";
        }
        if (ex.audio) {
          html +=
            '<div class="audio-block"><audio controls preload="none"></audio><p class="audio-hint">Аудиофайл будет добавлен позже.</p></div>';
        }
        exEl.innerHTML = html;

        var inputKind = ex.inputKind || "radio";

        for (var qi = 0; qi < ex.questions.length; qi += 1) {
          var q = ex.questions[qi];
          var num = 0;
          for (var fi = 0; fi < FLAT_QUESTIONS.length; fi += 1) {
            if (FLAT_QUESTIONS[fi].q.id === q.id) {
              num = FLAT_QUESTIONS[fi].serial;
              break;
            }
          }

          var qEl = document.createElement("div");
          qEl.className = "question";
          qEl.dataset.qid = q.id;

          var inner = '<div class="question-id">Вопрос ' + num + "</div>";
          inner += '<p class="question-prompt">' + escapeHtml(q.prompt) + "</p>";
          qEl.innerHTML = inner;

          if (inputKind === "wordOrder") {
            renderWordOrderQuestion(qEl, q);
          } else if (inputKind === "gapFill") {
            renderGapFillQuestion(qEl, q);
          } else if (inputKind === "gapDrag") {
            renderGapDragQuestion(qEl, q);
          } else if (inputKind === "matchPairs") {
            renderMatchPairsQuestion(qEl, q);
          } else if (inputKind === "checkbox" && q.options) {
            renderCheckboxQuestion(qEl, q);
          } else if (inputKind === "select" && q.options) {
            var selId = "answer_select_" + q.id;
            var sel =
              '<label class="select-wrap" for="' +
              escapeHtml(selId) +
              '"><span class="visually-hidden">Ответ</span>';
            sel +=
              '<select class="answer-select" id="' +
              escapeHtml(selId) +
              '" name="answer_' +
              escapeHtml(q.id) +
              '">';
            sel += '<option value="">— выберите —</option>';
            for (var oi = 0; oi < q.options.length; oi += 1) {
              var opt = q.options[oi];
              sel +=
                '<option value="' +
                escapeHtml(opt.key) +
                '">' +
                escapeHtml(optionCaption(opt.key, opt.text)) +
                "</option>";
            }
            sel += "</select></label>";
            var holder = document.createElement("div");
            holder.className = "options";
            holder.innerHTML = sel;
            qEl.appendChild(holder);
          } else if (q.options) {
            var groupName = "answer_" + q.id;
            var opts = document.createElement("div");
            opts.className = "options";
            var radioHtml = "";
            for (var oj = 0; oj < q.options.length; oj += 1) {
              var op = q.options[oj];
              var inputId = q.id + "_" + op.key;
              radioHtml += '<label class="option" for="' + escapeHtml(inputId) + '">';
              radioHtml +=
                '<input type="radio" name="' +
                escapeHtml(groupName) +
                '" id="' +
                escapeHtml(inputId) +
                '" value="' +
                escapeHtml(op.key) +
                '" />';
              radioHtml += "<span>" + escapeHtml(optionCaption(op.key, op.text)) + "</span>";
              radioHtml += "</label>";
            }
            opts.innerHTML = radioHtml;
            qEl.appendChild(opts);
          }

          exEl.appendChild(qEl);
        }

        partEl.appendChild(exEl);
      }
    }
  }

  function collectAnswers() {
    var out = {};
    for (var i = 0; i < FLAT_QUESTIONS.length; i += 1) {
      var item = FLAT_QUESTIONS[i];
      var q = item.q;
      var inputKind = item.inputKind;
      if (inputKind === "wordOrder") {
        out[q.id] = wordOrderState[q.id] ? wordOrderState[q.id].answer.slice() : [];
        continue;
      }
      if (inputKind === "gapDrag") {
        var hiddenGap = document.getElementById("gd_hidden_" + q.id);
        out[q.id] = hiddenGap && hiddenGap.value ? hiddenGap.value : "";
        continue;
      }
      if (inputKind === "gapFill") {
        var hiddenFill = document.getElementById("gf_hidden_" + q.id);
        out[q.id] = hiddenFill && hiddenFill.value ? hiddenFill.value : "";
        continue;
      }
      if (inputKind === "matchPairs") {
        var hiddenMp = document.getElementById("mp_hidden_" + q.id);
        out[q.id] = hiddenMp && hiddenMp.value ? hiddenMp.value : "";
        continue;
      }
      if (inputKind === "checkbox") {
        var cbs = document.querySelectorAll('input[name="answer_cb_' + q.id + '"]:checked');
        var keyList = [];
        for (var cbi = 0; cbi < cbs.length; cbi += 1) {
          keyList.push(cbs[cbi].value);
        }
        keyList.sort();
        out[q.id] = keyList.join(",");
        continue;
      }
      if (inputKind === "select") {
        var sel = document.getElementById("answer_select_" + q.id);
        out[q.id] = sel && sel.value ? sel.value : "";
        continue;
      }
      var group = document.querySelector('input[name="answer_' + q.id + '"]:checked');
      out[q.id] = group ? group.value : "";
    }
    return out;
  }

  function gradeAnswers(answers) {
    var score = 0;
    var rows = [];
    for (var i = 0; i < FLAT_QUESTIONS.length; i += 1) {
      var item = FLAT_QUESTIONS[i];
      var q = item.q;
      var raw = answers[q.id];
      var chosen =
        item.inputKind === "wordOrder"
          ? Array.isArray(raw)
            ? raw.join(" ")
            : ""
          : item.inputKind === "gapDrag" || item.inputKind === "gapFill" || item.inputKind === "matchPairs"
            ? typeof raw === "string"
              ? raw
              : ""
            : item.inputKind === "checkbox"
              ? typeof raw === "string"
                ? raw
                : ""
              : typeof raw === "string"
                ? raw
                : "";
      var emptyAnswer =
        item.inputKind === "wordOrder"
          ? !Array.isArray(raw) || raw.length === 0
          : item.inputKind === "gapDrag" || item.inputKind === "gapFill"
            ? gapStudentAnswerLooksEmpty(q, typeof raw === "string" ? raw : "")
            : item.inputKind === "matchPairs"
              ? matchPairsAnswerLooksEmpty(
                  typeof raw === "string" ? raw : "",
                  (q.matchLeftItems || []).length,
                )
              : item.inputKind === "checkbox"
                ? !String(chosen).trim()
                : chosen === "";
      var ok = isAnswerCorrect(item, chosen);
      if (ok) score += 1;
      var correctLine = correctAnswerDisplay(item);
      var studentLine = emptyAnswer
        ? "(нет ответа) ❌"
        : studentAnswerDisplay(item, chosen) + (ok ? " ✅" : " ❌");
      rows.push({
        serial: item.serial,
        qid: q.id,
        correctLine: correctLine,
        studentLine: studentLine,
        ok: ok,
      });
    }
    return { score: score, rows: rows, max: FLAT_QUESTIONS.length };
  }

  function highlightResults(result) {
    for (var ri = 0; ri < result.rows.length; ri += 1) {
      var row = result.rows[ri];
      var el = document.querySelector('.question[data-qid="' + row.qid + '"]');
      if (!el) continue;
      el.classList.remove("question-correct", "question-incorrect");
      if (row.ok) el.classList.add("question-correct");
      else el.classList.add("question-incorrect");
    }
  }

  function sendResultsToTelegram(studentName, result) {
    var meta = window.__LESSON_META__;
    if (!meta || !meta.lessonId) return;

    fetch("/api/lessons/" + encodeURIComponent(meta.lessonId) + "/submit-results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        studentName: studentName,
        score: result.score,
        max: result.max,
        rows: result.rows.map(function (row) {
          return {
            serial: row.serial,
            ok: row.ok,
            studentLine: row.studentLine,
            correctLine: row.correctLine,
          };
        }),
      }),
    }).catch(function (error) {
      console.warn("[lesson-test] telegram submit failed", error);
    });
  }

  function lockTest() {
    document.body.classList.add("test-locked");
    var nodes = document.querySelectorAll(
      '#test-root input[type="radio"], #test-root input[type="checkbox"], #test-root input[type="text"], #test-root input[type="hidden"], #test-root select, #student-name, #finish-btn',
    );
    for (var i = 0; i < nodes.length; i += 1) {
      nodes[i].setAttribute("disabled", "disabled");
    }
    var chips = document.querySelectorAll(".wo-chip");
    for (var j = 0; j < chips.length; j += 1) {
      chips[j].setAttribute("disabled", "disabled");
      chips[j].removeAttribute("draggable");
    }
  }

  function init() {
    console.log("[lesson-test] init, questions:", FLAT_QUESTIONS.length);
    try {
      suppressSave = true;
      renderTest();
      applyFormState(loadFormState());
      bindAutosave();
      suppressSave = false;
      console.log("[lesson-test] render complete");
    } catch (err) {
      var root = ensureTestRoot();
      var msg = err instanceof Error ? err.message : String(err);
      root.innerHTML =
        '<p class="init-error">Не удалось построить тест: ' +
        escapeHtml(msg) +
        ". Откройте консоль браузера (F12) для подробностей.</p>";
      console.error(err);
      return;
    }

    var btn = document.getElementById("finish-btn");
    var nameInput = document.getElementById("student-name");
    var panel = document.getElementById("result-panel");
    var scoreLine = document.getElementById("score-line");

    if (!btn) {
      console.error("[lesson-test] missing #finish-btn");
      return;
    }

    btn.addEventListener("click", function () {
      var studentName = (nameInput && nameInput.value.trim()) || "";
      if (!studentName) {
        alert("Введите ФИО в начале страницы.");
        if (nameInput) nameInput.focus();
        return;
      }

      var answers = collectAnswers();
      console.log("[lesson-test] grading, answer keys:", Object.keys(answers).length);
      var result = gradeAnswers(answers);
      console.log("[lesson-test] score", result.score, "/", result.max);
      highlightResults(result);
      saveFormState();

      if (scoreLine) {
        scoreLine.textContent = "Набрано баллов: " + result.score + " из " + result.max;
      }
      if (panel) panel.classList.add("visible");
      console.log("[lesson-test] finish, results shown for", studentName);

      sendResultsToTelegram(studentName, result);

      lockTest();
      saveFormState();
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
