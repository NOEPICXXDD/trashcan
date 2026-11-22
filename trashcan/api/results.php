<?php
require 'storage.php';

// The answer key lives on the SERVER, so the score is always calculated here
// (a player cannot send a fake score).  id => name + correct bin
const ANSWER_KEY = [
    'banana'    => ['name' => 'เปลือกกล้วย',        'bin' => 'organic'],
    'bottle'    => ['name' => 'ขวดพลาสติก',        'bin' => 'recycle'],
    'battery'   => ['name' => 'ถ่านไฟฉาย',         'bin' => 'hazard'],
    'tissue'    => ['name' => 'กระดาษทิชชู',       'bin' => 'general'],
    'can'       => ['name' => 'กระป๋องอะลูมิเนียม', 'bin' => 'recycle'],
    'vegetable' => ['name' => 'เศษผัก',            'bin' => 'organic'],
    'bulb'      => ['name' => 'หลอดไฟ',            'bin' => 'hazard'],
    'snack'     => ['name' => 'ซองขนม',            'bin' => 'general'],
];
const BINS = ['organic', 'recycle', 'general', 'hazard'];

// GET api/results.php -> public info about this Challenge (no player data)
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    sendJson([
        'challengeId' => CHALLENGE_ID,
        'group'       => CHALLENGE_GROUP,
        'title'       => CHALLENGE_TITLE,
        'total'       => count(ANSWER_KEY),
    ]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJson(['error' => 'Use GET or POST'], 405);
}

// POST api/results.php -> save ONE play (fetch() sends FormData -> $_POST)
$name = trim($_POST['displayName'] ?? '');
if ($name === '') {
    sendJson(['error' => 'Display name is required'], 400);
}
$name = cutText($name, 50);
if ($name === '') {
    sendJson(['error' => 'Display name is required'], 400);
}

$chosen = $_POST['answers'] ?? [];
if (!is_array($chosen)) {
    sendJson(['error' => 'Invalid answers'], 400);
}

$answers = [];
$score = 0;
foreach (ANSWER_KEY as $id => $info) {
    $bin = $chosen[$id] ?? null;
    if (!is_string($bin) || !in_array($bin, BINS, true)) {
        $bin = null;                         // not placed in any bin
    }
    $isCorrect = ($bin === $info['bin']);
    if ($isCorrect) {
        $score++;
    }
    $answers[] = [
        'id'         => $id,
        'item'       => $info['name'],
        'chosenBin'  => $bin,
        'correctBin' => $info['bin'],
        'isCorrect'  => $isCorrect,
    ];
}

$record = [
    'id'          => uniqid('r'),
    'playedAt'    => gmdate('Y-m-d\TH:i:s\Z'),
    'challengeId' => CHALLENGE_ID,
    'displayName' => $name,
    'sessionId'   => substr(preg_replace('/[^A-Za-z0-9-]/', '', (string)($_POST['sessionId'] ?? '')), 0, 64),
    'attempt'     => max(1, min(99, (int)($_POST['attempt'] ?? 1))),
    'score'       => $score,
    'total'       => count(ANSWER_KEY),
    'answers'     => $answers,
];

$players = readPlayers();      // 1. read
$players[] = $record;          // 2. add ONE play
writePlayers($players);        // 3. write

sendJson(['id' => $record['id'], 'score' => $score, 'total' => $record['total']], 201);
