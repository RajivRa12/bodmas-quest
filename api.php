<?php
/**
 * ═══════════════════════════════════════════════════════════════
 * api.php — BODMAS Quest Backend
 *
 * Endpoints:
 *   GET  api.php?action=leaderboard&level=easy     → JSON array of top scores
 *   GET  api.php?action=best&level=easy            → JSON {best: N}
 *   POST api.php  body: {action, name, score, level, accuracy, streak}
 *
 * Storage: flat JSON file (scores.json) — no database required.
 * ═══════════════════════════════════════════════════════════════
 */

/* ── CORS Headers (allow same-origin & local file requests) ── */
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

/* Pre-flight request */
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

/* ── Config ──────────────────────────────────────────────────── */
define('SCORES_FILE',    __DIR__ . '/scores.json');
define('MAX_PER_LEVEL',  10);   // top N entries kept per level
define('NAME_MAX_LEN',   20);

/* ── Helper: load all scores ─────────────────────────────────── */
function loadScores(): array {
    if (!file_exists(SCORES_FILE)) return [];
    $raw = file_get_contents(SCORES_FILE);
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

/* ── Helper: save all scores ─────────────────────────────────── */
function saveScores(array $scores): void {
    file_put_contents(SCORES_FILE, json_encode($scores, JSON_PRETTY_PRINT));
}

/* ── Helper: emit JSON response ─────────────────────────────── */
function respond(array $payload, int $code = 200): void {
    http_response_code($code);
    echo json_encode($payload);
    exit;
}

/* ── Helper: sanitise a player name ─────────────────────────── */
function sanitiseName(string $name): string {
    $name = trim($name);
    $name = preg_replace('/[^a-zA-Z0-9 _\-\.]/u', '', $name);
    return mb_substr($name ?: 'Anonymous', 0, NAME_MAX_LEN);
}

/* ── Helper: validate level ─────────────────────────────────── */
function validLevel(string $level): bool {
    return in_array($level, ['easy', 'medium', 'hard'], true);
}

/* ══════════════════════════════════════════════════════════════
   ROUTING
══════════════════════════════════════════════════════════════ */
$method = $_SERVER['REQUEST_METHOD'];

/* ---- GET ---------------------------------------------------- */
if ($method === 'GET') {
    $action = $_GET['action'] ?? '';
    $level  = $_GET['level']  ?? '';

    /* GET leaderboard */
    if ($action === 'leaderboard') {
        if (!validLevel($level)) respond(['error' => 'Invalid level'], 400);

        $all    = loadScores();
        $board  = $all[$level] ?? [];

        // Sort descending by score, then return top MAX_PER_LEVEL
        usort($board, fn($a, $b) => $b['score'] <=> $a['score']);
        $board = array_slice($board, 0, MAX_PER_LEVEL);

        // Add rank field
        foreach ($board as $i => &$entry) {
            $entry['rank'] = $i + 1;
        }
        unset($entry);

        respond(['level' => $level, 'leaderboard' => $board]);
    }

    /* GET personal best (by name) */
    if ($action === 'best') {
        if (!validLevel($level)) respond(['error' => 'Invalid level'], 400);
        $all  = loadScores();
        $list = $all[$level] ?? [];
        $best = empty($list) ? 0 : max(array_column($list, 'score'));
        respond(['level' => $level, 'best' => $best]);
    }

    /* GET all levels best summary */
    if ($action === 'summary') {
        $all     = loadScores();
        $summary = [];
        foreach (['easy', 'medium', 'hard'] as $lvl) {
            $list            = $all[$lvl] ?? [];
            $summary[$lvl]   = empty($list) ? 0 : max(array_column($list, 'score'));
        }
        respond(['summary' => $summary]);
    }

    respond(['error' => 'Unknown action'], 400);
}

/* ---- POST --------------------------------------------------- */
if ($method === 'POST') {
    /* Parse body */
    $body = json_decode(file_get_contents('php://input'), true);
    if (!is_array($body)) {
        // Try form-encoded fallback
        $body = $_POST;
    }

    $action   = $body['action']   ?? '';
    $level    = $body['level']    ?? '';
    $score    = (int)($body['score']    ?? 0);
    $name     = sanitiseName((string)($body['name'] ?? 'Anonymous'));
    $accuracy = (int)($body['accuracy'] ?? 0);
    $streak   = (int)($body['streak']   ?? 0);

    /* POST submit score */
    if ($action === 'submit') {
        if (!validLevel($level))    respond(['error' => 'Invalid level'], 400);
        if ($score < 0)             respond(['error' => 'Invalid score'], 400);

        $all     = loadScores();
        $list    = $all[$level] ?? [];

        // Add new entry with timestamp
        $entry = [
            'name'      => $name,
            'score'     => $score,
            'accuracy'  => $accuracy,
            'streak'    => $streak,
            'level'     => $level,
            'timestamp' => time(),
            'date'      => date('Y-m-d H:i')
        ];
        $list[] = $entry;

        // Sort descending, keep only top MAX_PER_LEVEL
        usort($list, fn($a, $b) => $b['score'] <=> $a['score']);
        $list = array_slice($list, 0, MAX_PER_LEVEL);

        $all[$level] = $list;
        saveScores($all);

        // Determine rank of submitted score
        $rank = 1;
        foreach ($list as $i => $e) {
            if ($e['score'] === $score && $e['name'] === $name && $e['timestamp'] === $entry['timestamp']) {
                $rank = $i + 1;
                break;
            }
        }

        respond([
            'success'   => true,
            'rank'      => $rank,
            'name'      => $name,
            'score'     => $score,
            'level'     => $level
        ]);
    }

    respond(['error' => 'Unknown action'], 400);
}

/* Fallback */
respond(['error' => 'Method not allowed'], 405);
