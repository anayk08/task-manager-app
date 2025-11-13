let currentUserId = null;
let allUsers = [];
let statsData = null;

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

// Load saved theme
function loadTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        document.getElementById('themeToggle').textContent = 'Light Mode';
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    loadTheme();
    loadStats();
    loadUsers();
});

// Load Statistics
async function loadStats() {
    try {
        const response = await fetch('/api/admin/stats');
        
        if (!response.ok) {
            window.location.href = 'index.html';
            return;
        }
        
        statsData = await response.json();
        
        // Update stat cards
        document.getElementById('statTotalUsers').textContent = statsData.totalUsers;
        document.getElementById('statTotalTasks').textContent = statsData.totalTasks;
        document.getElementById('statCompletedTasks').textContent = statsData.completedTasks;
        document.getElementById('statAdminCount').textContent = statsData.adminCount;
        
        // Render charts
        renderPriorityChart(statsData.tasksByPriority);
        renderCategoryChart(statsData.tasksByCategory);
        
        // Render activity log
        renderActivityLog(statsData.recentActivity);
        
    } catch (error) {
        console.error('Failed to load stats:', error);
    }
}

// Render Priority Chart
function renderPriorityChart(data) {
    const container = document.getElementById('priorityChart');
    container.innerHTML = '';
    
    if (data.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No task data available</p>';
        return;
    }
    
    const total = data.reduce((sum, item) => sum + item.count, 0);
    
    data.forEach(item => {
        const percentage = total > 0 ? (item.count / total * 100) : 0;
        
        const barHtml = `
            <div class="chart-bar">
                <div class="chart-label">${item.priority}</div>
                <div class="chart-bar-bg">
                    <div class="chart-bar-fill" style="width: ${percentage}%">
                        ${item.count}
                    </div>
                </div>
            </div>
        `;
        container.innerHTML += barHtml;
    });
}

// Render Category Chart
function renderCategoryChart(data) {
    const container = document.getElementById('categoryChart');
    container.innerHTML = '';
    
    if (data.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No task data available</p>';
        return;
    }
    
    const total = data.reduce((sum, item) => sum + item.count, 0);
    
    data.forEach(item => {
        const percentage = total > 0 ? (item.count / total * 100) : 0;
        
        const barHtml = `
            <div class="chart-bar">
                <div class="chart-label">${item.category}</div>
                <div class="chart-bar-bg">
                    <div class="chart-bar-fill" style="width: ${percentage}%">
                        ${item.count}
                    </div>
                </div>
            </div>
        `;
        container.innerHTML += barHtml;
    });
}

// Render Activity Log
function renderActivityLog(activities) {
    const container = document.getElementById('activityLog');
    container.innerHTML = '';
    
    if (activities.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No recent activity</p>';
        return;
    }
    
    activities.forEach(activity => {
        const activityHtml = `
            <div class="activity-item">
                <div class="activity-user">${escapeHtml(activity.username)}</div>
                <div class="activity-action">${escapeHtml(activity.action)}</div>
                ${activity.details ? `<div style="font-size: 0.9em; color: var(--text-secondary);">${escapeHtml(activity.details)}</div>` : ''}
                <div class="activity-time">${formatDateTime(activity.created_at)}</div>
            </div>
        `;
        container.innerHTML += activityHtml;
    });
}

// Load Users
async function loadUsers() {
    try {
        const response = await fetch('/api/admin/users');
        
        if (!response.ok) {
            window.location.href = 'index.html';
            return;
        }
        
        const data = await response.json();
        allUsers = data.users;
        currentUserId = data.currentUserId;
        
        renderUsers(allUsers);
    } catch (error) {
        console.error('Failed to load users:', error);
        document.getElementById('userList').innerHTML = 
            '<tr><td colspan="6" style="text-align: center; color: red;">Failed to load users</td></tr>';
    }
}

// Render Users Table
function renderUsers(users) {
    const userList = document.getElementById('userList');
    userList.innerHTML = '';
    
    if (users.length === 0) {
        userList.innerHTML = '<tr><td colspan="6" style="text-align: center;">No users found</td></tr>';
        return;
    }
    
    users.forEach(user => {
        const tr = document.createElement('tr');
        const isCurrentUser = user.id === currentUserId;
        
        const roleLabel = user.is_admin 
            ? '<span class="role-badge role-admin">ADMIN</span>' 
            : '<span class="role-badge role-user">User</span>';
        
        const deleteButton = isCurrentUser 
            ? '<button class="delete-btn" disabled title="You cannot delete your own account">Delete User</button>'
            : `<button class="delete-btn" onclick="deleteUser(${user.id}, '${escapeHtml(user.username)}')">Delete User</button>`;
        
        const usernameDisplay = isCurrentUser 
            ? `${escapeHtml(user.username)} <span class="user-label">(You)</span>` 
            : escapeHtml(user.username);
        
        tr.innerHTML = `
            <td>${user.id}</td>
            <td>${usernameDisplay}</td>
            <td>${roleLabel}</td>
            <td>${user.task_count}</td>
            <td>${formatDate(user.created_at)}</td>
            <td>${deleteButton}</td>
        `;
        userList.appendChild(tr);
    });
}

// Search Users
function searchUsers() {
    const searchTerm = document.getElementById('userSearch').value.toLowerCase().trim();
    
    if (searchTerm === '') {
        renderUsers(allUsers);
        return;
    }
    
    const filteredUsers = allUsers.filter(user => 
        user.username.toLowerCase().includes(searchTerm)
    );
    
    renderUsers(filteredUsers);
}

// Delete User
async function deleteUser(userId, username) {
    if (!confirm(`Are you sure you want to delete user "${username}" and all their tasks?\n\nThis action cannot be undone.`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/users/${userId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert(`User "${username}" deleted successfully`);
            loadUsers();
            loadStats(); // Refresh stats after deletion
        } else {
            alert(data.error || 'Failed to delete user');
        }
    } catch (error) {
        alert('Failed to delete user. Please try again.');
        console.error('Delete error:', error);
    }
}

// Utility Functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}

function formatDateTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}