import axios from "https://cdn.jsdelivr.net/npm/axios@1.6.8/+esm";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, doc, setDoc, getDoc, collection, getDocs, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";  
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyAlktJXgwAXkpV84NaCsvJ7XeBt6b5aQE8",
  authDomain: "vocabulary-database-30f71.firebaseapp.com",
  projectId: "vocabulary-database-30f71",
  storageBucket: "vocabulary-database-30f71.appspot.com",
  messagingSenderId: "650892651055",
  appId: "1:650892651055:web:57232bc35d354e8aa0f4da",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let currentUser = null;
let quizData = [];
let currentQuestionIndex = 0;
let correctCount = 0;
let wrongCount = 0;
let timer = null;
let timeLeft = 20;
let answerLocked = false;
let quizPercentage = 75;

// Elements
const authModal = document.getElementById("authModal");
const nicknameInput = document.getElementById("nickname");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");
const quizStats = document.getElementById("quizStats");
const quizCountDisplay = document.getElementById("quizCountDisplay");
const sidebar = document.querySelector(".sidebar");
const greeting = document.getElementById("username");
const logoutBtn = document.getElementById("logoutBtn");
const userBlock = document.getElementById("userBlock");
const adminPanel = document.getElementById("adminPanel");
const adminStats = document.getElementById("adminStats");
const mainContent = document.querySelector(".main-content");
const levelSelect = document.getElementById("levelSelect");
const unitSelect = document.getElementById("unitSelect");
const startQuizBtn = document.getElementById("startQuiz");
const wordListBody = document.querySelector("#wordList tbody");
const quizModal = document.getElementById("quizModal");
const quizTitle = document.getElementById("quizTitle");
const quizQuestion = document.getElementById("quizQuestion");
const userAnswer = document.getElementById("userAnswer");
const submitAnswerBtn = document.getElementById("submitAnswer");
const feedback = document.getElementById("feedback");
const timerDisplay = document.getElementById("timer");
const togglePassword = document.getElementById("togglePassword");
const resultModal = document.getElementById("resultModal");
const resultCorrect = document.getElementById("resultCorrect");
const resultWrong = document.getElementById("resultWrong");
const hamburgerBtn = document.getElementById("hamburgerBtn");
const overlay = document.getElementById("overlay");

// AUTH

loginBtn.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  if (!email || !password) return alert("Fill in all fields");
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const user = cred.user;
    const docSnap = await getDoc(doc(db, "users", user.uid));
    const nickname = docSnap.exists() ? docSnap.data().nickname : "User";
    currentUser = { uid: user.uid, nickname, email: user.email };
    showUserInterface();
  } catch (err) {
    alert("Login failed: " + err.message);
  }
});

registerBtn.addEventListener("click", async () => {
  const nickname = nicknameInput.value.trim();
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  if (!nickname || !email || !password) return alert("Fill in all fields");
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const user = cred.user;
    await setDoc(doc(db, "users", user.uid), { nickname, email });
    currentUser = { uid: user.uid, nickname, email };
    showUserInterface();
  } catch (err) {
    alert("Registration failed: " + err.message);
  }
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  currentUser = null;
  userBlock.classList.add("hidden");
  adminPanel.classList.add("hidden");
  mainContent.classList.add("blur-background");
  sidebar.classList.add("blur-background");
  authModal.classList.remove("hidden");
});
function showUserInterface() {
  authModal.classList.add("hidden");
  userBlock.classList.remove("hidden");
  mainContent.classList.remove("hidden", "blur-background");
  sidebar.classList.remove("hidden", "blur-background");
  greeting.textContent = currentUser.nickname;

  // Показываем/скрываем панель админа (но НЕ вызываем render здесь)
  if (currentUser.email === "asadbekqurbonov69@gmail.com") {
    adminPanel.classList.remove("hidden");
  } else {
    adminPanel.classList.add("hidden");
  }
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      const docSnap = await getDoc(doc(db, "users", user.uid));
      const nickname = docSnap.exists() ? docSnap.data().nickname : "User";

      currentUser = {
        uid: user.uid,
        nickname,
        email: user.email
      };

      showUserInterface();

      if (currentUser.email === "asadbekqurbonov69@gmail.com") {
        await renderAdminStats();
      } else {
        await renderUserStats();
      }

    } catch (err) {
      console.error("Ошибка при загрузке профиля:", err.message);
    }

  } else {
    // Только если точно не авторизован — показываем модалку
    authModal.classList.remove("hidden");
    mainContent.classList.add("blur-background");
    sidebar.classList.add("blur-background");
    userBlock.classList.add("hidden");
    adminPanel.classList.add("hidden");
  }
  console.log("Auth loaded, email:", user.email);
});



