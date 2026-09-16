const API = "http://localhost:5000/api/tasks";
let allTasks = [];
let currentFilter = "전체";
let selectedSubject = '';
let pendingDeleteId = null;

let activeSubjects = [];

// 학년별 반 개수 조절 (1학년: 13반 / 2학년: 12반)
function updateClassOptions() {
  const gradeSelect = document.getElementById("setup-grade");
  const classSelect = document.getElementById("setup-class");
  if (!gradeSelect || !classSelect) return;

  const grade = gradeSelect.value;
  const maxClass = grade === "2" ? 12 : 13;
  
  let optionsHtml = "";
  for (let i = 1; i <= maxClass; i++) {
    optionsHtml += `<option value="${i}">${i}반</option>`;
  }
  classSelect.innerHTML = optionsHtml;
}

function getSubjectColor(subject) {
  const fixedColors = {
    "공통국어1": "#818cf8", "공통국어2": "#818cf8",
    "공통영어1": "#34d399", "공통영어2": "#34d399",
    "공통수학1": "#fbbf24", "공통수학2": "#fbbf24",
    "통합과학1": "#60a5fa", "통합과학2": "#60a5fa",
    "통합사회1": "#f87171", "통합사회2": "#f87171",
    "한국사": "#c084fc", "체육": "#2dd4bf",
    "음악": "#fb923c", "기술가정": "#a7f3d0",
    "정보": "#38bdf8", "미술": "#f472b6",
    "화법과 언어": "#a78bfa", "대수": "#f59e0b",
    "영어1": "#10b981", "문학": "#e879f9",
    "미적분1": "#f43f5e", "영어2": "#06b6d4"
  };
  if (fixedColors[subject]) return fixedColors[subject];
  let hash = 0;
  for (let i = 0; i < subject.length; i++) {
    hash = subject.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash % 360);
  return `hsl(${h}, 70%, 65%)`;
}

function showPage(pageId) {
  document.querySelectorAll('.view-page').forEach(p => p.classList.remove('active'));
  document.getElementById(pageId).classList.add('active');
}

function submitSetup() {
  const grade = document.getElementById("setup-grade").value;
  const sClass = parseInt(document.getElementById("setup-class").value);
  const term = document.getElementById("setup-term").value;

  let subjects = [];

  if (grade === "1") {
    subjects = [
      `공통국어${term}`,
      `공통영어${term}`,
      `공통수학${term}`,
      `통합과학${term}`,
      `통합사회${term}`,
      "한국사",
      "체육"
    ];

    if (sClass >= 1 && sClass <= 6) {
      if (term === "1") {
        subjects.push("음악", "기술가정");
      } else {
        subjects.push("정보", "미술");
      }
    } else if (sClass >= 7 && sClass <= 13) {
      if (term === "1") {
        subjects.push("정보", "미술");
      } else {
        subjects.push("음악", "기술가정");
      }
    }
  } else if (grade === "2") {
    if (term === "1") {
      subjects = ["화법과 언어", "대수", "영어1", "체육"];
      if (sClass >= 1 && sClass <= 6) {
        subjects.push("음악");
      } else if (sClass >= 7 && sClass <= 12) {
        subjects.push("미술");
      }
    } else if (term === "2") {
      subjects = ["문학", "미적분1", "영어2", "체육"];
      if (sClass >= 1 && sClass <= 6) {
        subjects.push("미술");
      } else if (sClass >= 7 && sClass <= 12) {
        subjects.push("음악");
      }
    }
  }

  activeSubjects = subjects;
  localStorage.setItem("activeSubjects", JSON.stringify(activeSubjects));
  localStorage.setItem("userClassConfig", JSON.stringify({ grade, sClass, term }));

  initDashboard();
}

function resetSetupData() {
  if(confirm("학급 설정을 변경하시겠습니까? (저장된 과목 리스트가 초기화됩니다.)")) {
    localStorage.removeItem("activeSubjects");
    localStorage.removeItem("userClassConfig");
    document.getElementById("filter-container").innerHTML = "";
    updateClassOptions();
    showPage("page-setup");
  }
}

