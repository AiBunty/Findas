<?php
require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function send_json($status, $payload) {
    http_response_code($status);
    echo json_encode($payload);
    exit;
}

function sanitize_resource_name($name) {
    return preg_replace('/[^a-z\-]/', '', (string)$name);
}

function get_db() {
    static $mysqli = null;
    if ($mysqli === null) {
        $mysqli = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME, DB_PORT);
        if ($mysqli->connect_error) {
            send_json(500, ['ok' => false, 'error' => 'Database connection failed']);
        }
        $mysqli->set_charset('utf8mb4');
    }
    return $mysqli;
}

function get_json_body() {
    $raw = file_get_contents('php://input');
    if (!$raw) return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function base64url_encode($data) {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64url_decode($data) {
    $remainder = strlen($data) % 4;
    if ($remainder) {
        $data .= str_repeat('=', 4 - $remainder);
    }
    return base64_decode(strtr($data, '-_', '+/'));
}

function create_token($claims) {
    $payload = is_array($claims) ? $claims : ['sub' => (string)$claims];
    $payload['iat'] = time();
    $payload['exp'] = time() + TOKEN_TTL_SECONDS;
    $payloadJson = json_encode($payload);
    $payloadB64 = base64url_encode($payloadJson);
    $sig = hash_hmac('sha256', $payloadB64, APP_SECRET, true);
    return $payloadB64 . '.' . base64url_encode($sig);
}

function verify_token($token) {
    $parts = explode('.', $token);
    if (count($parts) !== 2) return false;
    $payloadB64 = $parts[0];
    $sigB64 = $parts[1];

    $calcSig = base64url_encode(hash_hmac('sha256', $payloadB64, APP_SECRET, true));
    if (!hash_equals($calcSig, $sigB64)) return false;

    $payloadJson = base64url_decode($payloadB64);
    $payload = json_decode($payloadJson, true);
    if (!is_array($payload)) return false;
    if (empty($payload['exp']) || time() > (int)$payload['exp']) return false;
    return $payload;
}

function require_auth() {
    $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!preg_match('/^Bearer\s+(.+)$/i', $auth, $m)) {
        send_json(401, ['ok' => false, 'error' => 'Missing token']);
    }
    $payload = verify_token($m[1]);
    if (!$payload) {
        send_json(401, ['ok' => false, 'error' => 'Invalid token']);
    }
    return $payload;
}

function require_role($payload, $roles) {
    $role = strtolower((string)($payload['role'] ?? ''));
    $allowed = array_map('strtolower', is_array($roles) ? $roles : [$roles]);
    if ($role === '' || !in_array($role, $allowed, true)) {
        send_json(403, ['ok' => false, 'error' => 'Forbidden']);
    }
}

function sanitize_role($role) {
    $r = strtolower(trim((string)$role));
    if (!in_array($r, ['owner', 'editor', 'viewer'], true)) {
        return 'editor';
    }
    return $r;
}

function ensure_admin_users_table() {
    $db = get_db();
    $db->query("CREATE TABLE IF NOT EXISTS admin_users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(191) NOT NULL UNIQUE,
        username VARCHAR(160) NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('owner','editor','viewer') NOT NULL DEFAULT 'editor',
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        last_login_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
}

function bootstrap_default_owner() {
    ensure_admin_users_table();
    $db = get_db();
    $row = fetch_one('SELECT COUNT(*) AS cnt FROM admin_users');
    $count = $row ? (int)($row['cnt'] ?? 0) : 0;
    if ($count > 0) return;

    $email = env_or_default('FINDAS_ADMIN_EMAIL', 'admin@findas.in');
    $username = ADMIN_USERNAME;
    $hash = password_hash(ADMIN_PASSWORD, PASSWORD_BCRYPT);
    $role = 'owner';
    $active = 1;

    $stmt = $db->prepare('INSERT INTO admin_users (email, username, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?)');
    if (!$stmt) {
        send_json(500, ['ok' => false, 'error' => 'Failed to initialize admin owner']);
    }
    $stmt->bind_param('ssssi', $email, $username, $hash, $role, $active);
    if (!$stmt->execute()) {
        send_json(500, ['ok' => false, 'error' => 'Failed to initialize admin owner']);
    }
}

function find_admin_user_for_login($identifier) {
    ensure_admin_users_table();
    $db = get_db();
    $stmt = $db->prepare('SELECT id, email, username, password_hash, role, is_active FROM admin_users WHERE (LOWER(email) = LOWER(?) OR LOWER(username) = LOWER(?)) LIMIT 1');
    if (!$stmt) {
        send_json(500, ['ok' => false, 'error' => 'Auth query failed']);
    }
    $stmt->bind_param('ss', $identifier, $identifier);
    if (!$stmt->execute()) {
        send_json(500, ['ok' => false, 'error' => 'Auth query failed']);
    }
    $stmt->bind_result($id, $email, $username, $passwordHash, $role, $isActive);
    if ($stmt->fetch()) {
        return [
            'id' => (int)$id,
            'email' => (string)$email,
            'username' => $username === null ? null : (string)$username,
            'password_hash' => (string)$passwordHash,
            'role' => (string)$role,
            'is_active' => (int)$isActive
        ];
    }
    return null;
}

function list_admin_users() {
    ensure_admin_users_table();
    return fetch_rows('SELECT id, email, username, role, is_active, last_login_at, created_at, updated_at FROM admin_users ORDER BY id ASC');
}

function create_admin_user($body) {
    ensure_admin_users_table();
    $db = get_db();
    $email = trim((string)($body['email'] ?? ''));
    $username = trim((string)($body['username'] ?? ''));
    $password = (string)($body['password'] ?? '');
    $role = sanitize_role($body['role'] ?? 'editor');
    $active = normalize_boolish($body['is_active'] ?? 1, 1);

    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        send_json(400, ['ok' => false, 'error' => 'Valid email is required']);
    }
    if (strlen($password) < 6) {
        send_json(400, ['ok' => false, 'error' => 'Password must be at least 6 characters']);
    }

    $hash = password_hash($password, PASSWORD_BCRYPT);
    $stmt = $db->prepare('INSERT INTO admin_users (email, username, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?)');
    if (!$stmt) {
        send_json(500, ['ok' => false, 'error' => 'Failed to prepare user create']);
    }
    $stmt->bind_param('ssssi', $email, $username, $hash, $role, $active);
    if (!$stmt->execute()) {
        send_json(500, ['ok' => false, 'error' => 'Failed to create user (email/username may already exist)']);
    }

    $id = (int)$db->insert_id;
    $row = fetch_one('SELECT id, email, username, role, is_active, last_login_at, created_at, updated_at FROM admin_users WHERE id = ' . $id . ' LIMIT 1');
    return $row;
}

function update_admin_user($id, $body) {
    ensure_admin_users_table();
    $db = get_db();

    $setParts = [];
    $vals = [];

    if (array_key_exists('email', $body)) {
        $email = trim((string)$body['email']);
        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            send_json(400, ['ok' => false, 'error' => 'Valid email is required']);
        }
        $setParts[] = '`email` = ?';
        $vals[] = $email;
    }

    if (array_key_exists('username', $body)) {
        $username = trim((string)$body['username']);
        $setParts[] = '`username` = ?';
        $vals[] = $username;
    }

    if (array_key_exists('role', $body)) {
        $role = sanitize_role($body['role']);
        $setParts[] = '`role` = ?';
        $vals[] = $role;
    }

    if (array_key_exists('is_active', $body)) {
        $active = normalize_boolish($body['is_active'], 1);
        $setParts[] = '`is_active` = ?';
        $vals[] = (string)$active;
    }

    if (array_key_exists('password', $body)) {
        $password = (string)$body['password'];
        if ($password !== '') {
            if (strlen($password) < 6) {
                send_json(400, ['ok' => false, 'error' => 'Password must be at least 6 characters']);
            }
            $setParts[] = '`password_hash` = ?';
            $vals[] = password_hash($password, PASSWORD_BCRYPT);
        }
    }

    if (count($setParts) === 0) {
        send_json(400, ['ok' => false, 'error' => 'No fields to update']);
    }

    $setParts[] = '`updated_at` = NOW()';
    $sql = 'UPDATE admin_users SET ' . implode(', ', $setParts) . ' WHERE id = ?';
    $stmt = $db->prepare($sql);
    if (!$stmt) {
        send_json(500, ['ok' => false, 'error' => 'Failed to prepare user update']);
    }
    $vals[] = (string)$id;
    bind_stmt_dynamic($stmt, $vals);
    if (!$stmt->execute()) {
        send_json(500, ['ok' => false, 'error' => 'Failed to update user']);
    }

    $row = fetch_one('SELECT id, email, username, role, is_active, last_login_at, created_at, updated_at FROM admin_users WHERE id = ' . (int)$id . ' LIMIT 1');
    return $row;
}