// QUIZ

levelSelect.addEventListener("change", () => {
  unitSelect.value = "";
  startQuizBtn.disabled = true;
  wordListBody.innerHTML = "<tr><td colspan='2'>Select unit</td></tr>";
});

unitSelect.addEventListener("change", () => {
  if (levelSelect.value && unitSelect.value) loadWords();
});

startQuizBtn.addEventListener("click", () => {
  if (!quizData.length) return;
  quizData = quizData.sort(() => Math.random() - 0.5);
  currentQuestionIndex = correctCount = wrongCount = 0;
  levelSelect.disabled = unitSelect.disabled = startQuizBtn.disabled = true;
  userAnswer.value = "";
  feedback.textContent = "";
  openQuizModal();
  showQuestion();
  startTimer();
});

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// async function loadWords() {
//   const level = levelSelect.value;
//   const unit = unitSelect.value;
//   const path = `./data/${level}/unit${unit}.json`;

//   try {
//     const res = await axios.get(path);
//     const allWords = res.data.map(w => ({ word: w.en, translation: w.ru }));
//     const shuffled = shuffle([...allWords]); // Копируем и перемешиваем
//     const count = Math.floor((allWords.length * quizPercentage) / 100);
//     quizData = shuffled.slice(0, count);

//     quizCountDisplay.textContent = `The quiz will have: ${quizData.length} words`;
//     wordListBody.innerHTML = quizData
//       .map(w => `<tr><td>${w.translation}</td><td>${w.word}</td></tr>`)
//       .join("");
//     startQuizBtn.disabled = false;
//   } catch {
//     wordListBody.innerHTML = "<tr><td colspan='2'>Error loading words</td></tr>";
//   }
// }

async function loadWords() {
  const level = levelSelect.value;
  const unit = unitSelect.value;
  const path = `./data/${level}/unit${unit}.json`;

  try {
    console.log("Loading from:", path); // отладка

    const res = await axios.get(path);
    const allWords = res.data.map(w => ({ word: w.en, translation: w.ru }));

    // 👇 Показываем ВСЕ слова в таблице
    wordListBody.innerHTML = allWords
      .map(w => `<tr><td>${(w.translation)}</td><td>${(w.word)}</td></tr>`)
      .join("");

    // 👇 75% перемешанных слов для квиза
    const shuffled = shuffle([...allWords]);
    const count = Math.floor((allWords.length * quizPercentage) / 100);
    quizData = shuffled.slice(0, count);

    quizCountDisplay.textContent = `The quiz will have: ${quizData.length} words`;
    startQuizBtn.disabled = false;

  } catch (err) {
    console.error("❌ Error loading words:", err.message);
    wordListBody.innerHTML = "<tr><td colspan='2'>Error loading words</td></tr>";
  }
}



function openQuizModal() {
  quizModal.classList.remove("hidden");
  mainContent.classList.add("blur-background");
  sidebar.classList.add("blur-background");
}

