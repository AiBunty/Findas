# Site Configuration Guide - Website Content Management

## Overview
This guide explains how to manage your website's content dynamically via Google Sheets:
- Hero Section content and video
- All logos (navbar, footer, loading, favicon)
- Meet Our Founder section
- Why Findas section (6 items)
- Footer content

## Setup Instructions

### 1. Create the `site_config` Sheet Tab

In your Google Sheets workbook (ID: `1a8PI6ppFLT2VbR8ArSpfDE4--3FGXiESBWFdQWCrNaU`), create a new sheet tab named:
```
site_config
```

### 2. Set Up Column Headers

Create the following columns in Row 1:

| Column A | Column B |
|----------|----------|
| **key** | **value** |

### 3. Add Configuration Rows

Add the following rows with your content:

#### Hero Section
| key | value | Example |
|-----|-------|---------|
| `hero_title` | Hero title with highlight separated by `|` | `Skyrocket Your|Financial Growth` |
| `hero_subtitle` | Hero subtitle text | `Years of experience distilled into practical, risk-aware programs you can apply immediately.` |
| `hero_benefit_1` | First benefit badge | `Lifetime Access` |
| `hero_benefit_2` | Second benefit badge | `14-Day Refund Policy` |
| `hero_benefit_3` | Third benefit badge | `4.8+ Lakh Enrolled` |
| `hero_button_1_text` | Primary CTA button text | `Explore Findas Courses` |
| `hero_button_2_text` | Secondary CTA button text | `Book Free Call` |
| `hero_video_url` | YouTube video URL (any format) | `https://www.youtube.com/watch?v=l2AbGuPDO4E` |

#### Logo Management
| key | value | Example |
|-----|-------|---------|
| `navbar_logo_url` | Logo displayed in navigation bar | `https://storage.files-vault.com/uploads/1771482761-H0bNoWSgQU.jpg` |
| `footer_logo_url` | Logo displayed in footer | `https://storage.files-vault.com/uploads/1771482761-H0bNoWSgQU.jpg` |
| `loading_logo_url` | Logo displayed during page load | `https://storage.files-vault.com/uploads/1771482761-H0bNoWSgQU.jpg` |
| `favicon_url` | Browser tab icon | `https://storage.files-vault.com/images/20260219120135_original__media_3.webp` |

#### Meet Our Founder Section
| key | value | Example |
|-----|-------|---------|
| `founder_title` | Section title with highlight separated by `|` | `Meet|Our Founder` |
| `founder_paragraph_1` | First paragraph about the founder | `Samir Machawe is a dynamic educator...` |
| `founder_paragraph_2` | Second paragraph about the founder | `He founded Findas in 1999...` |
| `founder_image_url` | Founder photo URL | `https://storage.files-vault.com/uploads/1772207760-dgdy7ilGGl.png` |
| `founder_image_alt` | Founder image alt text | `Samir Machawe` |

#### Why Findas Section (6 Items)
| key | value | Example |
|-----|-------|---------|
| `why_section_title` | Section title with highlight separated by `|` | `Why|Findas?` |
| `why_item_1_title` | First item title (can use `|` for highlight) | `On-Demand|Courses` |
| `why_item_1_description` | First item description | `Watch courses anytime, anywhere and learn at your own pace.` |
| `why_item_2_title` | Second item title | `Lifetime|Access` |
| `why_item_2_description` | Second item description | `Accessible as long as you need on a one-time payment.` |
| `why_item_3_title` | Third item title | `Free|Upgrades` |
| `why_item_3_description` | Third item description | `Get free unlimited upgrades whenever we improve our courses.` |
| `why_item_4_title` | Fourth item title | `Live Group|Sessions` |
| `why_item_4_description` | Fourth item description | `Attend monthly live group Q&A sessions with guided support.` |
| `why_item_5_title` | Fifth item title | `Community|Learning` |
| `why_item_5_description` | Fifth item description | `Connect and engage with fellow students in an active community.` |
| `why_item_6_title` | Sixth item title | `Practical|& Affordable` |
| `why_item_6_description` | Sixth item description | `Actionable learning paths designed to stay practical and affordable.` |