function initDashboard() {
  const config = JSON.parse(localStorage.getItem("userClassConfig"));
  if(config) {
    document.getElementById("header-class-info").textContent = `${config.grade}학년 ${config.sClass}반 (${config.term}학기) ⚙️`;
  }
  
  activeSubjects = JSON.parse(localStorage.getItem("activeSubjects")) || [];
  if(activeSubjects.length > 0 && (!selectedSubject || !activeSubjects.includes(selectedSubject))) {
    selectedSubject = activeSubjects[0];
  }

  renderFiltersAndDropdown();
  loadTasks();
  showPage("page-dashboard");
}

function setStatus(ok) {
  const dot = document.getElementById("status-dot");
  const txt = document.getElementById("status-text");
  dot.className = "dot " + (ok ? "connected" : "error");
  txt.textContent = ok ? "연결됨" : "오프라인(Local)";
}

function toggleModal() {
  const overlay = document.getElementById("modal-overlay");
  const fab = document.getElementById("fab");
  const isOpen = overlay.classList.contains("open");
  overlay.classList.toggle("open");
  fab.classList.toggle("open");
  document.getElementById("select-btn").classList.remove("open");
  document.getElementById("select-dropdown").classList.remove("open");
  if (!isOpen) document.getElementById("title").focus();
}

function closeOnOverlay(e) {
  if (e.target === document.getElementById("modal-overlay")) toggleModal();
}

async function loadTasks() {
  try {
    const res = await fetch(API);
    if (!res.ok) throw new Error();
    allTasks = await res.json();
    setStatus(true);
  } catch {
    setStatus(false);
    const saved = localStorage.getItem("tasks");
    allTasks = saved ? JSON.parse(saved) : [
      { id: 1, subject: activeSubjects[0] || "공통국어1", title: "예시 수행평가", due: "2026-07-20", done: false },
    ];
  }
  renderTasks();
  updateStats();
}

function saveLocal() {
  localStorage.setItem("tasks", JSON.stringify(allTasks));
}

function renderFiltersAndDropdown() {
  const filterContainer = document.getElementById("filter-container");
  if (filterContainer) {
    let filterHtml = `<button class="filter-btn ${currentFilter === '전체' ? 'active' : ''}" onclick="setFilter('전체', this)">전체</button>`;
    activeSubjects.forEach(sub => {
      filterHtml += `<button class="filter-btn ${currentFilter === sub ? 'active' : ''}" onclick="setFilter('${sub}', this)">${sub}</button>`;
    });
    filterContainer.innerHTML = filterHtml;
  }

  const dropdownContainer = document.getElementById("select-dropdown");
  const labelContainer = document.getElementById("select-label");
  
  if (dropdownContainer) {
    if (activeSubjects.length > 0 && (!selectedSubject || !activeSubjects.includes(selectedSubject))) {
      selectedSubject = activeSubjects[0];
    }
    
    if (labelContainer && selectedSubject) {
      labelContainer.textContent = selectedSubject;
      labelContainer.style.color = getSubjectColor(selectedSubject);
    }

    let dropdownHtml = "";
    activeSubjects.forEach(sub => {
      const color = getSubjectColor(sub);
      dropdownHtml += `
        <div class="custom-select-option ${selectedSubject === sub ? 'selected' : ''}" onclick="selectOption('${sub}', '${color}')">
          <span class="opt-dot" style="background:${color}"></span>${sub}
        </div>`;
    });
    dropdownContainer.innerHTML = dropdownHtml;
  }
}