function closeQuizModal() {
  quizModal.classList.add("hidden");
  mainContent.classList.remove("blur-background");
  sidebar.classList.remove("blur-background");
  levelSelect.disabled = unitSelect.disabled = startQuizBtn.disabled = false;
}

function showQuestion() {
  const q = quizData[currentQuestionIndex];
  quizTitle.textContent = `Question ${currentQuestionIndex + 1} of ${quizData.length}`;
  quizQuestion.innerHTML = `Translate: <strong>${q.translation}</strong>`;
  userAnswer.value = "";
  feedback.textContent = "";
  userAnswer.focus();
  submitAnswerBtn.disabled = true;
  timeLeft = 20;
  updateTimerDisplay();
  setTimeout(() => {
    userAnswer.focus();
  
    // 👉 iOS Safari fix: небольшая прокрутка помогает показать клавиатуру
    window.scrollTo(0, userAnswer.offsetTop - 30);
  }, 100);
}

function updateTimerDisplay() {
  timerDisplay.textContent = `00:${timeLeft.toString().padStart(2, "0")}`;
}

function startTimer() {
  clearInterval(timer);
  timer = setInterval(() => {
    timeLeft--;
    updateTimerDisplay();
    if (timeLeft <= 0) {
      clearInterval(timer);
      handleAnswer("");
    }
  }, 1000);
}

submitAnswerBtn.addEventListener("click", () => handleAnswer(userAnswer.value.trim()));
userAnswer.addEventListener("input", () => {
  submitAnswerBtn.disabled = userAnswer.value.trim() === "";
});
userAnswer.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    handleAnswer(userAnswer.value.trim());
  }
});

function handleAnswer(answer) {
  if (answerLocked) return;
  answerLocked = true;
  submitAnswerBtn.disabled = true;
  clearInterval(timer);
  const correct = quizData[currentQuestionIndex].word.toLowerCase();
  if (answer.toLowerCase() === correct) {
    correctCount++;
    feedback.textContent = "Correct!";
    feedback.className = "correct";
  } else {
    wrongCount++;
    feedback.textContent = `Wrong! Correct: ${correct}`;
    feedback.className = "wrong";
  }

  currentQuestionIndex++;
  if (currentQuestionIndex < quizData.length) {
    setTimeout(() => {
      showQuestion();
      startTimer();
      answerLocked = false;
    }, 1200);
  } else {
    setTimeout(endQuiz, 1500);
  }
}

async function endQuiz() {
  closeQuizModal();
  resultCorrect.textContent = correctCount;
  resultWrong.textContent = wrongCount;
  resultModal.classList.remove("hidden");

  await saveUserStats(currentUser.uid, {
    correct: correctCount,
    wrong: wrongCount,
    level: levelSelect.value,
    unit: unitSelect.value,
    date: new Date().toISOString()
  });

  if (currentUser.email === "asadbekqurbonov69@gmail.com") {
    renderAdminStats();
  } else {
    renderUserStats();
  }
  console.log("Saving stats for", currentUser.uid);
}


const saveAndEndBtn = document.getElementById("saveAndEndBtn");

saveAndEndBtn.addEventListener("click", async () => {
  saveAndEndBtn.disabled = true;
  saveAndEndBtn.textContent = "Saving...";

  try {
    await saveUserStats(currentUser.uid, {
      correct: correctCount,
      wrong: wrongCount,
      level: levelSelect.value,
      unit: unitSelect.value,
      date: new Date().toISOString()
    });

    // ⏳ Немного подождём, чтобы показать пользователю, что сохранилось
    setTimeout(() => {
      location.reload(); // ✅ Перезагружаем страницу
    }, 800);

  } catch (err) {
    console.error("❌ Error saving stats:", err);
    alert("Failed to save stats.");
    saveAndEndBtn.disabled = false;
    saveAndEndBtn.textContent = "Save and Finish";
  }
});

