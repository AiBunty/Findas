<?php

function env_or_default($key, $default) {
	$val = getenv($key);
	return ($val !== false && $val !== '') ? $val : $default;
}

define('DB_HOST', env_or_default('FINDAS_DB_HOST', 'sdb-87.hosting.stackcp.net'));
define('DB_NAME', env_or_default('FINDAS_DB_NAME', 'Findas-353131330571'));
define('DB_USER', env_or_default('FINDAS_DB_USER', 'Findas-353131330571'));
define('DB_PASS', env_or_default('FINDAS_DB_PASS', 'Zebra@789'));
define('DB_PORT', (int) env_or_default('FINDAS_DB_PORT', '3306'));

define('APP_SECRET', env_or_default('FINDAS_APP_SECRET', 'replace_with_strong_random_secret'));
define('ADMIN_USERNAME', env_or_default('FINDAS_ADMIN_USERNAME', 'admin'));
define('ADMIN_PASSWORD', env_or_default('FINDAS_ADMIN_PASSWORD', 'admin123'));

define('FINDAS_POLLS_API_KEY', env_or_default('FINDAS_POLLS_API_KEY', '851e995f-f691-4d8f-a630-5b3b83210eef'));

define('TOKEN_TTL_SECONDS', 7 * 24 * 60 * 60);
