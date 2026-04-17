const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ===== GAME CONFIG =====
const GAME_PIN = '1234';
const TIMER_DURATION = 30; // seconds per question

// ===== QUESTIONS =====
const questions = [
  { questionText: 'welke kleur is blauw?', options: ['blauw', 'rood', 'groen', 'geel'], correctIndex: 1 },
  { questionText: 'wie is de mol', options: ['roben', 'reben', 'ruben', 'raben'], correctIndex: 2 },
  { questionText: 'van wie is de uitspraak {ik ben zo blauw als een pauw?}', options: ['sven', 'jens', 'stan', 'marijn'], correctIndex: 2 },
  { questionText: 'wanneer is Keet Tranquillo opgericht?', options: ['2016', '2017', '2018', '2015'], correctIndex: 1 },
  { questionText: 'wat is de aller eerste plek van de keet', options: ['Bij wesley', 'bij Nick en Mart', 'Bij Stan', 'Bij Ruben'], correctIndex: 3 },
  { questionText: 'wie sloeg er met een bier pull iemands kop in in zaal dijk?', options: ['Stan', 'Jari', 'Sven Hoes', 'Ruben'], correctIndex: 3 },
  { questionText: 'Wat is een Tomaat?', options: ['Groente', 'Reptiel', 'Fruit', 'Kaapies liefde'], correctIndex: [2, 3] },
  { questionText: 'wie zaagde er bij oud en nieuw bij de keet een boom om?', options: ['Nick', 'Jorry', 'Ingmar', 'Marijn'], correctIndex: 2 },
  { questionText: 'wat is Joris van Luca', options: ['Zijn oom', 'Zijn neef', 'De Pukkel Van nina', 'Luca Junior'], correctIndex: 3 },
  { questionText: 'Jorry is de oudste van de keet', options: ['Waar', 'Niet waar'], correctIndex: 0 },
  { questionText: 'wie heeft er vanaf april tot en met september geen weekend rust door zijn/haar volle planning 🔑 ?', options: ['Nick', 'Bas', 'Jens', 'lieke'], correctIndex: 2 },
  { questionText: 'over wie spreken we als het gaat om de uitspraak {veel vermogend}', options: ['Romy', 'Wesley', 'Bas', 'Bas'], correctIndex: [2, 3] },
  { questionText: 'Wie is er op Mallorca van een Muurtje afgevallen en daar in slaap gevallen?', options: ['Ruben', 'Lisa', 'Sven', 'Stan'], correctIndex: 3 },
  { questionText: 'hoe heet de snackbar op Terschelling?', options: ['de schotse 4', 'WYB', 'het stoepje', 'De clipper'], correctIndex: 3 },
  { questionText: 'wie is de jongste van de Keet?', options: ['Lisa', 'Renee', 'Romy', 'Paula'], correctIndex: 0 },
  { questionText: 'Hoeveel cijfers telt Tranquillo?', options: ['6', '10', '0', '8'], correctIndex: 2 },
  { questionText: 'Wie is Gerard Glans?', options: ['Neef van Ron Jans', 'Personage uit de Dreft reclame', 'Gerard Reins en Robert Lans', 'Hardloper bij AV PEC-1910'], correctIndex: 2 },
  { questionText: 'Hoeveel dagen Heeft Augustus?', options: ['30', '29', '31', '28'], correctIndex: 2 },
  { questionText: 'Wat verzamelen we altijd na een vakantie in het buitenland?', options: ['Soa\'s', 'geld voor een goed doel', 'Kaapies', 'herinneringen'], correctIndex: 2 },
  { questionText: '1000x 25-250=24750', options: ['Waar', 'Niet waar'], correctIndex: 0 },
  { questionText: 'wanneer begon corona?', options: ['April 2019', 'februari 2020', 'Maart 2021', 'December 2019'], correctIndex: 1 },
  { questionText: 'Welke Dame zit er het langste Bij de groep', options: ['Romy', 'Aicha', 'Reneé', 'lieke'], correctIndex: 0 },
  { questionText: 'Wat kregen we bij Vonnie thuis na hem thuis te hebben gebracht met een kruiwagen?', options: ['Tosti', 'Magnum', 'Pepernoten', 'Broodje Bapao'], correctIndex: 3 },
  { questionText: 'Wie heeft er vaak na of tijdens een avond drinken last van zijn pens', options: ['Marijn', 'Iwan', 'Robert', 'Bas'], correctIndex: 3 },
  { questionText: 'Wie Had er vroeger een crush op {Noukie}', options: ['Ruben', 'Iwan', 'Luca', 'Wesley'], correctIndex: 1 },
  { questionText: 'Wie krijgt er als eerst de Keet baby?', options: ['Sven en Romy', 'Nick en Reneé', 'Marijn en Lisa', 'Luca {en zijn balkan hoer}'], correctIndex: [0, 1, 2, 3] },
  { questionText: 'Wie is [Zijn} er na een avondje dijk bij bureau halt belandt?', options: ['Nick', 'jens', 'Sven', 'Mart'], correctIndex: [0, 1, 2, 3] },
  { questionText: 'wie is het leukste zus{je}', options: ['Kyra', 'Nina', 'Demi', 'jill'], correctIndex: [0, 1, 2, 3] },
  { questionText: 'Wie belde zijn vriendin voordat die de stripclub in ging?', options: ['Ingmar', 'Bas', 'Jari', 'Sven'], correctIndex: 0 },
  { questionText: 'waar staat denekamp bekend om', options: ['sociale huur woningen', 'cafe\'s', 'watermolens', 'grachten'], correctIndex: 2 },
  { questionText: 'je kan niet met je ogen open niezen', options: ['Waar', 'Niet waar'], correctIndex: 0 },
  { questionText: 'wat is 53 x 83', options: ['4299', '499', '4399', '4499'], correctIndex: 2 }
];