async function saveUserStats(uid, stats) {
  const ref = doc(db, "stats", uid);
  const snap = await getDoc(ref);
  const history = snap.exists() ? snap.data().history || [] : [];
  history.push(stats);
  await setDoc(ref, { history }, { merge: true });
}

resultModal.querySelector("button").addEventListener("click", () => {
  resultModal.classList.add("hidden");
});

// SIDEBAR

hamburgerBtn.addEventListener("click", () => {
  sidebar.classList.add("open");
  overlay.classList.add("active");
  hamburgerBtn.classList.add("hidden-hamburger");
});

overlay.addEventListener("click", () => {
  sidebar.classList.remove("open");
  overlay.classList.remove("active");
  hamburgerBtn.classList.remove("hidden-hamburger");
});


document.addEventListener("click", (e) => {
  if (
    window.innerWidth <= 768 &&
    sidebar.classList.contains("open") &&
    !sidebar.contains(e.target) &&
    !hamburgerBtn.contains(e.target)
  ) {
    sidebar.classList.remove("open");
    overlay.classList.remove("active");
    hamburgerBtn.classList.remove("hidden-hamburger");
  }
});

// Admin panel render

async function renderAdminStats() {
  adminStats.innerHTML = "";

  const usersSnap = await getDocs(collection(db, "users"));
  const userMap = {};
  usersSnap.forEach(doc => {
    userMap[doc.id] = doc.data().nickname || "Unknown";
  });

  const statsSnap = await getDocs(collection(db, "stats"));
  if (statsSnap.empty) {
    adminStats.innerHTML = "<p>No statistics available</p>";
    return;
  }

  statsSnap.forEach(statDoc => {
    const uid = statDoc.id;
    const stats = statDoc.data().history || [];
    const nickname = userMap[uid] || "Unknown";

    const block = document.createElement("div");
    block.classList.add("admin-user-block");

    const statList = stats.map((s, i) =>
      `<li><b>Quiz ${i + 1}</b>: ✅ ${s.correct}, ❌ ${s.wrong}, 
       Level: <b>${s.level || "-"}</b>, Unit: <b>${s.unit || "-"}</b>, 
       Date: ${s.date ? new Date(s.date).toLocaleDateString() : "n/a"}</li>`
    ).join("");

    block.innerHTML = `<h4>${nickname}</h4><ul>${statList}</ul>`;

    adminStats.appendChild(block);
  });
  console.log("renderAdminStats() called");
}

async function renderUserStats() {
  quizStats.innerHTML = "";
  const snap = await getDoc(doc(db, "stats", currentUser.uid));
  const history = snap.exists() ? snap.data().history || [] : [];

  if (!history.length) {
    quizStats.innerHTML = "<li>No quiz data</li>";
    return;
  }

  history.forEach((s, i) => {
    const li = document.createElement("li");
    li.textContent = `Quiz #${i + 1}: ✅ ${s.correct}, ❌ ${s.wrong}, Level: ${s.level || "-"}, Unit: ${s.unit || "-"}, Date: ${s.date ? new Date(s.date).toLocaleDateString() : "n/a"}`;
    quizStats.appendChild(li);
  });
}

async function clearAllStats() {
  try {
    const statsSnap = await getDocs(collection(db, "stats"));
    const batch = writeBatch(db);

    statsSnap.forEach((docRef) => {
      batch.delete(docRef.ref); // ✅ Важно: docRef.ref, а не doc(...)
    });

    await batch.commit();
    alert("✅ All statistics deleted.");
    renderAdminStats();
    location.reload();
  } catch (err) {
    console.error("❌ Failed to clear stats:", err);
    alert("Error clearing stats.");
  }
}


document.getElementById("clearStatsBtn")?.addEventListener("click", async () => {
  if (confirm("Are you sure you want to delete ALL statistics?")) {
    await clearAllStats();
  }
});
togglePassword.addEventListener("change", () => {
  passwordInput.type = togglePassword.checked ? "text" : "password";
});