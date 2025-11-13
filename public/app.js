let currentUser = null;
let currentFilter = 'all';
let currentSort = 'date-desc';
let currentSearch = '';
let editingTaskId = null;
let allTasks = [];

// Theme Management
function toggleTheme() {
    const body = document.body;
    const themeToggle = document.getElementById('themeToggle');
    
    if (body.classList.contains('dark-mode')) {
        body.classList.remove('dark-mode');
        themeToggle.textContent = 'Dark Mode';
        localStorage.setItem('theme', 'light');
    } else {
        body.classList.add('dark-mode');
        themeToggle.textContent = 'Light Mode';
        localStorage.setItem('theme', 'dark');
    }
}

// Load saved theme on page load
function loadTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        document.getElementById('themeToggle').textContent = 'Light Mode';
    }
}

// Password strength indicator
function checkPasswordStrength() {
    const password = document.getElementById('registerPassword').value;
    const strengthDiv = document.getElementById('passwordStrength');
    
    if (password.length === 0) {
        strengthDiv.textContent = '';
        strengthDiv.className = 'password-strength';
        return;
    }
    
    let strength = 0;
    if (password.length >= 6) strength++;
    if (password.length >= 10) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z\d]/.test(password)) strength++;
    
    if (strength <= 2) {
        strengthDiv.textContent = 'Weak password';
        strengthDiv.className = 'password-strength weak';
    } else if (strength <= 3) {
        strengthDiv.textContent = 'Medium password';
        strengthDiv.className = 'password-strength medium';
    } else {
        strengthDiv.textContent = 'Strong password';
        strengthDiv.className = 'password-strength strong';
    }
}

// Add event listener for password field
document.addEventListener('DOMContentLoaded', () => {
    loadTheme();
    const registerPassword = document.getElementById('registerPassword');
    if (registerPassword) {
        registerPassword.addEventListener('input', checkPasswordStrength);
    }
});

// Authentication Functions
async function register() {
    const username = document.getElementById('registerUsername').value.trim();
    const password = document.getElementById('registerPassword').value;
    
    if (!username || !password) {
        showMessage('Please fill in all fields', 'error');
        return;
    }

    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showMessage('Registration successful! Please login.', 'success');
            document.getElementById('registerUsername').value = '';
            document.getElementById('registerPassword').value = '';
            document.getElementById('passwordStrength').textContent = '';
        } else {
            showMessage(data.error, 'error');
        }
    } catch (error) {
        showMessage('Registration failed. Please try again.', 'error');
    }
}

async function registerAdmin() {
    const username = document.getElementById('adminUsername').value.trim();
    const password = document.getElementById('adminPassword').value;
    const secretCode = document.getElementById('adminSecretCode').value;
    
    if (!username || !password || !secretCode) {
        showMessage('Please fill in all fields including the secret code', 'error');
        return;
    }

    try {
        const response = await fetch('/api/register-admin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, secretCode })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showMessage('Admin registration successful! Please login.', 'success');
            document.getElementById('adminUsername').value = '';
            document.getElementById('adminPassword').value = '';
            document.getElementById('adminSecretCode').value = '';
        } else {
            showMessage(data.error, 'error');
        }
    } catch (error) {
        showMessage('Admin registration failed. Please try again.', 'error');
    }
}

async function login() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    if (!username || !password) {
        showMessage('Please fill in all fields', 'error');
        return;
    }

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentUser = data.username;
            
            if (data.isAdmin) {
                window.location.href = 'admin.html';
            } else {
                document.getElementById('authSection').style.display = 'none';
                document.getElementById('taskSection').style.display = 'block';
                document.getElementById('welcomeMessage').textContent = `Welcome, ${data.username}!`;
                loadTasks();
            }
        } else {
            showMessage(data.error || 'Invalid username or password', 'error');
        }
    } catch (error) {
        showMessage('Login failed. Please try again.', 'error');
    }
}

