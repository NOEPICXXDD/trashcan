// ===== Trash Sorting Challenge - Backend =====
// ไม่ต้องติดตั้งอะไรเพิ่ม ใช้แค่ Node.js (เวอร์ชัน 16 ขึ้นไป)
// รัน:  node server.js   แล้วเปิด http://localhost:3000
//
// ตั้งรหัสสำหรับ export (แนะนำ):  EXPORT_KEY=รหัสของคุณ node server.js
//   (Windows PowerShell:  $env:EXPORT_KEY="รหัสของคุณ"; node server.js)

const http = require('http');
const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT       = process.env.PORT || 3000;
const EXPORT_KEY = process.env.EXPORT_KEY || '';          // ว่าง = ใครก็ export ได้
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_FILE  = path.join(__dirname, 'data', 'players.json');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.jfif': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml'
};

// ---------- อ่าน/เขียนข้อมูลผู้เล่น (เก็บเป็นไฟล์ JSON) ----------
function readPlayers() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return []; }                                     // ยังไม่มีไฟล์ = เริ่มจากว่าง
}

function writePlayers(list) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(list, null, 2), 'utf8');
  fs.renameSync(tmp, DATA_FILE);                           // เขียนไฟล์ชั่วคราวก่อน กันไฟล์พังกลางคัน
}

// ---------- ตัวช่วย ----------
function sendJson(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function readBody(req, limit = 50_000) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > limit) { reject(new Error('too large')); req.destroy(); }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function isAdmin(url) {
  if (!EXPORT_KEY) return true;
  const given = url.searchParams.get('key') || '';
  const a = Buffer.from(given), b = Buffer.from(EXPORT_KEY);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ตรวจและทำความสะอาดข้อมูลที่ส่งมาจากหน้าเว็บ (ห้ามเชื่อข้อมูลจากฝั่งผู้เล่น)
function cleanRecord(raw) {
  const str = (v, n) => String(v ?? '').trim().slice(0, n);
  const answers = Array.isArray(raw.answers) ? raw.answers.slice(0, 20).map(a => ({
    item:      str(a.item, 60),
    chosenBin: a.chosenBin ? str(a.chosenBin, 20) : null,
    correctBin: str(a.correctBin, 20),
    isCorrect: a.isCorrect === true
  })) : [];

  // คิดคะแนนใหม่ที่ฝั่งเซิร์ฟเวอร์จากคำตอบ ไม่เชื่อ score ที่ส่งมา
  const score = answers.filter(a => a.isCorrect).length;
  return {
    id: crypto.randomUUID(),
    savedAt: new Date().toISOString(),
    sessionId: str(raw.sessionId, 64),
    name: str(raw.name, 50) || 'ไม่ระบุชื่อ',
    score,
    total: answers.length,
    answers
  };
}

// ---------- API ----------
async function handleApi(req, res, url) {
  // บันทึกผลผู้เล่น
  if (req.method === 'POST' && url.pathname === '/api/results') {
    try {
      const raw = JSON.parse(await readBody(req));
      const record = cleanRecord(raw);
      if (record.total === 0) return sendJson(res, 400, { error: 'ไม่มีคำตอบ' });
      const list = readPlayers();
      list.push(record);
      writePlayers(list);
      return sendJson(res, 201, { ok: true, id: record.id, score: record.score, total: record.total });
    } catch (err) {
      return sendJson(res, 400, { error: 'ข้อมูลไม่ถูกต้อง' });
    }
  }

  // ดาวน์โหลดไฟล์ JSON ของผู้เล่นทั้งหมด
  if (req.method === 'GET' && url.pathname === '/api/export') {
    if (!isAdmin(url)) return sendJson(res, 401, { error: 'ต้องใช้รหัสผ่าน' });
    const stamp = new Date().toISOString().slice(0, 10);
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="players-${stamp}.json"`
    });
    return res.end(JSON.stringify(readPlayers(), null, 2));
  }

  sendJson(res, 404, { error: 'ไม่พบ API นี้' });
}

// ---------- เสิร์ฟไฟล์หน้าเว็บ (เฉพาะในโฟลเดอร์ public) ----------
function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/') rel = '/index.html';
  const filePath = path.normalize(path.join(PUBLIC_DIR, rel));

  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) {        // กัน ../ หลุดออกนอกโฟลเดอร์
    res.writeHead(403); return res.end('Forbidden');
  }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
}

http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith('/api/')) return handleApi(req, res, url);
  serveStatic(req, res, url);
}).listen(PORT, () => {
  console.log(`เปิดเกมที่  http://localhost:${PORT}`);
  console.log(EXPORT_KEY ? 'Export ต้องใช้รหัส (EXPORT_KEY)' : 'คำเตือน: ยังไม่ได้ตั้ง EXPORT_KEY ใครก็ export ข้อมูลได้');
});