function fetch_rows($sql) {
    $db = get_db();
    $result = $db->query($sql);
    if (!$result) {
        send_json(500, ['ok' => false, 'error' => 'Query failed']);
    }
    $rows = [];
    while ($row = $result->fetch_assoc()) {
        $rows[] = $row;
    }
    return $rows;
}

function fetch_one($sql) {
    $rows = fetch_rows($sql);
    return count($rows) ? $rows[0] : null;
}

function bind_stmt_dynamic($stmt, $values) {
    if (count($values) === 0) {
        return;
    }

    $types = str_repeat('s', count($values));
    $bindParams = [$types];
    foreach ($values as $k => $v) {
        $bindParams[] = &$values[$k];
    }
    call_user_func_array([$stmt, 'bind_param'], $bindParams);
}

function execute_stmt($stmt, $errorMessage) {
    if (!$stmt->execute()) {
        send_json(500, ['ok' => false, 'error' => $errorMessage]);
    }
}

function build_insert_payload($meta, $body) {
    $payload = [];
    foreach ($meta['fields'] as $field) {
        if (array_key_exists($field, $body)) {
            $payload[$field] = $body[$field];
        }
    }
    return $payload;
}

function build_update_payload($meta, $body) {
    $payload = [];
    foreach ($meta['fields'] as $field) {
        if (array_key_exists($field, $body)) {
            $payload[$field] = $body[$field];
        }
    }
    return $payload;
}

function ensure_required_fields($payload, $required) {
    foreach ($required as $field) {
        if (!array_key_exists($field, $payload) || $payload[$field] === null || $payload[$field] === '') {
            send_json(400, ['ok' => false, 'error' => 'Missing required field: ' . $field]);
        }
    }
}

function upsert_singleton($table, $fields, $body) {
    $db = get_db();
    $insertCols = ['id'];
    $insertVals = [1];
    $updates = [];

    foreach ($fields as $field) {
        if (array_key_exists($field, $body)) {
            $insertCols[] = $field;
            $insertVals[] = $body[$field];
            $updates[] = "`{$field}` = VALUES(`{$field}`)";
        }
    }

    if (count($insertCols) === 1) {
        send_json(400, ['ok' => false, 'error' => 'No fields to update']);
    }

    $colsSql = implode(', ', array_map(function($c) { return "`{$c}`"; }, $insertCols));
    $phSql = implode(', ', array_fill(0, count($insertCols), '?'));
    $updSql = implode(', ', $updates) . ', `updated_at` = NOW()';

    $sql = "INSERT INTO `{$table}` ({$colsSql}) VALUES ({$phSql}) ON DUPLICATE KEY UPDATE {$updSql}";
    $stmt = $db->prepare($sql);
    if (!$stmt) {
        send_json(500, ['ok' => false, 'error' => 'Failed to prepare singleton update']);
    }

    bind_stmt_dynamic($stmt, $insertVals);
    execute_stmt($stmt, 'Failed to save section');
}

function create_resource_item($resourceMeta, $body) {
    $db = get_db();
    $payload = build_insert_payload($resourceMeta, $body);
    ensure_required_fields($payload, $resourceMeta['required']);

    if (count($payload) === 0) {
        send_json(400, ['ok' => false, 'error' => 'No fields to insert']);
    }

    $cols = array_keys($payload);
    $vals = array_values($payload);
    $colsSql = implode(', ', array_map(function($c) { return "`{$c}`"; }, $cols));
    $phSql = implode(', ', array_fill(0, count($cols), '?'));

    $sql = "INSERT INTO `{$resourceMeta['table']}` ({$colsSql}) VALUES ({$phSql})";
    $stmt = $db->prepare($sql);
    if (!$stmt) {
        send_json(500, ['ok' => false, 'error' => 'Failed to prepare create']);
    }

    bind_stmt_dynamic($stmt, $vals);
    execute_stmt($stmt, 'Failed to create item');

    return (int)$db->insert_id;
}

function update_resource_item($resourceMeta, $id, $body) {
    $db = get_db();
    $payload = build_update_payload($resourceMeta, $body);
    if (count($payload) === 0) {
        send_json(400, ['ok' => false, 'error' => 'No fields to update']);
    }

    $setParts = [];
    $vals = [];
    foreach ($payload as $field => $value) {
        $setParts[] = "`{$field}` = ?";
        $vals[] = $value;
    }
    $setParts[] = '`updated_at` = NOW()';

    $sql = "UPDATE `{$resourceMeta['table']}` SET " . implode(', ', $setParts) . " WHERE id = ?";
    $stmt = $db->prepare($sql);
    if (!$stmt) {
        send_json(500, ['ok' => false, 'error' => 'Failed to prepare update']);
    }

    $vals[] = (string)$id;
    bind_stmt_dynamic($stmt, $vals);
    execute_stmt($stmt, 'Failed to update item');
}

function delete_resource_item($resourceMeta, $id) {
    $db = get_db();
    $stmt = $db->prepare("DELETE FROM `{$resourceMeta['table']}` WHERE id = ?");
    if (!$stmt) {
        send_json(500, ['ok' => false, 'error' => 'Failed to prepare delete']);
    }
    $sid = (string)$id;
    $stmt->bind_param('s', $sid);
    execute_stmt($stmt, 'Failed to delete item');
}

function normalize_boolish($value, $default = 1) {
        if ($value === null || $value === '' || $value === false) return (int)$default;
        $v = strtolower(trim((string)$value));
        return ($v === '1' || $v === 'true' || $v === 'yes' || $v === 'y') ? 1 : 0;
}

function normalize_num($value, $default = 0) {
        if ($value === null || $value === '') return $default;
        return is_numeric($value) ? (0 + $value) : $default;
}

