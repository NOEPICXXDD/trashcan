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

// Date in Thailand time (the file stores UTC)
function thaiDate($iso) {
    $d = new DateTime($iso);
    $d->setTimezone(new DateTimeZone('Asia/Bangkok'));
    return $d->format('Y-m-d');
}

// Build ONE Portfolio Item in the shape of the Data Contract (same as item002 in portfolio-example.json)
function buildItem($r, $evidenceUrl) {
    $ref = $r['reflection'] ?? [];
    return [
        'id'          => 'item_' . $r['id'],
        'title'       => CHALLENGE_TITLE,
        'type'        => 'Challenge',
        'date'        => thaiDate($r['playedAt']),
        'role'        => 'Player',
        'description' => 'Played challenge ' . CHALLENGE_ID . ' from Group ' . CHALLENGE_GROUP,
        'skills'      => CHALLENGE_SKILLS,
        'reflection'  => [
            'whatIDid'     => 'แยกขยะ ' . $r['total'] . ' ชิ้นลงถัง 4 ประเภท ได้ ' . $r['score'] . '/' . $r['total'] . ' คะแนน',
            'whatILearned' => $ref['whatILearned'] ?? '',
            'challenge'    => $ref['challenge'] ?? '',
            'nextStep'     => $ref['nextStep'] ?? '',
        ],
        'evidence'    => [$evidenceUrl],
        'challengeId' => CHALLENGE_ID,
    ];
}

// Link to this Challenge, e.g. http://1.2.3.4/challenge/
$scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$base   = rtrim(dirname(dirname($_SERVER['SCRIPT_NAME'])), '/\\');
$evidenceUrl = $scheme . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . $base . '/';

$records = readPlayers();

// One entry per player visit: keep the LATEST attempt of each session
$sessions = [];
foreach ($records as $r) {
    $key = ($r['sessionId'] ?? '') !== '' ? $r['sessionId'] : $r['id'];
    if (!isset($sessions[$key])) {
        $sessions[$key] = ['latest' => $r, 'attempts' => 0];
    }
    $sessions[$key]['attempts']++;
    if ($r['attempt'] >= $sessions[$key]['latest']['attempt']) {
        $sessions[$key]['latest'] = $r;
    }
}

$players = [];
foreach ($sessions as $s) {
    $r = $s['latest'];
    $players[] = [
        'displayName' => $r['displayName'],
        'playedAt'    => $r['playedAt'],
        'attempts'    => $s['attempts'],
        'score'       => $r['score'],
        'total'       => $r['total'],
        'answers'     => $r['answers'],
        'item'        => buildItem($r, $evidenceUrl),
    ];
}

header('Content-Disposition: attachment; filename="' . CHALLENGE_ID . '-players.json"');
sendJson([
    'challengeId'  => CHALLENGE_ID,
    'group'        => CHALLENGE_GROUP,
    'title'        => CHALLENGE_TITLE,
    'exportedAt'   => gmdate('Y-m-d\TH:i:s\Z'),
    'totalPlays'   => count($records),
    'totalPlayers' => count($players),
    'players'      => $players,
]);
