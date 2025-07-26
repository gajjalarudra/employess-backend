const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

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

// Employee login (checks if password set)
app.post('/api/employee-login', async (req, res) => {
  const { username, password } = req.body;
  const result = await pool.query('SELECT * FROM employees WHERE username=$1', [username]);

  if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

  const employee = result.rows[0];

  if (!employee.password) {
    return res.status(403).json({ error: 'Password not set', setPassword: true, employeeId: employee.id });
  }

  const isMatch = await bcrypt.compare(password, employee.password);
  if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign({ userId: employee.id, role: 'employee', username: employee.username }, JWT_SECRET, { expiresIn: '2h' });
  res.json({ token, role: 'employee', username: employee.username });
});

// Set employee password (first login)
app.post('/api/set-password', async (req, res) => {
  const { employeeId, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  await pool.query('UPDATE employees SET password=$1 WHERE id=$2', [hashed, employeeId]);
  res.sendStatus(200);
});

// ✅ Clock-in endpoint
app.post('/api/clock-in', authenticate(['employee']), async (req, res) => {
  try {
    const userId = req.user.userId;
    const today = new Date().toISOString().split('T')[0];

    const existing = await pool.query('SELECT * FROM attendance WHERE employee_id=$1 AND date=$2', [userId, today]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Already clocked in today' });
    }

    await pool.query(
      'INSERT INTO attendance (employee_id, clock_in, date, clockin_approved) VALUES ($1, NOW(), $2, false)',
      [userId, today]
    );
    res.sendStatus(200);
  } catch (err) {
    console.error('Clock-in error:', err);
    res.status(500).json({ error: 'Failed to clock in' });
  }
});

//clock-out endpoint
app.post('/api/clock-out', authenticate(['employee']), async (req, res) => {
  const userId = req.user.userId;
  const today = new Date().toISOString().split('T')[0];

  const result = await pool.query('SELECT * FROM attendance WHERE employee_id=$1 AND date=$2', [userId, today]);
  if (result.rows.length === 0) {
    return res.status(400).json({ error: 'You have not clocked in yet today' });
  }

  await pool.query('UPDATE attendance SET clock_out=NOW() WHERE employee_id=$1 AND date=$2', [userId, today]);
  res.sendStatus(200);
});

// ✅ Apply for leave
app.post('/api/leaves/apply', authenticate(['employee']), async (req, res) => {
  const { leave_type, start_date, end_date, reason } = req.body;
  const userId = req.user.userId;

  await pool.query(
    'INSERT INTO leaves (employee_id, leave_type, start_date, end_date, reason) VALUES ($1, $2, $3, $4, $5)',
    [userId, leave_type, start_date, end_date, reason]
  );

  res.sendStatus(201);
});

// ✅ Get all leaves for employee
app.get('/api/leaves', authenticate(['employee']), async (req, res) => {
  const userId = req.user.userId;
  const result = await pool.query('SELECT * FROM leaves WHERE employee_id=$1 ORDER BY start_date DESC', [userId]);
  res.json(result.rows);
});

// --- Leave Approvals for Admin ---

// Get all pending leave requests (approved = false)
app.get('/api/leave-requests', authenticate(['admin']), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT l.*, e.name as employeeName, e.username 
       FROM leaves l 
       JOIN employees e ON l.employee_id = e.id
       WHERE l.approved = false
       ORDER BY l.start_date DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching leave requests:', err);
    res.status(500).json({ error: 'Error fetching leave requests' });
  }
});

// Approve a leave request by ID
app.post('/api/leave-requests/:id/approve', authenticate(['admin']), async (req, res) => {
  const id = req.params.id;
  try {
    const result = await pool.query('UPDATE leaves SET approved = true WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Leave request not found' });
    }
    res.json({ message: 'Leave request approved' });
  } catch (err) {
    console.error('Error approving leave request:', err);
    res.status(500).json({ error: 'Error approving leave request' });
  }
});

// --- Clock-in Approvals for Admin ---

// Get all pending clock-in requests (clockin_approved = false)
app.get('/api/clockin-requests', authenticate(['admin']), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, e.name as employeeName, e.username 
       FROM attendance a
       JOIN employees e ON a.employee_id = e.id
       WHERE a.clockin_approved = false AND a.clock_in IS NOT NULL
       ORDER BY a.date DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching clock-in requests:', err);
    res.status(500).json({ error: 'Error fetching clock-in requests' });
  }
});

// Approve a clock-in request by attendance record ID
app.post('/api/clockin-requests/:id/approve', authenticate(['admin']), async (req, res) => {
  const id = req.params.id;
  try {
    const result = await pool.query(
      'UPDATE attendance SET clockin_approved = true WHERE id = $1 RETURNING *',
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Clock-in request not found' });
    }
    res.json({ message: 'Clock-in request approved' });
  } catch (err) {
    console.error('Error approving clock-in request:', err);
    res.status(500).json({ error: 'Error approving clock-in request' });
  }
});

app.get('/api/employees/me', authenticate(['employee']), async (req, res) => {
  const userId = req.user.userId;
  const result = await pool.query('SELECT id, name, username, email, salary FROM employees WHERE id = $1', [userId]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Employee not found' });
  res.json(result.rows[0]);
});

// Get attendance records for logged-in employee
app.get('/api/attendance', authenticate(['employee']), async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      'SELECT id, date, clock_in, clock_out, clockin_approved FROM attendance WHERE employee_id = $1 ORDER BY date DESC',
      [userId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching attendance:', err);
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
});


// ✅ Start server
app.listen(5000, () => {
  console.log('Server running on port 5000');
});