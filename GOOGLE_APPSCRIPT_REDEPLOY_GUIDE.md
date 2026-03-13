# Google Apps Script Redeploy Guide

## Step-by-Step Instructions to Enable Cloud Sync

### Step 1: Access Google Apps Script Editor
1. Open your browser and go to: **https://script.google.com**
2. Find and click on the Apps Script project named **"Findas Academy Polls"** (or similar)
3. You should see your existing deployment code

---

### Step 2: Prepare for Code Replacement
Before replacing the code, note your current **Deployment ID** for reference:
- Click on **"Manage Deployments"** (gear icon in toolbar)
- You'll see your old deployment starting with `AKfycbwg2Z...`

---

### Step 3: Replace the Code
1. In the code editor, **select ALL text** (Ctrl+A on Windows, Cmd+A on Mac)
2. **Delete all existing code**
3. **Paste the ENTIRE code** from below:

```javascript
// Findas Academy Polls - Google Apps Script Backend
// Version 1.2 with CORS Support and Credential Management

// ============================================
// SETUP & INITIALIZATION
// ============================================

function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Create Polls sheet
  try {
    ss.insertSheet('Polls', 0);
  } catch (e) {
    // Sheet already exists
  }
  
  // Create Credentials sheet
  try {
    ss.insertSheet('Credentials', 1);
  } catch (e) {
    // Sheet already exists
  }
  
  // Initialize Credentials sheet if empty
  const credSheet = ss.getSheetByName('Credentials');
  if (credSheet.getLastRow() === 0) {
    credSheet.appendRow(['API Key', '851e995f-f691-4d8f-a630-5b3b83210eef']);
    credSheet.appendRow(['Admin Username', 'admin']);
    credSheet.appendRow(['Admin Password Hash', '8c7dd922ad47494fc02c388e12c00eac53e97dd8376491eeaab56a551d40ec02']);
  }
}

// ============================================
// HTTP HANDLERS WITH CORS SUPPORT
// ============================================

function doOptions(e) {
  // Handle CORS preflight requests
  const output = ContentService.createTextOutput();
  output.setHeader('Access-Control-Allow-Origin', '*');
  output.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  output.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  return output;
}

function doGet(e) {
  try {
    const params = e.parameter;
    
    // Verify API key
    if (!verifyApiKey(params.apiKey)) {
      return createJsonResponse({ error: 'Invalid API key' }, 401);
    }
    
    // Get all polls
    const polls = getAllPolls();
    
    return createJsonResponse({ 
      success: true, 
      polls: polls,
      timestamp: new Date().toISOString()
    }, 200);
  } catch (error) {
    return createJsonResponse({ error: error.toString() }, 500);
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    
    // Verify API key
    if (!verifyApiKey(data.apiKey)) {
      return createJsonResponse({ error: 'Invalid API key' }, 401);
    }
    
    // Route to appropriate handler
    const action = data.action;
    
    if (action === 'savePoll') {
      savePoll(data.poll);
      return createJsonResponse({ success: true, message: 'Poll saved' }, 200);
    } 
    else if (action === 'deletePoll') {
      deletePoll(data.pollId);
      return createJsonResponse({ success: true, message: 'Poll deleted' }, 200);
    }
    else if (action === 'saveAllPolls') {
      saveAllPolls(data.polls);
      return createJsonResponse({ success: true, message: 'All polls saved' }, 200);
    }
    else if (action === 'getCredentials') {
      const creds = getAdminCredentials();
      return createJsonResponse({ success: true, credentials: creds }, 200);
    }
    else if (action === 'updateCredentials') {
      updateAdminCredentials(data.username, data.passwordHash);
      return createJsonResponse({ success: true, message: 'Credentials updated' }, 200);
    }
    else {
      return createJsonResponse({ error: 'Unknown action' }, 400);
    }
  } catch (error) {
    return createJsonResponse({ error: error.toString() }, 500);
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function verifyApiKey(apiKey) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const credSheet = ss.getSheetByName('Credentials');
  const data = credSheet.getDataRange().getValues();
  
  for (let row of data) {
    if (row[0] === 'API Key' && row[1] === apiKey) {
      return true;
    }
  }
  return false;
}

function createJsonResponse(data, statusCode) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  output.setHeader('Access-Control-Allow-Origin', '*');
  output.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  output.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  output.setHeader('Content-Type', 'application/json');
  return output;
}

// ============================================
// POLL MANAGEMENT FUNCTIONS
// ============================================

function getAllPolls() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Polls');
  const data = sheet.getDataRange().getValues();
  
  const polls = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) {
      try {
        polls.push(JSON.parse(data[i][0]));
      } catch (e) {
        // Skip invalid entries
      }
    }
  }
  return polls;
}

function savePoll(poll) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Polls');
  const data = sheet.getDataRange().getValues();
  
  // Check if poll exists
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) {
      try {
        const existing = JSON.parse(data[i][0]);
        if (existing.id === poll.id) {
          // Update existing poll
          sheet.getRange(i + 1, 1).setValue(JSON.stringify(poll));
          return;
        }
      } catch (e) {
        // Skip invalid entries
      }
    }
  }
  
  // Add new poll
  sheet.appendRow([JSON.stringify(poll)]);
}

function saveAllPolls(polls) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Polls');
  
  // Clear existing data
  if (sheet.getLastRow() > 1) {
    sheet.deleteRows(2, sheet.getLastRow() - 1);
  }
  
  // Add new polls
  for (let poll of polls) {
    sheet.appendRow([JSON.stringify(poll)]);
  }
}

function deletePoll(pollId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Polls');
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) {
      try {
        const poll = JSON.parse(data[i][0]);
        if (poll.id === pollId) {
          sheet.deleteRow(i + 1);
          return;
        }
      } catch (e) {
        // Skip invalid entries
      }
    }
  }
}

// ============================================
// CREDENTIAL MANAGEMENT
// ============================================

function getAdminCredentials() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const credSheet = ss.getSheetByName('Credentials');
  const data = credSheet.getDataRange().getValues();
  
  let username = 'admin';
  let passwordHash = '';
  
  for (let row of data) {
    if (row[0] === 'Admin Username') {
      username = row[1];
    } else if (row[0] === 'Admin Password Hash') {
      passwordHash = row[1];
    }
  }
  
  return { username, passwordHash };
}

function updateAdminCredentials(username, passwordHash) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const credSheet = ss.getSheetByName('Credentials');
  const data = credSheet.getDataRange().getValues();
  
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === 'Admin Username') {
      credSheet.getRange(i + 1, 2).setValue(username);
    } else if (data[i][0] === 'Admin Password Hash') {
      credSheet.getRange(i + 1, 2).setValue(passwordHash);
    }
  }
}

function getApiKey() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const credSheet = ss.getSheetByName('Credentials');
  const data = credSheet.getDataRange().getValues();
  
  for (let row of data) {
    if (row[0] === 'API Key') {
      return row[1];
    }
  }
  return '851e995f-f691-4d8f-a630-5b3b83210eef';
}
```

