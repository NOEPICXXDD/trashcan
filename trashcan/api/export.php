<?php
require 'storage.php';

// Host only: POST api/export.php  with the field  key=<password>
// The password is stored in a file OUTSIDE git:  DATA_DIR/export-key.txt
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJson(['error' => 'Use POST'], 405);
}

if (file_exists(KEY_FILE)) {
    $secret = trim(file_get_contents(KEY_FILE));
    $given  = (string)($_POST['key'] ?? '');
    if ($secret === '' || !hash_equals($secret, $given)) {
        sendJson(['error' => 'Wrong password'], 401);
    }
} elseif (php_sapi_name() !== 'cli-server') {
    // EC2 without a key file: stay closed instead of giving data to everyone
    sendJson(['error' => 'Export is disabled: create ' . KEY_FILE . ' on the server first'], 403);
}
// (laptop with no key file: allowed, for easy testing)

$players = readPlayers();

header('Content-Disposition: attachment; filename="' . CHALLENGE_ID . '-players.json"');
sendJson([
    'challengeId' => CHALLENGE_ID,
    'group'       => CHALLENGE_GROUP,
    'title'       => CHALLENGE_TITLE,
    'exportedAt'  => gmdate('Y-m-d\TH:i:s\Z'),
    'totalPlays'  => count($players),
    'players'     => $players,
]);
