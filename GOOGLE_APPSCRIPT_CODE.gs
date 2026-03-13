// Findas Academy Polls - Google Apps Script Backend
// Version 2.0 - Simple REST API with working CORS support
// Deploy as: Web app (Execute as: Me, Allow: Anyone)

const SHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();
const SHEET_NAME_POLLS = 'Polls';
const SHEET_NAME_CREDS = 'Credentials';
const API_KEY = '851e995f-f691-4d8f-a630-5b3b83210eef';

// No automatic schema creation/modification to avoid accidental overwrites.
function onOpen() {
  // Intentionally no-op.
}

function assertRequiredSheetsExist_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const missing = [];
  if (!ss.getSheetByName(SHEET_NAME_POLLS)) missing.push(SHEET_NAME_POLLS);
  if (!ss.getSheetByName(SHEET_NAME_CREDS)) missing.push(SHEET_NAME_CREDS);

  if (missing.length) {
    throw new Error(
      'Missing required sheet(s): ' + missing.join(', ') +
      '. Auto-create is disabled to protect existing data. Create these tabs manually.'
    );
  }
}

// ============================================
// REST API ENDPOINTS
// ============================================

// Handle CORS preflight requests (required for POST requests from browsers)
function doOptions(e) {
  return ContentService.createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT);
}

function doGet(e) {
  try {
    assertRequiredSheetsExist_();
    
    const action = (e && e.parameter && e.parameter.action) || '';
    const apiKey = (e && e.parameter && e.parameter.apiKey) || '';
    
    // Verify API key
    if (apiKey !== API_KEY) {
      return sendResponse({ error: 'Invalid API key' }, 401);
    }
    
    let result;
    
    if (action === 'getAllPolls') {
      result = { success: true, polls: getAllPolls() };
    } else if (action === 'getCredentials') {
      result = { success: true, credentials: getAdminCredentials() };
    } else if (action === 'getWhatsAppNumber') {
      result = { success: true, whatsappNumber: getWhatsAppNumber() };
    } else {
      result = { error: 'Unknown action', action: action };
    }
    
    return sendResponse(result, 200);
    
  } catch (error) {
    return sendResponse({ error: 'Server error: ' + error.toString() }, 500);
  }
}

function doPost(e) {
  try {
    assertRequiredSheetsExist_();
    
    let data = {};
    
    // Parse JSON from POST body - safely handle undefined e
    if (e && e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (parseError) {
        Logger.log('JSON parse error: ' + parseError.toString());
        return sendResponse({ error: 'Invalid JSON in request body' }, 400);
      }
    }
    
    const apiKey = data.apiKey || (e && e.parameter && e.parameter.apiKey);
    
    // Verify API key
    if (apiKey !== API_KEY) {
      return sendResponse({ error: 'Invalid API key' }, 401);
    }
    
    const action = data.action;
    let result;
    
    if (action === 'saveAllPolls') {
      if (!data.polls || !Array.isArray(data.polls)) {
        return sendResponse({ error: 'Invalid polls array' }, 400);
      }
      saveAllPolls(data.polls);
      result = { success: true, message: 'All polls saved', count: data.polls.length };
    } 
    else if (action === 'savePoll') {
      if (!data.poll || typeof data.poll !== 'object') {
        return sendResponse({ error: 'No poll data provided' }, 400);
      }
      savePoll(data.poll);
      result = { success: true, message: 'Poll saved' };
    }
    else if (action === 'deletePoll') {
      if (!data.pollId) {
        return sendResponse({ error: 'No poll ID provided' }, 400);
      }
      deletePoll(data.pollId);
      result = { success: true, message: 'Poll deleted' };
    }
    else if (action === 'updateCredentials' || action === 'updateAdminCredentials') {
      if (!data.username || !data.passwordHash) {
        return sendResponse({ error: 'Missing username or passwordHash' }, 400);
      }
      updateAdminCredentials(data.username, data.passwordHash);
      result = { success: true, message: 'Credentials updated' };
    }
    else if (action === 'setWhatsAppNumber') {
      if (!data.whatsappNumber || typeof data.whatsappNumber !== 'string') {
        return sendResponse({ error: 'Invalid WhatsApp number' }, 400);
      }
      setWhatsAppNumber(data.whatsappNumber);
      result = { success: true, message: 'WhatsApp number updated', whatsappNumber: data.whatsappNumber };
    }
    else {
      result = { error: 'Unknown action: ' + action };
    }
    
    return sendResponse(result, 200);
    
  } catch (error) {
    Logger.log('Error in doPost: ' + error.toString());
    return sendResponse({ error: 'Server error: ' + error.toString() }, 500);
  }
}

// ============================================
// RESPONSE HELPER (CRITICAL FOR CORS)
// ============================================

function sendResponse(data, statusCode) {
  // Use ContentService for proper CORS support
  const jsonString = JSON.stringify(data);
  const output = ContentService.createTextOutput(jsonString)
    .setMimeType(ContentService.MimeType.JSON);
  
  return output;
}

// ============================================
// POLL MANAGEMENT FUNCTIONS
// ============================================

