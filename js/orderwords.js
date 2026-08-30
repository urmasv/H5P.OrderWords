(function (H5P) {
  'use strict';

  var DEFAULT_L10N = {
    checkAnswer: 'Check',
    tryAgain: 'Try again',
    correctFeedback: 'Everything is correct!',
    yourResult: 'Result: @score / @max',
    correctText: 'Correct: @count',
    wrongText: 'Wrong: @count',
    missingCountText: 'Missing: @count',
    emptyContent: 'The author has not added any text.',
    solutionPrefix: 'Correct answer:',
    selectPlaceholder: 'choose...',
    emptyGap: 'empty',
    gapLabel: 'Answer field @num',
    extraText: 'Extra text',
    missingText: 'Missing text',
    poolLabel: 'Word bank',
    slotLabel: 'Word slot @num',
    sentenceLabel: 'Sentence @num',
    addWord: 'Add word to the answer',
    removeWord: 'Remove word from the answer'
  };

  var DEFAULTS = {
    taskDescription: 'Paiguta sõnad õigesse kohta.',
    correctText: 'Täna on ilus päev.',
    mode: 'order',
    scoreMode: 'position',
    extraOptions: '',
    dropdownOptionsMode: 'some',
    dropdownOptionCount: 4,
    dragOptionsPosition: 'bottom',
    gapInputWidthMode: 'byAnswer',
    behaviour: {
      delimiters: '[]',
      optionSeparator: '|',
      caseSensitive: true,
      shuffleOptions: true,
      scoreMode: 'position',
      gapInputWidthMode: 'byAnswer',
      enableRetry: true,
      showCorrectTextAfterCheck: true,
      showMissingAnswers: true
    },
    l10n: DEFAULT_L10N
  };

  function OrderWords(params, contentId, extras) {
    var self = this;

    H5P.EventDispatcher.call(self);

    var rawParams = params || {};
    var rawBehaviour = rawParams.behaviour || {};

    self.params = mergeDeep({}, DEFAULTS, rawParams);
    self.params.behaviour = mergeDeep({}, DEFAULTS.behaviour, rawBehaviour);
    self.params.behaviour.caseSensitive = true;
    self.params.l10n = mergeDeep({}, DEFAULT_L10N, rawParams.l10n || {});

    self.mode = resolveMode(self.params);

    self.contentId = contentId;
    self.extras = extras || {};
    self.container = null;
    self.wrapper = null;
    self.correct = null;
    self.sentences = [];
    self.checked = false;
    self.answerGiven = false;
    self.score = 0;
    self.maxScore = 0;
    self.lastResult = null;
    self.selectedDragText = null;
    self.draggedToken = null;
    self.selectedToken = null;
    self.solutionElement = null;
  }

  OrderWords.prototype = Object.create(H5P.EventDispatcher.prototype);
  OrderWords.prototype.constructor = OrderWords;

  OrderWords.prototype.attach = function ($container) {
    var self = this;
    var container = getDomElement($container);

    self.container = container;
    self.mode = resolveMode(self.params);

    if (isGapMode(self)) {
      self.correct = parseMarkedText(self, self.params.correctText || '');
      self.sentences = [];
    }
    else {
      self.correct = null;
      self.sentences = parseOrderSentences(self, self.params.correctText || '');
    }

    self.checked = false;
    self.answerGiven = false;
    self.score = 0;
    self.maxScore = calculateMaxScore(self);
    self.lastResult = null;
    self.selectedDragText = null;
    self.draggedToken = null;
    self.selectedToken = null;
    self.solutionElement = null;

    container.innerHTML = '';
    container.className += ' h5p-order-words-container';

    self.wrapper = document.createElement('div');
    self.wrapper.className = 'h5p-order-words h5p-order-words-mode-' + self.mode;
    container.appendChild(self.wrapper);

    render(self);
    self.triggerResize();
  };

  OrderWords.prototype.getAnswerGiven = function () {
    return !!this.answerGiven;
  };

  OrderWords.prototype.getScore = function () {
    return this.score || 0;
  };

  OrderWords.prototype.getMaxScore = function () {
    return this.maxScore || calculateMaxScore(this);
  };

  OrderWords.prototype.resetTask = function () {
    this.checked = false;
    this.answerGiven = false;
    this.score = 0;
    this.lastResult = null;
    this.selectedDragText = null;
    this.draggedToken = null;
    this.selectedToken = null;
    this.solutionElement = null;
    render(this);
    this.triggerResize();
  };

  OrderWords.prototype.showSolutions = function () {
    var result;

    if (!this.wrapper) {
      return;
    }

    result = evaluate(this);
    showCorrectAnswersInTask(this);
    showSolution(this);
    lockResponseArea(this, true);
    updateControls(this);
    this.score = result.maxScore;
    this.lastResult = {
      score: result.maxScore,
      maxScore: result.maxScore,
      success: true
    };
    triggerMathDisplay(this);
    this.triggerResize();
  };

  OrderWords.prototype.getXAPIData = function () {
    var event = this.getXAPIAnswerEvent();

    return event ? {
      statement: event.data.statement
    } : null;
  };

  OrderWords.prototype.getXAPIAnswerEvent = function (result) {
    var event;
    var statementResult;

    result = result || this.lastResult || evaluate(this);
    event = this.createXAPIEvent('answered');

    if (!event || !event.data || !event.data.statement) {
      return null;
    }

    if (typeof event.setScoredResult === 'function') {
      event.setScoredResult(result.score, result.maxScore, this, true, result.success);
    }

    statementResult = event.data.statement.result = event.data.statement.result || {};
    statementResult.response = this.getXAPIResponse();
    statementResult.completion = true;
    statementResult.success = !!result.success;
    statementResult.score = statementResult.score || {};
    statementResult.score.raw = result.score;
    statementResult.score.max = result.maxScore;
    statementResult.score.min = 0;
    statementResult.score.scaled = result.maxScore > 0 ? result.score / result.maxScore : 0;

    return event;
  };

  OrderWords.prototype.createXAPIEvent = function (verb) {
    var event;
    var definition;

    if (typeof this.createXAPIEventTemplate === 'function') {
      event = this.createXAPIEventTemplate(verb);
    }
    else if (H5P.XAPIEvent) {
      event = new H5P.XAPIEvent(verb);
    }

    if (!event || !event.data || !event.data.statement) {
      return null;
    }

    if (typeof event.getVerifiedStatementValue === 'function') {
      definition = event.getVerifiedStatementValue(['object', 'definition']);
    }
    else {
      event.data.statement.object = event.data.statement.object || {};
      definition = event.data.statement.object.definition = event.data.statement.object.definition || {};
    }

    extendObject(definition, this.getxAPIDefinition());

    return event;
  };

  OrderWords.prototype.getxAPIDefinition = function () {
    var languageTag = this.getLanguageTag();
    var definition = {
      name: {},
      description: {},
      type: 'http://adlnet.gov/expapi/activities/cmi.interaction',
      interactionType: 'fill-in',
      correctResponsesPattern: this.getXAPICorrectResponsesPattern()
    };

    definition.name[languageTag] = this.getTitle();
    definition.name['en-US'] = definition.name[languageTag];
    definition.description[languageTag] = this.getDescription();
    definition.description['en-US'] = definition.description[languageTag];

    return definition;
  };

  OrderWords.prototype.getXAPIResponse = function () {
    if (isGapMode(this)) {
      return this.getXAPIGapResponse();
    }
    return this.getXAPIOrderResponse();
  };

  OrderWords.prototype.getXAPIGapResponse = function () {
    var values = this.lastResult && this.lastResult.gapValues
      ? this.lastResult.gapValues
      : (this.wrapper ? getGapResponses(this) : []);
    var gapIndex = 0;
    var output = '';

    if (!this.correct || !this.correct.segments) {
      return '';
    }

    this.correct.segments.forEach(function (segment) {
      if (segment.type === 'text') {
        output += segment.text;
      }
      else {
        output += values[gapIndex] || '';
        gapIndex++;
      }
    });

    return output;
  };

  OrderWords.prototype.getXAPIOrderResponse = function () {
    var responses = this.lastResult && this.lastResult.orderValues
      ? this.lastResult.orderValues
      : (this.wrapper ? getOrderResponses(this) : []);

    return (this.sentences || []).map(function (sentence, sentenceIndex) {
      var slotIndex = 0;
      var values = responses[sentenceIndex] || [];
      var output = '';

      (sentence.segments || []).forEach(function (segment) {
        if (segment.type === 'static') {
          output += segment.text;
        }
        else {
          output += values[slotIndex] || '';
          slotIndex++;
        }
      });

      return output;
    }).join('\n');
  };

  OrderWords.prototype.getXAPICorrectResponsesPattern = function () {
    if (isGapMode(this)) {
      return buildGapCorrectResponses(this);
    }
    return buildOrderCorrectResponses(this);
  };

  OrderWords.prototype.getTitle = function () {
    var metadata = this.extras && this.extras.metadata;
    var title = metadata && metadata.title ? metadata.title : 'Paiguta sõnad';

    return H5P.createTitle ? H5P.createTitle(title) : title;
  };

  OrderWords.prototype.getDescription = function () {
    var description = stripTags(this.params.taskDescription || '').replace(/\s+/g, ' ').trim();

    return description || this.getTitle();
  };

  OrderWords.prototype.getLanguageTag = function () {
    var metadata = this.extras && this.extras.metadata;
    var language = (metadata && (metadata.defaultLanguage || metadata.language)) || 'et';
    var parts = String(language).replace('_', '-').split('-');

    if (!parts[0]) {
      return 'et';
    }

    parts[0] = parts[0].toLowerCase();
    if (parts[1]) {
      parts[1] = parts[1].toUpperCase();
    }

    return parts.length === 1 ? parts[0] : parts.join('-');
  };

  OrderWords.prototype.emitXAPIResult = function (result) {
    var event;

    try {
      event = this.getXAPIAnswerEvent(result);
      if (event) {
        this.trigger(event);
      }
    }
    catch (e) {
      // Older H5P integrations may not expose all xAPI helpers for custom libraries.
    }
  };

  OrderWords.prototype.triggerAnswered = function (score, maxScore) {
    this.emitXAPIResult({
      score: score,
      maxScore: maxScore,
      wrong: Math.max(0, maxScore - score),
      success: score === maxScore
    });
  };

  OrderWords.prototype.triggerResize = function () {
    if (typeof this.trigger === 'function') {
      this.trigger('resize');
    }
  };

  /*
   * Annab H5P.MathDisplayle (MathJax) märku, et see töötaks renderdatud/muutunud
   * sisu üle ning renderdaks matemaatika- ja keemiavalemid (LaTeX, nt \(x^2\),
   * $$...$$, \[...\], ning keemia \ce{...} kui mhchem on lubatud).
   * Uus MathDisplay (MathJax 3) tuvastab sisu küll ise globaalse vaatlejaga, kuid
   * vanem MathDisplay (MathJax 2) sõltub just sellest domChanged-sündmusest, et
   * dünaamiliselt lisatud/avatud sisu (laused, märksõnad, lahendus) üle töötada.
   */
  function triggerMathDisplay(self) {
    if (!self || typeof self.trigger !== 'function' || !self.wrapper) {
      return;
    }
    var target = (typeof H5P !== 'undefined' && H5P.jQuery) ? H5P.jQuery(self.wrapper) : self.wrapper;
    self.trigger('domChanged', {
      $target: target,
      library: 'H5P.OrderWords',
      key: 'render'
    }, { bubbles: true, external: true });
  }

  function isGapMode(self) {
    return self.mode !== 'order';
  }

  function resolveMode(params) {
    var mode = unwrapSettingValue(params ? params.mode : null, 'drag');
    if (mode === 'input' || mode === 'dropdown') {
      return mode;
    }
    if (mode === 'drag') {
      var scope = unwrapSettingValue(params ? params.dragScope : null, 'all');
      return scope === 'marked' ? 'dragdrop' : 'order';
    }
    // Backward compatibility with earlier content
    if (mode === 'dragdrop') {
      return 'dragdrop';
    }
    if (mode === 'order' || mode === 'click') {
      return 'order';
    }
    return 'order';
  }

  function render(self) {
    self.wrapper.innerHTML = '';
    self.wrapper.className = 'h5p-order-words h5p-order-words-mode-' + self.mode;

    if (isContentEmpty(self)) {
      renderEmpty(self);
      return;
    }

    renderTaskDescription(self);
    renderTask(self);
    renderControls(self);
    renderFeedbackElement(self);
    updateControls(self);
    triggerMathDisplay(self);
  }

  function isContentEmpty(self) {
    if (isGapMode(self)) {
      return isEmptyText(self.params.correctText);
    }
    return !self.sentences.length;
  }

  function renderEmpty(self) {
    var empty = document.createElement('div');
    empty.className = 'h5p-order-words-empty';
    empty.textContent = self.params.l10n.emptyContent;
    self.wrapper.appendChild(empty);
  }

  function renderTaskDescription(self) {
    var task;

    if (!self.params.taskDescription) {
      return;
    }

    task = document.createElement('div');
    task.className = 'h5p-order-words-task';
    task.innerHTML = self.params.taskDescription;
    self.wrapper.appendChild(task);
  }

  function renderTask(self) {
    var task = document.createElement('div');
    task.className = 'h5p-order-words-answer-area';

    // Üldpilt ("Lisa pilt") kuulub ainult lünkade režiimidesse. Režiimis
    // "Lohista lünkadesse -> Kogu tekst" kasutatakse hoopis ridade pilte,
    // seega üldpilti seal kunagi ei kuvata.
    var imageEl = isGapMode(self) ? buildImageElement(self, self.params.image) : null;
    var contentTarget = task;

    if (imageEl) {
      // Pilt asub .h5p-order-words-area-content SEES (selle esimese lapsena),
      // tekstisisu aga .h5p-order-words-area-body sees. See peegeldab ridade
      // piltide struktuuri (pilt + sisublokk ühe paigutuskasti sees).
      var areaContent = document.createElement('div');
      areaContent.className = 'h5p-order-words-area-content h5p-order-words-image-layout h5p-order-words-image-' + getImagePosition(self.params.image);
      areaContent.appendChild(imageEl);

      contentTarget = document.createElement('div');
      contentTarget.className = 'h5p-order-words-area-body';
      areaContent.appendChild(contentTarget);

      task.appendChild(areaContent);
    }

    if (isGapMode(self)) {
      renderGapTask(self, contentTarget);
    }
    else {
      self.sentences.forEach(function (sentence, index) {
        if (index > 0) {
          var separator = document.createElement('hr');
          separator.className = 'h5p-order-words-sentence-separator';
          separator.setAttribute('aria-hidden', 'true');
          contentTarget.appendChild(separator);
        }
        renderOrderSentence(self, contentTarget, sentence, index);
      });
    }

    renderSolutionElement(self, contentTarget);
    self.wrapper.appendChild(task);
  }

  /* ===================== Image helpers ===================== */

  function getImagePosition(imageParams) {
    return (imageParams && unwrapSettingValue(imageParams.position, 'above') === 'left') ? 'left' : 'above';
  }

  function getLineImage(self, lineIndex) {
    var list = self.params ? self.params.lineImages : null;
    if (!Array.isArray(list)) {
      return null;
    }
    return list[lineIndex] || null;
  }

  function buildImageElement(self, imageParams) {
    if (!imageParams) {
      return null;
    }

    var src = '';
    var file = imageParams.file;
    if (file && file.path) {
      src = H5P.getPath(file.path, self.contentId);
    }
    else if (imageParams.url) {
      src = trim(imageParams.url);
    }

    if (!src) {
      return null;
    }

    var wrap = document.createElement('div');
    wrap.className = 'h5p-order-words-image';

    var img = document.createElement('img');
    img.src = src;
    if (imageParams.alt) {
      img.setAttribute('alt', String(imageParams.alt));
    }
    else {
      img.setAttribute('alt', '');
      img.setAttribute('aria-hidden', 'true');
    }

    var width = parseFloat(unwrapSettingValue(imageParams.width, ''));
    if (isFinite(width) && width > 0) {
      var widthMode = unwrapSettingValue(imageParams.widthMode, 'percent');
      wrap.style.width = width + (widthMode === 'px' ? 'px' : '%');
      img.style.width = '100%';
    }

    img.addEventListener('load', function () {
      self.triggerResize();
    });

    wrap.appendChild(img);
    return wrap;
  }

  /* ===================== Gap modes (Gapfill heritage) ===================== */

  function renderGapTask(self, task) {
    var line = document.createElement('div');
    var distractors = getExtraOptions(self);
    var position = getDragOptionsPosition(self);
    var gapIndex = 0;
    var i;

    line.className = 'h5p-order-words-gap-line';
    line.setAttribute('dir', 'auto');

    if (self.mode === 'dragdrop' && (position === 'top' || position === 'both')) {
      task.appendChild(renderDragOptions(self, distractors, 'top'));
    }

    for (i = 0; i < self.correct.segments.length; i++) {
      var segment = self.correct.segments[i];
      if (segment.type === 'text') {
        appendText(line, segment.text, 'span', 'h5p-order-words-text-part');
      }
      else {
        renderGapElement(self, line, segment, gapIndex, distractors);
        gapIndex++;
      }
    }

    task.appendChild(line);

    if (self.mode === 'dragdrop' && (position === 'bottom' || position === 'both')) {
      task.appendChild(renderDragOptions(self, distractors, 'bottom'));
    }
  }

  function renderGapElement(self, line, segment, gapIndex, distractors) {
    var wrap = document.createElement('span');
    wrap.className = 'h5p-order-words-gap-wrap';
    wrap.setAttribute('data-index', String(gapIndex));

    if (self.mode === 'input') {
      var input = document.createElement('input');
      input.type = 'text';
      input.className = 'h5p-order-words-gap h5p-order-words-gap-input';
      input.setAttribute('data-index', String(gapIndex));
      input.setAttribute('autocomplete', 'off');
      input.setAttribute('autocapitalize', 'off');
      input.setAttribute('spellcheck', 'false');
      input.setAttribute('placeholder', ' ');
      input.setAttribute('aria-label', getGapLabel(self, gapIndex));
      setInputGapWidth(self, input, segment);
      input.addEventListener('input', function () {
        self.answerGiven = hasAnyGapAnswer(self);
        updateControls(self);
      });
      wrap.appendChild(input);
    }
    else if (self.mode === 'dropdown') {
      var select = document.createElement('select');
      var options = getDropdownOptions(self, segment, distractors);
      var opt;

      select.className = 'h5p-order-words-gap h5p-order-words-gap-select';
      select.setAttribute('data-index', String(gapIndex));
      select.setAttribute('aria-label', getGapLabel(self, gapIndex));

      opt = document.createElement('option');
      opt.value = '';
      opt.className = 'h5p-order-words-select-placeholder-option';
      opt.textContent = self.params.l10n.selectPlaceholder;
      select.appendChild(opt);
      updateSelectPlaceholderClass(select);

      options.forEach(function (option) {
        var item = document.createElement('option');
        item.value = option;
        item.textContent = option === '' ? self.params.l10n.emptyGap : option;
        select.appendChild(item);
      });

      select.addEventListener('change', function () {
        updateSelectPlaceholderClass(select);
        self.answerGiven = hasAnyGapAnswer(self);
        updateControls(self);
      });
      wrap.appendChild(select);
    }
    else if (self.mode === 'dragdrop') {
      var dropzone = document.createElement('span');
      dropzone.className = 'h5p-order-words-gap h5p-order-words-dropzone';
      dropzone.tabIndex = 0;
      dropzone.setAttribute('role', 'button');
      dropzone.setAttribute('data-index', String(gapIndex));
      dropzone.setAttribute('aria-label', getGapLabel(self, gapIndex));
      setDropzoneGapWidth(self, dropzone, segment);

      dropzone.addEventListener('dragover', function (event) {
        if (self.checked) {
          return;
        }
        event.preventDefault();
        dropzone.classList.add('h5p-order-words-drop-hover');
      });
      dropzone.addEventListener('dragleave', function () {
        dropzone.classList.remove('h5p-order-words-drop-hover');
      });
      dropzone.addEventListener('drop', function (event) {
        if (self.checked) {
          return;
        }
        event.preventDefault();
        dropzone.classList.remove('h5p-order-words-drop-hover');
        setDropzoneValue(self, dropzone, event.dataTransfer.getData('text/plain'));
      });
      dropzone.addEventListener('click', function () {
        if (!self.checked && self.selectedDragText !== null) {
          setDropzoneValue(self, dropzone, self.selectedDragText);
        }
      });
      dropzone.addEventListener('keydown', function (event) {
        if ((event.key === 'Enter' || event.key === ' ') && !self.checked && self.selectedDragText !== null) {
          setDropzoneValue(self, dropzone, self.selectedDragText);
          event.preventDefault();
        }
      });
      dropzone.addEventListener('dblclick', function () {
        if (!self.checked) {
          setDropzoneValue(self, dropzone, '');
        }
      });
      wrap.appendChild(dropzone);
    }

    line.appendChild(wrap);
  }

  function renderDragOptions(self, distractors, position) {
    var pool = [];
    var dragArea = document.createElement('div');
    var tokens = document.createElement('div');

    self.correct.gaps.forEach(function (gap) {
      (gap.answers || []).forEach(function (answer) {
        if (answer !== '') {
          pool.push(answer);
        }
      });
    });
    pool = uniqueOptions(self, pool.concat(cleanVisibleOptions(distractors)));
    if (self.params.behaviour.shuffleOptions) {
      pool = shuffle(pool);
    }

    dragArea.className = 'h5p-order-words-drag-area h5p-order-words-drag-area-' + (position || 'bottom');
    tokens.className = 'h5p-order-words-drag-tokens';

    pool.forEach(function (answer) {
      var token = document.createElement('button');
      token.type = 'button';
      token.className = 'h5p-order-words-token';
      token.draggable = true;
      token.textContent = answer;
      token.addEventListener('dragstart', function (event) {
        if (self.checked) {
          event.preventDefault();
          return;
        }
        self.selectedDragText = answer;
        event.dataTransfer.setData('text/plain', answer);
      });
      token.addEventListener('click', function () {
        if (self.checked) {
          return;
        }
        self.selectedDragText = answer;
        Array.prototype.forEach.call(self.wrapper.querySelectorAll('.h5p-order-words-token'), function (button) {
          button.classList.remove('h5p-order-words-token-selected');
        });
        token.classList.add('h5p-order-words-token-selected');
      });
      tokens.appendChild(token);
    });

    dragArea.appendChild(tokens);
    return dragArea;
  }

  function evaluateGaps(self) {
    var values = getGapResponses(self);
    var score = 0;
    var maxScore = self.correct.gaps.length;
    var missing = 0;
    var incorrect = 0;

    values.forEach(function (value, index) {
      var correct = isCorrectAnswer(self, value, self.correct.gaps[index].answers);
      if (correct) {
        score++;
      }
      else if (trim(value) === '') {
        missing++;
      }
      else {
        incorrect++;
      }
    });

    maxScore = Math.max(maxScore, 1);

    return {
      score: score,
      maxScore: maxScore,
      success: score === maxScore,
      gapValues: values,
      details: {
        correct: score,
        incorrect: incorrect,
        missing: missing,
        extra: 0
      }
    };
  }

  function renderEvaluatedGaps(self) {
    var gaps = self.wrapper.querySelectorAll('.h5p-order-words-gap');

    Array.prototype.forEach.call(gaps, function (gap) {
      var index = parseInt(gap.getAttribute('data-index'), 10);
      var value = getGapValue(gap);
      var correct = isCorrectAnswer(self, value, self.correct.gaps[index].answers);
      var missing = trim(value) === '';

      replaceEvaluatedGapElement(self, gap, index, value, correct, missing);
    });

    clearGapDragOptions(self);
  }

  function replaceEvaluatedGapElement(self, gap, index, value, correct, missing) {
    var expected = firstVisibleAnswer(self.correct.gaps[index].answers);
    var replacement = createCheckedAnswerDisplay(self, value, expected, correct, missing, self.correct.gaps[index]);

    // Unanswered cell + missing answers hidden: neutral empty cell sized to the word,
    // with no placeholder text and no dropdown arrow/select/input/dropzone left behind.
    if (!correct && missing && !getShowMissingAnswers(self)) {
      replacement = createMissingBlank(self, getGapWidthChars(self, self.correct.gaps[index]));
    }

    if (gap.parentNode) {
      gap.parentNode.replaceChild(replacement, gap);
    }
  }

  function createCheckedAnswerDisplay(self, value, expected, correct, missing, segment) {
    var replacement = document.createElement('span');
    var displayText;

    replacement.setAttribute('dir', 'auto');

    if (correct) {
      displayText = value || expected;
      replacement.className = 'h5p-order-words-gap h5p-order-words-gap-select h5p-order-words-gap-select-result h5p-order-words-checked-gap-cell h5p-order-words-select-correct';
      replacement.textContent = displayText;
      setCheckedGapCellWidth(self, replacement, segment, value);
      return replacement;
    }

    displayText = missing ? expected : value;
    if (displayText === '') {
      displayText = self.params.l10n.emptyGap || '';
    }

    replacement.className = 'h5p-order-words-gap h5p-order-words-gap-select h5p-order-words-gap-select-result h5p-order-words-checked-gap-cell ' +
      (missing ? 'h5p-order-words-select-missing' : 'h5p-order-words-select-wrong');
    replacement.textContent = displayText;
    setCheckedGapCellWidth(self, replacement, segment, value);

    return replacement;
  }

  function clearGapDragOptions(self) {
    Array.prototype.forEach.call(self.wrapper.querySelectorAll('.h5p-order-words-drag-area'), function (area) {
      area.innerHTML = '';
      area.hidden = true;
    });
  }

  function showCorrectGapAnswers(self) {
    Array.prototype.forEach.call(self.wrapper.querySelectorAll('.h5p-order-words-gap'), function (gap) {
      var index = parseInt(gap.getAttribute('data-index'), 10);
      var answer = firstVisibleAnswer(self.correct.gaps[index].answers);
      if (gap.tagName.toLowerCase() === 'input' || gap.tagName.toLowerCase() === 'select') {
        gap.value = answer;
        if (gap.tagName.toLowerCase() === 'select') {
          ensureSelectOption(gap, answer, answer === '' ? self.params.l10n.emptyGap : answer);
          gap.value = answer;
          updateSelectPlaceholderClass(gap);
        }
      }
      else {
        gap.textContent = answer;
      }
      gap.classList.add('h5p-order-words-correct');
    });
  }

  function getGapResponses(self) {
    var values = [];
    Array.prototype.forEach.call(self.wrapper.querySelectorAll('.h5p-order-words-gap'), function (gap) {
      values.push(getGapValue(gap));
    });
    return values;
  }

  function getGapValue(gap) {
    var tag = gap.tagName.toLowerCase();
    if (tag === 'input' || tag === 'select') {
      return gap.value || '';
    }
    // Dropzone: loe salvestatud väärtust, mitte textContent'i. MathDisplay
    // (MathJax) kirjutab renderdatud teksti ümber (nt \(x^3\) -> "x3"), mis
    // muidu rikuks vastuse võrdluse ja kuvamise.
    if (gap.hasAttribute('data-value')) {
      return gap.getAttribute('data-value') || '';
    }
    return gap.textContent || '';
  }

  function setDropzoneValue(self, dropzone, value) {
    value = value || '';
    dropzone.textContent = value;
    dropzone.setAttribute('data-value', value);
    dropzone.classList.toggle('h5p-order-words-dropzone-filled', !!value);
    self.answerGiven = hasAnyGapAnswer(self);
    updateControls(self);
  }

  function hasAnyGapAnswer(self) {
    return getGapResponses(self).some(function (value) {
      return trim(value) !== '';
    });
  }

  function getDropdownOptions(self, segment, distractors) {
    var mode = unwrapSettingValue(self.params && self.params.dropdownOptionsMode, 'some');
    var fullPool = [];
    var options;

    (self.correct.gaps || []).forEach(function (gap) {
      fullPool = fullPool.concat(gap.answers || []);
    });
    fullPool = cleanVisibleOptions(uniqueOptions(self, fullPool.concat(distractors || [])));

    if (mode === 'all') {
      options = fullPool.slice(0);
    }
    else if (mode === 'some') {
      var required = cleanVisibleOptions(uniqueOptions(self, (segment && segment.answers) ? segment.answers : []));
      var requiredKeys = {};
      required.forEach(function (answer) {
        requiredKeys[normalise(self, answer)] = true;
      });
      var rest = fullPool.filter(function (answer) {
        return !requiredKeys[normalise(self, answer)];
      });
      var count = getDropdownOptionCount(self);
      var fillCount = Math.max(0, count - required.length);
      var fill = shuffle(rest).slice(0, fillCount);
      options = uniqueOptions(self, required.concat(fill));
    }
    else {
      // Legacy 'partial': only this gap's options plus distractors
      options = cleanVisibleOptions(uniqueOptions(self,
        ((segment && segment.answers) ? segment.answers : []).concat(distractors || [])));
    }

    if (self.params.behaviour.shuffleOptions) {
      options = shuffle(options);
    }

    return options;
  }

  function getDropdownOptionCount(self) {
    var raw = unwrapSettingValue(self.params && self.params.dropdownOptionCount, 4);
    var count = parseInt(raw, 10);
    if (isNaN(count) || count < 1) {
      count = 4;
    }
    return count;
  }

  function ensureSelectOption(select, value, label) {
    var exists = false;

    Array.prototype.forEach.call(select.options || [], function (option) {
      if (option.value === value) {
        exists = true;
      }
    });

    if (!exists) {
      var option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      select.appendChild(option);
    }
  }

  function updateSelectPlaceholderClass(select) {
    if (!select) {
      return;
    }
    select.classList.toggle('h5p-order-words-gap-select-placeholder', (select.value || '') === '');
  }

  function setInputGapWidth(self, input, segment) {
    var chars = getGapWidthChars(self, segment);
    input.setAttribute('size', String(chars));
    input.style.width = 'calc(' + chars + 'ch + 0.8em)';
  }

  function setDropzoneGapWidth(self, dropzone, segment) {
    var chars = getGapWidthChars(self, segment);
    dropzone.style.minWidth = 'calc(' + chars + 'ch + 0.8em)';
  }

  function getGapWidthChars(self, segment) {
    var mode = getGapInputWidthMode(self);
    var answers;
    var length;

    if (mode === 'uniform') {
      length = 0;
      (self.correct.gaps || []).forEach(function (gap) {
        length = Math.max(length, longestVisibleAnswerLength(gap.answers));
      });
    }
    else {
      answers = segment && segment.answers ? segment.answers : [];
      length = longestVisibleAnswerLength(answers);
    }

    return Math.max(4, Math.min(40, length || 4));
  }

  function setCheckedGapCellWidth(self, cell, segment, value) {
    var chars = getCheckedGapCellWidthChars(self, segment, value);
    cell.style.minWidth = 'calc(' + chars + 'ch + 0.8em)';
  }

  function getCheckedGapCellWidthChars(self, segment, value) {
    var expectedLength = longestVisibleAnswerLength(segment && segment.answers ? segment.answers : []);
    var valueLength = toChars(value || '').length;
    var length = Math.max(expectedLength, valueLength);

    return Math.max(4, Math.min(40, length || 4));
  }

  function longestVisibleAnswerLength(answers) {
    var length = 0;
    (answers || []).forEach(function (answer) {
      if (answer !== '') {
        length = Math.max(length, toChars(answer).length);
      }
    });
    return length;
  }

  function getGapLabel(self, index) {
    return (self.params.l10n.gapLabel || 'Answer field @num').replace('@num', String(index + 1));
  }

  function parseMarkedText(self, text) {
    text = decodeHtmlEntities(String(text || ''));
    var delimiters = getDelimiterPair(self);
    var open = delimiters.open;
    var close = delimiters.close;
    var segments = [];
    var gaps = [];
    var position = 0;

    while (position < text.length) {
      var start = text.indexOf(open, position);
      var mathSpan = findNextMathSpan(text, position);

      // Valem (\( \), \[ \], $$ $$) on läbipaistmatu staatiline tekst, mitte lünk.
      // Tuvasta see enne lünga-eraldajat, et \[ ... \] (ja nt \sqrt[3]{x}) ei
      // läheks segi lünga-eraldajaga [ ].
      if (mathSpan && (start === -1 || mathSpan.start <= start)) {
        pushTextSegment(segments, text.substring(position, mathSpan.end));
        position = mathSpan.end;
        continue;
      }

      if (start === -1) {
        pushTextSegment(segments, text.substring(position));
        break;
      }

      if (start > position) {
        pushTextSegment(segments, text.substring(position, start));
      }

      var end = text.indexOf(close, start + open.length);
      if (end === -1) {
        pushTextSegment(segments, text.substring(start));
        break;
      }

      var raw = text.substring(start + open.length, end);
      var gap = {
        type: 'gap',
        raw: raw,
        answers: parseAnswerOptions(self, raw)
      };
      segments.push(gap);
      gaps.push(gap);
      position = end + close.length;
    }

    return {segments: segments, gaps: gaps};
  }

  function pushTextSegment(segments, text) {
    if (!text) {
      return;
    }
    if (segments.length && segments[segments.length - 1].type === 'text') {
      segments[segments.length - 1].text += text;
    }
    else {
      segments.push({type: 'text', text: text});
    }
  }

  function parseAnswerOptions(self, raw) {
    var separator = getOptionSeparator(self);
    var parts = separator ? String(raw).split(separator) : [raw];
    var answers = [];

    parts.forEach(function (part) {
      var value = trim(String(part));
      answers.push(value === '!!' ? '' : value);
    });

    return answers.length ? answers : [''];
  }

  function parseOrderModeMarkedAnswers(self, raw) {
    var separator = getOptionSeparator(self);
    var parts = separator ? String(raw).split(separator) : [raw];
    var answers = [];

    parts.forEach(function (part) {
      var value = trim(String(part));
      if (value !== '') {
        answers.push(value);
      }
    });

    return answers.length ? answers : [''];
  }

  function getOptionSeparator(self) {
    var value = self.params && self.params.behaviour ? self.params.behaviour.optionSeparator : '|';
    value = unwrapSettingValue(value, '|');
    value = String(value === null || value === undefined ? '|' : value).replace(/[\r\n]/g, '');
    return value === '' ? '|' : value;
  }

  function isCorrectAnswer(self, value, answers) {
    var normalisedValue = normalise(self, value);
    for (var i = 0; i < answers.length; i++) {
      if (normalisedValue === normalise(self, answers[i])) {
        return true;
      }
    }
    return false;
  }

  function firstVisibleAnswer(answers) {
    if (!answers || !answers.length) {
      return '';
    }
    for (var i = 0; i < answers.length; i++) {
      if (answers[i] !== '') {
        return answers[i];
      }
    }
    return '';
  }

  function stripMarkersToFirstCorrect(parsed) {
    var output = '';
    parsed.segments.forEach(function (segment) {
      output += segment.type === 'text' ? segment.text : firstVisibleAnswer(segment.answers);
    });
    return output;
  }

  function uniqueOptions(self, options) {
    var seen = {};
    var unique = [];
    options.forEach(function (option) {
      var key = normalise(self, option);
      if (!seen[key]) {
        seen[key] = true;
        unique.push(option);
      }
    });
    return unique;
  }

  function cleanVisibleOptions(options) {
    return options.filter(function (option) {
      return option !== '';
    });
  }

  /* ===================== Order mode ===================== */

  function parseOrderSentences(self, text) {
    var sentences = [];

    decodeHtmlEntities(String(text || '')).split(/\r?\n/).forEach(function (line, lineIndex) {
      var sentence = parseOrderLine(self, line);
      if (sentence.tokens.length) {
        sentence.lineIndex = lineIndex;
        sentences.push(sentence);
      }
    });

    return sentences;
  }

  // Matemaatika/keemia valemite piirajad. Selliste sümbolitega algav-lõppev
  // tekstiosa käsitletakse ühe tervikliku sõnana (sisemisi tühikuid ega
  // sümboleid ei tükeldata, ka mitte lünga-eraldajaks, nt \sqrt[3]{x}).
  var MATH_DELIMITERS = [
    { open: '\\(', close: '\\)' },
    { open: '\\[', close: '\\]' },
    { open: '$$', close: '$$' }
  ];

  // Leiab positsioonist 'from' alates järgmise tervikliku valemiploki (varaseima
  // alguskohaga). Tagastab {start, end} või null, kui terviklikku plokki pole.
  function findNextMathSpan(text, from) {
    var best = null;
    for (var d = 0; d < MATH_DELIMITERS.length; d++) {
      var open = MATH_DELIMITERS[d].open;
      var close = MATH_DELIMITERS[d].close;
      var start = text.indexOf(open, from);
      if (start === -1) {
        continue;
      }
      var end = text.indexOf(close, start + open.length);
      if (end === -1) {
        continue;
      }
      if (best === null || start < best.start) {
        best = { start: start, end: end + close.length };
      }
    }
    return best;
  }

  function parseOrderLine(self, line) {
    var delimiters = getDelimiterPair(self);
    var open = delimiters.open;
    var close = delimiters.close;
    var segments = [];
    var tokens = [];
    var position = 0;
    var text = String(line || '');

    while (position < text.length) {
      var start = text.indexOf(open, position);
      var mathSpan = findNextMathSpan(text, position);

      // Kui valem algab enne (või täpselt) lünga-eraldajat, käsitle seda ühe
      // sõnana. See lahendab ka \[ ... \] vs lünga-eraldaja [ ] konflikti.
      if (mathSpan && (start === -1 || mathSpan.start <= start)) {
        if (mathSpan.start > position) {
          pushOrderTextSegments(segments, tokens, text.substring(position, mathSpan.start));
        }
        pushOrderSlot(segments, tokens, text.substring(mathSpan.start, mathSpan.end));
        position = mathSpan.end;
        continue;
      }

      if (start === -1) {
        pushOrderTextSegments(segments, tokens, text.substring(position));
        break;
      }

      if (start > position) {
        pushOrderTextSegments(segments, tokens, text.substring(position, start));
      }

      var end = text.indexOf(close, start + open.length);
      if (end === -1) {
        pushOrderTextSegments(segments, tokens, text.substring(start));
        break;
      }

      var answers = parseOrderModeMarkedAnswers(self, text.substring(start + open.length, end));
      if (firstVisibleAnswer(answers) !== '') {
        pushOrderSlot(segments, tokens, answers);
      }
      position = end + close.length;
    }

    return {segments: segments, tokens: tokens};
  }

  function pushOrderSlot(segments, tokens, answer) {
    var answers = Array.isArray(answer) ? answer : [answer];
    var primary = firstVisibleAnswer(answers);

    segments.push({type: 'slot', answer: primary, answers: answers, slot: tokens.length});
    tokens.push(primary);
  }

  function pushOrderStatic(segments, text) {
    if (!text) {
      return;
    }
    if (segments.length && segments[segments.length - 1].type === 'static') {
      segments[segments.length - 1].text += text;
    }
    else {
      segments.push({type: 'static', text: text});
    }
  }

  function pushOrderTextSegments(segments, tokens, text) {
    var chars = toChars(String(text || ''));
    var current = '';
    var i;

    function flushWord() {
      if (current !== '') {
        pushOrderSlot(segments, tokens, current);
        current = '';
      }
    }

    for (i = 0; i < chars.length; i++) {
      var ch = chars[i];
      if (isWordChar(ch)) {
        current += ch;
      }
      else if (isWordConnector(ch) && current !== '' && i + 1 < chars.length && isWordChar(chars[i + 1])) {
        current += ch;
      }
      else {
        flushWord();
        pushOrderStatic(segments, ch);
      }
    }
    flushWord();
  }

  var WORD_CHAR_REGEX = (function () {
    try {
      return new RegExp('[\\p{L}\\p{N}]', 'u');
    }
    catch (e) {
      return /[A-Za-z0-9\u00C0-\u024F\u0400-\u04FF\u0100-\u017F]/;
    }
  })();

  function isWordChar(ch) {
    return WORD_CHAR_REGEX.test(ch);
  }

  function isWordConnector(ch) {
    return ch === '-' || ch === '\u2019' || ch === "'" || ch === '\u00AD';
  }

  function renderOrderSentence(self, task, sentence, index) {
    var block = document.createElement('div');
    var line = document.createElement('div');
    var position = getDragOptionsPosition(self);
    var extraLineIndex = sentence.lineIndex !== undefined ? sentence.lineIndex : index;
    var words = getOrderPoolWords(sentence).concat(getExtraOptionsForSentence(self, extraLineIndex));
    var specs = words.map(function (value, i) {
      return { id: index + '-' + i, value: value };
    });

    block.className = 'h5p-order-words-sentence';
    block.setAttribute('data-index', String(index));

    line.className = 'h5p-order-words-order-line';
    line.setAttribute('data-index', String(index));
    line.setAttribute('dir', 'auto');

    sentence.segments.forEach(function (segment) {
      if (segment.type === 'static') {
        appendText(line, segment.text, 'span', 'h5p-order-words-text-part');
      }
      else {
        line.appendChild(createOrderSlot(self, sentence, index, segment));
      }
    });

    var lineImageParams = getLineImage(self, extraLineIndex);
    var lineImageEl = buildImageElement(self, lineImageParams);
    var target = block;

    if (lineImageEl) {
      block.className += ' h5p-order-words-image-layout h5p-order-words-image-' + getImagePosition(lineImageParams);
      block.appendChild(lineImageEl);
      target = document.createElement('div');
      target.className = 'h5p-order-words-sentence-content';
      block.appendChild(target);
    }

    if (position === 'top') {
      target.appendChild(renderOrderPool(self, index, specs, 'top'));
      target.appendChild(line);
    }
    else if (position === 'both') {
      target.appendChild(renderOrderPool(self, index, specs, 'top'));
      target.appendChild(line);
      target.appendChild(renderOrderPool(self, index, specs, 'bottom'));
    }
    else {
      target.appendChild(line);
      target.appendChild(renderOrderPool(self, index, specs, 'bottom'));
    }

    task.appendChild(block);
  }

  function createOrderSlot(self, sentence, sentenceIndex, segment) {
    var slot = document.createElement('span');

    slot.className = 'h5p-order-words-slot';
    slot.tabIndex = 0;
    slot.setAttribute('role', 'button');
    slot.setAttribute('data-line', String(sentenceIndex));
    slot.setAttribute('data-slot', String(segment.slot));
    slot.setAttribute('aria-label', replacePlaceholders(self.params.l10n.slotLabel, {num: segment.slot + 1}));
    slot.style.minWidth = 'calc(' + getOrderSlotWidthChars(self, sentence, segment) + 'ch + 0.8em)';

    slot.addEventListener('dragover', function (event) {
      if (self.checked) {
        return;
      }
      event.preventDefault();
      slot.classList.add('h5p-order-words-drop-hover');
    });
    slot.addEventListener('dragleave', function () {
      slot.classList.remove('h5p-order-words-drop-hover');
    });
    slot.addEventListener('drop', function (event) {
      if (self.checked || !self.draggedToken) {
        return;
      }
      event.preventDefault();
      slot.classList.remove('h5p-order-words-drop-hover');
      if (parseInt(self.draggedToken.getAttribute('data-line'), 10) !== sentenceIndex) {
        return;
      }
      placeTokenInSlot(self, slot, self.draggedToken);
      self.draggedToken = null;
      afterOrderMove(self);
    });
    slot.addEventListener('click', function (event) {
      if (self.checked) {
        return;
      }
      if (event.target !== slot) {
        return;
      }
      if (self.selectedToken && parseInt(self.selectedToken.getAttribute('data-line'), 10) === sentenceIndex) {
        placeTokenInSlot(self, slot, self.selectedToken);
        self.selectedToken = null;
        afterOrderMove(self);
      }
    });
    slot.addEventListener('keydown', function (event) {
      if ((event.key === 'Enter' || event.key === ' ') && !self.checked && event.target === slot) {
        if (self.selectedToken && parseInt(self.selectedToken.getAttribute('data-line'), 10) === sentenceIndex) {
          placeTokenInSlot(self, slot, self.selectedToken);
          self.selectedToken = null;
          afterOrderMove(self);
        }
        event.preventDefault();
      }
    });
    slot.addEventListener('dblclick', function () {
      if (self.checked) {
        return;
      }
      clearOrderSlot(self, slot);
      afterOrderMove(self);
    });

    return slot;
  }

  function renderOrderPool(self, index, specs, position) {
    var pool = document.createElement('div');
    var order = specs.slice(0);

    if (self.params.behaviour.shuffleOptions) {
      order = shuffle(order);
    }

    pool.className = 'h5p-order-words-pool h5p-order-words-pool-' + position;
    pool.setAttribute('data-index', String(index));
    pool.setAttribute('data-pool', position);
    pool.setAttribute('role', 'group');
    pool.setAttribute('aria-label', self.params.l10n.poolLabel);

    order.forEach(function (spec) {
      pool.appendChild(createOrderToken(self, spec.value, index, spec.id, position));
    });

    pool.addEventListener('dragover', function (event) {
      if (self.checked) {
        return;
      }
      event.preventDefault();
      pool.classList.add('h5p-order-words-drop-hover');
    });
    pool.addEventListener('dragleave', function () {
      pool.classList.remove('h5p-order-words-drop-hover');
    });
    pool.addEventListener('drop', function (event) {
      if (self.checked || !self.draggedToken) {
        return;
      }
      event.preventDefault();
      pool.classList.remove('h5p-order-words-drop-hover');
      if (parseInt(self.draggedToken.getAttribute('data-line'), 10) !== index) {
        return;
      }
      returnTokenToPool(self, self.draggedToken);
      self.draggedToken = null;
      afterOrderMove(self);
    });

    return pool;
  }

  function createOrderToken(self, value, sentenceIndex, tokenId, poolPosition) {
    var token = document.createElement('button');

    token.type = 'button';
    token.className = 'h5p-order-words-token';
    token.textContent = value;
    token.draggable = true;
    token.setAttribute('data-value', value);
    token.setAttribute('data-line', String(sentenceIndex));
    token.setAttribute('data-token-id', String(tokenId));
    token.setAttribute('data-pool', poolPosition || 'bottom');
    token.setAttribute('title', self.params.l10n.addWord);

    token.addEventListener('dragstart', function (event) {
      if (self.checked) {
        event.preventDefault();
        return;
      }
      self.draggedToken = token;
      event.dataTransfer.setData('text/plain', value);
    });
    token.addEventListener('dragend', function () {
      self.draggedToken = null;
    });
    token.addEventListener('click', function (event) {
      if (self.checked) {
        return;
      }
      event.stopPropagation();
      if (isTokenInSlot(token)) {
        returnTokenToPool(self, token);
        afterOrderMove(self);
      }
      else {
        selectOrderToken(self, token);
      }
    });

    return token;
  }

  function selectOrderToken(self, token) {
    if (self.selectedToken === token) {
      self.selectedToken = null;
      token.classList.remove('h5p-order-words-token-selected');
      return;
    }
    self.selectedToken = token;
    Array.prototype.forEach.call(self.wrapper.querySelectorAll('.h5p-order-words-token'), function (button) {
      button.classList.remove('h5p-order-words-token-selected');
    });
    token.classList.add('h5p-order-words-token-selected');
  }

  function placeTokenInSlot(self, slot, token) {
    clearOrderSlot(self, slot);
    slot.appendChild(token);
    slot.classList.add('h5p-order-words-slot-filled');
    token.classList.remove('h5p-order-words-token-selected');
    token.hidden = false;
    token.setAttribute('title', self.params.l10n.removeWord);
    setTwinTokensHidden(self, token, true);
  }

  function clearOrderSlot(self, slot) {
    var existing = slot.querySelector('.h5p-order-words-token');
    if (existing) {
      returnTokenToPool(self, existing);
    }
  }

  function returnTokenToPool(self, token) {
    var line = token.getAttribute('data-line');
    var poolPosition = token.getAttribute('data-pool') || 'bottom';
    var slot = isTokenInSlot(token) ? token.parentNode : null;
    var pool = self.wrapper.querySelector('.h5p-order-words-sentence[data-index="' + line + '"] .h5p-order-words-pool[data-pool="' + poolPosition + '"]')
      || self.wrapper.querySelector('.h5p-order-words-pool[data-index="' + line + '"]');

    setTwinTokensHidden(self, token, false);

    if (pool) {
      pool.appendChild(token);
    }
    if (slot) {
      slot.classList.remove('h5p-order-words-slot-filled');
    }
    token.hidden = false;
    token.classList.remove('h5p-order-words-token-selected');
    token.setAttribute('title', self.params.l10n.addWord);
    if (self.selectedToken === token) {
      self.selectedToken = null;
    }
  }

  function setTwinTokensHidden(self, token, hidden) {
    var line = token.getAttribute('data-line');
    var id = token.getAttribute('data-token-id');
    if (id === null) {
      return;
    }
    var twins = self.wrapper.querySelectorAll('.h5p-order-words-sentence[data-index="' + line + '"] .h5p-order-words-token[data-token-id="' + id + '"]');
    Array.prototype.forEach.call(twins, function (twin) {
      if (twin === token) {
        return;
      }
      twin.hidden = hidden;
      if (hidden && self.selectedToken === twin) {
        twin.classList.remove('h5p-order-words-token-selected');
        self.selectedToken = null;
      }
    });
  }

  function isTokenInSlot(token) {
    return !!(token.parentNode && token.parentNode.classList && token.parentNode.classList.contains('h5p-order-words-slot'));
  }

  function afterOrderMove(self) {
    self.answerGiven = hasAnyOrderAnswer(self);
    updateControls(self);
    self.triggerResize();
  }

  function getOrderSlotWidthChars(self, sentence, segment) {
    var mode = getGapInputWidthMode(self);
    var length = 0;

    if (mode === 'uniform') {
      (self.sentences || []).forEach(function (item) {
        item.segments.forEach(function (itemSegment) {
          if (itemSegment.type === 'slot') {
            length = Math.max(length, longestVisibleAnswerLength(getOrderSlotAnswers(item, itemSegment.slot)));
          }
        });
      });
    }
    else {
      length = longestVisibleAnswerLength(getOrderSlotAnswers(sentence, segment.slot));
    }

    return Math.max(2, Math.min(40, length || 2));
  }

  function getOrderSlotElements(self, sentenceIndex) {
    return self.wrapper.querySelectorAll('.h5p-order-words-order-line[data-index="' + sentenceIndex + '"] .h5p-order-words-slot');
  }

  function getOrderResponses(self) {
    var responses = [];

    self.sentences.forEach(function (sentence, index) {
      var values = [];
      Array.prototype.forEach.call(getOrderSlotElements(self, index), function (slot) {
        var token = slot.querySelector('.h5p-order-words-token');
        values.push(token ? (token.getAttribute('data-value') || '') : '');
      });
      responses.push(values);
    });

    return responses;
  }

  function hasAnyOrderAnswer(self) {
    return getOrderResponses(self).some(function (values) {
      return values.some(function (value) {
        return trim(value) !== '';
      });
    });
  }

  function evaluateOrder(self) {
    var responses = getOrderResponses(self);
    var score = 0;
    var maxScore = 0;
    var correctCount = 0;
    var incorrect = 0;
    var missing = 0;
    var sentenceResults = [];

    self.sentences.forEach(function (sentence, index) {
      var values = responses[index] || [];
      var positions = [];
      var sentenceCorrect = true;
      var i;

      for (i = 0; i < sentence.tokens.length; i++) {
        var value = values[i] || '';
        var correct = isCorrectOrderAnswer(self, value, sentence, i);
        positions.push(correct);
        if (correct) {
          correctCount++;
        }
        else {
          sentenceCorrect = false;
          if (trim(value) === '') {
            missing++;
          }
          else {
            incorrect++;
          }
        }
      }

      sentenceResults.push({
        positions: positions,
        correct: sentenceCorrect
      });

      if (getScoreMode(self) === 'sentence') {
        maxScore += 1;
        if (sentenceCorrect) {
          score += 1;
        }
      }
      else {
        maxScore += sentence.tokens.length;
      }
    });

    if (getScoreMode(self) !== 'sentence') {
      score = correctCount;
    }

    maxScore = Math.max(maxScore, 1);

    var allSentencesCorrect = sentenceResults.length > 0 && sentenceResults.every(function (sentenceResult) {
      return sentenceResult.correct;
    });

    return {
      score: score,
      maxScore: maxScore,
      success: score === maxScore && allSentencesCorrect,
      orderValues: responses,
      sentenceResults: sentenceResults,
      details: {
        correct: correctCount,
        incorrect: incorrect,
        missing: missing,
        extra: 0
      }
    };
  }

  function renderEvaluatedOrder(self, result) {
    self.sentences.forEach(function (sentence, index) {
      var slots = Array.prototype.slice.call(getOrderSlotElements(self, index));
      var sentenceResult = result.sentenceResults[index];

      slots.forEach(function (slot, position) {
        var token = slot.querySelector('.h5p-order-words-token');
        var value = token ? (token.getAttribute('data-value') || '') : '';
        var correct = sentenceResult.positions[position];
        var missing = trim(value) === '';
        var answers = getOrderSlotAnswers(sentence, position);
        var expected = firstVisibleAnswer(answers);
        var segment = {answers: answers};
        var replacement;

        if (!correct && missing && !getShowMissingAnswers(self)) {
          // Unanswered word + missing answers hidden: neutral empty cell sized to the word.
          replacement = createMissingBlank(self, getOrderSlotWidthChars(self, sentence, {slot: position, answer: expected, answers: answers}));
        }
        else {
          replacement = createCheckedAnswerDisplay(self, value, expected, correct, missing, segment);
        }

        replacement.classList.add('h5p-order-words-order-result');

        if (slot.parentNode) {
          slot.parentNode.replaceChild(replacement, slot);
        }
      });

      clearOrderPools(self, index);
    });
  }

  function clearOrderPools(self, index) {
    Array.prototype.forEach.call(self.wrapper.querySelectorAll('.h5p-order-words-pool[data-index="' + index + '"]'), function (pool) {
      pool.innerHTML = '';
      pool.hidden = true;
      if (pool.parentNode) {
        pool.parentNode.removeChild(pool);
      }
    });
  }

  function showCorrectOrderAnswers(self) {
    self.sentences.forEach(function (sentence, index) {
      var slots = getOrderSlotElements(self, index);
      var pools = self.wrapper.querySelectorAll('.h5p-order-words-pool[data-index="' + index + '"]');

      Array.prototype.forEach.call(slots, function (slot, position) {
        slot.innerHTML = '';
        appendText(slot, firstVisibleAnswer(getOrderSlotAnswers(sentence, position)), 'span', 'h5p-order-words-result-plain');
        slot.classList.add('h5p-order-words-correct');
        slot.classList.add('h5p-order-words-slot-filled');
      });

      clearOrderPools(self, index);
    });
  }

  function getOrderPoolWords(sentence) {
    var words = [];

    (sentence.segments || []).forEach(function (segment) {
      if (segment.type === 'slot') {
        cleanVisibleOptions(segment.answers || [segment.answer]).forEach(function (answer) {
          words.push(answer);
        });
      }
    });

    return words.length ? words : (sentence.tokens || []).slice(0);
  }

  function getOrderSlotAnswers(sentence, position) {
    var segments = sentence && sentence.segments ? sentence.segments : [];
    var i;

    for (i = 0; i < segments.length; i++) {
      if (segments[i].type === 'slot' && segments[i].slot === position) {
        return segments[i].answers && segments[i].answers.length ? segments[i].answers : [segments[i].answer || ''];
      }
    }

    return [sentence && sentence.tokens ? (sentence.tokens[position] || '') : ''];
  }

  function isCorrectOrderAnswer(self, value, sentence, position) {
    return isCorrectAnswer(self, value, getOrderSlotAnswers(sentence, position));
  }

  /* ===================== Shared rendering ===================== */

  function renderControls(self) {
    var controls = document.createElement('div');
    var check = document.createElement('button');

    controls.className = 'h5p-order-words-controls';

    check.type = 'button';
    check.className = 'h5p-order-words-control h5p-order-words-check';
    check.textContent = self.params.l10n.checkAnswer;
    check.addEventListener('click', function () {
      if (!hasGivenAnswer(self)) {
        self.answerGiven = false;
        updateControls(self);
        return;
      }
      checkAnswers(self, true);
    });
    controls.appendChild(check);
    self.checkButton = check;

    if (self.params.behaviour.enableRetry) {
      var retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'h5p-order-words-control h5p-order-words-retry';
      retry.textContent = self.params.l10n.tryAgain;
      retry.hidden = true;
      retry.addEventListener('click', function () {
        self.resetTask();
      });
      controls.appendChild(retry);
      self.retryButton = retry;
    }

    self.wrapper.appendChild(controls);
  }

  function renderFeedbackElement(self) {
    var feedback = document.createElement('div');
    feedback.className = 'h5p-order-words-feedback';
    feedback.setAttribute('aria-live', 'polite');
    self.feedbackElement = feedback;
    self.wrapper.appendChild(feedback);
  }

  function checkAnswers(self, sendXapi) {
    var result;

    if (!hasGivenAnswer(self)) {
      self.answerGiven = false;
      updateControls(self);
      return;
    }

    result = evaluate(self);

    self.checked = true;
    self.answerGiven = true;
    self.score = result.score;
    self.maxScore = result.maxScore;
    self.lastResult = result;

    if (isGapMode(self)) {
      renderEvaluatedGaps(self, result);
    }
    else {
      renderEvaluatedOrder(self, result);
    }

    if (self.params.behaviour.showCorrectTextAfterCheck) {
      showSolution(self);
    }
    updateFeedback(self, self.params.l10n.yourResult
      .replace('@score', String(result.score))
      .replace('@max', String(result.maxScore)), result);
    lockResponseArea(self, true);
    updateControls(self);
    triggerMathDisplay(self);
    self.triggerResize();

    if (sendXapi !== false) {
      self.emitXAPIResult(result);
    }
  }

  function evaluate(self) {
    if (isGapMode(self)) {
      return evaluateGaps(self);
    }
    return evaluateOrder(self);
  }

  function hasGivenAnswer(self) {
    if (!self || !self.wrapper) {
      return false;
    }
    if (isGapMode(self)) {
      return hasAnyGapAnswer(self);
    }
    return hasAnyOrderAnswer(self);
  }

  function showCorrectAnswersInTask(self) {
    if (isGapMode(self)) {
      showCorrectGapAnswers(self);
    }
    else {
      showCorrectOrderAnswers(self);
    }
  }

  function calculateMaxScore(self) {
    if (isGapMode(self)) {
      if (!self.correct) {
        return 0;
      }
      return Math.max(self.correct.gaps.length, 1);
    }

    if (!self.sentences || !self.sentences.length) {
      return 0;
    }

    if (getScoreMode(self) === 'sentence') {
      return Math.max(self.sentences.length, 1);
    }

    var max = 0;
    self.sentences.forEach(function (sentence) {
      max += sentence.tokens.length;
    });
    return Math.max(max, 1);
  }

  function renderSolutionElement(self, parent) {
    var solution = document.createElement('div');
    var prefix = document.createElement('strong');

    solution.className = 'h5p-order-words-solution';
    solution.hidden = true;

    prefix.textContent = self.params.l10n.solutionPrefix + ' ';
    solution.appendChild(prefix);

    if (isGapMode(self)) {
      stripMarkersToFirstCorrect(self.correct).split(/\r?\n/).forEach(function (lineText) {
        if (trim(lineText) === '') {
          return;
        }
        var line = document.createElement('div');
        line.className = 'h5p-order-words-solution-line';
        line.textContent = lineText;
        solution.appendChild(line);
      });
    }
    else {
      self.sentences.forEach(function (sentence) {
        var line = document.createElement('div');
        line.className = 'h5p-order-words-solution-line';
        line.textContent = orderSentenceText(sentence);
        solution.appendChild(line);
      });
    }

    parent.appendChild(solution);
    self.solutionElement = solution;
  }

  function orderSentenceText(sentence) {
    var output = '';
    sentence.segments.forEach(function (segment) {
      output += segment.type === 'static' ? segment.text : segment.answer;
    });
    return output;
  }

  function showSolution(self) {
    if (!self.solutionElement) {
      return;
    }
    self.solutionElement.hidden = false;
  }

  function updateFeedback(self, message, result) {
    var score;
    var details;
    var detailLine;

    if (!self.feedbackElement) {
      return;
    }

    self.feedbackElement.innerHTML = '';
    self.feedbackElement.classList.remove('h5p-order-words-feedback-success');
    self.feedbackElement.classList.remove('h5p-order-words-feedback-failure');

    if (!message && !result) {
      return;
    }

    if (result && result.success) {
      var success = document.createElement('div');
      success.className = 'h5p-order-words-result-score';
      success.textContent = self.params.l10n.correctFeedback || DEFAULT_L10N.correctFeedback;
      self.feedbackElement.appendChild(success);
    }

    if (message) {
      score = document.createElement('div');
      score.className = 'h5p-order-words-result-score';
      score.textContent = message;
      self.feedbackElement.appendChild(score);
    }

    if (result && result.details) {
      details = result.details;
      detailLine = document.createElement('div');
      detailLine.className = 'h5p-order-words-result-details';
      appendFeedbackDetail(detailLine, self.params.l10n.correctText || DEFAULT_L10N.correctText, details.correct || 0, 'h5p-order-words-select-correct');
      appendFeedbackDetail(detailLine, self.params.l10n.wrongText || DEFAULT_L10N.wrongText, (details.incorrect || 0) + (details.extra || 0), 'h5p-order-words-select-wrong');
      appendFeedbackDetail(detailLine, self.params.l10n.missingCountText || DEFAULT_L10N.missingCountText, details.missing || 0, 'h5p-order-words-select-missing');
      self.feedbackElement.appendChild(detailLine);
    }

    if (result) {
      self.feedbackElement.classList.add(result.success ? 'h5p-order-words-feedback-success' : 'h5p-order-words-feedback-failure');
    }
  }

  function appendFeedbackDetail(parent, template, count, stateClass) {
    var item = document.createElement('span');
    var parts = splitTemplateAroundCount(template);
    var label = '';
    var labelSpan;
    var countSpan;

    item.className = 'h5p-order-words-result-detail-item';

    label = ((parts.before || '') + (parts.after || '')).trim();
    if (label) {
      labelSpan = document.createElement('span');
      labelSpan.textContent = label;
      item.appendChild(labelSpan);
    }

    countSpan = document.createElement('span');
    countSpan.className = 'h5p-order-words-feedback-count ' + (stateClass || '');
    countSpan.textContent = String(count);
    item.appendChild(countSpan);

    parent.appendChild(item);
  }

  function splitTemplateAroundCount(template) {
    var source = template || '';
    var index = source.indexOf('@count');

    if (index === -1) {
      return {before: source, after: ''};
    }

    return {
      before: source.slice(0, index),
      after: source.slice(index + 6)
    };
  }

  function replacePlaceholders(template, values) {
    var result = template || '';
    Object.keys(values || {}).forEach(function (key) {
      result = result.split('@' + key).join(values[key]);
    });
    return result;
  }

  function updateControls(self) {
    if (self.checkButton) {
      self.checkButton.hidden = !!self.checked;
      self.checkButton.disabled = !!self.checked || !hasGivenAnswer(self);
    }
    if (self.retryButton) {
      self.retryButton.hidden = !self.checked;
    }
  }

  function lockResponseArea(self, locked) {
    var answerArea;

    if (!self.wrapper) {
      return;
    }

    answerArea = self.wrapper.querySelector('.h5p-order-words-answer-area');
    if (answerArea) {
      answerArea.classList.toggle('is-locked', !!locked);
      answerArea.setAttribute('aria-disabled', locked ? 'true' : 'false');
    }

    Array.prototype.forEach.call(self.wrapper.querySelectorAll('input, select, button.h5p-order-words-token'), function (element) {
      element.disabled = !!locked;
      if (locked) {
        element.setAttribute('tabindex', '-1');
        if (element.draggable !== undefined) {
          element.draggable = false;
        }
      }
      else {
        element.removeAttribute('tabindex');
      }
    });

    Array.prototype.forEach.call(self.wrapper.querySelectorAll('.h5p-order-words-slot'), function (slot) {
      if (locked) {
        slot.setAttribute('tabindex', '-1');
      }
      else {
        slot.setAttribute('tabindex', '0');
      }
    });
  }

  /* ===================== Comparison rendering (Gapfill heritage) ===================== */

  function renderComparison(parent, userText, expectedText, self) {
    var ops = diffChars(userText || '', expectedText || '', self);

    ops.forEach(function (op) {
      if (op.type === 'equal') {
        appendPlainChar(parent, op.ch);
      }
      else if (op.type === 'extra') {
        appendClassifiedChar(parent, op.ch, true, self);
      }
      else if (op.type === 'missing') {
        appendClassifiedChar(parent, op.ch, false, self);
      }
    });
  }

  function diffChars(userText, expectedText, self) {
    var user = toChars(userText);
    var expected = toChars(expectedText);
    var n = user.length;
    var m = expected.length;
    var dp = [];
    var i;
    var j;
    var ops = [];

    if (n * m > 40000) {
      return [{type: 'extra', ch: userText}, {type: 'missing', ch: expectedText}];
    }

    for (i = 0; i <= n; i++) {
      dp[i] = [];
      for (j = 0; j <= m; j++) {
        dp[i][j] = 0;
      }
    }

    for (i = n - 1; i >= 0; i--) {
      for (j = m - 1; j >= 0; j--) {
        if (normaliseComparableChar(self, user[i]) === normaliseComparableChar(self, expected[j])) {
          dp[i][j] = dp[i + 1][j + 1] + 1;
        }
        else {
          dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
      }
    }

    i = 0;
    j = 0;
    while (i < n && j < m) {
      if (normaliseComparableChar(self, user[i]) === normaliseComparableChar(self, expected[j])) {
        ops.push({type: 'equal', ch: user[i]});
        i++;
        j++;
      }
      else if (dp[i + 1][j] >= dp[i][j + 1]) {
        ops.push({type: 'extra', ch: user[i]});
        i++;
      }
      else {
        ops.push({type: 'missing', ch: expected[j]});
        j++;
      }
    }
    while (i < n) {
      ops.push({type: 'extra', ch: user[i]});
      i++;
    }
    while (j < m) {
      ops.push({type: 'missing', ch: expected[j]});
      j++;
    }

    return ops;
  }

  function renderWrongCorrectComparison(parent, userText, expectedText, self) {
    if (trim(userText || '') !== '') {
      appendWholeMarkedText(parent, userText || '', 'h5p-order-words-wrong-result', self.params.l10n.extraText);
    }

    if (expectedText !== '' && getShowMissingAnswers(self)) {
      appendWholeMarkedText(parent, expectedText || '', 'h5p-order-words-correct-result', self.params.l10n.missingText);
    }
  }

  function getShowMissingAnswers(self) {
    var value = unwrapSettingValue(self.params && self.params.behaviour ? self.params.behaviour.showMissingAnswers : null, true);
    return value !== false;
  }

  function createMissingBlank(self, widthChars) {
    var span = document.createElement('span');
    var chars = Math.max(2, widthChars || 2);

    // Missing-answer text may be hidden by author setting, but the answer slot
    // must keep the same checked-result styling: orange cell, dashed border,
    // no input/select/dropzone and no revealed answer text.
    span.className = 'h5p-order-words-gap h5p-order-words-gap-select h5p-order-words-gap-select-result h5p-order-words-checked-gap-cell h5p-order-words-select-missing h5p-order-words-missing-blank h5p-order-words-missing-hidden';
    span.style.minWidth = 'calc(' + chars + 'ch + 0.8em)';
    span.setAttribute('aria-label', self.params.l10n.missingText);
    return span;
  }

  function appendWholeMarkedText(parent, text, className, ariaLabel) {
    var span = document.createElement('span');
    span.className = className;
    span.setAttribute('aria-label', ariaLabel || '');
    span.textContent = text || ' ';
    parent.appendChild(span);
  }

  function appendText(parent, text, tag, className) {
    var element = document.createElement(tag || 'span');
    element.className = className || '';
    element.textContent = text || '';
    parent.appendChild(element);
    return element;
  }

  function appendPlainText(parent, text) {
    toChars(text || '').forEach(function (ch) {
      appendPlainChar(parent, ch);
    });
  }

  function appendPlainChar(parent, ch) {
    var span = document.createElement('span');
    span.className = 'h5p-order-words-result-plain';
    span.textContent = ch === ' ' ? '\u00a0' : ch;
    parent.appendChild(span);
  }

  function appendClassifiedChar(parent, ch, isExtra, self) {
    var chars = toChars(ch || '');
    if (chars.length > 1) {
      chars.forEach(function (part) {
        appendClassifiedChar(parent, part, isExtra, self);
      });
      return;
    }

    var span = document.createElement('span');
    var isSpace = ch === ' ';

    span.className = isExtra ? 'h5p-order-words-extra-text' : 'h5p-order-words-missing-text';
    if (isSpace) {
      span.className += ' h5p-order-words-marked-space';
    }
    span.setAttribute('aria-label', isExtra ? self.params.l10n.extraText : self.params.l10n.missingText);
    span.textContent = isSpace ? '\u00a0' : ch;
    parent.appendChild(span);
  }

  /* ===================== Settings and utilities ===================== */

  function getScoreMode(self) {
    var params = self && self.params ? self.params : {};
    var behaviour = params.behaviour || {};
    var source = behaviour.scoreMode !== undefined ? behaviour.scoreMode : params.scoreMode;
    var value = unwrapSettingValue(source, 'position');
    return value === 'sentence' ? 'sentence' : 'position';
  }

  function getDragOptionsPosition(self) {
    var position = unwrapSettingValue(self.params && self.params.dragOptionsPosition, 'bottom');
    if (position === 'top' || position === 'both') {
      return position;
    }
    return 'bottom';
  }

  function getGapInputWidthMode(self) {
    var params = self && self.params ? self.params : {};
    var behaviour = params.behaviour || {};
    var source = behaviour.gapInputWidthMode !== undefined ? behaviour.gapInputWidthMode : params.gapInputWidthMode;
    var value = unwrapSettingValue(source, 'byAnswer');

    return value === 'uniform' ? 'uniform' : 'byAnswer';
  }

  function getExtraOptions(self) {
    var text = self.params.extraOptions || '';
    var options = [];

    String(text).split(/[\n,]+/).forEach(function (part) {
      var option = trim(part);
      if (option !== '') {
        options.push(option);
      }
    });

    return options;
  }

  function getExtraOptionsForSentence(self, sentenceIndex) {
    var text = String(self.params.extraOptions || '');
    var lines = getExtraOptionsLinesAlignedToText(self, text);

    if (sentenceIndex < 0 || sentenceIndex >= lines.length) {
      return [];
    }

    return parseExtraOptionsLine(lines[sentenceIndex]);
  }

  function getExtraOptionsLinesAlignedToText(self, text) {
    // Empty lines are meaningful here: they reserve the matching line/paragraph.
    // Some H5P editors trim leading blank textarea lines before saving.
    // If the saved value has fewer rows than Text and no preserved leading row,
    // pad the rows at the beginning so a value written after initial empty rows
    // still belongs to the intended later line.
    var lines = String(text || '').split(/\r?\n/);
    var textLineCount = getCorrectTextLineCount(self);
    var missingLeadingRows;

    if (!text || textLineCount <= 1 || lines.length >= textLineCount || startsWithLineBreak(text)) {
      return lines;
    }

    missingLeadingRows = textLineCount - lines.length;
    while (missingLeadingRows > 0) {
      lines.unshift('');
      missingLeadingRows--;
    }

    return lines;
  }

  function getCorrectTextLineCount(self) {
    return decodeHtmlEntities(String(self.params.correctText || '')).split(/\r?\n/).length;
  }

  function startsWithLineBreak(text) {
    return String(text || '').charAt(0) === '\n' || String(text || '').charAt(0) === '\r';
  }

  function parseExtraOptionsLine(line) {
    var options = [];

    String(line || '').split(/,+/).forEach(function (part) {
      var option = trim(part);
      if (option !== '') {
        options.push(option);
      }
    });

    return options;
  }

  function getDelimiterPair(self) {
    var value = unwrapSettingValue(self.params && self.params.behaviour && self.params.behaviour.delimiters, '[]');
    var open;
    var close;

    switch (value) {
      case '{}':
        open = '{';
        close = '}';
        break;
      case '##':
        open = '#';
        close = '#';
        break;
      case '@@':
        open = '@';
        close = '@';
        break;
      case '*':
        open = '*';
        close = '*';
        break;
      default:
        open = '[';
        close = ']';
        break;
    }

    return {open: open, close: close};
  }

  function unwrapSettingValue(value, fallback) {
    if (value === null || value === undefined) {
      return fallback;
    }
    if (typeof value === 'object') {
      if (Object.prototype.hasOwnProperty.call(value, 'value')) {
        return value.value;
      }
      if (Object.prototype.hasOwnProperty.call(value, 'params')) {
        return value.params;
      }
      if (Object.prototype.hasOwnProperty.call(value, 'raw')) {
        return value.raw;
      }
    }
    return value;
  }

  function normalise(self, value) {
    value = String(value === null || value === undefined ? '' : value);
    if (!self.params.behaviour.caseSensitive) {
      value = value.toLocaleLowerCase();
    }
    return value;
  }

  function normaliseComparableChar(self, ch) {
    ch = String(ch === null || ch === undefined ? '' : ch);
    return self.params.behaviour.caseSensitive ? ch : ch.toLocaleLowerCase();
  }

  function shuffle(array) {
    var copy = array.slice(0);
    for (var i = copy.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = copy[i];
      copy[i] = copy[j];
      copy[j] = temp;
    }
    return copy;
  }

  function isEmptyText(text) {
    return trim(stripHtml(String(text || ''))) === '';
  }

  function stripHtml(text) {
    return String(text || '')
      .replace(/<br\s*\/?\s*>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, '');
  }

  function decodeHtmlEntities(text) {
    var previous;
    var decoded = String(text || '');
    var textarea;

    if (typeof document === 'undefined') {
      return decoded
        .replace(/&quot;/g, '"')
        .replace(/&#34;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ');
    }

    textarea = document.createElement('textarea');
    do {
      previous = decoded;
      textarea.innerHTML = previous;
      decoded = textarea.value;
    } while (decoded !== previous && /&[a-zA-Z#0-9]+;/.test(decoded));

    return decoded;
  }

  function toChars(str) {
    if (typeof Array.from === 'function') {
      return Array.from(str || '');
    }
    return String(str || '').split('');
  }

  function trim(value) {
    return String(value || '').replace(/^\s+|\s+$/g, '');
  }

  function mergeDeep(target) {
    var i;
    target = target || {};
    for (i = 1; i < arguments.length; i++) {
      var source = arguments[i] || {};
      Object.keys(source).forEach(function (key) {
        if (isPlainObject(source[key])) {
          target[key] = mergeDeep(isPlainObject(target[key]) ? target[key] : {}, source[key]);
        }
        else {
          target[key] = source[key];
        }
      });
    }
    return target;
  }

  function isPlainObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
  }

  function getDomElement($container) {
    if (!$container) {
      return document.createElement('div');
    }
    return $container.jquery ? $container.get(0) : $container;
  }

  function buildGapCorrectResponses(self) {
    var alternatives = [''];

    if (!self.correct || !self.correct.segments) {
      return [''];
    }

    self.correct.segments.forEach(function (segment) {
      if (segment.type === 'text') {
        alternatives = appendXAPIFragmentAlternatives(alternatives, [segment.text]);
      }
      else {
        alternatives = appendXAPIFragmentAlternatives(alternatives, segment.answers || ['']);
      }
    });

    return alternatives.length ? alternatives : [''];
  }

  function buildOrderCorrectResponses(self) {
    var sentenceAlternatives = [];

    (self.sentences || []).forEach(function (sentence) {
      var alternatives = [''];

      (sentence.segments || []).forEach(function (segment) {
        if (segment.type === 'static') {
          alternatives = appendXAPIFragmentAlternatives(alternatives, [segment.text]);
        }
        else {
          alternatives = appendXAPIFragmentAlternatives(alternatives, getOrderSlotAnswers(sentence, segment.slot));
        }
      });

      sentenceAlternatives.push(alternatives.length ? alternatives : ['']);
    });

    if (!sentenceAlternatives.length) {
      return [''];
    }

    return combineXAPILineAlternatives(sentenceAlternatives, 0, ['']);
  }

  function appendXAPIFragmentAlternatives(base, fragments) {
    var output = [];
    var seen = {};

    base = base && base.length ? base : [''];
    fragments = fragments && fragments.length ? fragments : [''];

    base.forEach(function (prefix) {
      fragments.forEach(function (fragment) {
        var value = prefix + String(fragment || '');
        if (!seen[value]) {
          seen[value] = true;
          output.push(value);
        }
      });
    });

    return output;
  }

  function combineXAPILineAlternatives(lines, index, prefixes) {
    var output = [];
    var seen = {};

    if (index >= lines.length) {
      return prefixes;
    }

    prefixes.forEach(function (prefix) {
      (lines[index] || ['']).forEach(function (line) {
        var value = prefix + (prefix === '' ? '' : '\n') + line;
        if (!seen[value]) {
          seen[value] = true;
          output.push(value);
        }
      });
    });

    return combineXAPILineAlternatives(lines, index + 1, output);
  }

  function extendObject(target, source) {
    var key;

    target = target || {};
    source = source || {};

    for (key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        target[key] = source[key];
      }
    }

    return target;
  }

  function stripTags(text) {
    return String(text || '').replace(/<[^>]+>/g, '');
  }

  H5P.OrderWords = OrderWords;
})(H5P);
