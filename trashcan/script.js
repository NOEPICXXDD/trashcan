// ===== Trash Sorting Challenge =====
// ลากขยะลงถัง -> ตรวจคำตอบ (เต็ม 8) -> ส่งผลไปเก็บที่เซิร์ฟเวอร์ (api/results.php)

const trashList  = document.getElementById('trash-list');
const items      = document.querySelectorAll('.trash-item');
const dropAreas  = document.querySelectorAll('.drop-area');
const checkBtn   = document.getElementById('check-btn');
const resetBtn   = document.getElementById('reset-btn');
const resultBox  = document.getElementById('result');
const nameInput  = document.getElementById('player-name');
const saveStatus = document.getElementById('save-status');
const reflectionPanel  = document.getElementById('reflection-panel');
const reflectionBtn    = document.getElementById('reflection-btn');
const reflectionStatus = document.getElementById('reflection-status');
const learnedBox    = document.getElementById('learned');
const difficultyBox = document.getElementById('difficulty');
const nextStepBox   = document.getElementById('next-step');

let dragged  = null;   // ชิ้นที่กำลังลาก
let selected = null;   // ชิ้นที่แตะเลือกไว้ (สำหรับมือถือ)
let attempt  = 0;      // ตรวจกี่ครั้งแล้วในการเปิดหน้านี้
let lastRecordId = null;   // รหัสบันทึกล่าสุดจากเซิร์ฟเวอร์ (ไว้เพิ่มข้อความสะท้อนคิด)

// รหัสประจำการเล่น 1 ครั้ง (ไว้จัดกลุ่มหลายรอบของคนเดียวกัน)
const sessionId = (window.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : String(Date.now()) + '-' + Math.random().toString(16).slice(2);

// ---------- แสดงรหัส Challenge (มาจากเซิร์ฟเวอร์ แก้ที่ api/storage.php) ----------
async function loadInfo() {
    const label = document.getElementById('challenge-id');
    try {
        const res = await fetch('api/results.php');
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const info = await res.json();
        label.textContent = 'Challenge ID: ' + info.challengeId + ' · Group ' + info.group;
    } catch (err) {
        label.textContent = '';
    }
}
loadInfo();

// ---------- ย้ายขยะไปยังที่หมายเลือก ----------
function moveItem(item, target) {
    target.appendChild(item);
    clearMarks();
    updatePlaceholders();
}

function updatePlaceholders() {
    dropAreas.forEach(area => {
        const ph = area.querySelector('.placeholder');
        ph.style.display = area.querySelector('.trash-item') ? 'none' : '';
    });
}

function clearMarks() {
    items.forEach(i => i.classList.remove('correct', 'wrong'));
    resultBox.innerHTML = '';
    saveStatus.textContent = '';
    reflectionPanel.hidden = true;     // คะแนนเก่าแล้ว ต้องตรวจใหม่
    lastRecordId = null;
}

function clearSelected() {
    if (selected) selected.classList.remove('selected');
    selected = null;
}

// ---------- ลากขยะ ----------
items.forEach(item => {
    item.addEventListener('dragstart', e => {
        dragged = item;
        clearSelected();
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', item.querySelector('p').textContent);
        setTimeout(() => item.classList.add('dragging'), 0);
    });

    item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        dragged = null;
        document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    });

    // แตะเลือก (ใช้บนมือถือที่ลากไม่ได้)
    item.addEventListener('click', e => {
        e.stopPropagation();
        if (selected === item) { clearSelected(); return; }
        clearSelected();
        selected = item;
        item.classList.add('selected');
    });
});

// ---------- พื้นที่วาง (ถัง + กลับไปที่รายการเดิม) ----------
function makeDropTarget(el) {
    el.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        el.classList.add('drag-over');
    });
    el.addEventListener('dragleave', e => {
        if (!el.contains(e.relatedTarget)) el.classList.remove('drag-over');
    });
    el.addEventListener('drop', e => {
        e.preventDefault();
        el.classList.remove('drag-over');
        if (dragged) moveItem(dragged, el);
    });
    // แตะที่ถังหลังเลือกขยะ
    el.addEventListener('click', () => {
        if (selected) {
            moveItem(selected, el);
            clearSelected();
        }
    });
}

dropAreas.forEach(makeDropTarget);
makeDropTarget(trashList);   // ลากกลับมาวางที่เดิมได้