#### Footer Section
| key | value | Example |
|-----|-------|---------|
| `footer_brand_name` | Footer brand/academy name | `Findas Academy` |
| `footer_about_text` | Footer about paragraph | `Empowering financial freedom through expert-led courses...` |
| `footer_quick_links_title` | Quick Links section title | `Quick Links` |
| `footer_quick_link_1` | First quick link text | `Courses` |
| `footer_quick_link_2` | Second quick link text | `Webinars` |
| `footer_quick_link_3` | Third quick link text | `Digital Products` |
| `footer_quick_link_4` | Fourth quick link text | `Membership` |
| `footer_quick_link_5` | Fifth quick link text | `Gallery` |
| `footer_quick_link_6` | Sixth quick link text | `Reviews` |
| `footer_contact_title` | Contact section title | `Contact` |
| `footer_address` | Physical address | `Pune, Maharashtra, India` |
| `footer_social_title` | Social media section title | `Connect` |
| `footer_social_instagram` | Instagram URL | `https://www.instagram.com/findasindia` |
| `footer_social_facebook` | Facebook URL | `https://www.facebook.com/Financiallybindaas` |
| `footer_social_youtube` | YouTube URL | `https://www.youtube.com/@FindasMarathi` |
| `footer_copyright` | Copyright text (HTML allowed) | `&copy; 2026 Findas Academy. All rights reserved.` |

### 4. Example Sheet Structure

```
Row 1:  | key                    | value                                                                              |
Row 2:  | hero_title             | Skyrocket Your|Financial Growth                                                    |
Row 3:  | hero_subtitle          | Years of experience distilled into practical, risk-aware programs.                 |
Row 4:  | hero_benefit_1         | Lifetime Access                                                                    |
Row 5:  | hero_benefit_2         | 14-Day Refund Policy                                                               |
Row 6:  | hero_benefit_3         | 4.8+ Lakh Enrolled                                                                 |
Row 7:  | hero_button_1_text     | Explore Findas Courses                                                             |
Row 8:  | hero_button_2_text     | Book Free Call                                                                     |
Row 9:  | hero_video_url         | https://www.youtube.com/watch?v=l2AbGuPDO4E                                        |
Row 10: | navbar_logo_url        | https://storage.files-vault.com/uploads/1771482761-H0bNoWSgQU.jpg                  |
Row 11: | footer_logo_url        | https://storage.files-vault.com/uploads/1771482761-H0bNoWSgQU.jpg                  |
Row 12: | loading_logo_url       | https://storage.files-vault.com/uploads/1771482761-H0bNoWSgQU.jpg                  |
Row 13: | favicon_url            | https://storage.files-vault.com/images/20260219120135_original__media_3.webp       |
```

## Field Details

### Hero Title Format
- Use the pipe symbol `|` to separate the main title from the highlighted portion
- Example: `Skyrocket Your|Financial Growth`
  - "Skyrocket Your" will be displayed in regular style
  - "Financial Growth" will be highlighted with colored text

If you don't use a `|`, the entire text will be displayed without highlighting.

### Hero Video URL
The system accepts any YouTube URL format:
- Full watch URL: `https://www.youtube.com/watch?v=VIDEO_ID`
- Short URL: `https://youtu.be/VIDEO_ID`
- Embed URL: `https://www.youtube.com/embed/VIDEO_ID`
- Just the Video ID: `VIDEO_ID`

The system will automatically extract the video ID and create the proper embed URL.

### Logo URLs
All logo fields accept direct image URLs. Supported formats:
- JPEG/JPG
- PNG
- WebP
- GIF
- SVG

**Recommended Image Sizes:**
- **Navbar Logo**: 200x60px (or similar aspect ratio)
- **Footer Logo**: 150x50px (or similar aspect ratio)
- **Loading Logo**: 200x200px (square recommended)
- **Favicon**: 32x32px or 64x64px (square, .ico or .png)

