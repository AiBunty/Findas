-- Using allocated database
USE `Findas-353131330571`;

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

CREATE TABLE IF NOT EXISTS about_section (
  id INT PRIMARY KEY,
  founder_name VARCHAR(160) NOT NULL,
  founder_title VARCHAR(255),
  paragraph_1 TEXT,
  paragraph_2 TEXT,
  paragraph_3 TEXT,
  founder_image_url VARCHAR(500),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contact_section (
  id INT PRIMARY KEY,
  phone VARCHAR(50),
  email VARCHAR(160),
  address TEXT,
  gallery_enabled TINYINT(1) DEFAULT 1,
  footer_brand_name VARCHAR(255),
  footer_about_text TEXT,
  footer_quick_links_title VARCHAR(255),
  footer_quick_link_1 VARCHAR(255),
  footer_quick_link_2 VARCHAR(255),
  footer_quick_link_3 VARCHAR(255),
  footer_quick_link_4 VARCHAR(255),
  footer_quick_link_5 VARCHAR(255),
  footer_quick_link_6 VARCHAR(255),
  footer_contact_title VARCHAR(255),
  footer_phone VARCHAR(255),
  footer_address TEXT,
  footer_social_title VARCHAR(255),
  footer_social_instagram VARCHAR(500),
  footer_social_facebook VARCHAR(500),
  footer_social_youtube VARCHAR(500),
  footer_social_twitter VARCHAR(500),
  footer_social_whatsapp VARCHAR(500),
  footer_copyright TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

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
  start_datetime_local DATETIME NULL,
  end_datetime_local DATETIME NULL,
  is_active TINYINT(1) DEFAULT 1,
  `order` INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
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
  target_audience TEXT,
  benefits TEXT,
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
  details TEXT,
  is_active TINYINT(1) DEFAULT 1,
  `order` INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS academy_before (
  id INT AUTO_INCREMENT PRIMARY KEY,
  challenge TEXT NOT NULL,
  is_active TINYINT(1) DEFAULT 1,
  `order` INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS academy_after (
  id INT AUTO_INCREMENT PRIMARY KEY,
  benefit TEXT NOT NULL,
  is_active TINYINT(1) DEFAULT 1,
  `order` INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS academy_roadmap (
  id INT AUTO_INCREMENT PRIMARY KEY,
  stage_num INT NOT NULL,
  stage_name VARCHAR(160) NOT NULL,
  description TEXT,
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

INSERT IGNORE INTO hero_section (id, title, subtitle, button_text_1, button_url_1, button_text_2, button_url_2, video_url)
VALUES (1, 'Build Wealth.', 'Findas Academy is a learning community designed for financial intelligence and growth.', 'Join Findas Academy', '#academy', 'Book Free Call', '#booking', '');

INSERT IGNORE INTO about_section (id, founder_name, founder_title, paragraph_1, paragraph_2, paragraph_3, founder_image_url)
VALUES (1, 'Samir Machawe', 'Founder, Findas Academy', 'Financial Freedom Coach with 20+ years of experience.', 'Most people struggle with money because no one teaches how money works.', 'Mission: help people move from survival mode to freedom mode.', 'https://storage.files-vault.com/uploads/1772207760-dgdy7ilGGl.png');

INSERT IGNORE INTO contact_section (id, phone, email, address)
VALUES (1, '+91 00000 00000', 'support@findasacademy.in', 'Pune, Maharashtra, India');
