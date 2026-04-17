// De Grote E-Commerce Quiz — Client-side JavaScript
const socket = io();

// ===== DETECT WHICH PAGE WE'RE ON =====
const isIndexPage = !!document.getElementById('join-form');
const isPlayerPage = !!document.getElementById('view-waiting');

// Store previous score for animation
let previousScore = 0;

// Helper: Format to Euro
function formatCurrency(amount) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount);
}

// ==== PERSISTENT PLAYER ID ====
// If no playerId exists in localStorage, generate a simple unique random string.
let playerId = localStorage.getItem('rody_player_id');
if (!playerId) {
  playerId = 'player_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
  localStorage.setItem('rody_player_id', playerId);
}

// Helper: Animate count up (Cash Register effect)
function animateValue(obj, start, end, duration) {
  if (!obj) return;
  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    const currentVal = Math.floor(progress * (end - start) + start);
    obj.innerHTML = formatCurrency(currentVal);
    if (progress < 1) {
      window.requestAnimationFrame(step);
    }
  };
  window.requestAnimationFrame(step);
}

// ===== INDEX PAGE (Join Form) =====
if (isIndexPage) {
  const joinForm = document.getElementById('join-form');
  const errorMessage = document.getElementById('error-message');

  joinForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const pin = document.getElementById('pin-input').value.trim();
    const username = document.getElementById('username-input').value.trim();

    if (!pin || !username) return;

    const joinBtn = document.getElementById('join-btn');
    joinBtn.disabled = true;
    joinBtn.textContent = 'Verifiëren...';

    socket.emit('joinRoom', { pin, username, playerId });
  });



  socket.on('joinSuccess', ({ username, isReconnect }) => {
    sessionStorage.setItem('rody_username', username);
    
    if (!isReconnect) {
      // Play Join Audio for new joins
      try {
        const audioJoin = new Audio('audio/ron-jans-keukenrol.mp3');
        audioJoin.play().catch(e => console.warn("Browser blocked audio: ", e));
      } catch(e) {}
    }

    // Delay redirect slightly so audio can play
    setTimeout(() => {
      window.location.href = 'player.html';
    }, isReconnect ? 0 : 1500); // 0 delay if it's just a reconnect
  });

  socket.on('joinError', ({ message }) => {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';

    const joinBtn = document.getElementById('join-btn');
    joinBtn.disabled = false;
    joinBtn.textContent = 'Betreed Winkel';

    setTimeout(() => {
      errorMessage.style.display = 'none';
    }, 3000);
  });
}

