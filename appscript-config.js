// Central Apps Script configuration for Findas frontend pages.
// This file is the master source of truth for production Apps Script URLs.
// Deploy scripts must not overwrite these values unless explicitly requested.
window.FINDAS_CONFIG = {
  // Primary PHP API base used by index.html.
  PHP_API_BASE: '/api',

  // Content API used by index.html (Code.gs / JSONP endpoint).
  WEBAPP_URL: 'https://script.google.com/macros/s/AKfycbySQGmEoW1zwK048wxXCY4cBWSxd8U4sjXsDL6hPymg2Df5cCkBEwYkv8B65SK4-y6MkA/exec',

  // Optional backup content API for automatic failover in index.html retries.
  WEBAPP_BACKUP_URL: 'https://script.google.com/macros/s/AKfycbyy6HxCajyeWD02nTlxi3LcCplFFelkLhYbh_uJcvjgayp_hCaubOdpNoSLqSoefM0JCA/exec',

  // Polling API used by admin-polls.html and sync test page.
  POLLS_DEPLOYMENT_URL: 'https://script.google.com/macros/s/AKfycbzr52WyJVmS0UIBHRvrlVzXEqEFkFyuDE_sq625zq1utSPnfzwC0d4fNMq0VwNosRiz/exec',
  POLLS_API_KEY: '851e995f-f691-4d8f-a630-5b3b83210eef'
};

// Backward-compatible globals used in existing pages.
window.FINDAS_WEBAPP_URL = window.FINDAS_WEBAPP_URL || window.FINDAS_CONFIG.WEBAPP_URL;
window.FINDAS_WEBAPP_BACKUP_URL = window.FINDAS_WEBAPP_BACKUP_URL || window.FINDAS_CONFIG.WEBAPP_BACKUP_URL;
window.FINDAS_PHP_API_BASE = window.FINDAS_PHP_API_BASE || window.FINDAS_CONFIG.PHP_API_BASE;
window.FINDAS_POLLS_DEPLOYMENT_URL = window.FINDAS_POLLS_DEPLOYMENT_URL || window.FINDAS_CONFIG.POLLS_DEPLOYMENT_URL;
window.FINDAS_POLLS_API_KEY = window.FINDAS_POLLS_API_KEY || window.FINDAS_CONFIG.POLLS_API_KEY;

