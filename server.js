const express = require('express');
const sqlite3 = require('better-sqlite3');
const bcrypt = require('bcrypt');
const session = require('express-session');
const path = require('path');

const app = express();
const db = sqlite3('database.db');

// Create tables with ALL new features
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    is_admin INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    completed INTEGER DEFAULT 0,
    priority TEXT DEFAULT 'medium',
    category TEXT DEFAULT 'personal',
    due_date TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )
`);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: 'your-secret-key-change-this-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Helper function to log activities
function logActivity(userId, action, details = '') {
  try {
    db.prepare('INSERT INTO activity_log (user_id, action, details) VALUES (?, ?, ?)').run(userId, action, details);
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
}

// ==================== AUTH ROUTES ====================

app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  
  // Validation
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  if (username.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const stmt = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)');
    const result = stmt.run(username, hashedPassword);
    logActivity(result.lastInsertRowid, 'User registered', `Username: ${username}`);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: 'Username already exists' });
  }
});

app.post('/api/register-admin', async (req, res) => {
  const { username, password, secretCode } = req.body;
  
  // Validation
  if (!username || !password || !secretCode) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  
  if (secretCode !== 'baNAna123!') {
    return res.status(400).json({ error: 'Invalid secret code' });
  }
  
  if (username.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  
  const adminCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE is_admin = 1').get();
  if (adminCount.count >= 3) {
    return res.status(400).json({ error: 'Maximum number of admins reached (3)' });
  }
  
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const stmt = db.prepare('INSERT INTO users (username, password, is_admin) VALUES (?, ?, 1)');
    const result = stmt.run(username, hashedPassword);
    logActivity(result.lastInsertRowid, 'Admin registered', `Username: ${username}`);
    res.json({ success: true, isAdmin: true });
  } catch (error) {
    res.status(400).json({ error: 'Username already exists' });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  
  if (user && await bcrypt.compare(password, user.password)) {
    req.session.userId = user.id;
    req.session.isAdmin = user.is_admin === 1;
    req.session.username = user.username;
    logActivity(user.id, 'User logged in', `Username: ${username}`);
    res.json({ success: true, isAdmin: user.is_admin === 1, username: user.username });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.post('/api/logout', (req, res) => {
  if (req.session.userId) {
    logActivity(req.session.userId, 'User logged out');
  }
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/check-session', (req, res) => {
  if (req.session.userId) {
    res.json({ 
      loggedIn: true, 
      isAdmin: req.session.isAdmin || false,
      username: req.session.username 
    });
  } else {
    res.json({ loggedIn: false });
  }
});

// ==================== TASK ROUTES ====================

app.get('/api/tasks', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not logged in' });
  }
  
  const { filter, sort, search } = req.query;
  let query = 'SELECT * FROM tasks WHERE user_id = ?';
  const params = [req.session.userId];
  
  // Apply filters
  if (filter === 'active') {
    query += ' AND completed = 0';
  } else if (filter === 'completed') {
    query += ' AND completed = 1';
  }
  
  // Apply search
  if (search) {
    query += ' AND (title LIKE ? OR description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  
  // Apply sorting
  if (sort === 'date-asc') {
    query += ' ORDER BY created_at ASC';
  } else if (sort === 'date-desc') {
    query += ' ORDER BY created_at DESC';
  } else if (sort === 'alpha') {
    query += ' ORDER BY title ASC';
  } else if (sort === 'priority') {
    query += ' ORDER BY CASE priority WHEN "high" THEN 1 WHEN "medium" THEN 2 WHEN "low" THEN 3 END';
  } else {
    query += ' ORDER BY created_at DESC';
  }
  
  const tasks = db.prepare(query).all(...params);
  res.json(tasks);
});

app.post('/api/tasks', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not logged in' });
  }
  
  const { title, description, priority, category, due_date } = req.body;
  
  if (!title || title.trim() === '') {
    return res.status(400).json({ error: 'Task title is required' });
  }
  
  const stmt = db.prepare(`
    INSERT INTO tasks (user_id, title, description, priority, category, due_date) 
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  const result = stmt.run(
    req.session.userId, 
    title.trim(), 
    description || '', 
    priority || 'medium',
    category || 'personal',
    due_date || null
  );
  
  logActivity(req.session.userId, 'Task created', `Title: ${title}`);
  
  const newTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);
  res.json(newTask);
});