function renderTasks() {
  const list = document.getElementById("task-list");
  const filtered = currentFilter === "전체"
    ? allTasks
    : allTasks.filter(t => t.subject === currentFilter);

  if (filtered.length === 0) {
    list.innerHTML = `<div class="empty"><div class="empty-icon">🎉</div>수행평가가 없어요!</div>`;
    return;
  }

  list.innerHTML = filtered.map(task => {
    const color = getSubjectColor(task.subject);
    return `
      <div class="task-item ${task.done ? 'done' : ''}">
        <div class="task-check ${task.done ? 'checked' : ''}"
             onclick="toggleDone(${task.id}, ${task.done})">${task.done ? '✓' : ''}</div>
        <span class="subject-badge" style="background:${color}20; color:${color}">${task.subject}</span>
        <div class="task-info">
          <div class="task-title">${task.title}</div>
          <div class="task-due">마감일: ${task.due}</div>
        </div>
        <span class="dday-badge ${ddayClass(task.due, task.done)}">${ddayText(task.due, task.done)}</span>
        <button class="btn-del" onclick="deleteTask(${task.id})">×</button>
      </div>
    `;
  }).join("");
}

function openSubjectModal() {
  document.getElementById("subject-modal").classList.add("open");
  renderSubjectManageList();
}

function closeSubjectModal() {
  document.getElementById("subject-modal").classList.remove("open");
  document.getElementById("new-subject-input").value = "";
}

function closeSubjectModalOnOverlay(e) {
  if (e.target === document.getElementById("subject-modal")) closeSubjectModal();
}

function renderSubjectManageList() {
  const box = document.getElementById("subject-manage-list");
  if(!box) return;

  if(activeSubjects.length === 0) {
    box.innerHTML = `<div style="text-align:center; color:var(--text-muted); font-size:13px; padding:20px 0;">등록된 과목이 없습니다.</div>`;
    return;
  }

  box.innerHTML = activeSubjects.map(sub => {
    const color = getSubjectColor(sub);
    const hasTasks = allTasks.some(t => t.subject === sub);
    return `
      <div class="subject-manage-item">
        <div class="sub-item-left">
          <span class="sub-item-dot" style="background:${color}"></span>
          <span>${sub}</span>
        </div>
        <button class="btn-sub-item-del" onclick="removeSubjectInline('${sub}', ${hasTasks})">✕</button>
      </div>
    `;
  }).join("");
}

function addSubjectInline() {
  const input = document.getElementById("new-subject-input");
  const value = input.value.trim();
  
  if(!value) { alert("과목명을 입력해 주세요!"); return; }
  if(activeSubjects.includes(value)) { alert("이미 존재하는 과목명입니다."); return; }

  activeSubjects.push(value);
  localStorage.setItem("activeSubjects", JSON.stringify(activeSubjects));
  
  input.value = "";
  selectedSubject = value; 
  
  renderSubjectManageList();
  renderFiltersAndDropdown();
  renderTasks();
}

function removeSubjectInline(subject, hasTasks) {
  if(hasTasks) {
    alert(`'${subject}' 과목에 아직 등록된 수행평가 데이터가 존재하여 삭제할 수 없습니다. 수행평가 데이터부터 먼저 삭제해 주세요!`);
    return;
  }

  if(confirm(`'${subject}' 과목을 목록에서 완전히 삭제할까요?`)) {
    activeSubjects = activeSubjects.filter(s => s !== subject);
    localStorage.setItem("activeSubjects", JSON.stringify(activeSubjects));
    
    if (currentFilter === subject) currentFilter = "전체";
    if (selectedSubject === subject) selectedSubject = activeSubjects[0] || '';

    renderSubjectManageList();
    renderFiltersAndDropdown();
    renderTasks();
  }
}

function updateStats() {
  const total = allTasks.length;
  const done = allTasks.filter(t => t.done).length;
  document.getElementById("stat-total").textContent = total;
  document.getElementById("stat-done").textContent = done;
  document.getElementById("stat-remain").textContent = total - done;
}

function dday(due) {
  const today = new Date(); today.setHours(0,0,0,0);
  return Math.ceil((new Date(due) - today) / 86400000);
}