// ===== PLAYER PAGE =====
if (isPlayerPage) {
  const username = sessionStorage.getItem('rody_username');

  if (!username) {
    window.location.href = 'index.html';
  }

  // ===== DOM ELEMENTS =====
  const viewWaiting = document.getElementById('view-waiting');
  const viewQuestion = document.getElementById('view-question');
  const viewAnswered = document.getElementById('view-answered');
  const viewResult = document.getElementById('view-result');
  const viewFinal = document.getElementById('view-final');

  const playerNameEl = document.getElementById('player-name');
  const playerCountEl = document.getElementById('player-count-number');
  const questionCounter = document.getElementById('question-counter-player');
  const questionTextEl = document.getElementById('player-question-text');
  const answersGrid = document.getElementById('answers-grid');

  const feedbackIcon = document.getElementById('feedback-icon');
  const feedbackText = document.getElementById('feedback-text');
  const correctAnswerText = document.getElementById('correct-answer-text');
  const playerTotalScore = document.getElementById('player-total-score');
  const playerFeedback = document.getElementById('player-feedback');

  let selectedAnswer = null;
  let currentOptions = [];

  // ===== AUDIO ELEMENTS =====
  const audioCorrect = new Audio('audio/ding-sound-effect_1_CVUaI0C.mp3');
  const audioWrong = new Audio('audio/fahhh_KcgAXfs.mp3');

  // ===== VIEW SWITCHING =====
  function showView(view) {
    viewWaiting.classList.add('hidden');
    viewQuestion.classList.add('hidden');
    viewAnswered.classList.add('hidden');
    viewResult.classList.add('hidden');
    viewFinal.classList.add('hidden');
    view.classList.remove('hidden');
  }

  // ===== RENDER LEADERBOARD =====
  function renderLeaderboard(container, top5) {
    const medals = ['🥇', '🥈', '🥉', '', ''];
    container.innerHTML = top5
      .map((p, i) => `
        <li class="leaderboard-item">
          <span class="leaderboard-rank">${medals[i] || (i + 1)}</span>
          <span class="leaderboard-name">${p.username}</span>
          <span class="leaderboard-score">${formatCurrency(p.score)}</span>
        </li>
      `)
      .join('');
  }

  // ===== SET USERNAME =====
  if (playerNameEl) playerNameEl.textContent = username;

  // ===== RE-JOIN THE ROOM =====
  // If connection drops and re-establishes, socket.io automatically triggers this
  socket.on('connect', () => {
    socket.emit('joinRoom', { pin: '1234', username, playerId });
    socket.emit('requestState'); // Asks backend: "What screen should I be showing right now?"
  });

  socket.on('disconnect', () => {
    console.warn("Verbinding verbroken. Automatisch proberen te herstellen...");
  });

  // ===== SOCKET EVENTS =====

  socket.on('playerCount', ({ count }) => {
    if (playerCountEl) playerCountEl.textContent = count;
  });

  // New question received
  socket.on('newQuestion', ({ questionIndex, totalQuestions, questionText, options, image }) => {
    selectedAnswer = null;
    currentOptions = options;
    showView(viewQuestion);

    questionCounter.textContent = `Vraag ${questionIndex + 1} / ${totalQuestions}`;
    questionTextEl.textContent = questionText;

    const imgEl = document.getElementById('player-question-image');
    if (imgEl) {
      if (image) {
        imgEl.src = image;
        imgEl.style.display = 'block';
      } else {
        imgEl.style.display = 'none';
        imgEl.src = '';
      }
    }

    // E-commerce CTA Button Styles
    const colors = ['bol', 'amazon', 'shopify', 'purple'];
    const icons = ['🛒', '🛍️', '📦', '🎁'];

    answersGrid.innerHTML = options
      .map((opt, i) => `
        <button class="btn-answer btn-answer--${colors[i]}" id="answer-btn-${i}" data-index="${i}">
          <span class="btn-answer-icon">${icons[i]}</span>
          <span class="btn-answer-text">${opt}</span>
        </button>
      `)
      .join('');

    answersGrid.querySelectorAll('.btn-answer').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (selectedAnswer !== null) return;

        selectedAnswer = parseInt(btn.dataset.index);
        btn.classList.add('btn-answer--selected');
        
        // Processing Order State
        btn.innerHTML = `<span class="spinner"></span><span class="btn-answer-text">Processing Order...</span>`;

        answersGrid.querySelectorAll('.btn-answer').forEach((b) => {
          b.disabled = true;
          if (b !== btn) b.style.opacity = '0.5';
        });

        socket.emit('submitAnswer', { answerIndex: selectedAnswer });
      });
    });
  });

  // Timer updates (Flash Sale)
  socket.on('timerUpdate', ({ time }) => {
    const timerText = document.getElementById('player-timer-text');
    const timerBar = document.getElementById('player-timer-bar');
    
    if (timerText) timerText.textContent = time;
    if (timerBar) {
      timerBar.style.width = `${(time / 30) * 100}%`;
      const flashSaleContainer = document.querySelector('.flash-sale-container');
      if (time <= 5 && flashSaleContainer) {
        flashSaleContainer.classList.add('flash-sale--urgent');
      } else if (flashSaleContainer) {
        flashSaleContainer.classList.remove('flash-sale--urgent');
      }
    }
  });

  // Answer received confirmation
  socket.on('answerReceived', () => {
    showView(viewAnswered);
  });

  // Show leaderboard / result
  socket.on('showLeaderboard', ({ correctIndex, correctAnswer, top5, isLastQuestion }) => {
    if (isLastQuestion) {
      // FINAL SCREEN
      showView(viewFinal);

      const finalLeaderboard = document.getElementById('final-leaderboard');
      renderLeaderboard(finalLeaderboard, top5);

      // Find own score
      const me = top5.find((p) => p.username === username);
      const finalScoreEl = document.getElementById('final-score');
      if (me) {
        animateValue(finalScoreEl, previousScore, me.score, 2000);
      } else {
        finalScoreEl.textContent = '—';
      }
    } else {
      // RESULT VIEW
      showView(viewResult);

      // Set correct answer
      correctAnswerText.textContent = correctAnswer;

      // Check if player answered correctly
      const isCorrect = Array.isArray(correctIndex) ? correctIndex.includes(selectedAnswer) : selectedAnswer === correctIndex;
      const didNotAnswer = selectedAnswer === null;
      
      const scoreLabel = document.querySelector('.result-score-label');

      if (didNotAnswer) {
        audioWrong.currentTime = 0;
        audioWrong.play().catch(e => console.warn(e));
        feedbackIcon.innerHTML = '⏱️';
        feedbackText.textContent = 'Transaction Cancelled (Timeout)';
        playerFeedback.className = 'feedback feedback--incorrect';
        if (scoreLabel) scoreLabel.textContent = 'Huidige balans';
      } else if (isCorrect) {
        audioCorrect.currentTime = 0;
        audioCorrect.play().catch(e => console.warn(e));
        feedbackIcon.innerHTML = '✅';
        feedbackText.textContent = 'Order Confirmed!';
        playerFeedback.className = 'feedback feedback--correct';
        if (scoreLabel) scoreLabel.textContent = 'Nieuwe Profit ⭐';
      } else {
        audioWrong.currentTime = 0;
        audioWrong.play().catch(e => console.warn(e));
        feedbackIcon.innerHTML = '<div class="out-of-stock-badge">OUT OF STOCK</div>';
        feedbackText.textContent = 'Transaction Declined.';
        playerFeedback.className = 'feedback feedback--incorrect';
        if (scoreLabel) scoreLabel.textContent = 'Huidige balans';
      }

      // Find own score in leaderboard & animate
      const me = top5.find((p) => p.username === username);
      const targetScore = me ? me.score : 0;
      animateValue(playerTotalScore, previousScore, targetScore, 1500);
      previousScore = targetScore;
    }
  });

  // Game over (fallback)
  socket.on('gameOver', () => {
    showView(viewFinal);
  });

  socket.on('forceReload', () => {
    sessionStorage.removeItem('rody_username');
    localStorage.removeItem('rody_player_id'); // Optional: explicitly purge ID if kicked
    window.location.href = 'index.html';
  });
}