// ---------- ตรวจคำตอบ ----------
checkBtn.addEventListener('click', () => {
    clearSelected();

    // ต้องมีชื่อ ผู้จัดจะได้รู้ว่าใครเล่น
    if (nameInput.value.trim() === '') {
        saveStatus.className = 'save-status error';
        saveStatus.textContent = 'กรุณากรอกชื่อผู้เล่นก่อนตรวจคำตอบ';
        nameInput.focus();
        return;
    }

    let score = 0;
    let unplaced = 0;
    const formData = new FormData();   // ข้อมูลที่จะส่งไปเก็บ (PHP อ่านด้วย $_POST)

    items.forEach(item => {
        item.classList.remove('correct', 'wrong');
        const bin = item.closest('.bin');
        formData.append('answers[' + item.dataset.id + ']', bin ? bin.dataset.bin : '');

        if (!bin) {            // ยังไม่ได้วางลงถัง นับเป็นผิด
            unplaced++;
            return;
        }
        if (bin.dataset.bin === item.dataset.type) {
            score++;
            item.classList.add('correct');
        } else {
            item.classList.add('wrong');
        }
    });

    const total = items.length;   // 8
    let msg;
    if (score === total)           msg = '🎉 ยอดเยี่ยม! แยกขยะถูกทุกชิ้น';
    else if (score >= total * 0.6) msg = '👍 ดีมาก! ลองแก้ชิ้นที่ผิด (กรอบสีแดง) แล้วตรวจอีกครั้ง';
    else                           msg = '💪 สู้ๆ! ลองย้ายชิ้นที่ผิด (กรอบสีแดง) แล้วตรวจอีกครั้ง';

    resultBox.innerHTML =
        `<div class="score">${score} <small>/ ${total} คะแนน</small></div>` +
        `<div class="msg">${msg}</div>` +
        (unplaced ? `<div class="warn">ยังมีขยะที่ไม่ได้วางลงถัง ${unplaced} ชิ้น (นับเป็นผิด)</div>` : '');
    resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    attempt++;
    formData.append('displayName', nameInput.value.trim());
    formData.append('sessionId', sessionId);
    formData.append('attempt', attempt);
    formData.append('whatILearned', learnedBox.value);     // ข้อความที่เคยเขียนไว้ ติดไปกับรอบนี้ด้วย
    formData.append('challenge', difficultyBox.value);
    formData.append('nextStep', nextStepBox.value);
    saveResult(formData);
});

// ---------- ส่งผลไปเก็บที่เซิร์ฟเวอร์ ----------
async function saveResult(formData) {
    saveStatus.className = 'save-status';
    saveStatus.textContent = 'กำลังบันทึกผล...';
    try {
        const res = await fetch('api/results.php', { method: 'POST', body: formData });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        lastRecordId = data.id;
        reflectionStatus.textContent = '';
        reflectionPanel.hidden = false;
        saveStatus.textContent = '✔ บันทึกผลเรียบร้อยแล้ว';
    } catch (err) {
        saveStatus.className = 'save-status error';
        saveStatus.textContent = 'บันทึกผลไม่สำเร็จ (ตรวจสอบว่าเปิดผ่านเซิร์ฟเวอร์ PHP)';
    }
}

// ---------- บันทึกข้อความสะท้อนคิด (ไม่บังคับ) ----------
reflectionBtn.addEventListener('click', async () => {
    if (!lastRecordId) return;
    const formData = new FormData();
    formData.append('id', lastRecordId);
    formData.append('sessionId', sessionId);
    formData.append('whatILearned', learnedBox.value);
    formData.append('challenge', difficultyBox.value);
    formData.append('nextStep', nextStepBox.value);

    reflectionStatus.className = 'save-status';
    reflectionStatus.textContent = 'กำลังบันทึก...';
    try {
        const res = await fetch('api/reflection.php', { method: 'POST', body: formData });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        reflectionStatus.textContent = '✔ บันทึกข้อความแล้ว';
    } catch (err) {
        reflectionStatus.className = 'save-status error';
        reflectionStatus.textContent = 'บันทึกข้อความไม่สำเร็จ';
    }
});

// ---------- เริ่มใหม่ ----------
resetBtn.addEventListener('click', () => {
    clearSelected();
    items.forEach(item => trashList.appendChild(item));
    clearMarks();
    [learnedBox, difficultyBox, nextStepBox].forEach(t => t.value = '');
    updatePlaceholders();
});

updatePlaceholders();
