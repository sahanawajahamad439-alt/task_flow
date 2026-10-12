/**
 * TaskFlow &mdash; Modern Task Management Application
 * Pure Vanilla JavaScript implementation with LocalStorage, Audio FX, Confetti, and Rich Interactions.
 */

(function () {
  'use strict';

  // --- State & Constants ---
  const STORAGE_KEY = 'taskflow_tasks_v1';
  const THEME_KEY = 'taskflow_theme';
  const SOUND_KEY = 'taskflow_sound_enabled';

  const DEFAULT_TASKS = [
    {
      id: 'task-1',
      text: 'Design sleek dashboard layout and UI components',
      priority: 'high',
      category: 'Work',
      completed: true,
      starred: true,
      createdAt: Date.now() - 3600000 * 2
    },
    {
      id: 'task-2',
      text: 'Press Enter to swiftly add your new tasks',
      priority: 'medium',
      category: 'Learning',
      completed: false,
      starred: false,
      createdAt: Date.now() - 3600000
    },
    {
      id: 'task-3',
      text: 'Explore priority filters, dark/light mode & audio chimes',
      priority: 'low',
      category: 'Personal',
      completed: false,
      starred: false,
      createdAt: Date.now()
    }
  ];

  let tasks = loadTasks();
  let currentFilter = 'all';
  let searchQuery = '';
  let soundEnabled = localStorage.getItem(SOUND_KEY) !== 'false';
  let lastDeletedTask = null;
  let undoTimeout = null;

  // --- Audio Synthesis (Web Audio API) ---
  let audioCtx = null;
  function getAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playSound(type) {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;

      if (type === 'add') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
      } else if (type === 'complete') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
        gain.gain.setValueAtTime(0.09, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        osc.start(now);
        osc.stop(now + 0.28);
      } else if (type === 'delete') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(160, now + 0.15);
        gain.gain.setValueAtTime(0.07, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
      }
    } catch (e) {
      // Audio autoplay restriction fallback
    }
  }

  // --- Confetti Animation ---
  function fireConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const pieces = [];
    const colors = ['#6366f1', '#a855f7', '#ec4899', '#3b82f6', '#10b981', '#f59e0b'];

    for (let i = 0; i < 65; i++) {
      pieces.push({
        x: canvas.width / 2,
        y: canvas.height / 2,
        w: Math.random() * 8 + 4,
        h: Math.random() * 6 + 4,
        vx: (Math.random() - 0.5) * 16,
        vy: (Math.random() - 0.8) * 15,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        spin: (Math.random() - 0.5) * 10,
        alpha: 1
      });
    }

    let animationFrame;
    function render() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let active = false;

      pieces.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.35; // gravity
        p.rotation += p.spin;
        p.alpha -= 0.012;

        if (p.alpha > 0) {
          active = true;
          ctx.save();
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          ctx.restore();
        }
      });

      if (active) {
        animationFrame = requestAnimationFrame(render);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        cancelAnimationFrame(animationFrame);
      }
    }
    render();
  }

  // --- DOM Elements ---
  const todoForm = document.getElementById('todo-form');
  const taskInput = document.getElementById('task-input');
  const clearInputBtn = document.getElementById('clear-input-btn');
  const addTaskBtn = document.getElementById('add-task-btn');
  const prioritySelect = document.getElementById('priority-select');
  const categorySelect = document.getElementById('category-select');
  const taskList = document.getElementById('task-list');
  const emptyState = document.getElementById('empty-state');
  const searchInput = document.getElementById('search-input');
  const clearCompletedBtn = document.getElementById('clear-completed-btn');
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const soundToggleBtn = document.getElementById('sound-toggle-btn');
  const toastContainer = document.getElementById('toast-container');
  const currentDateDisplay = document.getElementById('current-date-display');

  // Stats elements
  const statTotal = document.getElementById('stat-total');
  const statPending = document.getElementById('stat-pending');
  const statCompleted = document.getElementById('stat-completed');
  const progressPercent = document.getElementById('progress-percent');
  const progressFill = document.getElementById('progress-fill');
  const progressTrack = document.getElementById('progress-track');

  // Badge elements
  const badgeAll = document.getElementById('badge-all');
  const badgeActive = document.getElementById('badge-active');
  const badgeCompleted = document.getElementById('badge-completed');
  const badgeStarred = document.getElementById('badge-starred');

  // Edit Modal Elements
  const editModal = document.getElementById('edit-modal');
  const editForm = document.getElementById('edit-form');
  const editTaskId = document.getElementById('edit-task-id');
  const editTaskInput = document.getElementById('edit-task-input');
  const editPrioritySelect = document.getElementById('edit-priority-select');
  const editCategorySelect = document.getElementById('edit-category-select');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const cancelEditBtn = document.getElementById('cancel-edit-btn');

  // --- Initial Setup ---
  function init() {
    initTheme();
    initSound();
    initDateDisplay();
    bindEvents();
    render();
  }

  function initDateDisplay() {
    const now = new Date();
    const options = { weekday: 'long', month: 'short', day: 'numeric' };
    if (currentDateDisplay) {
      currentDateDisplay.textContent = now.toLocaleDateString(undefined, options);
    }
  }

  function initTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(THEME_KEY, next);
    updateThemeIcon(next);
  }

  function updateThemeIcon(theme) {
    const iconSun = themeToggleBtn.querySelector('.icon-sun');
    const iconMoon = themeToggleBtn.querySelector('.icon-moon');
    if (theme === 'light') {
      iconSun.classList.add('hidden');
      iconMoon.classList.remove('hidden');
    } else {
      iconSun.classList.remove('hidden');
      iconMoon.classList.add('hidden');
    }
  }

  function initSound() {
    updateSoundIcon(soundEnabled);
  }

  function toggleSound() {
    soundEnabled = !soundEnabled;
    localStorage.setItem(SOUND_KEY, soundEnabled);
    updateSoundIcon(soundEnabled);
    if (soundEnabled) playSound('add');
  }

  function updateSoundIcon(enabled) {
    const iconOn = soundToggleBtn.querySelector('.icon-sound-on');
    const iconOff = soundToggleBtn.querySelector('.icon-sound-off');
    if (enabled) {
      iconOn.classList.remove('hidden');
      iconOff.classList.add('hidden');
    } else {
      iconOn.classList.add('hidden');
      iconOff.classList.remove('hidden');
    }
  }

  // --- LocalStorage Operations ---
  function loadTasks() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to parse tasks from localStorage', e);
    }
    return [...DEFAULT_TASKS];
  }

  function saveTasks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (e) {
      console.error('Failed to save tasks to localStorage', e);
    }
  }

  // --- Task CRUD Operations ---

  /**
   * Adds a new task from the input box.
   * Triggered either by Enter key or Add Task button.
   */
  function handleAddTask() {
    const text = taskInput.value.trim();
    if (!text) {
      taskInput.focus();
      return;
    }

    const newTask = {
      id: 'task-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      text: text,
      priority: prioritySelect.value || 'medium',
      category: categorySelect.value || 'General',
      completed: false,
      starred: false,
      createdAt: Date.now()
    };

    // Prepend new task so it appears at top
    tasks.unshift(newTask);
    saveTasks();

    // Reset input box and refocus
    taskInput.value = '';
    clearInputBtn.classList.add('hidden');
    taskInput.focus();

    playSound('add');
    showToast('Task added successfully!');
    render();
  }

  function toggleTaskCompletion(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    task.completed = !task.completed;
    saveTasks();

    if (task.completed) {
      playSound('complete');
      // Check if all tasks are completed for celebration!
      const allDone = tasks.length > 0 && tasks.every(t => t.completed);
      if (allDone) {
        fireConfetti();
        showToast('🎉 Bravo! You completed all tasks!');
      }
    }

    render();
  }

  function toggleTaskStar(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    task.starred = !task.starred;
    saveTasks();
    render();
  }

  function deleteTask(id) {
    const index = tasks.findIndex(t => t.id === id);
    if (index === -1) return;

    const taskItemEl = document.querySelector(`[data-task-id="${id}"]`);
    if (taskItemEl) {
      taskItemEl.classList.add('removing');
      setTimeout(() => {
        performDelete(index);
      }, 220);
    } else {
      performDelete(index);
    }
  }

  function performDelete(index) {
    lastDeletedTask = {
      task: tasks[index],
      index: index
    };

    tasks.splice(index, 1);
    saveTasks();
    playSound('delete');
    render();

    showUndoToast('Task deleted', () => {
      if (lastDeletedTask) {
        tasks.splice(lastDeletedTask.index, 0, lastDeletedTask.task);
        saveTasks();
        lastDeletedTask = null;
        render();
        showToast('Task restored');
      }
    });
  }

  function clearCompletedTasks() {
    const countCompleted = tasks.filter(t => t.completed).length;
    if (countCompleted === 0) {
      showToast('No completed tasks to clear.');
      return;
    }

    tasks = tasks.filter(t => !t.completed);
    saveTasks();
    playSound('delete');
    render();
    showToast(`Cleared ${countCompleted} completed task${countCompleted > 1 ? 's' : ''}.`);
  }

  // --- Modal Edit Operations ---
  function openEditModal(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    editTaskId.value = task.id;
    editTaskInput.value = task.text;
    editPrioritySelect.value = task.priority;
    editCategorySelect.value = task.category;

    editModal.classList.remove('hidden');
    editTaskInput.focus();
  }

  function closeEditModal() {
    editModal.classList.add('hidden');
    editTaskId.value = '';
    editTaskInput.value = '';
  }

  function handleSaveEdit(e) {
    e.preventDefault();
    const id = editTaskId.value;
    const newText = editTaskInput.value.trim();
    if (!newText) return;

    const task = tasks.find(t => t.id === id);
    if (task) {
      task.text = newText;
      task.priority = editPrioritySelect.value;
      task.category = editCategorySelect.value;
      saveTasks();
      closeEditModal();
      render();
      showToast('Task updated successfully!');
    }
  }

  // --- Rendering & Filtering ---
  function getFilteredTasks() {
    return tasks.filter(task => {
      // Search match
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesText = task.text.toLowerCase().includes(query);
        const matchesCat = task.category.toLowerCase().includes(query);
        if (!matchesText && !matchesCat) return false;
      }

      // Filter tab
      if (currentFilter === 'active') return !task.completed;
      if (currentFilter === 'completed') return task.completed;
      if (currentFilter === 'starred') return task.starred;
      return true; // 'all'
    });
  }

  function render() {
    updateStats();
    renderList();
  }

  function updateStats() {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const active = total - completed;
    const starred = tasks.filter(t => t.starred).length;

    statTotal.textContent = total;
    statPending.textContent = active;
    statCompleted.textContent = completed;

    badgeAll.textContent = total;
    badgeActive.textContent = active;
    badgeCompleted.textContent = completed;
    badgeStarred.textContent = starred;

    const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
    progressPercent.textContent = `${percent}%`;
    progressFill.style.width = `${percent}%`;
    progressTrack.setAttribute('aria-valuenow', percent);
  }

  function renderList() {
    const filtered = getFilteredTasks();
    taskList.innerHTML = '';

    if (filtered.length === 0) {
      emptyState.classList.remove('hidden');
    } else {
      emptyState.classList.add('hidden');
      filtered.forEach(task => {
        const item = createTaskElement(task);
        taskList.appendChild(item);
      });
    }
  }

  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function createTaskElement(task) {
    const li = document.createElement('li');
    li.className = `task-item ${task.completed ? 'completed' : ''}`;
    li.setAttribute('data-task-id', task.id);

    const priorityClass = `priority-${task.priority}`;
    const escapedText = escapeHTML(task.text);
    const escapedCategory = escapeHTML(task.category);

    li.innerHTML = `
      <div class="task-main">
        <button type="button" class="custom-checkbox ${task.completed ? 'checked' : ''}" aria-label="${task.completed ? 'Mark task incomplete' : 'Mark task completed'}">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </button>
        <div class="task-content">
          <span class="task-title">${escapedText}</span>
          <div class="task-badges">
            <span class="tag-badge ${priorityClass}">${task.priority}</span>
            <span class="tag-badge category-tag">${escapedCategory}</span>
          </div>
        </div>
      </div>
      <div class="task-actions">
        <button type="button" class="action-btn star-btn ${task.starred ? 'starred' : ''}" title="${task.starred ? 'Unstar task' : 'Star task'}" aria-label="Star task">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="${task.starred ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
          </svg>
        </button>
        <button type="button" class="action-btn edit-btn" title="Edit task" aria-label="Edit task">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
        <button type="button" class="action-btn delete-btn" title="Delete task" aria-label="Delete task">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    `;

    // Event listeners
    const checkbox = li.querySelector('.custom-checkbox');
    checkbox.addEventListener('click', () => toggleTaskCompletion(task.id));

    const starBtn = li.querySelector('.star-btn');
    starBtn.addEventListener('click', () => toggleTaskStar(task.id));

    const editBtn = li.querySelector('.edit-btn');
    editBtn.addEventListener('click', () => openEditModal(task.id));

    const deleteBtn = li.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', () => deleteTask(task.id));

    // Double-click task title to edit
    const titleEl = li.querySelector('.task-title');
    titleEl.addEventListener('dblclick', () => openEditModal(task.id));

    return li;
  }

  // --- Toasts & Notifications ---
  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('removing');
      setTimeout(() => toast.remove(), 250);
    }, 3200);
  }

  function showUndoToast(message, onUndo) {
    if (undoTimeout) {
      clearTimeout(undoTimeout);
    }

    // Remove existing undo toast if any
    const existing = toastContainer.querySelector('.toast-with-undo');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast toast-with-undo';

    const textSpan = document.createElement('span');
    textSpan.textContent = message;
    toast.appendChild(textSpan);

    const undoBtn = document.createElement('button');
    undoBtn.className = 'toast-action';
    undoBtn.textContent = 'Undo';
    undoBtn.addEventListener('click', () => {
      onUndo();
      toast.classList.add('removing');
      setTimeout(() => toast.remove(), 200);
    });
    toast.appendChild(undoBtn);

    toastContainer.appendChild(toast);

    undoTimeout = setTimeout(() => {
      toast.classList.add('removing');
      setTimeout(() => toast.remove(), 250);
    }, 4500);
  }

  // --- Event Bindings ---
  function bindEvents() {
    // 1. Core Requirement: Add Task via Enter Key in Input Box
    taskInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddTask();
      }
    });

    // 2. Core Requirement: Add Task via Add Button
    addTaskBtn.addEventListener('click', (e) => {
      e.preventDefault();
      handleAddTask();
    });

    // Clear input helper button
    taskInput.addEventListener('input', () => {
      if (taskInput.value.length > 0) {
        clearInputBtn.classList.remove('hidden');
      } else {
        clearInputBtn.classList.add('hidden');
      }
    });

    clearInputBtn.addEventListener('click', () => {
      taskInput.value = '';
      clearInputBtn.classList.add('hidden');
      taskInput.focus();
    });

    // Filter tabs
    const filterTabs = document.querySelectorAll('.filter-tab');
    filterTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        filterTabs.forEach(t => {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        currentFilter = tab.getAttribute('data-filter') || 'all';
        renderList();
      });
    });

    // Search input
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim();
      renderList();
    });

    // Clear completed
    clearCompletedBtn.addEventListener('click', clearCompletedTasks);

    // Theme & Sound
    themeToggleBtn.addEventListener('click', toggleTheme);
    soundToggleBtn.addEventListener('click', toggleSound);

    // Edit Modal events
    editForm.addEventListener('submit', handleSaveEdit);
    closeModalBtn.addEventListener('click', closeEditModal);
    cancelEditBtn.addEventListener('click', closeEditModal);

    editModal.addEventListener('click', (e) => {
      if (e.target === editModal) {
        closeEditModal();
      }
    });

    // Global keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (!editModal.classList.contains('hidden')) {
          closeEditModal();
        }
      } else if (e.key === '/' && document.activeElement !== taskInput && document.activeElement !== searchInput && document.activeElement !== editTaskInput) {
        e.preventDefault();
        taskInput.focus();
      }
    });
  }

  // Run application on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
