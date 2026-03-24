const express = require('express');

const { requireAuth } = require('../middleware/auth');
const { query } = require('../config/database');

const router = express.Router();

const PUBLIC_TABLE_MAP = {
  courses: 'courses',
  webinars: 'webinars',
  'digital-products': 'digital_products',
  membership: 'membership_plans',
  'academy-sections': 'academy_sections',
  'academy-community': 'academy_community_posts'
};

router.get('/admin/hero', requireAuth, async (_req, res, next) => {
  try {
    const rows = await query('SELECT * FROM hero_section ORDER BY id DESC LIMIT 1');
    return res.json({ ok: true, data: rows[0] || null });
  } catch (error) {
    return next(error);
  }
});

router.put('/admin/hero', requireAuth, async (req, res, next) => {
  try {
    const { title, subtitle, button_text_1, button_text_2, video_url } = req.body || {};
    await query(
      'UPDATE hero_section SET title = ?, subtitle = ?, button_text_1 = ?, button_text_2 = ?, video_url = ?, updated_at = NOW() WHERE id = 1',
      [title || '', subtitle || '', button_text_1 || '', button_text_2 || '', video_url || '']
    );
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

router.get('/admin/:resource', requireAuth, async (req, res, next) => {
  try {
    const table = PUBLIC_TABLE_MAP[req.params.resource];
    if (!table) {
      return res.status(404).json({ ok: false, error: 'Unknown admin resource' });
    }
    const rows = await query(`SELECT * FROM ${table} ORDER BY \`order\` ASC, id ASC`);
    return res.json({ ok: true, data: rows });
  } catch (error) {
    return next(error);
  }
});

router.get('/:resource', async (req, res, next) => {
  try {
    const table = PUBLIC_TABLE_MAP[req.params.resource];
    if (!table) {
      return res.status(404).json({ ok: false, error: 'Unknown resource' });
    }
    const rows = await query(`SELECT * FROM ${table} WHERE is_active = 1 ORDER BY \`order\` ASC, id ASC`);
    return res.json({ ok: true, data: rows });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
