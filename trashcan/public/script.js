// ===== Trash Sorting Challenge =====
const trashList = document.getElementById('trash-list');
const items     = document.querySelectorAll('.trash-item');
const dropAreas = document.querySelectorAll('.drop-area');
const checkBtn  = document.getElementById('check-btn');
const resetBtn  = document.getElementById('reset-btn');
const resultBox = document.getElementById('result');
const nameInput = document.getElementById('player-name');
const saveStatus = document.getElementById('save-status');
const exportBtn = document.getElementById('export-btn');

// รหัสประจำการเล่น 1 ครั้ง (ไว้จัดกลุ่มหลายรอบของคนเดียวกัน)
const sessionId = (window.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : String(Date.now()) + Math.random().toString(16).slice(2);

let dragged  = null;   // ชิ้นที่กำลังลาก
let selected = null;   // ชิ้นที่แตะเลือกไว้ (สำหรับมือถือ)

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
    let score = 0;
    let unplaced = 0;
    const answers = [];   // เก็บคำตอบทุกชิ้นไว้ส่งไปบันทึก

    items.forEach(item => {
        item.classList.remove('correct', 'wrong');
        const bin = item.closest('.bin');
        const isCorrect = !!bin && bin.dataset.bin === item.dataset.type;
        answers.push({
            item: item.querySelector('p').textContent,
            chosenBin: bin ? bin.dataset.bin : null,
            correctBin: item.dataset.type,
            isCorrect
        });

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
    if (score === total)      msg = '🎉 ยอดเยี่ยม! แยกขยะถูกทุกชิ้น';
    else if (score >= total * 0.6) msg = '👍 ดีมาก! ลองแก้ชิ้นที่ผิด (กรอบสีแดง) แล้วตรวจอีกครั้ง';
    else                      msg = '💪 สู้ๆ! ลองย้ายชิ้นที่ผิด (กรอบสีแดง) แล้วตรวจอีกครั้ง';

    resultBox.innerHTML =
        `<div class="score">${score} <small>/ ${total} คะแนน</small></div>` +
        `<div class="msg">${msg}</div>` +
        (unplaced ? `<div class="warn">ยังมีขยะที่ไม่ได้วางลงถัง ${unplaced} ชิ้น (นับเป็นผิด)</div>` : '');

    resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    saveResult(answers);
});

// ---------- ส่งผลไปเก็บที่เซิร์ฟเวอร์ ----------
async function saveResult(answers) {
    saveStatus.className = 'save-status';
    saveStatus.textContent = 'กำลังบันทึกผล...';
    try {
        const res = await fetch('/api/results', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId,
                name: nameInput.value,
                answers
            })
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        saveStatus.textContent = '✔ บันทึกผลเรียบร้อยแล้ว';
    } catch (err) {
        saveStatus.className = 'save-status error';
        saveStatus.textContent = 'บันทึกผลไม่สำเร็จ (ตรวจสอบว่าเปิดเซิร์ฟเวอร์อยู่)';
    }
}

// ---------- ดาวน์โหลด JSON ----------
exportBtn.addEventListener('click', async () => {
    let res = await fetch('/api/export');
    if (res.status === 401) {                       // เซิร์ฟเวอร์ตั้งรหัสไว้
        const key = prompt('กรอกรหัสสำหรับ export ข้อมูล');
        if (!key) return;
        res = await fetch('/api/export?key=' + encodeURIComponent(key));
    }
    if (!res.ok) { alert('ดาวน์โหลดไม่สำเร็จ (รหัสไม่ถูกต้อง?)'); return; }

    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'players-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
});

// ---------- เริ่มใหม่ ----------
resetBtn.addEventListener('click', () => {
    clearSelected();
    items.forEach(item => trashList.appendChild(item));
    clearMarks();
    saveStatus.textContent = '';
    updatePlaceholders();
});

updatePlaceholders();
