CREATE DATABASE IF NOT EXISTS findas_db;
USE findas_db;

CREATE TABLE IF NOT EXISTS hero_section (
  id INT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  subtitle TEXT,
  button_text_1 VARCHAR(120),
  button_url_1 VARCHAR(500),
  button_text_2 VARCHAR(120),
  button_url_2 VARCHAR(500),
  video_url VARCHAR(500),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO hero_section (id, title, subtitle, button_text_1, button_url_1, button_text_2, button_url_2, video_url)
VALUES (1, 'Build Wealth.', 'Findas Academy community intro', 'Join Findas Academy', '#academy', 'Book Free Call', '#booking', '');

CREATE TABLE IF NOT EXISTS courses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  subtitle TEXT,
  slug VARCHAR(160) UNIQUE,
  thumbnail_url VARCHAR(500),
  price_inr DECIMAL(10,2) DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1,
  `order` INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS webinars (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  subtitle TEXT,
  slug VARCHAR(160) UNIQUE,
  banner_url VARCHAR(500),
  host_image_url VARCHAR(500),
  host_name VARCHAR(160),
  platform VARCHAR(120),
  timezone VARCHAR(80),
  start_datetime_local DATETIME NULL,
  end_datetime_local DATETIME NULL,
  price_inr DECIMAL(10,2) DEFAULT 0,
  is_free TINYINT(1) DEFAULT 0,
  payment_link VARCHAR(500),
  primary_cta_text VARCHAR(160),
  body_video_url VARCHAR(500),
  is_active TINYINT(1) DEFAULT 1,
  `order` INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO webinars (
  title,
  subtitle,
  slug,
  banner_url,
  host_image_url,
  host_name,
  platform,
  timezone,
  start_datetime_local,
  end_datetime_local,
  price_inr,
  is_free,
  payment_link,
  primary_cta_text,
  body_video_url,
  is_active,
  `order`
) VALUES
(
  'Smart Capital Allocation 101',
  'A practical live session on how to structure your monthly investments with confidence.',
  'smart-capital-allocation-101',
  'https://images.unsplash.com/photo-1559526324-593bc073d938?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=500&q=80',
  'Samir Machawe',
  'YouTube Live',
  'Asia/Kolkata',
  '2026-06-20 19:30:00',
  '2026-06-20 21:00:00',
  499,
  0,
  'https://paymentz.findasacademy.in/product/29635/41719?staffId=0&ac=1',
  'Register Now',
  'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  1,
  1
),
(
  'Market Psychology in 60 Seconds',
  'A high-impact shorts-style webinar on avoiding emotional trading mistakes.',
  'market-psychology-in-60-seconds',
  'https://images.unsplash.com/photo-1518186285589-2f7649de83e0?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1573497019707-1c04de26e58c?auto=format&fit=crop&w=500&q=80',
  'Samir Machawe',
  'YouTube Shorts',
  'Asia/Kolkata',
  '2026-06-23 20:00:00',
  '2026-06-23 21:00:00',
  0,
  1,
  '',
  'Watch Free Webinar',
  'https://www.youtube.com/shorts/aqz-KE-bpKQ',
  1,
  2
);

CREATE TABLE IF NOT EXISTS digital_products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  subtitle TEXT,
  slug VARCHAR(160) UNIQUE,
  thumbnail_url VARCHAR(500),
  price_inr DECIMAL(10,2) DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1,
  `order` INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS membership_plans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  price_inr DECIMAL(10,2) DEFAULT 0,
  features TEXT,
  is_active TINYINT(1) DEFAULT 1,
  `order` INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS academy_sections (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  icon_emoji VARCHAR(20),
  is_active TINYINT(1) DEFAULT 1,
  `order` INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS academy_community_posts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  post_type VARCHAR(120),
  content TEXT,
  author VARCHAR(120),
  is_active TINYINT(1) DEFAULT 1,
  `order` INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
