const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  user: 'postgres',               // Replace with your actual DB user
  host: '172.31.12.227',
  database: 'employeedb',         // Your database name
  password: 'Test2025',           // Your actual password
  port: 5432,
});

const JWT_SECRET = 'your_secret_key'; // Keep this consistent

// ✅ Login endpoint (plain-text password check)
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const userRes = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userRes.rows[0];

    // ✅ Plain-text comparison (temporary)
    if (user.password !== password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({ token, role: user.role });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ✅ Middleware to protect admin-only routes
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
    } catch (err) {
      return res.sendStatus(403);
    }
  };
};

// ✅ Get all employees
app.get('/api/employees', authenticate(['admin']), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM employees');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching employees' });
  }
});

// ✅ Create employee
app.post('/api/employees', authenticate(['admin']), async (req, res) => {
  const { name, username, email, salary, designation, joining_date } = req.body;
  try {
    await pool.query(
  'INSERT INTO employees (name, username, email, salary, designation, joining_date) VALUES ($1, $2, $3, $4, $5, $6)',
  [name, username, email, salary, designation, joining_date]
);
    res.sendStatus(201);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ✅ Update employee
app.put('/api/employees/:id', authenticate(['admin']), async (req, res) => {
  const { name, username, email, salary, designation, joining_date } = req.body;
  const id = req.params.id;
  try {
    await pool.query(
  'UPDATE employees SET name=$1, username=$2, email=$3, salary=$4, designation=$5, joining_date=$6 WHERE id=$7',
  [name, username, email, salary, designation, joining_date, id]
);
    res.sendStatus(200);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ✅ Delete employee
app.delete('/api/employees/:id', authenticate(['admin']), async (req, res) => {
  const id = req.params.id;
  try {
    await pool.query('DELETE FROM employees WHERE id = $1', [id]);
    res.sendStatus(200);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ✅ Start server
app.listen(5000, () => {
  console.log('Server running on port 5000');
});