## Important Notes

### Default Behavior
If any field is left empty or the `site_config` sheet doesn't exist:
- The website will use the hardcoded default values
- No errors will occur - graceful fallback is built-in

### Required Fields
**None of the fields are required.** The system will:
1. Try to load from `site_config` sheet
2. Fall back to default values if any field is missing
3. Continue working normally

### Optional Fields
All fields in `site_config` are optional. You can:
- Leave a row empty to use the default value
- Add only the fields you want to customize
- Delete rows you don't need

## Testing Your Changes

### 1. Quick Test
After updating the Google Sheet:
1. Reload your website
2. Changes should appear within 5 minutes (cache refresh)
3. Force refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)

### 2. Clear Cache for Immediate Update
If changes don't appear immediately:
1. Open Google Apps Script editor
2. Go to View > Executions
3. Wait for cache to expire (5 minutes)
4. Or manually clear cache using Apps Script

### 3. Check for Errors
If something doesn't work:
1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for any API errors
4. Verify your sheet name is exactly `site_config`
5. Verify column headers are exactly `key` and `value`

## Advanced Configuration

### Adding Custom Fields
You can add additional custom fields to the `site_config` sheet for future use:
1. Add new rows with your custom `key` names
2. The data will be available via the API
3. Update your code to use these new fields

### Multiple Environments
If you have dev/staging/production environments:
1. Create separate Google Sheets for each
2. Update the `SPREADSHEET_ID` in `Code.gs`
3. Deploy separate Apps Script projects
4. Update `appscript-config.js` with the correct URLs

## Troubleshooting

### Problem: Changes don't appear
**Solution:** 
- Wait 5 minutes for cache to refresh
- Force refresh browser: `Ctrl+Shift+R`
- Check sheet name is exactly `site_config`

### Problem: Video doesn't play
**Solution:**
- Ensure YouTube URL is valid
- Check video privacy settings (must be Public or Unlisted)
- Try using the full YouTube URL format

### Problem: Logo doesn't display
**Solution:**
- Verify image URL is publicly accessible
- Check image format (JPEG, PNG, WebP, SVG)
- Ensure HTTPS is used for secure connections
- Test URL in browser address bar

### Problem: Hero title doesn't split correctly
**Solution:**
- Ensure you're using the pipe symbol `|` (not lowercase L or number 1)
- Check for extra spaces around the `|`
- Example: `Part One|Part Two` ✓ correct
- Example: `Part One | Part Two` ✗ has spaces

## API Reference

### Endpoint
```
?api=1&fn=getSiteConfig
```

### Response Format
```json
{
  "ok": true,
  "data": {
    "hero_title": "Skyrocket Your|Financial Growth",
    "hero_subtitle": "Years of experience distilled...",
    "hero_benefit_1": "Lifetime Access",
    "hero_benefit_2": "14-Day Refund Policy",
    "hero_benefit_3": "4.8+ Lakh Enrolled",
    "hero_button_1_text": "Explore Findas Courses",
    "hero_button_2_text": "Book Free Call",
    "hero_video_url": "https://www.youtube.com/watch?v=VIDEO_ID",
    "navbar_logo_url": "https://...",
    "footer_logo_url": "https://...",
    "loading_logo_url": "https://...",
    "favicon_url": "https://..."
  }
}
```

## Quick Reference Card

**Sheet Name:** `site_config`
**Columns:** `key` | `value`
**Cache Duration:** 5 minutes
**Deployment Script:** `.\scripts\deploy-appscript.ps1 -Target content`

**Quick Edit Process:**
1. Open Google Sheet
2. Find `site_config` tab
3. Edit values in Column B
4. Save (auto-saves)
5. Wait 5 minutes or force refresh page

---

**Last Updated:** March 9, 2026
**Apps Script Project:** Content API (gas-content)
**Deployment ID:** AKfycbwRq-N_8Fj65RwS2sCcStPYdOln7e-e5VRr4seDQ-bDPDjM_RYHcjUEikab9vCLU8oW