app.patch('/api/tasks/:id', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not logged in' });
  }
  
  const taskId = req.params.id;
  const updates = req.body;
  
  // Verify task belongs to user
  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(taskId, req.session.userId);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  
  const allowedFields = ['title', 'description', 'completed', 'priority', 'category', 'due_date'];
  const setClauses = [];
  const values = [];
  
  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
      setClauses.push(`${key} = ?`);
      values.push(value);
    }
  }
  
  if (setClauses.length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }
  
  setClauses.push('updated_at = CURRENT_TIMESTAMP');
  values.push(taskId, req.session.userId);
  
  const query = `UPDATE tasks SET ${setClauses.join(', ')} WHERE id = ? AND user_id = ?`;
  db.prepare(query).run(...values);
  
  logActivity(req.session.userId, 'Task updated', `Task ID: ${taskId}`);
  
  const updatedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  res.json(updatedTask);
});

app.delete('/api/tasks/:id', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not logged in' });
  }
  
  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(req.params.id, req.session.userId);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  
  db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').run(req.params.id, req.session.userId);
  logActivity(req.session.userId, 'Task deleted', `Title: ${task.title}`);
  res.json({ success: true });
});

app.delete('/api/tasks/completed/clear', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not logged in' });
  }
  
  const result = db.prepare('DELETE FROM tasks WHERE user_id = ? AND completed = 1').run(req.session.userId);
  logActivity(req.session.userId, 'Cleared completed tasks', `Deleted ${result.changes} tasks`);
  res.json({ success: true, deletedCount: result.changes });
});

// ==================== ADMIN ROUTES ====================

app.get('/api/admin/users', (req, res) => {
  if (!req.session.userId || !req.session.isAdmin) {
    return res.status(401).json({ error: 'Admin access required' });
  }
  
  const users = db.prepare(`
    SELECT 
      users.id,
      users.username,
      users.is_admin,
      users.created_at,
      COUNT(tasks.id) as task_count
    FROM users
    LEFT JOIN tasks ON users.id = tasks.user_id
    GROUP BY users.id
    ORDER BY users.created_at DESC
  `).all();
  
  res.json({ users, currentUserId: req.session.userId });
});

app.get('/api/admin/stats', (req, res) => {
  if (!req.session.userId || !req.session.isAdmin) {
    return res.status(401).json({ error: 'Admin access required' });
  }
  
  const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const totalTasks = db.prepare('SELECT COUNT(*) as count FROM tasks').get().count;
  const completedTasks = db.prepare('SELECT COUNT(*) as count FROM tasks WHERE completed = 1').get().count;
  const adminCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE is_admin = 1').get().count;
  
  const tasksByPriority = db.prepare(`
    SELECT priority, COUNT(*) as count 
    FROM tasks 
    GROUP BY priority
  `).all();
  
  const tasksByCategory = db.prepare(`
    SELECT category, COUNT(*) as count 
    FROM tasks 
    GROUP BY category
  `).all();
  
  const recentActivity = db.prepare(`
    SELECT 
      activity_log.*,
      users.username
    FROM activity_log
    JOIN users ON activity_log.user_id = users.id
    ORDER BY activity_log.created_at DESC
    LIMIT 20
  `).all();
  
  res.json({
    totalUsers,
    totalTasks,
    completedTasks,
    adminCount,
    tasksByPriority,
    tasksByCategory,
    recentActivity
  });
});

app.delete('/api/admin/users/:id', (req, res) => {
  if (!req.session.userId || !req.session.isAdmin) {
    return res.status(401).json({ error: 'Admin access required' });
  }
  
  if (parseInt(req.params.id) === req.session.userId) {
    return res.status(400).json({ error: 'You cannot delete your own account' });
  }
  
  const user = db.prepare('SELECT username FROM users WHERE id = ?').get(req.params.id);
  
  db.prepare('DELETE FROM tasks WHERE user_id = ?').run(req.params.id);
  db.prepare('DELETE FROM activity_log WHERE user_id = ?').run(req.params.id);
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  
  logActivity(req.session.userId, 'Admin deleted user', `Deleted user: ${user?.username}`);
  res.json({ success: true });
});

// ==================== START SERVER ====================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Admin Dashboard: http://localhost:${PORT}/admin.html`);
});