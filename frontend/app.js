const API_URL = 'http://127.0.0.1:5000'; // Change this to your deployed backend URL later

// DOM Elements
const authSection = document.getElementById('auth-section');
const boardSection = document.getElementById('board-section');
const authForm = document.getElementById('auth-form');
const toggleAuthBtn = document.getElementById('toggle-auth');
const authTitle = document.getElementById('auth-title');
const authBtn = document.getElementById('auth-btn');
const logoutBtn = document.getElementById('logout-btn');
const addTaskForm = document.getElementById('add-task-form');
const notification = document.getElementById('notification');
const loading = document.getElementById('loading');

let isLogin = true;
let tasks = [];

// --- Initialization ---
function init() {
    const token = localStorage.getItem('token');
    if (token) {
        showBoard();
        fetchTasks();
    } else {
        showAuth();
    }
}

// --- UI Navigation ---
function showAuth() {
    authSection.classList.remove('hidden');
    boardSection.classList.add('hidden');
}

function showBoard() {
    authSection.classList.add('hidden');
    boardSection.classList.remove('hidden');
}

function showNotification(msg, isError = false) {
    notification.textContent = msg;
    notification.style.backgroundColor = isError ? '#d9534f' : '#4CAF50';
    notification.classList.remove('hidden');
    setTimeout(() => notification.classList.add('hidden'), 3000);
}

toggleAuthBtn.addEventListener('click', () => {
    isLogin = !isLogin;
    authTitle.textContent = isLogin ? 'Login' : 'Register';
    authBtn.textContent = isLogin ? 'Login' : 'Register';
    toggleAuthBtn.innerHTML = isLogin 
        ? 'Need an account? <span class="link">Register</span>' 
        : 'Already have an account? <span class="link">Login</span>';
});

// --- API Helper ---
async function apiCall(endpoint, method = 'GET', body = null) {
    const headers = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem('token');
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const config = { method, headers };
    if (body) config.body = JSON.stringify(body);

    const response = await fetch(`${API_URL}${endpoint}`, config);
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'API Error');
    return data;
}

// --- Auth Logic ---
authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const endpoint = isLogin ? '/login' : '/register';

    try {
        const res = await apiCall(endpoint, 'POST', { username, password });
        if (isLogin) {
            localStorage.setItem('token', res.token);
            showBoard();
            fetchTasks();
        } else {
            showNotification('Registered successfully! Please login.');
            toggleAuthBtn.click(); // Switch to login view
        }
    } catch (error) {
        showNotification(error.message, true);
    }
});

logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('token');
    showAuth();
});

// --- Task Logic ---
async function fetchTasks() {
    loading.classList.remove('hidden');
    try {
        tasks = await apiCall('/tasks');
        renderTasks();
    } catch (error) {
        showNotification('Session expired or error loading tasks', true);
        localStorage.removeItem('token');
        showAuth();
    } finally {
        loading.classList.add('hidden');
    }
}

addTaskForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('new-task-title');
    const title = input.value;
    
    try {
        const res = await apiCall('/tasks', 'POST', { title });
        tasks.push(res.task);
        input.value = '';
        renderTasks();
        showNotification('Task added!');
    } catch (error) {
        showNotification(error.message, true);
    }
});

async function updateTaskStage(id, newStage) {
    try {
        await apiCall(`/tasks/${id}`, 'PUT', { stage: newStage });
        const task = tasks.find(t => t.id === id);
        if (task) task.stage = newStage;
        renderTasks();
    } catch (error) {
        showNotification(error.message, true);
    }
}

async function deleteTask(id) {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
        await apiCall(`/tasks/${id}`, 'DELETE');
        tasks = tasks.filter(t => t.id !== id);
        renderTasks();
        showNotification('Task deleted!');
    } catch (error) {
        showNotification(error.message, true);
    }
}

// --- Rendering ---
function renderTasks() {
    const stages = { 'Todo': 'list-Todo', 'In Progress': 'list-In-Progress', 'Done': 'list-Done' };
    
    // Clear all columns
    Object.values(stages).forEach(id => document.getElementById(id).innerHTML = '');

    tasks.forEach(task => {
        // Handle CSS class differences in IDs (spaces to dashes)
        const stageId = stages[task.stage] || 'list-Todo'; 
        const listEl = document.getElementById(stageId);
        
        const taskEl = document.createElement('div');
        taskEl.className = 'task';
        taskEl.innerHTML = `
            <div>${task.title}</div>
            <div class="task-actions">
                <select onchange="updateTaskStage(${task.id}, this.value)">
                    <option value="Todo" ${task.stage === 'Todo' ? 'selected' : ''}>Todo</option>
                    <option value="In Progress" ${task.stage === 'In Progress' ? 'selected' : ''}>In Progress</option>
                    <option value="Done" ${task.stage === 'Done' ? 'selected' : ''}>Done</option>
                </select>
                <button class="btn-delete" onclick="deleteTask(${task.id})">X</button>
            </div>
        `;
        listEl.appendChild(taskEl);
    });
}

// Boot up
init();
