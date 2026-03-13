# Dynamic Hero & Logo Management - Implementation Summary

## ✅ What Was Done

Your website now supports **dynamic management** of:
1. **Hero Section Content** (title, subtitle, benefits)
2. **Hero Video** (YouTube embed)
3. **All Logos** (navbar, footer, loading, favicon)

All controlled via Google Sheets! No code changes needed for updates.

---

## 📂 Files Updated

### 1. Apps Script Backend
**File:** `gas-content/Code.gs`
- ✅ Added `getSiteConfig()` function
- ✅ Reads from `site_config` sheet tab
- ✅ Exposes data via API endpoint: `?api=1&fn=getSiteConfig`
- ✅ Deployed successfully

### 2. Frontend Website
**File:** `index.html`
- ✅ Added IDs to all hero elements for dynamic updates
- ✅ Updated DOM reference object (D) with hero elements
- ✅ Modified `applyBrand()` to use logo URLs from site config
- ✅ Added `applySiteConfig()` function to update hero content
- ✅ Integrated API call in `init()` function

### 3. Documentation
**Files Created:**
- ✅ `SITE_CONFIG_GUIDE.md` - Complete setup and usage guide
- ✅ `site_config_template.csv` - Import-ready template

---

## 🚀 How to Use

### Step 1: Create the Google Sheet Tab

