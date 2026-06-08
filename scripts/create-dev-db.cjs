const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(process.cwd(), 'data', 'dev.json');
const dir = path.dirname(DB_FILE);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({ app_users: [] }, null, 2));
  console.log('Created', DB_FILE);
} else {
  console.log('DB already exists at', DB_FILE);
}