function getAllPolls() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME_POLLS);
    
    if (!sheet) return [];
    
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return [];
    
    // Read all data columns (A to J)
    const data = sheet.getRange(2, 1, lastRow - 1, 10).getValues();
    const polls = [];
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      // Skip empty rows
      if (!row[0]) continue;
      
      try {
        // Construct poll object matching FRONTEND structure (snake_case)
        const poll = {
          id: row[0],
          question: row[1],             // title -> question
          status: row[2] || 'ACTIVE',   // isActive -> status (Active/Closed/Archived)
          created_at: row[3],           // createdAt -> created_at
          ends_at: row[4] || null,      // endsAt -> ends_at
          require_name: row[5] === true || row[5] === 'TRUE', // flattened settings
          show_voters_publicly: row[6] === true || row[6] === 'TRUE', // flattened settings
          options: row[7] ? JSON.parse(row[7]) : [],
          voters: row[8] ? JSON.parse(row[8]) : [],
          // description col (9) ignore or mapped if frontend needs it
        };
        
        polls.push(poll);
      } catch (e) {
        Logger.log('Error parsing row ' + (i + 2) + ': ' + e.toString());
      }
    }
    
    return polls;
  } catch (error) {
    Logger.log('Error in getAllPolls: ' + error.toString());
    return [];
  }
}

function savePoll(poll) {
  try {
    if (!poll || !poll.id) return;
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME_POLLS);
    if (!sheet) return;
    
    // Prepare row data matching FRONTEND structure
    const rowData = [
      poll.id,
      poll.question || '',
      poll.status || 'ACTIVE',
      poll.created_at || new Date().toISOString(),
      poll.ends_at || '',
      poll.require_name || false,
      poll.show_voters_publicly || false,
      JSON.stringify(poll.options || []),
      JSON.stringify(poll.voters || []),
      poll.description || '' // Optional extra column
    ];
    
    const lastRow = sheet.getLastRow();
    let found = false;
    
    // Try to find existing poll to update
    if (lastRow > 1) {
      const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (let i = 0; i < ids.length; i++) {
        if (ids[i][0] === poll.id) {
          // Update existing row (1-based index, +1 for header)
          sheet.getRange(i + 2, 1, 1, 10).setValues([rowData]);
          found = true;
          break;
        }
      }
    }
    
    // Append if not found
    if (!found) {
      sheet.appendRow(rowData);
    }
  } catch (error) {
    Logger.log('Error in savePoll: ' + error.toString());
  }
}

function saveAllPolls(polls) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME_POLLS);
    if (!sheet || !Array.isArray(polls)) return;
    
    // Clear existing data (preserve header)
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.deleteRows(2, lastRow - 1);
    }
    
    if (polls.length === 0) return;
    
    // Prepare batch data matching FRONTEND structure
    const data = polls.map(poll => [
      poll.id,
      poll.question || '',
      poll.status || 'ACTIVE',
      poll.created_at || new Date().toISOString(),
      poll.ends_at || '',
      poll.require_name || false,
      poll.show_voters_publicly || false,
      JSON.stringify(poll.options || []),
      JSON.stringify(poll.voters || []),
      poll.description || ''
    ]);
    
    // Batch write
    sheet.getRange(2, 1, data.length, 10).setValues(data);
    Logger.log('Saved ' + polls.length + ' polls');
    
  } catch (error) {
    Logger.log('Error in saveAllPolls: ' + error.toString());
  }
}

function deletePoll(pollId) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME_POLLS);
    if (!sheet) return;
    
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return;
    
    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < ids.length; i++) {
      if (ids[i][0] === pollId) {
        sheet.deleteRow(i + 2); // +2 because 1-based index and header
        break;
      }
    }
  } catch (error) {
    Logger.log('Error in deletePoll: ' + error.toString());
  }
}

// ============================================
// CREDENTIAL MANAGEMENT
// ============================================

function getAdminCredentials() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME_CREDS);
    
    if (!sheet) {
      return { username: 'admin', passwordHash: '' };
    }
    
    const data = sheet.getDataRange().getValues();
    let username = 'admin';
    let passwordHash = '';
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === 'Admin Username') {
        username = data[i][1] || 'admin';
      } else if (data[i][0] === 'Admin Password Hash') {
        passwordHash = data[i][1] || '';
      }
    }
    
    return { username, passwordHash };
  } catch (error) {
    Logger.log('Error in getAdminCredentials: ' + error.toString());
    return { username: 'admin', passwordHash: '' };
  }
}

function updateAdminCredentials(username, passwordHash) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME_CREDS);
    
    if (!sheet) {
      Logger.log('Credentials sheet not found');
      return;
    }
    
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === 'Admin Username') {
        sheet.getRange(i + 1, 2).setValue(username);
      } else if (data[i][0] === 'Admin Password Hash') {
        sheet.getRange(i + 1, 2).setValue(passwordHash);
      }
    }
    
    Logger.log('Updated admin credentials');
  } catch (error) {
    Logger.log('Error in updateAdminCredentials: ' + error.toString());
  }
}

function getCredentialValue(key) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME_CREDS);
    
    if (!sheet) {
      return null;
    }
    
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === key) {
        return data[i][1] || null;
      }
    }
    
    return null;
  } catch (error) {
    Logger.log('Error in getCredentialValue: ' + error.toString());
    return null;
  }
}

function setCredentialValue(key, value) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME_CREDS);
    
    if (!sheet) {
      Logger.log('Credentials sheet not found');
      return false;
    }
    
    const data = sheet.getDataRange().getValues();
    let found = false;
    
    // Update existing key
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === key) {
        sheet.getRange(i + 1, 2).setValue(value);
        found = true;
        break;
      }
    }
    
    // Add new key if not found
    if (!found) {
      sheet.appendRow([key, value]);
    }
    
    Logger.log('Updated credential: ' + key);
    return true;
  } catch (error) {
    Logger.log('Error in setCredentialValue: ' + error.toString());
    return false;
  }
}

function getWhatsAppNumber() {
  return getCredentialValue('WhatsApp Number') || '918766514883';
}

function setWhatsAppNumber(number) {
  return setCredentialValue('WhatsApp Number', number);
}

// ============================================
// DEBUGGING HELPER
// ============================================

function getApiKey() {
  return API_KEY;
}