1. Open your Google Sheet: [Open Sheet](https://docs.google.com/spreadsheets/d/1a8PI6ppFLT2VbR8ArSpfDE4--3FGXiESBWFdQWCrNaU/edit)
2. Click the **+** button at the bottom to add a new sheet
3. Rename it to exactly: `site_config`

### Step 2: Import the Template

**Option A - Manual Entry:**
1. In Row 1, add headers: `key` | `value`
2. Copy data from `site_config_template.csv`

**Option B - CSV Import:**
1. Click File > Import
2. Select `site_config_template.csv`
3. Choose "Insert new sheet"
4. Rename to `site_config`

### Step 3: Customize Your Content

Edit the `value` column (Column B) with your content:

| What to Edit | Example |
|--------------|---------|
| **Hero Title** | `Master Trading|With Confidence` |
| **Hero Subtitle** | `Learn proven strategies from experts` |
| **Hero Benefits** | Change to your unique selling points |
| **Button Text** | Customize CTA button labels |
| **Video URL** | Paste any YouTube video URL |
| **Logos** | Upload images and paste URLs |

### Step 4: See Changes Live

1. Save your sheet (auto-saves)
2. Wait 5 minutes (API cache refresh)
3. Reload your website: **Ctrl+Shift+R** (force refresh)
4. Changes appear instantly!

---

## 🎯 Key Features

### Hero Title with Highlighting
Use the pipe symbol `|` to highlight part of the title:
```
Input:  Skyrocket Your|Financial Growth
Result: "Skyrocket Your" (normal) + "Financial Growth" (colored highlight)
```

### YouTube Video Flexibility
Accepts any YouTube URL format:
- ✅ `https://www.youtube.com/watch?v=VIDEO_ID`
- ✅ `https://youtu.be/VIDEO_ID`
- ✅ `https://www.youtube.com/embed/VIDEO_ID`
- ✅ Just the video ID: `VIDEO_ID`

### Smart Logo Management
- **Navbar Logo**: Top navigation bar
- **Footer Logo**: Bottom of page
- **Loading Logo**: Displays while page loads
- **Favicon**: Browser tab icon

### Graceful Fallbacks
- If sheet doesn't exist → uses defaults
- If field is empty → uses defaults
- No errors, seamless experience!

---

## 📋 Quick Reference

### Google Sheet Structure
```
Column A (key)          | Column B (value)
-----------------------|--------------------------------
hero_title             | Your Title|Highlighted Part
hero_subtitle          | Your compelling subtitle text
hero_benefit_1         | Benefit badge 1
hero_benefit_2         | Benefit badge 2
hero_benefit_3         | Benefit badge 3
hero_button_1_text     | Primary button text
hero_button_2_text     | Secondary button text
hero_video_url         | https://youtube.com/...
navbar_logo_url        | https://your-logo-url.jpg
footer_logo_url        | https://your-logo-url.jpg
loading_logo_url       | https://your-logo-url.jpg
favicon_url            | https://your-favicon.png
```

### Image Hosting Options

**Where to host your logo images:**

1. **Google Drive** (Recommended for small teams)
   - Upload to Drive
   - Right-click > Get link > Set to "Anyone with link"
   - Use the shareable link

2. **Your Web Server**
   - Upload via FTP/cPanel
   - Use the direct URL: `https://yourdomain.com/images/logo.png`

3. **CDN/Cloud Storage** (Best for production)
   - Cloudinary, ImageKit, AWS S3, Azure Blob Storage
   - Upload and get public URL
   - Optimized for fast loading

4. **Existing URLs**
   - Copy image URLs from your current site
   - Ensure they're publicly accessible (no authentication required)

**Image Requirements:**
- Format: JPG, PNG, WebP, SVG
- Must be publicly accessible (HTTPS preferred)
- Navbar logo: ~200x60px
- Footer logo: ~150x50px
- Loading logo: ~200x200px (square)
- Favicon: 32x32px or 64x64px

---

## 🔧 Technical Details

### API Endpoint
```
GET ?api=1&fn=getSiteConfig
```

### Response Structure
```json
{
  "ok": true,
  "data": {
    "hero_title": "...",
    "hero_subtitle": "...",
    "hero_benefit_1": "...",
    "navbar_logo_url": "...",
    // etc.
  }
}
```

### Cache Duration
- **5 minutes** (Apps Script cache)
- Updates appear within 5 minutes of sheet changes
- Force refresh browser to see immediately

### Deployment Info
- **Project:** gas-content (Content API)
- **Deployment ID:** AKfycbwRq-N_8Fj65RwS2sCcStPYdOln7e-e5VRr4seDQ-bDPDjM_RYHcjUEikab9vCLU8oW
- **Last Deploy:** March 9, 2026

---

## 🎨 Example Scenarios

### Scenario 1: Change Hero for New Course Launch
```
1. Open Google Sheet > site_config tab
2. Update hero_title: "Launch Your|Trading Career"
3. Update hero_subtitle: "New course starting March 2026"
4. Update hero_video_url: New promotional video
5. Save & wait 5 minutes
6. Website updates automatically!
```

### Scenario 2: Seasonal Campaigns
```
1. Create different hero_benefit messages
2. Update hero_button_text for campaign-specific CTAs
3. Change hero_video to seasonal content
4. All without touching code!
```

### Scenario 3: Rebrand Logos
```
1. Design new logos
2. Upload to your server/CDN
3. Update navbar_logo_url, footer_logo_url, favicon_url
4. Entire site rebrands in one sheet edit!
```

---

## 📚 Additional Resources

- **Full Guide:** [SITE_CONFIG_GUIDE.md](SITE_CONFIG_GUIDE.md)
- **Template:** [site_config_template.csv](site_config_template.csv)
- **Deployment:** Run `.\scripts\deploy-appscript.ps1 -Target content`

---

## 🆘 Need Help?

### Common Issues

**Q: Changes don't appear?**
- Wait 5 minutes for cache
- Force refresh: `Ctrl+Shift+R`
- Check sheet name is exactly `site_config`

**Q: Video won't play?**
- Verify video is Public or Unlisted (not Private)
- Try full YouTube URL
- Check for typos in URL

**Q: Logo doesn't show?**
- Ensure URL is publicly accessible
- Test URL in browser address bar
- Check image format (JPG, PNG, WebP)
- Verify HTTPS URLs for secure pages

**Q: Hero title doesn't split?**
- Use pipe symbol `|` (Shift+\\)
- Remove spaces around `|`
- Correct: `Part1|Part2`
- Wrong: `Part1 | Part2`

---

## ✨ What's Next?

Your site now has full CMS control for:
- ✅ Hero section content
- ✅ Hero video
- ✅ All logos and branding
- ✅ Via simple Excel/Google Sheets

**No developer needed for content updates!**

Just open the sheet, edit, and your changes go live automatically. 🚀

---

**Implementation Date:** March 9, 2026
**Status:** ✅ Complete and Live
**Deployment:** Successful