async function logout() {
    if (!confirm('Are you sure you want to logout?')) {
        return;
    }
    
    try {
        await fetch('/api/logout', { method: 'POST' });
        currentUser = null;
        document.getElementById('authSection').style.display = 'block';
        document.getElementById('taskSection').style.display = 'none';
        document.getElementById('loginUsername').value = '';
        document.getElementById('loginPassword').value = '';
        allTasks = [];
    } catch (error) {
        console.error('Logout failed:', error);
    }
}

// Task Management Functions
async function loadTasks() {
    try {
        document.getElementById('loadingState').style.display = 'block';
        document.getElementById('emptyState').style.display = 'none';
        
        const params = new URLSearchParams({
            filter: currentFilter,
            sort: currentSort,
            search: currentSearch
        });
        
        const response = await fetch(`/api/tasks?${params}`);
        
        if (!response.ok) {
            throw new Error('Failed to load tasks');
        }
        
        allTasks = await response.json();
        
        document.getElementById('loadingState').style.display = 'none';
        
        renderTasks(allTasks);
        updateStats();
    } catch (error) {
        document.getElementById('loadingState').style.display = 'none';
        showMessage('Failed to load tasks', 'error');
        console.error('Error loading tasks:', error);
    }
}

function renderTasks(tasks) {
    const taskList = document.getElementById('taskList');
    const emptyState = document.getElementById('emptyState');
    
    taskList.innerHTML = '';
    
    if (tasks.length === 0) {
        emptyState.style.display = 'block';
        return;
    }
    
    emptyState.style.display = 'none';
    
    tasks.forEach(task => {
        const li = document.createElement('li');
        li.className = 'task-item';
        if (task.completed) li.classList.add('completed');
        li.classList.add(`priority-${task.priority}`);
        
        const dueDate = task.due_date ? new Date(task.due_date) : null;
        const isOverdue = dueDate && dueDate < new Date() && !task.completed;
        
        li.innerHTML = `
            <div class="task-main">
                <input type="checkbox" ${task.completed ? 'checked' : ''} 
                       onchange="toggleTask(${task.id}, ${task.completed})" 
                       class="task-checkbox">
                <div class="task-content">
                    <div class="task-title">${escapeHtml(task.title)}</div>
                    ${task.description ? `<div class="task-description">${escapeHtml(task.description)}</div>` : ''}
                    <div class="task-meta">
                        <span class="priority-badge priority-${task.priority}">${task.priority}</span>
                        <span class="category-badge">${task.category}</span>
                        ${task.due_date ? `<span class="due-date ${isOverdue ? 'overdue' : ''}">${formatDate(task.due_date)}</span>` : ''}
                        <span class="task-date">Created: ${formatDateTime(task.created_at)}</span>
                    </div>
                </div>
            </div>
            <div class="task-actions">
                <button onclick="openEditModal(${task.id})" class="btn-edit" title="Edit">Edit</button>
                <button onclick="deleteTask(${task.id})" class="btn-delete" title="Delete">Delete</button>
            </div>
        `;
        taskList.appendChild(li);
    });
}

async function addTask() {
    const title = document.getElementById('newTaskTitle').value.trim();
    const description = document.getElementById('newTaskDescription').value.trim();
    const priority = document.getElementById('newTaskPriority').value;
    const category = document.getElementById('newTaskCategory').value;
    const due_date = document.getElementById('newTaskDueDate').value;
    
    if (!title) {
        showMessage('Please enter a task title', 'error');
        return;
    }

    try {
        const response = await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description, priority, category, due_date })
        });
        
        if (response.ok) {
            document.getElementById('newTaskTitle').value = '';
            document.getElementById('newTaskDescription').value = '';
            document.getElementById('newTaskPriority').value = 'medium';
            document.getElementById('newTaskCategory').value = 'personal';
            document.getElementById('newTaskDueDate').value = '';
            
            await loadTasks();
            showMessage('Task added successfully!', 'success');
        } else {
            const data = await response.json();
            showMessage(data.error || 'Failed to add task', 'error');
        }
    } catch (error) {
        showMessage('Failed to add task', 'error');
    }
}

