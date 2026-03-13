# WebVeda Design Integration for Findas Academy

## Overview
Your Findas Academy website has been updated with WebVeda's design elements, including:
- ✅ **New Color Theme**: Modern blue (#1F4D87) and orange (#FF7A00) replacing the previous teal/gold
- ✅ **FAQ Section**: Before the footer with accordion-style interface
- ✅ **"Who Is For?" Section**: Showcase 6 categories of ideal students/users
- ✅ **Responsive Cards**: Beautiful hover effects and animations

## What's Been Added

### 1. **Color Theme Update**
- **Primary Brand Color**: `#1F4D87` (WebVeda Blue) - Updated throughout the site
- **Accent Color**: `#FF7A00` (WebVeda Orange) - Used for buttons, highlights, and CTAs
- **Background**: Light blue gradient matching WebVeda's modern aesthetic

### 2. **FAQ Section**
- **Location**: Before footer (after Reviews)
- **Style**: Accordion with emoji indicators (✨)
- **Features**:
  - Click to expand/collapse questions
  - Smooth animations
  - Hover effects
  - Default 6 FAQs provided

### 3. **Who Is For? Section**
- **Location**: Below FAQ section
- **Style**: 6-card grid layout
- **Features**:
  - Category icons (emoji or custom)
  - Hover animations
  - Responsive grid (auto-fit)
  - Default 6 categories provided:
    - 👤 Beginners
    - 💼 Professionals
    - 💰 Investors
    - 🚀 Entrepreneurs
    - 👨‍👩‍👧‍👦 Parents
    - 🎯 Goal Seekers

## How to Add Your Own Data

### Option 1: Use Default Data (No Setup Required)
The website currently displays default FAQ and "Who Is For?" data. The default data includes:
- 6 common questions about Findas Academy
- 6 audience segments relevant to Findas Academy

**To see the defaults in action**: Deploy the updated code and visit your website.

### Option 2: Add Your Own Data to Google Sheets

#### Step 1: Create FAQ Sheet
In your Google Sheet, create a new sheet named **`faq`** with these columns:

| Column Name | Type | Example |
|------------|------|---------|
| `order` | Number | 1 |
| `active` | Text (true/false) | true |
| `question` | Text | What is the refund policy? |
| `answer` | Text | We offer a full 14-day refund... |

**Example rows:**
```
order | active | question | answer
1     | true   | What is the refund policy? | We offer a full 14-day refund if you're not satisfied.
2     | true   | Are courses self-paced? | Yes, all courses are self-paced with lifetime access.
3     | true   | Is there community support? | Yes, members get access to exclusive communities.
```

#### Step 2: Create Who Is For Sheet
In your Google Sheet, create a new sheet named **`who_for`** with these columns:

| Column Name | Type | Example |
|------------|------|---------|
| `order` | Number | 1 |
| `active` | Text (true/false) | true |
| `icon` | Text (emoji) | 👤 |
| `title` | Text | Beginners |
| `description` | Text | Start your financial journey from scratch |

**Example rows:**
```
order | active | icon | title | description
1     | true   | 👤   | Beginners | Start learning from the basics
2     | true   | 💼   | Professionals | Enhance skills while working
3     | true   | 💰   | Investors | Deepen investment knowledge
4     | true   | 🚀   | Entrepreneurs | Master business finances
5     | true   | 👨‍👩‍👧‍👦   | Families | Balance family & finances
6     | true   | 📚   | Self-Learners | Independent learners
```

#### Step 3: Deploy Updated Apps Script
1. Go to your Google Apps Script editor
2. Click **Deploy** → **Manage Deployments**
3. Select the existing web app deployment
4. Click the **Update** button (pencil icon)
5. Your new functions are now live!

#### Step 4: Test Your Website
1. Refresh your Findas Academy website
2. Scroll down to see the new FAQ and Who Is For sections
3. Your custom data will automatically load from Google Sheets

### Option 3: Customize WebVeda Categories
If you want to keep some defaults and add more, simply add more rows to the Google Sheets with different categories:

**Example custom audiences for Findas:**
- 🏦 Bankers & Financial Officers
- 👴 Retirees & Pre-retirees
- 📊 Day Traders
- 🏠 Real Estate Investors
- 💳 Debt Management Seekers
- 🇺🇸 NRI & Expats

## Styling & Customization

### Colors Used Throughout the Site
- **Primary Brand**: `#1F4D87` (Dark Blue)
- **Accent**: `#FF7A00` (Orange)
- **Text**: `#0f1923` (Dark)
- **Muted**: `#5a6d84` (Gray)
- **Background**: Light gradient

### To Change Colors
Edit the `:root` CSS variables in your `index.html`:
```css
:root {
  --brand: #1F4D87;        /* Primary color */
  --accent: #FF7A00;       /* Accent color */
  /* ...other colors... */
}
```

### FAQ Section Styling
```css
.faq-item {                /* Card container */
.faq-item summary {        /* Question header */
.faq-item .faq-answer {    /* Answer content */
```

### Who Is For Section Styling
```css
.who-card {                /* Category card */
.who-card-icon {           /* Icon container */
.who-card-title {          /* Category title */
```

## Default Data

### FAQ Default Questions
1. **What is the refund policy?**
   - Answer: Full refund within 14 days of purchase

2. **Are courses self-paced?**
   - Answer: Yes, with lifetime access

3. **Is there any live interaction?**
   - Answer: Most courses include live Q&A sessions

4. **Do I need prior experience?**
   - Answer: No, courses designed for everyone

5. **Can I take multiple courses?**
   - Answer: Yes, no limits

6. **Is there a community?**
   - Answer: Yes, exclusive community for members

### Who Is For Default Categories
1. 👤 **Beginners** - Start your financial journey
2. 💼 **Professionals** - Enhance financial skills
3. 💰 **Investors** - Build stronger portfolio
4. 🚀 **Entrepreneurs** - Master business finances
5. 👨‍👩‍👧‍👦 **Parents** - Balance family needs
6. 🎯 **Goal Seekers** - Create clear financial objectives

## Troubleshooting

### FAQ/Who Is For sections not showing
1. Clear browser cache (Ctrl+Shift+Delete)
2. Refresh the website (Ctrl+F5)
3. Check Google Sheets for proper sheet names (`faq` and `who_for`)
4. Ensure rows have `active: true`

### Data not loading
1. Verify Apps Script deployment is updated
2. Check console (F12 → Console tab) for errors
3. Ensure sheet columns match the examples above
4. Check for typos in sheet names

### Colors not updating
1. Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
2. Check :`root variables in CSS
3. Verify no browser extensions interfering

## Files Modified

### HTML/CSS/JavaScript
- **`index.html`**
  - Added FAQ section HTML
  - Added Who Is For section HTML
  - Updated CSS color theme
  - Added `renderFAQ()` and `renderWhoFor()` functions
  - Updated DOM selectors for new sections

### Google Apps Script
- **`Code.gs`**
  - Added `getFAQ()` function
  - Added `getWhoFor()` function
  - Registered new functions in API handler

## Next Steps

1. **Review the design**: Visit your website and view the new sections
2. **Create Google Sheets**: Add `faq` and `who_for` sheets (optional)
3. **Customize content**: Replace default data with your own
4. **Test & deploy**: Ensure everything loads correctly
5. **Share & promote**: Highlight the new sections to your audience

## Support & Customization

If you want to customize further:
- **Change icons**: Update emoji in `who_for` Google Sheet
- **Add more FAQs**: Add rows to `faq` sheet (no limit)
- **Modify styling**: Edit CSS classes (`faq-item`, `who-card`, etc.)
- **Rename sections**: Change "Who Is For?" text in HTML

---

**Version**: 1.0  
**Last Updated**: February 27, 2026  
**Status**: ✅ Ready to Use
