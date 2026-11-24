<?php
require 'storage.php';

// POST api/reflection.php -> the player adds / changes the Reflection of ONE play
// fields: id (from results.php), sessionId, whatILearned, challenge, nextStep
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJson(['error' => 'Use POST'], 405);
}

$id        = (string)($_POST['id'] ?? '');
$sessionId = substr(preg_replace('/[^A-Za-z0-9-]/', '', (string)($_POST['sessionId'] ?? '')), 0, 64);
if ($id === '' || $sessionId === '') {
    sendJson(['error' => 'id and sessionId are required'], 400);
}

$players = readPlayers();                       // 1. read
foreach ($players as $i => $record) {
    // only the browser that created the play (same sessionId) may change it
    if ($record['id'] === $id && $record['sessionId'] === $sessionId) {
        $players[$i]['reflection'] = [          // 2. change ONE record
            'whatILearned' => cleanText($_POST['whatILearned'] ?? ''),
            'challenge'    => cleanText($_POST['challenge'] ?? ''),
            'nextStep'     => cleanText($_POST['nextStep'] ?? ''),
        ];
        writePlayers($players);                 // 3. write
        sendJson(['ok' => true]);
    }
}
sendJson(['error' => 'Play not found'], 404);
