const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'employeedb',
  password: 'Test2025',
  port: 5432,
});

const JWT_SECRET = 'your_secret_key';

// Login endpoint
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const userRes = await pool.query('SELECT * FROM users WHERE username=$1', [username]);
  if (userRes.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

  const user = userRes.rows[0];
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
  res.json({ token, role: user.role });
});

// Middleware to protect routes
const authenticate = (roles = []) => {
  return (req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth) return res.sendStatus(401);
    const token = auth.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (!roles.includes(decoded.role)) return res.sendStatus(403);
      req.user = decoded;
      next();
    } catch {
      res.sendStatus(403);
    }
  };
};

// CRUD: Get all employees (admin)
app.get('/api/employees', authenticate(['admin']), async (req, res) => {
  const result = await pool.query('SELECT * FROM employees');
  res.json(result.rows);
});

// Create employee
app.post('/api/employees', authenticate(['admin']), async (req, res) => {
  const { name, username, email, salary } = req.body;
  try {
    await pool.query(
      'INSERT INTO employees (name, username, email, salary) VALUES ($1, $2, $3, $4)',
      [name, username, email, salary]
    );
    res.sendStatus(201);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update employee
app.put('/api/employees/:id', authenticate(['admin']), async (req, res) => {
  const { name, username, email, salary } = req.body;
  const id = req.params.id;
  await pool.query(
    'UPDATE employees SET name=$1, username=$2, email=$3, salary=$4 WHERE id=$5',
    [name, username, email, salary, id]
  );
  res.sendStatus(200);
});

// Delete employee
app.delete('/api/employees/:id', authenticate(['admin']), async (req, res) => {
  const id = req.params.id;
  await pool.query('DELETE FROM employees WHERE id=$1', [id]);
  res.sendStatus(200);
});

// Start server
app.listen(5000, () => {
  console.log('Server running on port 5000');
});
