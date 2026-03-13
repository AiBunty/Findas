# Google Sheets + Apps Script Setup Guide

## Step 1: Create a Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com)
2. Click **"+ New"** → **"Spreadsheet"**
3. Name it: **`Findas Academy Polls`**
4. Save it (you now have the Sheet ID in the URL)

---

## Step 2: Add Google Apps Script

1. In your Google Sheet, go to **Tools** → **"Script editor"**
2. This opens Google Apps Script editor
3. **Delete all existing code** in the editor
4. **Copy the entire code** from `GOOGLE_APPSCRIPT_CODE.gs` file
5. **Paste it** into the Apps Script editor
6. **Save** (Ctrl+S or Cmd+S)

---

## Step 3: Initialize the Script

1. In the Apps Script editor, find the function list (left panel)
2. Click on **`setupSheets`**
3. Click the **"▶ Run"** button (top)
4. Approve the permissions when prompted
5. You'll see: `✅ Sheets setup complete!` in the Logs

---

## Step 4: Deploy as Web App

1. Go to **"Deploy"** → **"New Deployment"** (top right)
2. Click the gear icon ⚙️
3. Select **"Web app"** from the dropdown
4. Set the following:
   - **Execute as:** Your Google Account (email)
   - **Who has access:** Anyone (important!)
5. Click **"Create Deployment"**
6. You'll see the **Deployment URL** - **COPY THIS!**

**URL format looks like:**
```
https://script.google.com/macros/d/[DEPLOYMENT_ID]/useweb
```

---

## Step 5: Get Your API Key

1. Back in the Apps Script editor
2. Click on **`getApiKey`** function
3. Click **"▶ Run"** button
4. In the Logs (bottom), you'll see your API key:
```
YOUR_API_KEY_HERE (looks like a UUID)
```
5. **COPY THIS KEY** - you'll need it in your HTML app

---

## Step 6: Update Your HTML App

Replace these lines in your **admin-polls.html** with your actual values:

**FIND this section near the top of the JavaScript:**
```javascript
// Google Sheets Config
const GOOGLE_APPS_SCRIPT_URL = 'YOUR_DEPLOYMENT_URL_HERE';
const GOOGLE_API_KEY = 'YOUR_API_KEY_HERE';
```

**REPLACE with:**
- `YOUR_DEPLOYMENT_URL_HERE` → Paste your Deployment URL
- `YOUR_API_KEY_HERE` → Paste your API Key

---

## How It Works Now

✅ **Auto-sync to Google Sheets:**
- Every time admin creates/edits a poll → Saves to Sheets
- Every time someone votes → Updated in Sheets
- Every time page loads → Pulls latest from Sheets

✅ **Data Persistence:**
- All poll data lives in Google Sheets
- Survives browser cache clears
- Accessible across all devices
- Automatic Google backups

✅ **Backup Your Data:**
- Open the Google Sheet anytime
- See all poll data
- Download as Excel/CSV
- Edit directly in Sheets if needed

---

## Testing

1. Open your **admin-polls.html**
2. Create a new poll
3. Open your **Google Sheet** 
4. You should see the poll appear in the sheet automatically! ✨
5. When votes come in, they update in the Sheet too

---

## Troubleshooting

**"Deployment URL not working?"**
- Make sure "Who has access" is set to "Anyone"
- Clear browser cache and try again

**"API Key error?"**
- Double-check the API Key matches exactly
- Run `getApiKey()` function again to confirm

**"No data appearing in Sheet?"**
- Check browser console for errors (F12)
- Verify Deployment URL is correct
- Make sure setupSheets() was run

---

## Optional: Share Access

If others need to see the data:
1. Open the Google Sheet
2. Click **"Share"** (top right)
3. Add their email addresses
4. They can now view/edit the Sheet

---

**That's it! Your polls now auto-backup to Google Sheets!** 🎉
