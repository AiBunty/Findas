# How to Deploy Updated Apps Script

## Step 1: Open Google Apps Script Editor
1. Go to your Google Sheet
2. Click **Extensions** → **Apps Script**
3. This opens the Apps Script editor for your project

## Step 2: Verify Code.gs is Updated
Look for these new functions at the bottom of your `Code.gs` file:
- `getFAQ()`
- `getWhoFor()`

If they're NOT there, you need to add them from the updated Code.gs file.

## Step 3: Deploy the Updated Version
1. In Apps Script editor, click **Deploy** (top right)
2. Click **"Manage deployments"** (pencil icon)
3. Find your **Web app** deployment
4. Click the **pencil/edit icon** next to it
5. This opens the deployment editor
6. Click **"Update"** button (blue button in top right)
7. Wait for confirmation "Deployment updated"
8. **Close the dialog** - you can ignore the deployment ID

## Step 4: Verify Deployment
1. Your web app URL **does NOT change**
2. It should still work exactly as before
3. Just refresh your Findas website (Ctrl+F5) to see the FAQ and Who Is For sections load properly

## If You Don't See the Update Option
Try this alternative:
1. In Apps Script editor, click **Deploy** → **New deployment**
2. Click the gear icon, select **Web app**
3. Change settings:
   - Execute as: **Me** (your email)
   - Who has access: **Anyone** (or "Anyone with link")
4. Click **Deploy**
5. Copy the new web app URL
6. Replace the `WEBAPP_API_URL` in your website's index.html with this new URL

## Troubleshooting

### Still Getting "Unknown fn" Error?
1. Clear browser cache: **Ctrl+Shift+Delete**
2. Hard refresh website: **Ctrl+Shift+R** (or Cmd+Shift+R on Mac)
3. Wait 1-2 minutes for deployment to propagate
4. Try again

### Functions Still Not Found?
1. Check that `getFAQ()` and `getWhoFor()` exist in Code.gs
2. Check that they're registered in the `handleApiRequest_()` function:
   ```javascript
   } else if (fn === 'getFAQ') {
     data = getFAQ();
   } else if (fn === 'getWhoFor') {
     data = getWhoFor();
   ```
3. Ensure both sheets exist: `faq` and `who_for` (or they'll use defaults)

### Need the Latest Code.gs?
Check that these functions exist in your Code.gs:

```javascript
function getFAQ() {
  return sortByOrder_(filterActive_(getSheetData_('faq')));
}

function getWhoFor() {
  return sortByOrder_(filterActive_(getSheetData_('who_for')));
}
```

And in `handleApiRequest_()`:
```javascript
} else if (fn === 'getFAQ') {
  data = getFAQ();
} else if (fn === 'getWhoFor') {
  data = getWhoFor();
}
```

---

**That's it!** Your website will now load the FAQ and Who Is For sections with either your Google Sheets data or beautiful defaults.