function ensure_sync_tables() {
        $db = get_db();
        $db->query("CREATE TABLE IF NOT EXISTS polls_snapshot (
            id VARCHAR(191) PRIMARY KEY,
            question TEXT,
            status VARCHAR(60),
            created_at_text VARCHAR(120),
            ends_at_text VARCHAR(120),
            require_name TINYINT(1) DEFAULT 0,
            show_voters_publicly TINYINT(1) DEFAULT 0,
            options_json LONGTEXT,
            voters_json LONGTEXT,
            description TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        $db->query("CREATE TABLE IF NOT EXISTS admin_credentials_snapshot (
            id INT PRIMARY KEY,
            username VARCHAR(191),
            password_hash TEXT,
            whatsapp_number VARCHAR(80),
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
}

function ensure_column_if_missing($table, $column, $definitionSql) {
        $db = get_db();
        $safeTable = preg_replace('/[^a-zA-Z0-9_]/', '', (string)$table);
        $safeColumn = preg_replace('/[^a-zA-Z0-9_]/', '', (string)$column);
        if ($safeTable === '' || $safeColumn === '') return;

        $exists = $db->query("SHOW COLUMNS FROM `{$safeTable}` LIKE '" . $db->real_escape_string($safeColumn) . "'");
        if ($exists && $exists->num_rows > 0) {
            return;
        }

        $ok = $db->query("ALTER TABLE `{$safeTable}` ADD COLUMN `{$safeColumn}` {$definitionSql}");
        if (!$ok) {
            send_json(500, ['ok' => false, 'error' => 'Failed schema migration for ' . $safeTable . '.' . $safeColumn]);
        }
}

function ensure_modal_content_schema() {
        static $done = false;
        if ($done) return;
        $done = true;

        $db = get_db();

        $db->query("CREATE TABLE IF NOT EXISTS course_page_blocks (
            id INT AUTO_INCREMENT PRIMARY KEY,
            course_slug VARCHAR(160) NOT NULL,
            slug VARCHAR(160) NULL,
            block_type VARCHAR(80) NOT NULL,
            title VARCHAR(255) NULL,
            subtitle TEXT NULL,
            body TEXT NULL,
            bullets TEXT NULL,
            image_url VARCHAR(500) NULL,
            bg_color VARCHAR(40) NULL,
            is_active TINYINT(1) DEFAULT 1,
            `order` INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_course_page_blocks_slug (course_slug),
            INDEX idx_course_page_blocks_slug_legacy (slug)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        $db->query("CREATE TABLE IF NOT EXISTS course_for_you_cards (
            id INT AUTO_INCREMENT PRIMARY KEY,
            course_slug VARCHAR(160) NOT NULL,
            slug VARCHAR(160) NULL,
            card_title VARCHAR(255) NULL,
            card_body TEXT NULL,
            icon_url VARCHAR(500) NULL,
            is_active TINYINT(1) DEFAULT 1,
            `order` INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_course_for_you_slug (course_slug),
            INDEX idx_course_for_you_slug_legacy (slug)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        $db->query("CREATE TABLE IF NOT EXISTS digital_product_details (
            id INT AUTO_INCREMENT PRIMARY KEY,
            product_slug VARCHAR(160) NOT NULL,
            slug VARCHAR(160) NULL,
            section_type VARCHAR(80) NOT NULL,
            heading VARCHAR(255) NULL,
            body TEXT NULL,
            file_includes TEXT NULL,
            bullets TEXT NULL,
            image_url VARCHAR(500) NULL,
            is_active TINYINT(1) DEFAULT 1,
            `order` INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_digital_details_slug (product_slug),
            INDEX idx_digital_details_slug_legacy (slug)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        $db->query("CREATE TABLE IF NOT EXISTS webinar_page_blocks (
            id INT AUTO_INCREMENT PRIMARY KEY,
            webinar_slug VARCHAR(160) NOT NULL,
            slug VARCHAR(160) NULL,
            block_type VARCHAR(80) NOT NULL,
            title VARCHAR(255) NULL,
            subtitle TEXT NULL,
            body TEXT NULL,
            bullets TEXT NULL,
            image_url VARCHAR(500) NULL,
            bg_color VARCHAR(40) NULL,
            is_active TINYINT(1) DEFAULT 1,
            `order` INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_webinar_blocks_slug (webinar_slug),
            INDEX idx_webinar_blocks_slug_legacy (slug)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        $db->query("CREATE TABLE IF NOT EXISTS webinar_key_points_cards (
            id INT AUTO_INCREMENT PRIMARY KEY,
            webinar_slug VARCHAR(160) NOT NULL,
            slug VARCHAR(160) NULL,
            title VARCHAR(255) NULL,
            body TEXT NULL,
            icon_url VARCHAR(500) NULL,
            is_active TINYINT(1) DEFAULT 1,
            `order` INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_webinar_keypoints_slug (webinar_slug),
            INDEX idx_webinar_keypoints_slug_legacy (slug)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        $db->query("CREATE TABLE IF NOT EXISTS short_reviews (
            id INT AUTO_INCREMENT PRIMARY KEY,
            slug VARCHAR(160) NULL,
            course_slug VARCHAR(160) NULL,
            webinar_slug VARCHAR(160) NULL,
            review_text TEXT NULL,
            name VARCHAR(160) NULL,
            is_active TINYINT(1) DEFAULT 1,
            `order` INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_short_reviews_slug (slug),
            INDEX idx_short_reviews_course (course_slug),
            INDEX idx_short_reviews_webinar (webinar_slug)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        $db->query("CREATE TABLE IF NOT EXISTS featured_reviews (
            id INT AUTO_INCREMENT PRIMARY KEY,
            slug VARCHAR(160) NULL,
            course_slug VARCHAR(160) NULL,
            webinar_slug VARCHAR(160) NULL,
            title VARCHAR(255) NULL,
            review_text TEXT NULL,
            name VARCHAR(160) NULL,
            image_url VARCHAR(500) NULL,
            is_active TINYINT(1) DEFAULT 1,
            `order` INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_featured_reviews_slug (slug),
            INDEX idx_featured_reviews_course (course_slug),
            INDEX idx_featured_reviews_webinar (webinar_slug)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        $db->query("CREATE TABLE IF NOT EXISTS gallery_images (
            id INT AUTO_INCREMENT PRIMARY KEY,
            image_url VARCHAR(500) NULL,
            title VARCHAR(255) NULL,
            alt_text VARCHAR(255) NULL,
            is_active TINYINT(1) DEFAULT 1,
            `order` INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        $db->query("CREATE TABLE IF NOT EXISTS faq (
            id INT AUTO_INCREMENT PRIMARY KEY,
            question TEXT NULL,
            answer TEXT NULL,
            is_active TINYINT(1) DEFAULT 1,
            `order` INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        $db->query("CREATE TABLE IF NOT EXISTS who_for (
            id INT AUTO_INCREMENT PRIMARY KEY,
            icon VARCHAR(64) NULL,
            title VARCHAR(255) NULL,
            description TEXT NULL,
            is_active TINYINT(1) DEFAULT 1,
            `order` INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        ensure_column_if_missing('courses', 'category', 'VARCHAR(120) NULL AFTER `subtitle`');
        ensure_column_if_missing('courses', 'language', 'VARCHAR(120) NULL AFTER `category`');
        ensure_column_if_missing('courses', 'badge', 'VARCHAR(120) NULL AFTER `language`');
        ensure_column_if_missing('courses', 'students', 'VARCHAR(120) NULL AFTER `badge`');
        ensure_column_if_missing('courses', 'payment_link', 'VARCHAR(500) NULL AFTER `students`');
        ensure_column_if_missing('courses', 'redirect_url', 'VARCHAR(500) NULL AFTER `payment_link`');

        ensure_column_if_missing('digital_products', 'category', 'VARCHAR(120) NULL AFTER `subtitle`');
        ensure_column_if_missing('digital_products', 'language', 'VARCHAR(120) NULL AFTER `category`');
        ensure_column_if_missing('digital_products', 'badge', 'VARCHAR(120) NULL AFTER `language`');
        ensure_column_if_missing('digital_products', 'preview_url', 'VARCHAR(500) NULL AFTER `badge`');
        ensure_column_if_missing('digital_products', 'payment_link', 'VARCHAR(500) NULL AFTER `preview_url`');
        ensure_column_if_missing('digital_products', 'redirect_url', 'VARCHAR(500) NULL AFTER `payment_link`');

        ensure_column_if_missing('webinars', 'host_image_url', 'VARCHAR(500) NULL AFTER `banner_url`');
        ensure_column_if_missing('webinars', 'host_name', 'VARCHAR(160) NULL AFTER `host_image_url`');
        ensure_column_if_missing('webinars', 'platform', 'VARCHAR(120) NULL AFTER `host_name`');
        ensure_column_if_missing('webinars', 'timezone', 'VARCHAR(80) NULL AFTER `platform`');
        ensure_column_if_missing('webinars', 'price_inr', 'DECIMAL(10,2) DEFAULT 0 AFTER `timezone`');
        ensure_column_if_missing('webinars', 'is_free', 'TINYINT(1) DEFAULT 0 AFTER `price_inr`');
        ensure_column_if_missing('webinars', 'payment_link', 'VARCHAR(500) NULL AFTER `is_free`');
        ensure_column_if_missing('webinars', 'primary_cta_text', 'VARCHAR(160) NULL AFTER `payment_link`');

        ensure_column_if_missing('membership_plans', 'period', 'VARCHAR(120) NULL AFTER `price_inr`');
        ensure_column_if_missing('membership_plans', 'recommended', 'TINYINT(1) DEFAULT 0 AFTER `period`');
        ensure_column_if_missing('membership_plans', 'image_url', 'VARCHAR(500) NULL AFTER `recommended`');
        ensure_column_if_missing('membership_plans', 'payment_link', 'VARCHAR(500) NULL AFTER `image_url`');

        ensure_column_if_missing('contact_section', 'gallery_enabled', 'TINYINT(1) DEFAULT 1 AFTER `address`');
        ensure_column_if_missing('contact_section', 'footer_brand_name', 'VARCHAR(255) NULL AFTER `gallery_enabled`');
        ensure_column_if_missing('contact_section', 'footer_about_text', 'TEXT NULL AFTER `footer_brand_name`');
        ensure_column_if_missing('contact_section', 'footer_quick_links_title', 'VARCHAR(255) NULL AFTER `footer_about_text`');
        ensure_column_if_missing('contact_section', 'footer_quick_link_1', 'VARCHAR(255) NULL AFTER `footer_quick_links_title`');
        ensure_column_if_missing('contact_section', 'footer_quick_link_url_1', 'VARCHAR(500) NULL AFTER `footer_quick_link_1`');
        ensure_column_if_missing('contact_section', 'footer_quick_link_2', 'VARCHAR(255) NULL AFTER `footer_quick_link_1`');
        ensure_column_if_missing('contact_section', 'footer_quick_link_url_2', 'VARCHAR(500) NULL AFTER `footer_quick_link_2`');
        ensure_column_if_missing('contact_section', 'footer_quick_link_3', 'VARCHAR(255) NULL AFTER `footer_quick_link_2`');
        ensure_column_if_missing('contact_section', 'footer_quick_link_url_3', 'VARCHAR(500) NULL AFTER `footer_quick_link_3`');
        ensure_column_if_missing('contact_section', 'footer_quick_link_4', 'VARCHAR(255) NULL AFTER `footer_quick_link_3`');
        ensure_column_if_missing('contact_section', 'footer_quick_link_url_4', 'VARCHAR(500) NULL AFTER `footer_quick_link_4`');
        ensure_column_if_missing('contact_section', 'footer_quick_link_5', 'VARCHAR(255) NULL AFTER `footer_quick_link_4`');
        ensure_column_if_missing('contact_section', 'footer_quick_link_url_5', 'VARCHAR(500) NULL AFTER `footer_quick_link_5`');
        ensure_column_if_missing('contact_section', 'footer_quick_link_6', 'VARCHAR(255) NULL AFTER `footer_quick_link_5`');
        ensure_column_if_missing('contact_section', 'footer_quick_link_url_6', 'VARCHAR(500) NULL AFTER `footer_quick_link_6`');
        ensure_column_if_missing('contact_section', 'footer_contact_title', 'VARCHAR(255) NULL AFTER `footer_quick_link_6`');
        ensure_column_if_missing('contact_section', 'footer_phone', 'VARCHAR(255) NULL AFTER `footer_contact_title`');
        ensure_column_if_missing('contact_section', 'footer_address', 'TEXT NULL AFTER `footer_phone`');
        ensure_column_if_missing('contact_section', 'footer_social_title', 'VARCHAR(255) NULL AFTER `footer_address`');
        ensure_column_if_missing('contact_section', 'footer_social_instagram', 'VARCHAR(500) NULL AFTER `footer_social_title`');
        ensure_column_if_missing('contact_section', 'footer_social_facebook', 'VARCHAR(500) NULL AFTER `footer_social_instagram`');
        ensure_column_if_missing('contact_section', 'footer_social_youtube', 'VARCHAR(500) NULL AFTER `footer_social_facebook`');
        ensure_column_if_missing('contact_section', 'footer_social_twitter', 'VARCHAR(500) NULL AFTER `footer_social_youtube`');
        ensure_column_if_missing('contact_section', 'footer_social_whatsapp', 'VARCHAR(500) NULL AFTER `footer_social_twitter`');
        ensure_column_if_missing('contact_section', 'footer_copyright', 'TEXT NULL AFTER `footer_social_whatsapp`');

        $db->query("CREATE TABLE IF NOT EXISTS site_assets (
            id INT PRIMARY KEY,
            navbar_logo_url VARCHAR(500) NULL,
            footer_logo_url VARCHAR(500) NULL,
            loading_logo_url VARCHAR(500) NULL,
            favicon_url VARCHAR(500) NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        $db->query("INSERT IGNORE INTO site_assets (id) VALUES (1)");

        $db->query("CREATE TABLE IF NOT EXISTS site_config (
            id INT PRIMARY KEY,
            footer_brand_name VARCHAR(255) NULL,
            footer_about_text TEXT NULL,
            footer_quick_links_title VARCHAR(255) NULL,
            footer_quick_link_1 VARCHAR(255) NULL,
            footer_quick_link_url_1 VARCHAR(500) NULL,
            footer_quick_link_2 VARCHAR(255) NULL,
            footer_quick_link_url_2 VARCHAR(500) NULL,
            footer_quick_link_3 VARCHAR(255) NULL,
            footer_quick_link_url_3 VARCHAR(500) NULL,
            footer_quick_link_4 VARCHAR(255) NULL,
            footer_quick_link_url_4 VARCHAR(500) NULL,
            footer_quick_link_5 VARCHAR(255) NULL,
            footer_quick_link_url_5 VARCHAR(500) NULL,
            footer_quick_link_6 VARCHAR(255) NULL,
            footer_quick_link_url_6 VARCHAR(500) NULL,
            footer_contact_title VARCHAR(255) NULL,
            footer_phone VARCHAR(255) NULL,
            footer_address TEXT NULL,
            footer_social_title VARCHAR(255) NULL,
            footer_social_instagram VARCHAR(500) NULL,
            footer_social_facebook VARCHAR(500) NULL,
            footer_social_youtube VARCHAR(500) NULL,
            footer_social_twitter VARCHAR(500) NULL,
            footer_social_whatsapp VARCHAR(500) NULL,
            footer_copyright TEXT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        $db->query("INSERT IGNORE INTO site_config (id) VALUES (1)");

        ensure_column_if_missing('site_config', 'footer_social_twitter', 'VARCHAR(500) NULL AFTER `footer_social_youtube`');
        ensure_column_if_missing('site_config', 'footer_social_whatsapp', 'VARCHAR(500) NULL AFTER `footer_social_twitter`');
        ensure_column_if_missing('site_config', 'footer_quick_link_url_1', 'VARCHAR(500) NULL AFTER `footer_quick_link_1`');
        ensure_column_if_missing('site_config', 'footer_quick_link_url_2', 'VARCHAR(500) NULL AFTER `footer_quick_link_2`');
        ensure_column_if_missing('site_config', 'footer_quick_link_url_3', 'VARCHAR(500) NULL AFTER `footer_quick_link_3`');
        ensure_column_if_missing('site_config', 'footer_quick_link_url_4', 'VARCHAR(500) NULL AFTER `footer_quick_link_4`');
        ensure_column_if_missing('site_config', 'footer_quick_link_url_5', 'VARCHAR(500) NULL AFTER `footer_quick_link_5`');
        ensure_column_if_missing('site_config', 'footer_quick_link_url_6', 'VARCHAR(500) NULL AFTER `footer_quick_link_6`');

        $db->query("CREATE TABLE IF NOT EXISTS academy_config (
            id INT PRIMARY KEY,
            is_enabled TINYINT(1) DEFAULT 1,
            show_intro_comparison TINYINT(1) DEFAULT 1,
            show_features TINYINT(1) DEFAULT 1,
            show_products TINYINT(1) DEFAULT 1,
            show_community TINYINT(1) DEFAULT 1,
            show_roadmap TINYINT(1) DEFAULT 1,
            show_growth_roadmap TINYINT(1) DEFAULT 1,
            show_who_should_join TINYINT(1) DEFAULT 1,
            show_cta TINYINT(1) DEFAULT 1,
            intro_text TEXT NULL,
            before_heading VARCHAR(255) NULL,
            before_items TEXT NULL,
            after_heading VARCHAR(255) NULL,
            after_items TEXT NULL,
            features_intro VARCHAR(255) NULL,
            features_json JSON NULL,
            products_heading VARCHAR(255) NULL,
            products_description TEXT NULL,
            community_heading VARCHAR(255) NULL,
            community_samples_json JSON NULL,
            roadmap_heading VARCHAR(255) NULL,
            roadmap_items_json JSON NULL,
            growth_roadmap_heading VARCHAR(255) NULL,
            growth_stages_json JSON NULL,
            who_should_join_text TEXT NULL,
            membership_heading VARCHAR(255) NULL,
            membership_description TEXT NULL,
            cta_button_text VARCHAR(255) NULL,
            cta_button_url VARCHAR(500) NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        $db->query("INSERT IGNORE INTO academy_config (id) VALUES (1)");
        
        // Add individual section toggle columns if missing
        ensure_column_if_missing('academy_config', 'show_intro_comparison', 'TINYINT(1) DEFAULT 1 AFTER `is_enabled`');
        ensure_column_if_missing('academy_config', 'show_features', 'TINYINT(1) DEFAULT 1 AFTER `show_intro_comparison`');
        ensure_column_if_missing('academy_config', 'show_products', 'TINYINT(1) DEFAULT 1 AFTER `show_features`');
        ensure_column_if_missing('academy_config', 'show_community', 'TINYINT(1) DEFAULT 1 AFTER `show_products`');
        ensure_column_if_missing('academy_config', 'show_roadmap', 'TINYINT(1) DEFAULT 1 AFTER `show_community`');
        ensure_column_if_missing('academy_config', 'show_growth_roadmap', 'TINYINT(1) DEFAULT 1 AFTER `show_roadmap`');
        ensure_column_if_missing('academy_config', 'show_who_should_join', 'TINYINT(1) DEFAULT 1 AFTER `show_growth_roadmap`');
        ensure_column_if_missing('academy_config', 'show_cta', 'TINYINT(1) DEFAULT 1 AFTER `show_who_should_join`');
}

function get_site_assets_row() {
        ensure_modal_content_schema();
        $row = fetch_one("SELECT * FROM `site_assets` WHERE id = 1 LIMIT 1");
        if (!$row) {
            return [
                'id' => 1,
                'navbar_logo_url' => '',
                'footer_logo_url' => '',
                'loading_logo_url' => '',
                'favicon_url' => ''
            ];
        }
        return $row;
}

function upsert_site_assets($payload) {
        $current = get_site_assets_row();
        $navbar = array_key_exists('navbar_logo_url', $payload) ? trim((string)$payload['navbar_logo_url']) : (string)($current['navbar_logo_url'] ?? '');
        $footer = array_key_exists('footer_logo_url', $payload) ? trim((string)$payload['footer_logo_url']) : (string)($current['footer_logo_url'] ?? '');
        $loading = array_key_exists('loading_logo_url', $payload) ? trim((string)$payload['loading_logo_url']) : (string)($current['loading_logo_url'] ?? '');
        $favicon = array_key_exists('favicon_url', $payload) ? trim((string)$payload['favicon_url']) : (string)($current['favicon_url'] ?? '');

        $db = get_db();
        $stmt = $db->prepare("INSERT INTO site_assets (id, navbar_logo_url, footer_logo_url, loading_logo_url, favicon_url)
            VALUES (1, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
            navbar_logo_url = VALUES(navbar_logo_url),
            footer_logo_url = VALUES(footer_logo_url),
            loading_logo_url = VALUES(loading_logo_url),
            favicon_url = VALUES(favicon_url),
            updated_at = NOW()");
        if (!$stmt) {
            send_json(500, ['ok' => false, 'error' => 'Failed to prepare site assets update']);
        }
        $stmt->bind_param('ssss', $navbar, $footer, $loading, $favicon);
        if (!$stmt->execute()) {
            send_json(500, ['ok' => false, 'error' => 'Failed to update site assets']);
        }
        return get_site_assets_row();
}

function save_logo_asset_file($fileName, $mimeType, $base64Data) {
        $fileName = trim((string)$fileName);
        $mimeType = strtolower(trim((string)$mimeType));
        $base64Data = trim((string)$base64Data);
        if ($base64Data === '') {
            send_json(400, ['ok' => false, 'error' => 'Missing image data']);
        }

        $extByMime = [
            'image/png' => 'png',
            'image/jpeg' => 'jpg',
            'image/jpg' => 'jpg',
            'image/webp' => 'webp',
            'image/svg+xml' => 'svg'
        ];

        $ext = '';
        if ($mimeType !== '' && isset($extByMime[$mimeType])) {
            $ext = $extByMime[$mimeType];
        }

        if ($ext === '' && preg_match('/\.([a-zA-Z0-9]+)$/', $fileName, $m)) {
            $guessed = strtolower($m[1]);
            if (in_array($guessed, ['png', 'jpg', 'jpeg', 'webp', 'svg'], true)) {
                $ext = ($guessed === 'jpeg') ? 'jpg' : $guessed;
            }
        }

        if ($ext === '') {
            $ext = 'png';
        }

        $binary = base64_decode($base64Data, true);
        if ($binary === false) {
            send_json(400, ['ok' => false, 'error' => 'Invalid image data']);
        }
        if (strlen($binary) > (6 * 1024 * 1024)) {
            send_json(400, ['ok' => false, 'error' => 'Image is too large. Max size is 6MB']);
        }

        $assetsDir = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'assets';
        if (!is_dir($assetsDir)) {
            if (!mkdir($assetsDir, 0775, true) && !is_dir($assetsDir)) {
                send_json(500, ['ok' => false, 'error' => 'Failed to create assets folder']);
            }
        }

        $rand = '';
        try {
            $rand = bin2hex(random_bytes(4));
        } catch (Throwable $e) {
            $rand = substr(md5((string)microtime(true)), 0, 8);
        }

        $targetName = 'site-logo-' . time() . '-' . $rand . '.' . $ext;
        $targetPath = $assetsDir . DIRECTORY_SEPARATOR . $targetName;

        if (file_put_contents($targetPath, $binary) === false) {
            send_json(500, ['ok' => false, 'error' => 'Failed to save uploaded image']);
        }

        return '/assets/' . $targetName;
}

function fetch_rows_by_slug_match($table, $slug, $slugFields, $activeOnly = true) {
        $db = get_db();
        $safeSlug = $db->real_escape_string((string)$slug);
        $conds = [];
        foreach ($slugFields as $field) {
            $safeField = preg_replace('/[^a-zA-Z0-9_]/', '', (string)$field);
            if ($safeField === '') continue;
            $conds[] = "(`{$safeField}` = '{$safeSlug}' OR FIND_IN_SET('{$safeSlug}', REPLACE(REPLACE(`{$safeField}`, ' ', ''), '|', ',')) > 0)";
        }
        if (count($conds) === 0) return [];

        $where = '(' . implode(' OR ', $conds) . ')';
        if ($activeOnly) {
            $where = "`is_active` = 1 AND " . $where;
        }
        return fetch_rows("SELECT * FROM `{$table}` WHERE {$where} ORDER BY `order` ASC, id ASC");
}

function sync_webapp_to_mysql() {
        ensure_sync_tables();
        $db = get_db();

        $countTables = [
            'courses' => 'courses',
            'digital_products' => 'digital_products',
            'webinars' => 'webinars',
            'membership_plans' => 'membership_plans',
            'academy_sections' => 'academy_sections',
            'academy_community_posts' => 'academy_community_posts',
            'polls_snapshot' => 'polls_snapshot',
            'admin_credentials_snapshot' => 'admin_credentials_snapshot'
        ];

        $counts = [];
        foreach ($countTables as $key => $table) {
            $result = $db->query('SELECT COUNT(*) AS cnt FROM `' . $table . '`');
            if ($result) {
                $row = $result->fetch_assoc();
                $counts[$key] = (int)($row['cnt'] ?? 0);
            } else {
                $counts[$key] = 0;
            }
        }

        return $counts;
}

function require_polls_api_key($body = null) {
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    $auth = '';
    if (is_array($headers) && isset($headers['Authorization'])) {
        $auth = (string)$headers['Authorization'];
    } elseif (is_array($headers) && isset($headers['authorization'])) {
        $auth = (string)$headers['authorization'];
    }
    if ($auth && preg_match('/Bearer\s+(.*)$/i', $auth, $m)) {
        $payload = verify_token(trim($m[1]));
        if ($payload && isset($payload['sub'])) {
            return;
        }
    }

    $apiKey = isset($_GET['apiKey']) ? (string)$_GET['apiKey'] : '';
    if ($apiKey === '' && is_array($body) && isset($body['apiKey'])) {
        $apiKey = (string)$body['apiKey'];
    }
    if ($apiKey === '' || !hash_equals((string)FINDAS_POLLS_API_KEY, $apiKey)) {
        send_json(401, ['success' => false, 'error' => 'Invalid API key']);
    }
}

function load_polls_snapshot_rows() {
    ensure_sync_tables();
    $db = get_db();
    $result = $db->query('SELECT id, question, status, created_at_text, ends_at_text, require_name, show_voters_publicly, options_json, voters_json, description FROM polls_snapshot ORDER BY updated_at DESC');
    if (!$result) {
        send_json(500, ['success' => false, 'error' => 'Failed to load polls']);
    }

    $rows = [];
    while ($row = $result->fetch_assoc()) {
        $options = json_decode((string)$row['options_json'], true);
        $voters = json_decode((string)$row['voters_json'], true);
        $rows[] = [
            'id' => (string)$row['id'],
            'question' => (string)$row['question'],
            'status' => (string)$row['status'],
            'created_at' => (string)$row['created_at_text'],
            'ends_at' => (string)$row['ends_at_text'],
            'require_name' => ((int)$row['require_name']) === 1,
            'show_voters_publicly' => ((int)$row['show_voters_publicly']) === 1,
            'options' => is_array($options) ? $options : [],
            'voters' => is_array($voters) ? $voters : [],
            'description' => (string)$row['description']
        ];
    }
    return $rows;
}

function save_polls_snapshot_rows($polls) {
    if (!is_array($polls)) {
        send_json(400, ['success' => false, 'error' => 'Invalid polls payload']);
    }

    ensure_sync_tables();
    $db = get_db();
    $db->query('DELETE FROM polls_snapshot');

    if (count($polls) === 0) {
        return 0;
    }

    $stmt = $db->prepare('INSERT INTO polls_snapshot (id, question, status, created_at_text, ends_at_text, require_name, show_voters_publicly, options_json, voters_json, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    if (!$stmt) {
        send_json(500, ['success' => false, 'error' => 'Failed to prepare poll save']);
    }

    $saved = 0;
    foreach ($polls as $p) {
        if (!is_array($p)) continue;
        $id = isset($p['id']) ? trim((string)$p['id']) : '';
        if ($id === '') continue;

        $question = isset($p['question']) ? (string)$p['question'] : '';
        $status = isset($p['status']) ? (string)$p['status'] : 'ACTIVE';
        $created = isset($p['created_at']) ? (string)$p['created_at'] : '';
        $ends = isset($p['ends_at']) ? (string)$p['ends_at'] : '';
        $requireName = normalize_boolish(isset($p['require_name']) ? $p['require_name'] : 0, 0);
        $showVoters = normalize_boolish(isset($p['show_voters_publicly']) ? $p['show_voters_publicly'] : 0, 0);
        $optionsJson = json_encode(isset($p['options']) && is_array($p['options']) ? $p['options'] : []);
        $votersJson = json_encode(isset($p['voters']) && is_array($p['voters']) ? $p['voters'] : []);
        $desc = isset($p['description']) ? (string)$p['description'] : '';

        $stmt->bind_param('sssssiisss', $id, $question, $status, $created, $ends, $requireName, $showVoters, $optionsJson, $votersJson, $desc);
        $stmt->execute();
        $saved++;
    }

    return $saved;
}

function load_admin_credentials_snapshot_row() {
    ensure_sync_tables();
    $row = fetch_one('SELECT id, username, password_hash, whatsapp_number FROM admin_credentials_snapshot WHERE id = 1 LIMIT 1');
    if (!$row) {
        return [
            'username' => ADMIN_USERNAME,
            'passwordHash' => '',
            'whatsappNumber' => '918766514883'
        ];
    }
    return [
        'username' => isset($row['username']) ? (string)$row['username'] : ADMIN_USERNAME,
        'passwordHash' => isset($row['password_hash']) ? (string)$row['password_hash'] : '',
        'whatsappNumber' => isset($row['whatsapp_number']) ? (string)$row['whatsapp_number'] : '918766514883'
    ];
}

function save_admin_credentials_snapshot($username, $passwordHash) {
    ensure_sync_tables();
    $db = get_db();
    $whatsapp = '918766514883';
    $row = fetch_one('SELECT whatsapp_number FROM admin_credentials_snapshot WHERE id = 1 LIMIT 1');
    if ($row && isset($row['whatsapp_number']) && $row['whatsapp_number'] !== '') {
        $whatsapp = (string)$row['whatsapp_number'];
    }

    $stmt = $db->prepare('INSERT INTO admin_credentials_snapshot (id, username, password_hash, whatsapp_number) VALUES (1, ?, ?, ?) ON DUPLICATE KEY UPDATE username=VALUES(username), password_hash=VALUES(password_hash), whatsapp_number=VALUES(whatsapp_number), updated_at=NOW()');
    if (!$stmt) {
        send_json(500, ['success' => false, 'error' => 'Failed to prepare credentials save']);
    }
    $stmt->bind_param('sss', $username, $passwordHash, $whatsapp);
    $stmt->execute();
}

function save_whatsapp_number_snapshot($whatsappNumber) {
    ensure_sync_tables();
    $db = get_db();
    $creds = load_admin_credentials_snapshot_row();
    $username = (string)$creds['username'];
    $passwordHash = (string)$creds['passwordHash'];

    $stmt = $db->prepare('INSERT INTO admin_credentials_snapshot (id, username, password_hash, whatsapp_number) VALUES (1, ?, ?, ?) ON DUPLICATE KEY UPDATE username=VALUES(username), password_hash=VALUES(password_hash), whatsapp_number=VALUES(whatsapp_number), updated_at=NOW()');
    if (!$stmt) {
        send_json(500, ['success' => false, 'error' => 'Failed to prepare whatsapp save']);
    }
    $stmt->bind_param('sss', $username, $passwordHash, $whatsappNumber);
    $stmt->execute();
}

$uriPath = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$scriptDir = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/');
$path = preg_replace('#^' . preg_quote($scriptDir, '#') . '#', '', $uriPath);
$path = '/' . ltrim($path, '/');
$method = $_SERVER['REQUEST_METHOD'];

ensure_modal_content_schema();

$resourceMap = [
    'courses' => [
        'table' => 'courses',
        'fields' => ['title', 'subtitle', 'slug', 'category', 'language', 'badge', 'students', 'thumbnail_url', 'price_inr', 'payment_link', 'redirect_url', 'is_active', 'order'],
        'required' => ['title']
    ],
    'webinars' => [
        'table' => 'webinars',
        'fields' => ['title', 'subtitle', 'slug', 'banner_url', 'host_image_url', 'host_name', 'platform', 'timezone', 'start_datetime_local', 'end_datetime_local', 'price_inr', 'is_free', 'payment_link', 'primary_cta_text', 'is_active', 'order'],
        'required' => ['title']
    ],
    'digital-products' => [
        'table' => 'digital_products',
        'fields' => ['title', 'subtitle', 'slug', 'category', 'language', 'badge', 'thumbnail_url', 'price_inr', 'preview_url', 'payment_link', 'redirect_url', 'is_active', 'order'],
        'required' => ['title']
    ],
    'membership' => [
        'table' => 'membership_plans',
        'fields' => ['plan_id', 'title', 'description', 'price_inr', 'period', 'recommended', 'image_url', 'payment_link', 'features', 'target_audience', 'benefits', 'is_active', 'order'],
        'required' => ['title']
    ],
    'academy-sections' => [
        'table' => 'academy_sections',
        'fields' => ['title', 'description', 'icon_emoji', 'details', 'is_active', 'order'],
        'required' => ['title']
    ],
    'academy-community' => [
        'table' => 'academy_community_posts',
        'fields' => ['post_type', 'content', 'author', 'is_active', 'order'],
        'required' => ['content']
    ],
    'course-page-blocks' => [
        'table' => 'course_page_blocks',
        'fields' => ['course_slug', 'slug', 'block_type', 'title', 'subtitle', 'body', 'bullets', 'image_url', 'bg_color', 'is_active', 'order'],
        'required' => ['course_slug', 'block_type']
    ],
    'course-for-you-cards' => [
        'table' => 'course_for_you_cards',
        'fields' => ['course_slug', 'slug', 'card_title', 'card_body', 'icon_url', 'is_active', 'order'],
        'required' => ['course_slug']
    ],
    'digital-product-details' => [
        'table' => 'digital_product_details',
        'fields' => ['product_slug', 'slug', 'section_type', 'heading', 'body', 'file_includes', 'bullets', 'image_url', 'is_active', 'order'],
        'required' => ['product_slug', 'section_type']
    ],
    'webinar-page-blocks' => [
        'table' => 'webinar_page_blocks',
        'fields' => ['webinar_slug', 'slug', 'block_type', 'title', 'subtitle', 'body', 'bullets', 'image_url', 'bg_color', 'is_active', 'order'],
        'required' => ['webinar_slug', 'block_type']
    ],
    'webinar-key-points-cards' => [
        'table' => 'webinar_key_points_cards',
        'fields' => ['webinar_slug', 'slug', 'title', 'body', 'icon_url', 'is_active', 'order'],
        'required' => ['webinar_slug']
    ],
    'short-reviews' => [
        'table' => 'short_reviews',
        'fields' => ['slug', 'course_slug', 'webinar_slug', 'review_text', 'name', 'is_active', 'order'],
        'required' => ['review_text']
    ],
    'featured-reviews' => [
        'table' => 'featured_reviews',
        'fields' => ['slug', 'course_slug', 'webinar_slug', 'title', 'review_text', 'name', 'image_url', 'is_active', 'order'],
        'required' => ['review_text']
    ],
    'gallery-images' => [
        'table' => 'gallery_images',
        'fields' => ['image_url', 'title', 'alt_text', 'is_active', 'order'],
        'required' => ['image_url']
    ],
    'faq' => [
        'table' => 'faq',
        'fields' => ['question', 'answer', 'is_active', 'order'],
        'required' => ['question', 'answer']
    ],
    'who-for' => [
        'table' => 'who_for',
        'fields' => ['icon', 'title', 'description', 'is_active', 'order'],
        'required' => ['title']
    ],
    'academy-before' => [
        'table' => 'academy_before',
        'fields' => ['challenge', 'is_active', 'order'],
        'required' => ['challenge']
    ],
    'academy-after' => [
        'table' => 'academy_after',
        'fields' => ['benefit', 'is_active', 'order'],
        'required' => ['benefit']
    ],
    'academy-roadmap' => [
        'table' => 'academy_roadmap',
        'fields' => ['stage_num', 'stage_name', 'description', 'is_active', 'order'],
        'required' => ['stage_num', 'stage_name']
    ]
];

$singletonMap = [
    'hero' => [
        'table' => 'hero_section',
        'fields' => ['title', 'subtitle', 'button_text_1', 'button_text_2', 'video_url']
    ],
    'about' => [
        'table' => 'about_section',
        'fields' => ['founder_name', 'founder_title', 'paragraph_1', 'paragraph_2', 'paragraph_3', 'founder_image_url']
    ],
    'contact' => [
        'table' => 'contact_section',
        'fields' => [
            'phone',
            'email',
            'address',
            'gallery_enabled',
            'footer_brand_name',
            'footer_about_text',
            'footer_quick_links_title',
            'footer_quick_link_1',
            'footer_quick_link_url_1',
            'footer_quick_link_2',
            'footer_quick_link_url_2',
            'footer_quick_link_3',
            'footer_quick_link_url_3',
            'footer_quick_link_4',
            'footer_quick_link_url_4',
            'footer_quick_link_5',
            'footer_quick_link_url_5',
            'footer_quick_link_6',
            'footer_quick_link_url_6',
            'footer_contact_title',
            'footer_phone',
            'footer_address',
            'footer_social_title',
            'footer_social_instagram',
            'footer_social_facebook',
            'footer_social_youtube',
            'footer_social_twitter',
            'footer_social_whatsapp',
            'footer_copyright'
        ]
    ],
    'site-config' => [
        'table' => 'site_config',
        'fields' => [
            'footer_brand_name',
            'footer_about_text',
            'footer_quick_links_title',
            'footer_quick_link_1',
            'footer_quick_link_url_1',
            'footer_quick_link_2',
            'footer_quick_link_url_2',
            'footer_quick_link_3',
            'footer_quick_link_url_3',
            'footer_quick_link_4',
            'footer_quick_link_url_4',
            'footer_quick_link_5',
            'footer_quick_link_url_5',
            'footer_quick_link_6',
            'footer_quick_link_url_6',
            'footer_contact_title',
            'footer_phone',
            'footer_address',
            'footer_social_title',
            'footer_social_instagram',
            'footer_social_facebook',
            'footer_social_youtube',
            'footer_social_twitter',
            'footer_social_whatsapp',
            'footer_copyright'
        ]
    ],
    'academy' => [
        'table' => 'academy_config',
        'fields' => [
            'is_enabled',
            'show_intro_comparison',
            'show_features',
            'show_products',
            'show_community',
            'show_roadmap',
            'show_growth_roadmap',
            'show_who_should_join',
            'show_cta',
            'intro_text',
            'before_heading',
            'before_items',
            'after_heading',
            'after_items',
            'features_intro',
            'features_json',
            'products_heading',
            'products_description',
            'community_heading',
            'community_samples_json',
            'roadmap_heading',
            'roadmap_items_json',
            'growth_roadmap_heading',
            'growth_stages_json',
            'who_should_join_text',
            'membership_heading',
            'membership_description',
            'cta_button_text',
            'cta_button_url'
        ]
    ]
];

function get_default_contact_footer_payload() {
    return [
        'id' => 1,
        'phone' => '+91 8766514883',
        'email' => 'support@findasacademy.in',
        'address' => 'Pune, Maharashtra, India',
        'gallery_enabled' => 1,
        'footer_brand_name' => 'Findas Academy',
        'footer_about_text' => 'Empowering financial freedom through expert-led courses, webinars, and a growth-focused learning community.',
        'footer_quick_links_title' => 'Quick Links',
        'footer_quick_link_1' => 'Home',
        'footer_quick_link_url_1' => '#home',
        'footer_quick_link_2' => 'About',
        'footer_quick_link_url_2' => '#about',
        'footer_quick_link_3' => 'Courses',
        'footer_quick_link_url_3' => '#courses',
        'footer_quick_link_4' => 'Webinars',
        'footer_quick_link_url_4' => '#webinars',
        'footer_quick_link_5' => 'Membership',
        'footer_quick_link_url_5' => '#membership',
        'footer_quick_link_6' => 'Contact',
        'footer_quick_link_url_6' => '#contact',
        'footer_contact_title' => 'Contact',
        'footer_phone' => '+91 8766514883',
        'footer_address' => 'Pune, Maharashtra, India',
        'footer_social_title' => 'Connect',
        'footer_social_instagram' => 'https://instagram.com/findasacademy',
        'footer_social_facebook' => 'https://facebook.com/findasacademy',
        'footer_social_youtube' => 'https://youtube.com/@findasacademy',
        'footer_social_twitter' => 'https://x.com/findasacademy',
        'footer_social_whatsapp' => 'https://wa.me/918766514883',
        'footer_copyright' => '&copy; 2026 Findas Academy. All rights reserved.'
    ];
}

function get_default_singleton_row($section, $row) {
    if ($section !== 'contact' && $section !== 'site-config') {
        return $row;
    }

    $defaults = get_default_contact_footer_payload();
    if (!is_array($row) || count($row) === 0) {
        return $defaults;
    }

    foreach ($defaults as $key => $value) {
        if (!array_key_exists($key, $row) || $row[$key] === null || $row[$key] === '') {
            $row[$key] = $value;
        }
    }
    return $row;
}

if ($path === '/health' || $path === '/api/health') {
    send_json(200, ['ok' => true, 'service' => 'findas-php-api']);
}

if (($path === '/site-assets' || $path === '/api/site-assets') && $method === 'GET') {
    send_json(200, ['ok' => true, 'data' => get_site_assets_row()]);
}

if ($path === '/polls-api' || $path === '/api/polls-api') {
    if ($method === 'GET') {
        require_polls_api_key();
        $action = isset($_GET['action']) ? (string)$_GET['action'] : '';

        if ($action === 'getAllPolls') {
            send_json(200, ['success' => true, 'polls' => load_polls_snapshot_rows()]);
        }
        if ($action === 'getCredentials') {
            $creds = load_admin_credentials_snapshot_row();
            send_json(200, ['success' => true, 'credentials' => ['username' => $creds['username'], 'passwordHash' => $creds['passwordHash']]]);
        }
        if ($action === 'getWhatsAppNumber') {
            $creds = load_admin_credentials_snapshot_row();
            send_json(200, ['success' => true, 'whatsappNumber' => $creds['whatsappNumber']]);
        }

        send_json(400, ['success' => false, 'error' => 'Unknown action']);
    }

    if ($method === 'POST') {
        $body = get_json_body();
        require_polls_api_key($body);
        $action = isset($body['action']) ? (string)$body['action'] : '';

        if ($action === 'saveAllPolls') {
            $saved = save_polls_snapshot_rows(isset($body['polls']) ? $body['polls'] : []);
            send_json(200, ['success' => true, 'saved' => $saved]);
        }
        if ($action === 'updateAdminCredentials') {
            $username = isset($body['username']) ? trim((string)$body['username']) : '';
            $passwordHash = isset($body['passwordHash']) ? trim((string)$body['passwordHash']) : '';
            if ($username === '' || $passwordHash === '') {
                send_json(400, ['success' => false, 'error' => 'Missing username or passwordHash']);
            }
            save_admin_credentials_snapshot($username, $passwordHash);
            send_json(200, ['success' => true]);
        }
        if ($action === 'setWhatsAppNumber') {
            $whatsapp = isset($body['whatsappNumber']) ? trim((string)$body['whatsappNumber']) : '';
            if ($whatsapp === '') {
                send_json(400, ['success' => false, 'error' => 'Missing whatsappNumber']);
            }
            save_whatsapp_number_snapshot($whatsapp);
            send_json(200, ['success' => true]);
        }

        send_json(400, ['success' => false, 'error' => 'Unknown action']);
    }

    send_json(405, ['success' => false, 'error' => 'Method not allowed']);
}

if (($path === '/admin/sync-webapp' || $path === '/api/admin/sync-webapp') && $method === 'POST') {
    $payload = require_auth();
    require_role($payload, ['owner', 'editor']);
    try {
        $counts = sync_webapp_to_mysql();
        send_json(200, ['ok' => true, 'data' => ['counts' => $counts]]);
    } catch (Exception $e) {
        send_json(500, ['ok' => false, 'error' => 'Sync failed: ' . $e->getMessage()]);
    }
}

if (($path === '/admin/site-assets' || $path === '/api/admin/site-assets') && $method === 'PUT') {
    $payload = require_auth();
    require_role($payload, ['owner', 'editor']);
    $body = get_json_body();
    $saved = upsert_site_assets(is_array($body) ? $body : []);
    send_json(200, ['ok' => true, 'data' => $saved]);
}

if (($path === '/admin/assets/logo' || $path === '/api/admin/assets/logo') && $method === 'POST') {
    $payload = require_auth();
    require_role($payload, ['owner', 'editor']);
    $body = get_json_body();
    $logoUrl = save_logo_asset_file($body['fileName'] ?? '', $body['mimeType'] ?? '', $body['base64Data'] ?? '');
    $saved = upsert_site_assets([
        'navbar_logo_url' => $logoUrl,
        'footer_logo_url' => $logoUrl,
        'loading_logo_url' => $logoUrl
    ]);
    send_json(200, ['ok' => true, 'data' => $saved]);
}

if ($path === '/auth/login' || $path === '/api/auth/login') {
    try {
        if ($method !== 'POST') {
            send_json(405, ['ok' => false, 'error' => 'Method not allowed']);
        }
        $body = get_json_body();
        bootstrap_default_owner();
        $username = trim((string)($body['username'] ?? ''));
        $email = trim((string)($body['email'] ?? ''));
        $password = (string)($body['password'] ?? '');
        $identifier = $email !== '' ? $email : $username;

        if ($identifier === '' || $password === '') {
            send_json(400, ['ok' => false, 'error' => 'Email/username and password are required']);
        }

        $user = find_admin_user_for_login($identifier);
        if (!$user || (int)($user['is_active'] ?? 0) !== 1 || !password_verify($password, (string)$user['password_hash'])) {
            send_json(401, ['ok' => false, 'error' => 'Invalid credentials']);
        }

        $userId = (int)$user['id'];
        $db = get_db();
        $db->query('UPDATE admin_users SET last_login_at = NOW() WHERE id = ' . $userId);

        $token = create_token([
            'sub' => (string)$userId,
            'email' => (string)($user['email'] ?? ''),
            'username' => (string)($user['username'] ?? ''),
            'role' => sanitize_role($user['role'] ?? 'editor')
        ]);

        send_json(200, [
            'ok' => true,
            'token' => $token,
            'user' => [
                'id' => $userId,
                'email' => (string)($user['email'] ?? ''),
                'username' => (string)($user['username'] ?? ''),
                'role' => sanitize_role($user['role'] ?? 'editor')
            ]
        ]);
    } catch (Throwable $e) {
        send_json(500, ['ok' => false, 'error' => 'Login failed']);
    }
}

if (($path === '/auth/me' || $path === '/api/auth/me') && $method === 'GET') {
    $payload = require_auth();
    send_json(200, [
        'ok' => true,
        'user' => [
            'id' => (int)($payload['sub'] ?? 0),
            'email' => (string)($payload['email'] ?? ''),
            'username' => (string)($payload['username'] ?? ''),
            'role' => sanitize_role($payload['role'] ?? 'viewer')
        ]
    ]);
}

if (($path === '/admin/users' || $path === '/api/admin/users')) {
    $payload = require_auth();
    require_role($payload, ['owner']);

    if ($method === 'GET') {
        send_json(200, ['ok' => true, 'data' => list_admin_users()]);
    }

    if ($method === 'POST') {
        $body = get_json_body();
        $user = create_admin_user($body);
        send_json(201, ['ok' => true, 'data' => $user]);
    }

    send_json(405, ['ok' => false, 'error' => 'Method not allowed']);
}

if (preg_match('#^/(api/)?admin/users/([0-9]+)$#', $path, $m)) {
    $payload = require_auth();
    require_role($payload, ['owner']);
    $id = (int)$m[2];

    if ($method === 'PUT') {
        $body = get_json_body();
        $user = update_admin_user($id, $body);
        send_json(200, ['ok' => true, 'data' => $user]);
    }

    send_json(405, ['ok' => false, 'error' => 'Method not allowed']);
}

if (preg_match('#^/(api/)?admin/(hero|about|contact|site-config|academy)$#', $path, $m)) {
    $payload = require_auth();
    $section = sanitize_resource_name($m[2]);
    $meta = $singletonMap[$section] ?? null;
    if (!$meta) {
        send_json(404, ['ok' => false, 'error' => 'Unknown singleton resource']);
    }

    if ($method === 'GET') {
        $row = fetch_one("SELECT * FROM `{$meta['table']}` ORDER BY id DESC LIMIT 1");
        $row = get_default_singleton_row($section, $row);
        send_json(200, ['ok' => true, 'data' => $row]);
    }

    if ($method === 'PUT') {
        require_role($payload, ['owner', 'editor']);
        $body = get_json_body();
        upsert_singleton($meta['table'], $meta['fields'], $body);
        $row = fetch_one("SELECT * FROM `{$meta['table']}` WHERE id = 1 LIMIT 1");
        send_json(200, ['ok' => true, 'data' => $row]);
    }

    send_json(405, ['ok' => false, 'error' => 'Method not allowed']);
}

if (preg_match('#^/(api/)?admin/([a-z\-]+)$#', $path, $m)) {
    $payload = require_auth();
    $resource = sanitize_resource_name($m[2]);
    if (!isset($resourceMap[$resource])) {
        send_json(404, ['ok' => false, 'error' => 'Unknown admin resource']);
    }

    $meta = $resourceMap[$resource];
    $table = $meta['table'];

    if ($method === 'GET') {
        $rows = fetch_rows("SELECT * FROM `{$table}` ORDER BY `order` ASC, id ASC");
        send_json(200, ['ok' => true, 'data' => $rows]);
    }

    if ($method === 'POST') {
        require_role($payload, ['owner', 'editor']);
        $body = get_json_body();
        $newId = create_resource_item($meta, $body);
        $row = fetch_one("SELECT * FROM `{$table}` WHERE id = " . (int)$newId . " LIMIT 1");
        send_json(201, ['ok' => true, 'data' => $row]);
    }

    send_json(405, ['ok' => false, 'error' => 'Method not allowed']);
}

if (preg_match('#^/(api/)?admin/([a-z\-]+)/([0-9]+)$#', $path, $m)) {
    $payload = require_auth();
    $resource = sanitize_resource_name($m[2]);
    $id = (int)$m[3];
    if (!isset($resourceMap[$resource])) {
        send_json(404, ['ok' => false, 'error' => 'Unknown admin resource']);
    }

    $meta = $resourceMap[$resource];
    if ($method === 'PUT') {
        require_role($payload, ['owner', 'editor']);
        $body = get_json_body();
        update_resource_item($meta, $id, $body);
        $row = fetch_one("SELECT * FROM `{$meta['table']}` WHERE id = {$id} LIMIT 1");
        send_json(200, ['ok' => true, 'data' => $row]);
    }

    if ($method === 'DELETE') {
        require_role($payload, ['owner', 'editor']);
        delete_resource_item($meta, $id);
        send_json(200, ['ok' => true]);
    }

    send_json(405, ['ok' => false, 'error' => 'Method not allowed']);
}

if (preg_match('#^/(api/)?course-details/([^/]+)$#', $path, $m) && $method === 'GET') {
    $db = get_db();
    $slug = urldecode((string)$m[2]);
    $safeSlug = $db->real_escape_string($slug);
    $course = fetch_one("SELECT * FROM `courses` WHERE `is_active` = 1 AND `slug` = '{$safeSlug}' LIMIT 1");
    if (!$course) {
        send_json(404, ['ok' => false, 'error' => 'Course details not found']);
    }

    $blocks = fetch_rows_by_slug_match('course_page_blocks', $slug, ['course_slug', 'slug'], true);
    $forYouCards = fetch_rows_by_slug_match('course_for_you_cards', $slug, ['course_slug', 'slug'], true);
    $shortReviews = fetch_rows_by_slug_match('short_reviews', $slug, ['course_slug', 'slug'], true);
    $featuredReviews = fetch_rows_by_slug_match('featured_reviews', $slug, ['course_slug', 'slug'], true);

    send_json(200, [
        'ok' => true,
        'data' => [
            'course' => $course,
            'blocks' => $blocks,
            'forYouCards' => $forYouCards,
            'shortReviews' => $shortReviews,
            'featuredReviews' => $featuredReviews
        ]
    ]);
}

if (preg_match('#^/(api/)?digital-product-details/([^/]+)$#', $path, $m) && $method === 'GET') {
    $db = get_db();
    $slug = urldecode((string)$m[2]);
    $safeSlug = $db->real_escape_string($slug);
    $product = fetch_one("SELECT * FROM `digital_products` WHERE `is_active` = 1 AND `slug` = '{$safeSlug}' LIMIT 1");
    if (!$product) {
        send_json(404, ['ok' => false, 'error' => 'Product details not found']);
    }

    $sections = fetch_rows_by_slug_match('digital_product_details', $slug, ['product_slug', 'slug'], true);
    send_json(200, ['ok' => true, 'data' => ['product' => $product, 'sections' => $sections]]);
}

if (preg_match('#^/(api/)?webinar-details/([^/]+)$#', $path, $m) && $method === 'GET') {
    $db = get_db();
    $slug = urldecode((string)$m[2]);
    $safeSlug = $db->real_escape_string($slug);
    $webinar = fetch_one("SELECT * FROM `webinars` WHERE `is_active` = 1 AND `slug` = '{$safeSlug}' LIMIT 1");
    if (!$webinar) {
        send_json(404, ['ok' => false, 'error' => 'Webinar details not found']);
    }

    $blocks = fetch_rows_by_slug_match('webinar_page_blocks', $slug, ['webinar_slug', 'slug'], true);
    $keyPoints = fetch_rows_by_slug_match('webinar_key_points_cards', $slug, ['webinar_slug', 'slug'], true);
    $featuredReviews = fetch_rows_by_slug_match('featured_reviews', $slug, ['webinar_slug', 'slug'], true);

    send_json(200, [
        'ok' => true,
        'data' => [
            'webinar' => $webinar,
            'blocks' => $blocks,
            'keyPoints' => $keyPoints,
            'featuredReviews' => $featuredReviews
        ]
    ]);
}

if (preg_match('#^/(api/)?(hero|about|contact|site-config)$#', $path, $m) && $method === 'GET') {
    $section = sanitize_resource_name($m[2]);
    $meta = $singletonMap[$section] ?? null;
    if (!$meta) {
        send_json(404, ['ok' => false, 'error' => 'Unknown resource']);
    }
    $row = fetch_one("SELECT * FROM `{$meta['table']}` ORDER BY id DESC LIMIT 1");
    send_json(200, ['ok' => true, 'data' => $row]);
}

if (preg_match('#^/(api/)?([a-z\-]+)$#', $path, $m) && $method === 'GET') {
    $resource = sanitize_resource_name($m[2]);
    if (!isset($resourceMap[$resource])) {
        send_json(404, ['ok' => false, 'error' => 'Unknown resource']);
    }
    $table = $resourceMap[$resource]['table'];
    $rows = fetch_rows("SELECT * FROM `{$table}` WHERE is_active = 1 ORDER BY `order` ASC, id ASC");
    send_json(200, ['ok' => true, 'data' => $rows]);
}

send_json(404, ['ok' => false, 'error' => 'Not found']);
