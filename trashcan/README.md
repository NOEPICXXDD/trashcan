# Trash Sorting Challenge (เว็บ Challenge แยก)

ลากขยะลงถัง → ตรวจคำตอบ (เต็ม 8) → เซิร์ฟเวอร์บันทึกผลผู้เล่น → ผู้จัด (Host) export เป็น .json

## ไฟล์
| ไฟล์ | หน้าที่ |
|---|---|
| `index.html`, `style.css`, `script.js` | หน้าเกม (ผู้เล่น) |
| `host.html` | หน้าผู้จัด: กรอกรหัส ดูรายชื่อ ดาวน์โหลด .json |
| `api/storage.php` | ฟังก์ชันอ่าน/เขียนไฟล์ (มีล็อก) + **ตั้งรหัส Challenge ตรงบนสุด** |
| `api/results.php` | POST = บันทึกผลการเล่น 1 ครั้ง (คิดคะแนนที่เซิร์ฟเวอร์) |
| `api/reflection.php` | POST = ผู้เล่นเพิ่มข้อความสะท้อนคิดของการเล่นครั้งนั้น |
| `api/export.php` | POST + รหัสผู้จัด = ส่งข้อมูลผู้เล่นทั้งหมดเป็น JSON (ผู้เล่น 1 คน = 1 Portfolio Item) |

## ก่อนใช้: แก้ค่าใน api/storage.php
แก้ `CHALLENGE_ID` และ `CHALLENGE_GROUP` (เช่น กลุ่ม 05 → `G05-C01`, `05`) และ `CHALLENGE_SKILLS` ถ้าต้องการเปลี่ยนทักษะที่ขึ้นในไฟล์ export

## ทดสอบบนเครื่อง
```bash
cd trashcan
php -S localhost:8000
```
เปิด http://localhost:8000 · ข้อมูลเก็บที่ `local-data/` (อยู่ใน .gitignore)
บนเครื่อง ถ้าไม่มีไฟล์รหัสผู้จัด จะ export ได้เลยเพื่อความสะดวกในการทดสอบ

## ตั้งค่า EC2 (ครั้งเดียว)
```bash
sudo mkdir -p /var/www/data
sudo chown www-data:www-data /var/www/data
echo 'ตั้งรหัสผู้จัดของคุณ' | sudo tee /var/www/data/export-key.txt
sudo chown www-data:www-data /var/www/data/export-key.txt
sudo chmod 600 /var/www/data/export-key.txt
```
ถ้ายังไม่สร้าง `export-key.txt` บน EC2 หน้า export จะปิดอยู่ (ไม่ให้ใครดึงข้อมูลได้)

## Deploy (ทุกครั้งที่อัปเดต)
```bash
cd ~/<โฟลเดอร์ repo>
git pull
sudo cp -r ~/<โฟลเดอร์ repo>/* /var/www/html/
```

## ไฟล์ที่ผู้จัด export ได้ (host.html)
- **JSON รายบุคคล**: ในตารางหน้า Host กดปุ่ม “ดาวน์โหลด JSON” ของผู้เล่นแต่ละคน จะได้ไฟล์ JSON 1 ไฟล์ต่อ 1 คน เป็น JSON object ตาม Data Contract (ใช้รอบล่าสุดของแต่ละ session)
- **Portfolio Items (.json)**: ดาวน์โหลดรายการ Item ของผู้เล่นทุกคนรวมเป็นไฟล์เดียว (ยังคงมีไว้สำหรับการส่งออกแบบรวม)
- **ข้อมูลผู้เล่นละเอียด (.json)**: มีชื่อ คะแนน จำนวนรอบ คำตอบรายชิ้น + Item
- ข้อมูลดิบทุกรอบอยู่ที่ `/var/www/data/challenge-players.json`

## วันงาน
- ผู้เล่นเปิด `http://<public-ip>/` → กรอกชื่อ → เล่น
- ผู้จัดเปิด `http://<public-ip>/host.html` → กรอกรหัส → โหลดข้อมูล → ดาวน์โหลด .json
- ดูไฟล์จริงบนเซิร์ฟเวอร์: `sudo cat /var/www/data/challenge-players.json`

## ถ้ามีปัญหา
- บันทึกผลไม่สำเร็จ / 500 → `sudo chown www-data:www-data /var/www/data` · `sudo tail /var/log/apache2/error.log`
- เห็นโค้ด PHP บนหน้าจอ → เปิดผ่าน Live Server/GitHub Pages อยู่ ให้ใช้ `php -S` หรือ URL ของ EC2