4. Save your changes: **Ctrl+S** (Windows) or **Cmd+S** (Mac)

---

### Step 4: Create a New Deployment
1. Click the **"Deploy"** button (or look for deployment options)
2. Click **"New deployment"** (or "+ New")
3. Select **"Type"** → Choose **"Web app"**
4. In **"Execute as"**, keep your Google account selected
5. In **"Who has access"**, select **"Anyone"**
6. Click **"Deploy"**

A dialog will appear with your **new Deployment ID**. Example:
```
Deployment ID: AKfycbwxxxxxxxxxxxxxxxxxxxxxxxx
```

---

### Step 5: Copy Your New Deployment URL
The deployment URL format is:
```
https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
```

Example if your Deployment ID is `AKfycbwXYZ123...`:
```
https://script.google.com/macros/s/AKfycbwXYZ123.../exec
```

**Copy this URL** - you'll need it in the next step.

---

### Step 6: Update Your HTML File
1. Open **admin-polls.html** in your editor
2. Find line ~1533 with `DEPLOYMENT_URL:`
3. Replace the old URL with your new one:

```javascript
const GOOGLE_SHEETS_CONFIG = {
    DEPLOYMENT_URL: 'https://script.google.com/macros/s/YOUR_NEW_DEPLOYMENT_ID/exec',
    API_KEY: '851e995f-f691-4d8f-a630-5b3b83210eef',
    ENABLED: true  // ← Change from false to true
};
```

---

### Step 7: Enable Google Sheets Sync
In **admin-polls.html**, ensure line ~1535 is set to:
```javascript
ENABLED: true
```

---

### Step 8: Save and Test
1. Save **admin-polls.html**
2. Push to GitHub:
   ```bash
   git add .
   git commit -m "Enable Google Sheets sync with new deployment"
   git push
   ```
3. Refresh your polls app
4. Try creating a new poll or changing credentials - you should see no CORS errors
5. Check your Google Sheet to verify data is being saved

---

## Cleanup (Optional)

To remove old deployments:
1. Open your Google Apps Script project
2. Click **"Manage Deployments"** (gear icon)
3. Find your old deployment (the one starting with the original ID)
4. Click the three dots menu next to it
5. Select **"Remove"** or **"Delete"**

---

## Testing Cloud Sync

After enabling, test these operations:
- ✅ Create a new poll → Check if it appears in Google Sheets "Polls" tab
- ✅ Edit a poll → Check if changes sync to Google Sheets
- ✅ Change admin credentials → Check if they update in Google Sheets "Credentials" tab
- ✅ Refresh the page → Polls should load from Google Sheets

**Success indicator**: Your browser console should NOT show any fetch errors when performing these operations.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Still getting CORS errors | Verify you copied the NEW deployment URL correctly |
| Polls not saving to Sheets | Check that Sheets are named exactly "Polls" and "Credentials" |
| Can't see new deployments | Refresh the browser and re-open the Apps Script project |
| Old deployment still showing | Make sure you created a NEW deployment, not just saved code |

---

## Questions?

If you encounter issues:
1. Check browser console (F12) for specific error messages
2. Verify the deployment URL is spelled exactly correctly
3. Open Google Sheets in another tab to watch real-time updates