// ===== GAME STATE =====
const players = {}; // { playerId: { username, score, currentAnswer, activeSocket: socket.id } }
const socketToPlayerMap = {}; // { socketId: playerId }
let currentQuestionIndex = -1; // -1 = game not started
let timerInterval = null;
let timeRemaining = 0;
let questionStartTime = 0;
let answersReceived = 0;

// Serve static files from the public folder
app.use(express.static(path.join(__dirname, 'public')));

// ===== HELPER FUNCTIONS =====
function getPlayerCount() {
  // Count only actively connected players for the dashboard
  return Object.values(players).filter(p => p.activeSocket !== null).length;
}

function startTimer() {
  timeRemaining = TIMER_DURATION;
  questionStartTime = Date.now();
  answersReceived = 0;

  // Reset all player answers for new question
  Object.values(players).forEach((p) => {
    p.currentAnswer = null;
  });

  // Send initial timer
  io.to('game').emit('timerUpdate', { time: timeRemaining });

  // Countdown every second
  timerInterval = setInterval(() => {
    timeRemaining--;
    io.to('game').emit('timerUpdate', { time: timeRemaining });

    if (timeRemaining <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      handleTimeUp();
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function handleTimeUp() {
  stopTimer();

  const q = questions[currentQuestionIndex];

  // Calculate top 5 leaderboard
  const top5 = Object.values(players)
    .filter((p) => p.username && p.username.trim() !== '' && p.activeSocket)
    .map((p) => ({ username: p.username, score: p.score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const isLastQuestion = currentQuestionIndex >= questions.length - 1;

  const correctOptionText = Array.isArray(q.correctIndex) 
    ? q.correctIndex.map(i => q.options[i]).join(', of ') 
    : q.options[q.correctIndex];

  // Send leaderboard + correct answer to ALL clients
  io.to('game').emit('showLeaderboard', {
    correctIndex: q.correctIndex,
    correctAnswer: correctOptionText,
    top5,
    isLastQuestion,
    questionIndex: currentQuestionIndex,
    totalQuestions: questions.length,
  });

  console.log(`⏰ Time's up for question ${currentQuestionIndex + 1}`);
  console.log(`🏆 Top: ${top5.map((p, i) => `${i + 1}. ${p.username} (${p.score})`).join(', ')}`);

  if (isLastQuestion) {
    console.log(`\n🎉 GAME OVER! Winner: ${top5[0]?.username || 'nobody'} with ${top5[0]?.score || 0} points!\n`);
  }
}

function broadcastCurrentQuestion() {
  const q = questions[currentQuestionIndex];

  // CRITICAL: Do NOT send correctIndex to the frontend
  io.to('game').emit('newQuestion', {
    questionIndex: currentQuestionIndex,
    totalQuestions: questions.length,
    questionText: q.questionText,
    options: q.options,
  });

  console.log(`❓ Question ${currentQuestionIndex + 1}/${questions.length}: ${q.questionText}`);

  // Start the countdown
  startTimer();
}

// ===== SOCKET.IO =====
io.on('connection', (socket) => {
  console.log(`[+] New connection: ${socket.id}`);

  // --- Player joins with PIN + username + playerId ---
  socket.on('joinRoom', ({ pin, username, playerId }) => {
    if (!pin || !username || !playerId) {
      socket.emit('joinError', { message: 'Vul zowel PIN als naam in.' });
      return;
    }

    if (pin !== GAME_PIN) {
      socket.emit('joinError', { message: 'Ongeldige PIN. Probeer opnieuw.' });
      return;
    }

    // Profanity Filter
    const PROHIBITED_WORDS = [
      'kanker', 'tyfus', 'tering', 'kut', 'hoer', 'slet', 'mongool', 'klootzak', 'bitch', 'fuck', 'shit', 'asshole', 'dick', 'cunt', 'pussy', 'whore', 'slut', 'fag', 'nigger', 'nigga', 'cancer', 'hitler', 'nazi', 'suck',
      'poep', 'sex', 'seks', 'porno', 'pik', 'lul', 'sneu', 'pedo'
    ];
    const lowerName = username.trim().toLowerCase();
    const isProfane = PROHIBITED_WORDS.some(word => lowerName.includes(word));
    if (isProfane) {
      socket.emit('joinError', { message: 'Deze naam bevat ongepast taalgebruik. Bedenk een leukere naam.' });
      return;
    }

    socket.join('game');

    // RECONNECT LOGIC: Check if this player already exists by UUID
    if (players[playerId]) {
      // Re-map the new physical socket to the existing logical player
      socketToPlayerMap[socket.id] = playerId;
      players[playerId].activeSocket = socket.id;
      players[playerId].username = username.trim(); // Always update to latest display name
      console.log(`🔌 ${username} reconnected (Score: ${players[playerId].score})`);
      socket.emit('joinSuccess', { username: username.trim(), isReconnect: true });
    } else {
      // Check for duplicate username for NEW players
      const nameTaken = Object.values(players).some(
        (p) => p.username.toLowerCase() === username.trim().toLowerCase()
      );
      if (nameTaken) {
        socket.emit('joinError', { message: 'Deze naam is al bezet. Kies een andere.' });
        return;
      }

      // Create new logical player
      socketToPlayerMap[socket.id] = playerId;
      players[playerId] = {
        username: username.trim(),
        score: 0,
        currentAnswer: null,
        activeSocket: socket.id
      };

      console.log(`🎮 ${username} joined the game (${getPlayerCount()} players)`);
      socket.emit('joinSuccess', { username: username.trim(), isReconnect: false });
    }

    // Notify everyone about the updated player count
    io.to('game').emit('playerCount', { count: getPlayerCount() });

    // Also emit to admin (if connected)
    io.emit('playerList', {
      players: Object.values(players).map((p) => p.username),
      count: getPlayerCount(),
    });

  });

  // --- State Synchronization (Player asks: Where are we?) ---
  socket.on('requestState', () => {
    // If game already started, send current state to the reconnecting player
    if (currentQuestionIndex >= 0 && currentQuestionIndex < questions.length) {
      const q = questions[currentQuestionIndex];
      socket.emit('newQuestion', {
        questionIndex: currentQuestionIndex,
        totalQuestions: questions.length,
        questionText: q.questionText,
        options: q.options,
      });

      // If timer is still running, sync it
      if (timeRemaining > 0) {
        socket.emit('timerUpdate', { time: timeRemaining });
      }

      // Check if player had already submitted an answer for this active round BEFORE the drop
      const playerId = socketToPlayerMap[socket.id];
      if (playerId && players[playerId]?.currentAnswer !== null) {
         // They already answered
         socket.emit('answerReceived', { pointsEarned: 0 }); // Just triggering the view
      }

    } else if (currentQuestionIndex >= questions.length) {
      // Game completely over
      socket.emit('gameOver');
    }
  });

  // --- Admin joins ---
  socket.on('adminJoin', () => {
    socket.join('game');
    console.log('👑 Admin connected');
    socket.emit('adminConnected');

    // Send current player list
    socket.emit('playerList', {
      players: Object.values(players).map((p) => p.username),
      count: getPlayerCount(),
    });
  });

  // --- Admin starts the game / sends first question ---
  socket.on('adminStartQuestion', () => {
    if (currentQuestionIndex < 0) {
      currentQuestionIndex = 0;
    }

    if (currentQuestionIndex >= questions.length) {
      socket.emit('gameOver');
      return;
    }

    console.log('🚀 Admin started the game!');
    broadcastCurrentQuestion();
  });

  // --- Admin skips current question ---
  socket.on('adminSkipQuestion', () => {
    if (timerInterval) {
      console.log('⏭️ Admin skipped the question');
      timeRemaining = 0;
      io.to('game').emit('timerUpdate', { time: timeRemaining });
      handleTimeUp();
    }
  });

  // --- Admin resets the session ---
  socket.on('adminResetSession', () => {
    console.log('🔄 Admin triggered a reset. Wiping game data but keeping admin alive.');
    clearInterval(timerInterval);
    
    // Kick all players to the home screen context, but softly reset admins
    io.sockets.sockets.forEach((s) => {
      const mappedPlayerId = socketToPlayerMap[s.id];
      if (mappedPlayerId && players[mappedPlayerId]) {
        s.emit('forceReload'); // player reload
      } else {
        s.emit('adminSoftReset'); // admin soft UI reset
      }
    });

    // Clear maps entirely
    for (const key in players) delete players[key];
    for (const key in socketToPlayerMap) delete socketToPlayerMap[key];
    
    currentQuestionIndex = -1;
    timeRemaining = 30;
  });

  // --- Admin forces game to end early ---
  socket.on('adminForceEndGame', () => {
    console.log('⏭️ Admin forced game to end early -> skipping to final leaderboard');
    clearInterval(timerInterval);
    currentQuestionIndex = questions.length; // Artificially mark as done
    
    // Calculate final scores
    const leaderboard = Object.values(players)
      .filter((p) => p.username && p.username.trim() !== '' && p.activeSocket)
      .sort((a, b) => b.score - a.score);
    const top7 = leaderboard.slice(0, 7);

    io.to('game').emit('showLeaderboard', {
      correctAnswer: 'Afgesloten door Quizmaster',
      top5: top7, // rename logic maintained on client
      isLastQuestion: true,
      questionIndex: currentQuestionIndex,
      totalQuestions: questions.length,
    });
  });

  // --- Admin sends next question ---
  socket.on('adminNextQuestion', () => {
    currentQuestionIndex++;

    if (currentQuestionIndex >= questions.length) {
      io.to('game').emit('gameOver');
      console.log('🏁 Game over! All questions done.');
      return;
    }

    broadcastCurrentQuestion();
  });

  // --- Player submits an answer ---
  socket.on('submitAnswer', ({ answerIndex }) => {
    const playerId = socketToPlayerMap[socket.id];
    if (!playerId) return;
    const player = players[playerId];
    if (!player) return;

    // Already answered this question
    if (player.currentAnswer !== null) return;

    // Game not in progress
    if (currentQuestionIndex < 0 || currentQuestionIndex >= questions.length) return;

    const q = questions[currentQuestionIndex];
    const isCorrect = Array.isArray(q.correctIndex) 
      ? q.correctIndex.includes(answerIndex) 
      : answerIndex === q.correctIndex;

    const elapsed = (Date.now() - questionStartTime) / 1000; // seconds elapsed
    
    // GRACE PERIOD: Reject answers completely if they are 1.5s past the strict Timer. 
    // This accounts for internet drops/latency in an 80-user room.
    if (elapsed > (TIMER_DURATION + 1.5)) {
      console.log(`⚠️ Network Lag: ${player.username} answered too late (${elapsed}s)`);
      return; 
    }

    // Calculate score based on speed (max 1000, linear decrease over TIMER_DURATION)
    let pointsEarned = 0;
    if (isCorrect) {
      // Math.max guarantees 0 points if they answered after TIMER_DURATION but inside Grace Period
      const fraction = Math.max(0, 1 - elapsed / TIMER_DURATION);
      pointsEarned = Math.round(fraction * 1000);
    }

    player.currentAnswer = answerIndex;
    player.score += pointsEarned;
    answersReceived++;

    console.log(
      `📝 ${player.username} answered ${isCorrect ? '✅ correctly' : '❌ wrong'} (+${pointsEarned} pts, total: ${player.score})`
    );

    // Confirm to the player that their answer was received
    socket.emit('answerReceived', { pointsEarned });

    // Notify admin of answer count
    io.to('game').emit('playerAnswered', {
      count: answersReceived,
      total: getPlayerCount(),
    });

    // If ALL players have answered, trigger timeUp early
    if (answersReceived >= getPlayerCount()) {
      console.log('⚡ All players answered — ending round early');
      handleTimeUp();
    }
  });

  // --- Disconnect ---
  socket.on('disconnect', () => {
    const playerId = socketToPlayerMap[socket.id];
    
    if (playerId && players[playerId]) {
      console.log(`[-] ${players[playerId].username} disconnected physically, but session retained.`);
      
      // We do NOT delete the player from the 'players' dictionary anymore!
      // This is the entire point of the V2 architecture. They stay alive so they can reconnect.

      players[playerId].activeSocket = null;
      // We DO delete the physical mapping so memory doesn't leak infinitely for old socket IDs
      delete socketToPlayerMap[socket.id];

      // Update counts based on active connections
      const activeCount = Object.values(players).filter(p => p.activeSocket !== null).length;
      io.to('game').emit('playerCount', { count: activeCount });
      io.emit('playerList', {
        players: Object.values(players).filter(p => p.activeSocket !== null).map((p) => p.username),
        count: activeCount,
      });

      // Note: We avoid deleting them from answered count so the round can still gracefully conclude
    } else {
      console.log(`[-] Disconnected: ${socket.id}`);
    }
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🎮 Rody Quiz server running at http://localhost:${PORT}`);
  console.log(`📌 Game PIN: ${GAME_PIN}`);
  console.log(`👑 Admin panel: http://localhost:${PORT}/admin.html`);
  console.log(`📝 ${questions.length} questions loaded\n`);
});
