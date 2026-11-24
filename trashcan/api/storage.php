<?php
// Shared helpers for all API files:  require 'storage.php';

// ★ แก้ 3 ค่านี้ให้ตรงกับกลุ่มของคุณ (รหัสรูปแบบ Gxx-Cxx)
const CHALLENGE_ID    = 'G24-C01';
const CHALLENGE_GROUP = '24';
const CHALLENGE_TITLE = 'Trash Sorting Challenge';
const CHALLENGE_SKILLS = ['Waste sorting', 'Environmental awareness'];   // shown in every exported Item

// Where the data files live:
// - laptop (php -S localhost:8000): the folder local-data/ in the project (in .gitignore)
// - EC2 (Apache): /var/www/data, OUTSIDE the public web folder /var/www/html
if (php_sapi_name() === 'cli-server') {
    define('DATA_DIR', __DIR__ . '/../local-data');
    if (!is_dir(DATA_DIR)) {
        @mkdir(DATA_DIR);
    }
} else {
    define('DATA_DIR', '/var/www/data');
}

define('DATA_FILE', DATA_DIR . '/challenge-players.json');   // one record per play
define('KEY_FILE',  DATA_DIR . '/export-key.txt');           // Host password (never in git)

// Only ONE request at a time may use the data file.
// The lock is taken on the first read and released when the request ends.
function lockData() {
    static $lock = null;
    if ($lock === null) {
        $lock = @fopen(DATA_DIR . '/challenge.lock', 'c');
        if ($lock === false) {
            cannotSave(DATA_DIR . '/challenge.lock');
        }
        flock($lock, LOCK_EX);
    }
}

// Read all play records (empty list if no file yet)
function readPlayers() {
    lockData();
    if (!file_exists(DATA_FILE)) {
        return [];
    }
    return json_decode(file_get_contents(DATA_FILE), true) ?? [];
}

// Write all play records back to the JSON file
function writePlayers($players) {
    $json = json_encode($players, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (@file_put_contents(DATA_FILE, $json, LOCK_EX) === false) {
        cannotSave(DATA_FILE);
    }
}

function cannotSave($file) {
    if (php_sapi_name() === 'cli-server') {
        $fix = 'On your laptop: check that the project folder is not read-only.';
    } else {
        $fix = 'On EC2 run: sudo mkdir -p /var/www/data && sudo chown www-data:www-data /var/www/data';
    }
    sendJson(['error' => 'Server cannot save to ' . $file . '. ' . $fix], 500);
}

// Cut a text to at most $max characters (Thai-safe, works without the mbstring extension)
function cutText($text, $max) {
    $chars = preg_split('//u', $text, -1, PREG_SPLIT_NO_EMPTY);
    if ($chars === false) {
        return '';                          // not valid UTF-8
    }
    return implode('', array_slice($chars, 0, $max));
}

// Trim a text from a form field and cut it to $max characters
function cleanText($value, $max = 300) {
    return cutText(trim((string)$value), $max);
}

// Send an answer back to JavaScript as JSON, then stop
function sendJson($data, $status = 200) {
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