function ddayText(due, done) {
  if (done) return "완료";
  const d = dday(due);
  if (d < 0) return "기한초과";
  if (d === 0) return "D-Day";
  return `D-${d}`;
}

function ddayClass(due, done) {
  if (done) return "dday-done";
  const d = dday(due);
  if (d <= 3) return "dday-urgent";
  if (d <= 7) return "dday-soon";
  return "dday-ok";
}

async function addTask() {
  const subject = selectedSubject;
  const title = document.getElementById("title").value.trim();
  const due = document.getElementById("due").value;
  if (!subject) { alert("과목을 선택하거나 과목 관리에서 등록해주세요!"); return; }
  if (!title) { alert("제목을 입력해주세요!"); return; }
  if (!due) { alert("마감일을 선택해주세요!"); return; }

  const newTask = { subject, title, due, done: false };
  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newTask),
    });
    if (res.ok) allTasks.push(await res.json());
    else throw new Error();
  } catch {
    newTask.id = Date.now();
    allTasks.push(newTask);
  }
  document.getElementById("title").value = "";
  document.getElementById("due").value = "";
  saveLocal();
  toggleModal();
  renderTasks();
  updateStats();
}

async function toggleDone(id, currentDone) {
  try {
    await fetch(`${API}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !currentDone }),
    });
  } catch {}
  const task = allTasks.find(t => t.id === id);
  if (task) task.done = !currentDone;
  saveLocal();
  renderTasks(); updateStats();
}

function toggleDropdown() {
  const btn = document.getElementById("select-btn");
  const dd = document.getElementById("select-dropdown");
  btn.classList.toggle("open");
  dd.classList.toggle("open");
}

function selectOption(value, color) {
  selectedSubject = value;
  document.getElementById("select-label").textContent = value;
  document.getElementById("select-label").style.color = color;
  document.querySelectorAll(".custom-select-option").forEach(o => o.classList.remove("selected"));
  if (event && event.currentTarget) {
    event.currentTarget.classList.add("selected");
  }
  document.getElementById("select-btn").classList.remove("open");
  document.getElementById("select-dropdown").classList.remove("open");
}

document.addEventListener("click", (e) => {
  const cs = document.getElementById("custom-select");
  if (cs && !cs.contains(e.target)) {
    document.getElementById("select-btn").classList.remove("open");
    document.getElementById("select-dropdown").classList.remove("open");
  }
});

// 수정된 삭제 확인 모달 제어 함수
function closeConfirm() {
  const overlay = document.getElementById("confirm-overlay");
  if (overlay) overlay.classList.remove("open");
  
  const okBtn = document.getElementById("confirm-ok-btn");
  if (okBtn) okBtn.onclick = null;
  
  pendingDeleteId = null;
}

// 중복 핸들러 실행을 막아 1회만 클릭하도록 수정한 deleteTask
async function deleteTask(id) {
  pendingDeleteId = id;
  const overlay = document.getElementById("confirm-overlay");
  const okBtn = document.getElementById("confirm-ok-btn");
  
  if (overlay) overlay.classList.add("open");
  
  if (okBtn) {
    okBtn.onclick = null;
    
    okBtn.onclick = async () => {
      const targetId = pendingDeleteId;
      closeConfirm();
      
      if (targetId !== null) {
        try { 
          await fetch(`${API}/${targetId}`, { method: "DELETE" }); 
        } catch {}
        allTasks = allTasks.filter(t => t.id !== targetId);
        saveLocal();
        renderTasks(); 
        updateStats();
      }
    };
  }
}

function setFilter(subject, btn) {
  currentFilter = subject;
  document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add('active');
  renderTasks();
}

window.addEventListener('DOMContentLoaded', () => {
  document.getElementById("due").min = new Date().toISOString().split("T")[0];
  
  updateClassOptions();
  
  const hasConfig = localStorage.getItem("userClassConfig");
  if (hasConfig) {
    initDashboard();
  } else {
    showPage("page-setup");
  }
});
