(function(){
  const wordsPath = 'data/words.txt';
  const wordListEl = document.querySelector('.word-list');
  const inputEl = document.getElementById('typing-input');
  const detailsEl = document.getElementById('begin-test');
  const wpmEl = document.getElementById('wpm-value');
  const accEl = document.getElementById('acc-value');
  const timeEl = document.getElementById('time-value');
  const timeRadios = document.querySelectorAll('input[name="time-limit"]');
  const customInput = document.getElementById('custom-time');

  if (!wordListEl || !inputEl) return;

  let words = [];
  const BATCH_SIZE = 5;
  let batchStart = 0;
  let currentInBatch = 0; // index within the visible batch
  let totalTyped = 0;
  let correctTyped = 0;
  let startedAt = null;
  let updateInterval = null;
  let timeLimitSeconds = null; // null = no limit

  function shuffleArray(arr){
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  function loadWordsFromFile(){
    return fetch(wordsPath)
      .then(r => {
        if (!r.ok) throw new Error('Failed to load');
        return r.text();
      })
      .then(txt => txt.split(/\r?\n/).map(s => s.trim()).filter(Boolean));
  }

  function fallbackWordsFromDOM(){
    return Array.from(wordListEl.querySelectorAll('.word')).map(s => s.textContent.trim()).filter(Boolean);
  }

  function renderWordList(){
    wordListEl.innerHTML = '';
    const end = Math.min(batchStart + BATCH_SIZE, words.length);
    for (let i = batchStart; i < end; i++){
      const span = document.createElement('span');
      span.className = 'word';
      if (i === batchStart) span.classList.add('current');
      span.textContent = words[i];
      wordListEl.appendChild(span);
    }
    currentInBatch = 0;
    updateStats();
  }

  function initWords(){
    return loadWordsFromFile().catch(err => {
      console.warn('Could not load words.txt — using DOM defaults', err);
      return fallbackWordsFromDOM();
    }).then(list => {
      words = list;
      shuffleArray(words);
      batchStart = 0;
      renderWordList();
    });
  }

  function formatTime(seconds){
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2,'0')}`;
  }

  function readTimeLimitFromUI(){
    const sel = document.querySelector('input[name="time-limit"]:checked');
    if (!sel) return null;
    if (sel.value === 'custom'){
      const v = parseInt(customInput.value,10);
      return (Number.isFinite(v) && v >= 5) ? v : null;
    }
    const n = parseInt(sel.value,10);
    return Number.isFinite(n) ? n : null;
  }

  function updateStats(){
    const elapsedSec = startedAt ? Math.floor((Date.now() - startedAt)/1000) : 0;
    const elapsedMin = elapsedSec / 60;
    const wpm = (startedAt && elapsedMin > 0) ? Math.round(correctTyped / elapsedMin) : 0;
    const accuracy = totalTyped > 0 ? Math.round((correctTyped/totalTyped) * 100) : 100;
    if (wpmEl) wpmEl.textContent = String(wpm);
    if (accEl) accEl.textContent = String(accuracy) + '%';
    if (timeEl) timeEl.textContent = formatTime(elapsedSec);

    // enforce time limit if set
    if (timeLimitSeconds && startedAt){
      if (elapsedSec >= timeLimitSeconds){
        finishTest();
      }
    }
  }

  function setCurrent(indexInBatch){
    const spans = wordListEl.querySelectorAll('.word');
    spans.forEach(s => s.classList.remove('current'));
    if (spans[indexInBatch]){
      spans[indexInBatch].classList.add('current');
      spans[indexInBatch].scrollIntoView({block:'nearest',inline:'nearest'});
    }
  }

  function markWord(indexInBatch, correct){
    const spans = wordListEl.querySelectorAll('.word');
    if (!spans[indexInBatch]) return;
    spans[indexInBatch].classList.remove('current');
    if (correct) spans[indexInBatch].classList.add('correct');
    else spans[indexInBatch].classList.add('error');
  }

  function finishTest(){
    clearInterval(updateInterval);
    inputEl.disabled = true;
    updateStats();
  }

  function handleSubmitWord(){
    const typed = inputEl.value.trim();
    const globalIndex = batchStart + currentInBatch;
    const currentWord = words[globalIndex] || '';
    totalTyped++;
    const correct = typed === currentWord;
    if (correct) correctTyped++;
    markWord(currentInBatch, correct);
    currentInBatch++;
    inputEl.value = '';

    const batchEnd = Math.min(batchStart + BATCH_SIZE, words.length);
    // finished entire word list
    if (batchStart + currentInBatch >= words.length){
      updateStats();
      finishTest();
      return;
    }

    // if current batch completed, move to next batch
    if (batchStart + currentInBatch >= batchEnd){
      batchStart += BATCH_SIZE;
      currentInBatch = 0;
      renderWordList();
      setTimeout(()=> inputEl.focus(), 10);
    } else {
      setCurrent(currentInBatch);
    }

    updateStats();
  }

  function onKeydown(e){
    if (e.key === ' ' || e.key === 'Enter'){
      e.preventDefault();
      if (!startedAt){
        startedAt = Date.now();
        timeLimitSeconds = readTimeLimitFromUI();
        updateInterval = setInterval(updateStats, 1000);
      }
      handleSubmitWord();
    }
  }

  function onInput(){
    if (!startedAt && inputEl.value.length > 0){
      startedAt = Date.now();
      timeLimitSeconds = readTimeLimitFromUI();
      updateInterval = setInterval(updateStats, 1000);
    }
    const typed = inputEl.value;
    const globalIndex = batchStart + currentInBatch;
    const currentWord = words[globalIndex] || '';
    const isPrefix = currentWord.startsWith(typed);
    inputEl.classList.toggle('input-error', typed.length > 0 && !isPrefix);
  }

  function setupTimeControls(){
    if (!timeRadios || !customInput) return;
    timeRadios.forEach(r => r.addEventListener('change', ()=>{
      if (r.value === 'custom' && r.checked){
        customInput.disabled = false;
        customInput.focus();
      } else if (r.checked){
        customInput.disabled = true;
      }
      timeLimitSeconds = readTimeLimitFromUI();
    }));
    customInput.addEventListener('input', ()=>{
      timeLimitSeconds = readTimeLimitFromUI();
    });
    timeLimitSeconds = readTimeLimitFromUI();
  }

  function addListeners(){
    inputEl.addEventListener('keydown', onKeydown);
    inputEl.addEventListener('input', onInput);
    if (detailsEl){
      detailsEl.addEventListener('toggle', () => {
        if (detailsEl.open){
          setTimeout(()=> inputEl.focus(), 50);
        }
      });
    }
    setupTimeControls();
  }

  // Initialize
  (function start(){
    initWords().then(() => addListeners());
  })();

})();