async function toggleTask(id, currentCompleted) {
    try {
        const response = await fetch(`/api/tasks/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ completed: currentCompleted ? 0 : 1 })
        });
        
        if (response.ok) {
            await loadTasks();
        }
    } catch (error) {
        showMessage('Failed to update task', 'error');
    }
}

async function deleteTask(id) {
    if (!confirm('Are you sure you want to delete this task?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/tasks/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            await loadTasks();
            showMessage('Task deleted successfully', 'success');
        }
    } catch (error) {
        showMessage('Failed to delete task', 'error');
    }
}

async function clearCompleted() {
    const completedCount = allTasks.filter(t => t.completed).length;
    
    if (completedCount === 0) {
        showMessage('No completed tasks to clear', 'error');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete ${completedCount} completed task(s)?`)) {
        return;
    }
    
    try {
        const response = await fetch('/api/tasks/completed/clear', {
            method: 'DELETE'
        });
        
        if (response.ok) {
            await loadTasks();
            showMessage(`${completedCount} completed task(s) deleted`, 'success');
        }
    } catch (error) {
        showMessage('Failed to clear completed tasks', 'error');
    }
}

// Edit Task Modal
function openEditModal(taskId) {
    const task = allTasks.find(t => t.id === taskId);
    if (!task) return;
    
    editingTaskId = taskId;
    
    document.getElementById('editTaskTitle').value = task.title;
    document.getElementById('editTaskDescription').value = task.description || '';
    document.getElementById('editTaskPriority').value = task.priority;
    document.getElementById('editTaskCategory').value = task.category;
    document.getElementById('editTaskDueDate').value = task.due_date || '';
    
    document.getElementById('editModal').style.display = 'block';
}

function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
    editingTaskId = null;
}

async function saveTaskEdit() {
    if (!editingTaskId) return;
    
    const title = document.getElementById('editTaskTitle').value.trim();
    const description = document.getElementById('editTaskDescription').value.trim();
    const priority = document.getElementById('editTaskPriority').value;
    const category = document.getElementById('editTaskCategory').value;
    const due_date = document.getElementById('editTaskDueDate').value;
    
    if (!title) {
        showMessage('Task title cannot be empty', 'error');
        return;
    }
    
    try {
        const response = await fetch(`/api/tasks/${editingTaskId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description, priority, category, due_date })
        });
        
        if (response.ok) {
            closeEditModal();
            await loadTasks();
            showMessage('Task updated successfully!', 'success');
        } else {
            const data = await response.json();
            showMessage(data.error || 'Failed to update task', 'error');
        }
    } catch (error) {
        showMessage('Failed to update task', 'error');
    }
}

// Filter, Sort, Search Functions
function filterTasks(filter) {
    currentFilter = filter;
    
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    loadTasks();
}

function sortTasks() {
    currentSort = document.getElementById('sortSelect').value;
    loadTasks();
}

function searchTasks() {
    currentSearch = document.getElementById('searchInput').value.trim();
    loadTasks();
}

// Stats Update
function updateStats() {
    const total = allTasks.length;
    const active = allTasks.filter(t => !t.completed).length;
    const completed = allTasks.filter(t => t.completed).length;
    
    document.getElementById('totalTasks').textContent = total;
    document.getElementById('activeTasks').textContent = active;
    document.getElementById('completedTasks').textContent = completed;
}

// Utility Functions
function showMessage(message, type) {
    const messageDiv = document.getElementById('authMessage');
    messageDiv.textContent = message;
    messageDiv.className = type;
    messageDiv.style.display = 'block';
    setTimeout(() => {
        messageDiv.style.display = 'none';
        messageDiv.textContent = '';
        messageDiv.className = '';
    }, 4000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) {
        return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
        return 'Tomorrow';
    } else {
        return date.toLocaleDateString();
    }
}

function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('editModal');
    if (event.target === modal) {
        closeEditModal();
    }
}

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // Ctrl/Cmd + K to focus search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.focus();
    }
    
    // Escape to close modal
    if (e.key === 'Escape') {
        closeEditModal();
    }
});