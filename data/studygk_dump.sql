-- StudyGK MySQL dump
-- Generated: 2026-01-06
-- Import on Hostinger using: mysql -u USER -p studygk < studygk_dump.sql

DROP DATABASE IF EXISTS studygk;
CREATE DATABASE studygk CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE studygk;

-- admins
CREATE TABLE IF NOT EXISTS admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) UNIQUE,
  password VARCHAR(255),
  secret_question TEXT,
  secret_answer TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- blogs
CREATE TABLE IF NOT EXISTS blogs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE,
  summary TEXT,
  content LONGTEXT,
  featured_image TEXT,
  category VARCHAR(120),
  category_id INT DEFAULT NULL,
  is_hero BOOLEAN DEFAULT FALSE,
  hero_order INT DEFAULT 0,
  meta_title TEXT,
  meta_description TEXT,
  keywords TEXT,
  views INT DEFAULT 0,
  up_votes INT DEFAULT 0,
  down_votes INT DEFAULT 0,
  author VARCHAR(255),
  published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- brand_requests
CREATE TABLE IF NOT EXISTS brand_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name TEXT,
  mobile TEXT,
  title TEXT,
  description TEXT,
  image TEXT,
  status VARCHAR(40) DEFAULT 'open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- product_brands
CREATE TABLE IF NOT EXISTS product_brands (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title TEXT,
  image TEXT,
  link TEXT,
  description TEXT,
  active BOOLEAN DEFAULT TRUE,
  position INT DEFAULT 0,
  views INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- brand_strip
CREATE TABLE IF NOT EXISTS brand_strip (
  id INT AUTO_INCREMENT PRIMARY KEY,
  image TEXT,
  link TEXT,
  slug VARCHAR(255),
  title TEXT,
  price_text TEXT,
  h1 TEXT,
  h2 TEXT,
  h3 TEXT,
  meta_title TEXT,
  meta_description TEXT,
  keywords TEXT,
  position INT DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- categories
CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255),
  slug VARCHAR(255) UNIQUE,
  description TEXT,
  position INT DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- news
CREATE TABLE IF NOT EXISTS news (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title TEXT,
  link TEXT,
  position INT DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- pages
CREATE TABLE IF NOT EXISTS pages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE,
  slug_input TEXT,
  content LONGTEXT,
  meta_title TEXT,
  meta_description TEXT,
  keywords TEXT,
  published BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- comments
CREATE TABLE IF NOT EXISTS comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  blog_id INT NOT NULL,
  parent_comment_id INT DEFAULT NULL,
  image TEXT,
  author_name VARCHAR(255),
  author_email VARCHAR(255),
  content TEXT NOT NULL,
  status VARCHAR(30) DEFAULT 'approved',
  up_votes INT DEFAULT 0,
  down_votes INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_comments_blog_id (blog_id),
  INDEX idx_comments_parent (parent_comment_id),
  CONSTRAINT fk_comments_blog FOREIGN KEY (blog_id) REFERENCES blogs(id) ON DELETE CASCADE,
  CONSTRAINT fk_comments_parent FOREIGN KEY (parent_comment_id) REFERENCES comments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Sample seed data (blogs)
INSERT INTO blogs (title, slug, summary, content, featured_image, meta_title, meta_description, keywords, author, published, created_at, updated_at)
VALUES
('Healthy Morning Routine','healthy-morning-routine','Simple steps to start the day with energy.','<p>Begin with hydration, light stretching, and a focused plan for the day. Small consistent habits drive long term results.</p>','https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1200&q=80','Healthy Morning Routine Tips','Morning routine ideas for busy creators.','health,routine,habits','Admin',1,'2026-01-01 08:00:00','2026-01-01 08:00:00'),
('Boost Study Focus','boost-study-focus','Improve concentration with these quick wins.','<p>Use short focused sprints, remove distractions, and schedule active recall sessions. Track progress each week.</p>','https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1200&q=80','Boost Study Focus Quickly','Concentration strategies for students.','study,focus,productivity','Admin',1,'2026-01-01 09:00:00','2026-01-01 09:00:00'),
('Weekly Fitness Habits','weekly-fitness-habits','Maintain momentum with manageable routines.','<p>Blend strength work, mobility, and active recovery. Keep a simple log to review wins and plan the next week.</p>','https://images.unsplash.com/photo-1517832207067-4db24a2ae47c?auto=format&fit=crop&w=1200&q=80','Weekly Fitness Habit Plan','Keep your workout schedule on track.','fitness,habits,wellness','Admin',1,'2026-01-01 10:00:00','2026-01-01 10:00:00'
);

-- Optional: create an admin account. The application supports creating admins via the register UI (/ratans). If you prefer SQL, uncomment and set a bcrypt hash for a known password.
-- Example (do NOT use this placeholder hash in production):
-- INSERT INTO admins (email, password) VALUES ('admin@studygk.local', '$2b$10$REPLACE_WITH_BCRYPT_HASH');

-- Done
