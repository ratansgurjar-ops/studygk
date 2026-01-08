const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const PORT = process.env.PORT || 4000;
const DB_HOST = process.env.DB_HOST || '';
const DB_USER = process.env.DB_USER || '';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_DATABASE = process.env.DB_DATABASE || 'studygk';
let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('FATAL: JWT_SECRET environment variable not set. Exiting.');
    process.exit(1);
  } else {
    JWT_SECRET = 'dev-secret';
    console.warn('Warning: JWT_SECRET not set; using dev-secret for non-production environment.');
  }
}

const app = express();
app.use(cors());
// Increase body size limits to allow large editor payloads (HTML with inline images, etc.)
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
// static uploads
app.use('/uploads', express.static(path.join(__dirname, '..', 'data', 'uploads')));

// simple settings stored in data/settings.json (admin editable)
const settingsFile = path.join(__dirname, '..', 'data', 'settings.json');
function readSettings(){
  try{
    if (!fs.existsSync(settingsFile)) {
      const def = { heroInterval: 30, stripInterval: 30, showHero: true, showStrip: true,
        homepage_meta_title: 'StudyGKHub — Blog & Free Brand Features',
        homepage_meta_description: 'Publish blog posts and get your brand featured for free. Submit your brand to earn quality backlinks and increase visibility.',
        request_meta_title: 'Request Free Brand Feature',
        request_meta_description: 'Submit your brand details to get a free featured post and editorial backlink on StudyGKHub.',
        site_keywords: 'blog,branding,free feature,backlinks',
        amazon_affiliate_tag: '',
        amazon_affiliate_enabled: false,
        amazon_affiliate_disclosure: 'As an Amazon Associate we may earn from qualifying purchases.'
      };
      fs.writeFileSync(settingsFile, JSON.stringify(def, null, 2));
      return def;
    }
    return JSON.parse(fs.readFileSync(settingsFile, 'utf8') || '{}') || {};
  }catch(e){ return { heroInterval: 30, stripInterval: 30, showHero: true, showStrip: true } }
}
function writeSettings(s){
  try{ fs.writeFileSync(settingsFile, JSON.stringify(s || {}, null, 2)); }catch(e){}
}

function slugify(value){
  return (value || '')
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function normalizePageSlug(value) {
  if (value === undefined || value === null) return '';
  let slug = String(value).trim();
  if (!slug) return '';
  slug = slug.replace(/^[a-z]+:\/\//i, '');
  slug = slug.replace(/^\/\//, '');
  const firstSlash = slug.indexOf('/');
  if (firstSlash >= 0) {
    const hostCandidate = slug.slice(0, firstSlash);
    if (/^[A-Za-z0-9.-]+(?::\d+)?$/.test(hostCandidate)) {
      slug = slug.slice(firstSlash + 1);
    }
  }
  const hashIndex = slug.indexOf('#');
  if (hashIndex >= 0) slug = slug.slice(0, hashIndex);
  const queryIndex = slug.indexOf('?');
  if (queryIndex >= 0) slug = slug.slice(0, queryIndex);
  slug = slug.replace(/\\+/g, '/');
  slug = slug.replace(/^\.+/, '');
  slug = slug.replace(/\s+/g, '-');
  slug = slug.replace(/\.{2,}/g, '.');
  while (slug.includes('../')) slug = slug.replace('../', '/');
  while (slug.includes('/./')) slug = slug.replace('/./', '/');
  slug = slug.replace(/\/+/g, '/');
  slug = slug.replace(/^\/+/, '');
  slug = slug.replace(/\/+$/, '');
  slug = slug.replace(/^\.+/, '');
  slug = slug.replace(/\.+$/, '');
  slug = slug.replace(/[^A-Za-z0-9\-._/]+/g, '');
  slug = slug.replace(/\/+/g, '/');
  slug = slug.replace(/^\/+/, '');
  slug = slug.replace(/\/+$/, '');
  return slug;
}

function appendPageSlugSuffix(baseSlug, suffix) {
  const suffixStr = String(typeof suffix === 'number' ? suffix : (suffix || '')).trim();
  const cleanBase = normalizePageSlug(baseSlug);
  if (!suffixStr) return cleanBase || 'page';
  const segments = cleanBase ? cleanBase.split('/') : [];
  const lastSegment = segments.length ? segments.pop() : 'page';
  const combinedLast = normalizePageSlug(`${lastSegment}-${suffixStr}`) || `${lastSegment}-${suffixStr}`;
  const withSuffix = [...segments, combinedLast].filter(Boolean).join('/');
  const normalized = normalizePageSlug(withSuffix);
  return normalized || `page-${suffixStr}`;
}
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function escapeHtml(str){
  if (str === undefined || str === null) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function buildAbsoluteUrl(req, value){
  if (!value) return '';
  const raw = String(value).trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw) || raw.startsWith('//')) return raw;
  const protocol = req && req.protocol ? req.protocol : 'http';
  const host = (req && typeof req.get === 'function' && req.get('host')) ? req.get('host') : '';
  const base = host ? `${protocol}://${host}` : '';
  const normalizedPath = raw.startsWith('/') ? raw : `/${raw.replace(/^\/+/,'')}`;
  return base ? `${base}${normalizedPath}` : normalizedPath;
}

function hydrateBlogRow(row, req){
  if (!row) return row;
  const hydrated = { ...row };
  hydrated.featured_image = buildAbsoluteUrl(req, row.featured_image);
  return hydrated;
}

const multer = require('multer');
const uploadDir = path.join(__dirname, '..', 'data', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const original = (file && file.originalname) ? String(file.originalname) : 'upload';
    const ext = path.extname(original);
    const base = path.basename(original, ext).replace(/[^a-z0-9_-]+/gi, '').slice(0, 40) || 'file';
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e6);
    cb(null, `${base}-${unique}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 15 * 1024 * 1024 } });

// Save a base64 data URL or remote image URL into the uploads folder and
// return a server-relative path (served under /uploads).
async function saveImageFromString(imageString) {
  try {
    if (!imageString || typeof imageString !== 'string') return null;

    // Data URL (base64)
    const dataMatch = imageString.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    if (dataMatch) {
      const mime = dataMatch[1];
      const base64Data = dataMatch[2];
      const ext = (mime.split('/')[1] || 'png').replace(/[^a-z0-9]/gi, '');
      const filename = `upload-${Date.now()}-${Math.round(Math.random()*1e6)}.${ext}`;
      const filepath = path.join(uploadDir, filename);
      await fs.promises.writeFile(filepath, Buffer.from(base64Data, 'base64'));
      return `/uploads/${filename}`;
    }

    // Remote URL (http/https or protocol-relative)
    let urlStr = imageString;
    if (urlStr.startsWith('//')) urlStr = 'http:' + urlStr;
    if (/^https?:\/\//i.test(urlStr)) {
      const httpLib = urlStr.startsWith('https') ? require('https') : require('http');
      try {
        const parsed = new URL(urlStr);
        const extFromPath = (path.extname(parsed.pathname) || '').split('.').pop();
        const ext = extFromPath || 'png';
        const filename = `upload-${Date.now()}-${Math.round(Math.random()*1e6)}.${ext}`;
        const filepath = path.join(uploadDir, filename);
        await new Promise((resolve, reject) => {
          const req = httpLib.get(urlStr, (resp) => {
            if (resp.statusCode >= 400) return reject(new Error('Failed to download image: ' + resp.statusCode));
            const ws = fs.createWriteStream(filepath);
            resp.pipe(ws);
            ws.on('finish', () => ws.close(resolve));
            ws.on('error', reject);
          });
          req.on('error', reject);
        });
        return `/uploads/${filename}`;
      } catch (err) {
        return null;
      }
    }

    // Otherwise assume it's already a server path or filename
    return imageString;
  } catch (err) {
    return null;
  }
}

let pool = null;
let sqlite = null;
let useSqlite = false;

function sqliteQueryAll(sql, params = []) {
  const stmt = sqlite.prepare(sql);
  return stmt.all(...params);
}

function sqliteRun(sql, params = []) {
  const stmt = sqlite.prepare(sql);
  const info = stmt.run(...params);
  return info;
}

function sql(lines = []) {
  return Array.isArray(lines) ? lines.join('\n') : String(lines || '');
}

async function dbQuery(sql, params = []) {
  if (useSqlite) {
    const trimmed = sql.trim().toUpperCase();
    if (trimmed.startsWith('SELECT')) {
      const rows = sqliteQueryAll(sql, params);
      return [rows, undefined];
    }
    const info = sqliteRun(sql, params);
    return [info, undefined];
  }
  if (!pool) throw new Error('Database pool not initialised');
  try {
    return await pool.execute(sql, params);
  } catch (err) {
    // If a MySQL 'unknown column' error occurs, attempt to add the missing columns
    // for common INSERT INTO / UPDATE statements and retry once.
    try {
      if (err && err.code === 'ER_BAD_FIELD_ERROR' && typeof sql === 'string') {
        const s = sql;
        let table = null;
        let cols = [];
        const insertMatch = s.match(/INSERT\s+INTO\s+([`\w]+)\s*\(([^)]+)\)/i);
        const updateMatch = s.match(/UPDATE\s+([`\w]+)\s+SET\s+([\s\S]+?)\s+WHERE/i);
        if (insertMatch) {
          table = insertMatch[1].replace(/`/g, '');
          cols = insertMatch[2].split(',').map(c => c.trim().replace(/`/g, '').split(' ').pop()).filter(Boolean);
        } else if (updateMatch) {
          table = updateMatch[1].replace(/`/g, '');
          const setPart = updateMatch[2];
          cols = setPart.split(',').map(p => (p || '').split('=')[0].trim().replace(/`/g, '')).filter(Boolean);
        }

        if (table && cols.length) {
          console.warn('Detected missing columns for table', table, 'attempting to add:', cols.join(','));
          for (const c of cols) {
            try {
              await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${c}\` TEXT`);
              console.log('Added column', c, 'to', table);
            } catch (aerr) {
              // ignore — column may already exist or ALTER not permitted
            }
          }
          // retry the original query once
          return await pool.execute(sql, params);
        }
      }
    } catch (recoveryErr) {
      // fall through to rethrow original error
      console.warn('Auto-recovery attempt failed', recoveryErr && recoveryErr.message ? recoveryErr.message : recoveryErr);
    }
    throw err;
  }
}

async function initDb() {
  // Try MySQL first if DB_HOST is provided
  if (DB_HOST) {
    for (let i = 0; i < 5; i++) {
      try {
        pool = mysql.createPool({
          host: process.env.DB_HOST,
          user: process.env.DB_USER,
          password: process.env.DB_PASSWORD,
          // Support both DB_NAME (older envs) and DB_DATABASE (current .env)
          database: process.env.DB_NAME || process.env.DB_DATABASE || DB_DATABASE,
          waitForConnections: true,
          connectionLimit: 10,
          queueLimit: 0
        });
        const conn = await pool.getConnection();
        await conn.ping();
        conn.release();
        console.log('Connected to MySQL');
        break;
      } catch (err) {
        console.log('Waiting for MySQL... retry', i+1);
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }

  if (!pool) {
    try {
      const Database = require('better-sqlite3');
      const dataDir = path.join(__dirname, '..', 'data');
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      const dbFile = path.join(dataDir, 'studygk.db');
      sqlite = new Database(dbFile);
      useSqlite = true;
      console.log('Using SQLite fallback at', dbFile);
    } catch (err) {
      console.error('No database connection available', err && err.message ? err.message : err);
      throw new Error('Database initialisation failed');
    }
  }

  // create tables if not exist (sqlite or mysql)
  if (useSqlite) {
    await dbQuery(sql([
      'CREATE TABLE IF NOT EXISTS admins (',
      '  id INTEGER PRIMARY KEY AUTOINCREMENT,',
      '  email TEXT UNIQUE,',
      '  password TEXT,',
      '  secret_question TEXT,',
      '  secret_answer TEXT',
      ');'
    ]));

    await dbQuery(sql([
      'CREATE TABLE IF NOT EXISTS blogs (',
      '  id INTEGER PRIMARY KEY AUTOINCREMENT,',
      '  title TEXT NOT NULL,',
      '  slug TEXT UNIQUE,',
      '  summary TEXT,',
      '  content TEXT,',
      '  featured_image TEXT,',
      '  category TEXT,',
      '  category_id INTEGER,',
      '  is_hero INTEGER DEFAULT 0,',
      '  hero_order INTEGER DEFAULT 0,',
      '  meta_title TEXT,',
      '  meta_description TEXT,',
      '  keywords TEXT,',
      '  views INTEGER DEFAULT 0,',
      '  up_votes INTEGER DEFAULT 0,',
      '  down_votes INTEGER DEFAULT 0,',
      '  author TEXT,',
      '  published INTEGER DEFAULT 0,',
      "  created_at TEXT DEFAULT (datetime('now')),",
      "  updated_at TEXT DEFAULT (datetime('now'))",
      ');'
    ]));

    await dbQuery(sql([
      'CREATE TABLE IF NOT EXISTS brand_requests (',
      '  id INTEGER PRIMARY KEY AUTOINCREMENT,',
      '  name TEXT,',
      '  mobile TEXT,',
      '  title TEXT,',
      '  description TEXT,',
      '  image TEXT,',
      "  status TEXT DEFAULT 'open',",
      "  created_at TEXT DEFAULT (datetime('now')),",
      '  resolved_at TEXT',
      ');'
    ]));
    try { await dbQuery('ALTER TABLE brand_requests ADD COLUMN image TEXT'); } catch(e){}

    await dbQuery(sql([
      'CREATE TABLE IF NOT EXISTS product_brands (',
      '  id INTEGER PRIMARY KEY AUTOINCREMENT,',
      '  title TEXT,',
      '  image TEXT,',
      '  link TEXT,',
      '  description TEXT,',
      '  meta_title TEXT,',
      '  meta_description TEXT,',
      '  keywords TEXT,',
      '  active INTEGER DEFAULT 1,',
      '  position INTEGER DEFAULT 0,',
      '  views INTEGER DEFAULT 0,',
      "  created_at TEXT DEFAULT (datetime('now')),",
      "  updated_at TEXT DEFAULT (datetime('now'))",
      ');'
    ]));

    await dbQuery(sql([
      'CREATE TABLE IF NOT EXISTS brand_strip (',
      '  id INTEGER PRIMARY KEY AUTOINCREMENT,',
      '  image TEXT,',
      '  link TEXT,',
      '  slug TEXT,',
      '  title TEXT,',
      '  price_text TEXT,',
      '  h1 TEXT,',
      '  h2 TEXT,',
      '  h3 TEXT,',
      '  meta_title TEXT,',
      '  meta_description TEXT,',
      '  keywords TEXT,',
      '  position INTEGER DEFAULT 0,',
      '  active INTEGER DEFAULT 1,',
      "  created_at TEXT DEFAULT (datetime('now')),",
      "  updated_at TEXT DEFAULT (datetime('now'))",
      ');'
    ]));
    try { await dbQuery('ALTER TABLE brand_strip ADD COLUMN slug TEXT'); } catch(e){}
    try { await dbQuery('ALTER TABLE brand_strip ADD COLUMN title TEXT'); } catch(e){}
    try { await dbQuery('ALTER TABLE brand_strip ADD COLUMN price_text TEXT'); } catch(e){}
    try { await dbQuery('ALTER TABLE brand_strip ADD COLUMN h1 TEXT'); } catch(e){}
    try { await dbQuery('ALTER TABLE brand_strip ADD COLUMN h2 TEXT'); } catch(e){}
    try { await dbQuery('ALTER TABLE brand_strip ADD COLUMN h3 TEXT'); } catch(e){}
    try { await dbQuery('ALTER TABLE brand_strip ADD COLUMN meta_title TEXT'); } catch(e){}
    try { await dbQuery('ALTER TABLE brand_strip ADD COLUMN meta_description TEXT'); } catch(e){}
    try { await dbQuery('ALTER TABLE brand_strip ADD COLUMN keywords TEXT'); } catch(e){}

    await dbQuery(sql([
      'CREATE TABLE IF NOT EXISTS categories (',
      '  id INTEGER PRIMARY KEY AUTOINCREMENT,',
      '  name TEXT,',
      '  slug TEXT UNIQUE,',
      '  description TEXT,',
      '  meta_title TEXT,',
      '  meta_description TEXT,',
      '  keywords TEXT,',
      '  position INTEGER DEFAULT 0,',
      '  active INTEGER DEFAULT 1,',
      "  created_at TEXT DEFAULT (datetime('now')),",
      "  updated_at TEXT DEFAULT (datetime('now'))",
      ');'
    ]));

    await dbQuery(sql([
      'CREATE TABLE IF NOT EXISTS news (',
      '  id INTEGER PRIMARY KEY AUTOINCREMENT,',
      '  title TEXT,',
      '  link TEXT,',
      '  position INTEGER DEFAULT 0,',
      '  active INTEGER DEFAULT 1,',
      "  created_at TEXT DEFAULT (datetime('now')),",
      "  updated_at TEXT DEFAULT (datetime('now'))",
      ');'
    ]));

    await dbQuery(sql([
      'CREATE TABLE IF NOT EXISTS pages (',
      '  id INTEGER PRIMARY KEY AUTOINCREMENT,',
      '  title TEXT NOT NULL,',
      '  slug TEXT UNIQUE,',
      '  slug_input TEXT,',
      '  content TEXT,',
      '  meta_title TEXT,',
      '  meta_description TEXT,',
      '  keywords TEXT,',
      '  published INTEGER DEFAULT 1,',
      "  created_at TEXT DEFAULT (datetime('now')),",
      "  updated_at TEXT DEFAULT (datetime('now'))",
      ');'
    ]));
    try { await dbQuery('ALTER TABLE pages ADD COLUMN slug_input TEXT'); } catch (err) {}
    try { await dbQuery('ALTER TABLE pages ADD COLUMN meta_title TEXT'); } catch (err) {}
    try { await dbQuery('ALTER TABLE pages ADD COLUMN meta_description TEXT'); } catch (err) {}
    try { await dbQuery('ALTER TABLE pages ADD COLUMN keywords TEXT'); } catch (err) {}
    try { await dbQuery('ALTER TABLE pages ADD COLUMN published INTEGER DEFAULT 1'); } catch (err) {}

    try { await dbQuery('ALTER TABLE blogs ADD COLUMN up_votes INTEGER DEFAULT 0'); } catch (err) {}
    try { await dbQuery('ALTER TABLE blogs ADD COLUMN down_votes INTEGER DEFAULT 0'); } catch (err) {}
    try { await dbQuery('ALTER TABLE comments ADD COLUMN parent_comment_id INTEGER'); } catch (err) {}
    try { await dbQuery('ALTER TABLE comments ADD COLUMN up_votes INTEGER DEFAULT 0'); } catch (err) {}
    try { await dbQuery('ALTER TABLE comments ADD COLUMN down_votes INTEGER DEFAULT 0'); } catch (err) {}
    try { await dbQuery('ALTER TABLE comments ADD COLUMN image TEXT'); } catch (err) {}
    try { await dbQuery('ALTER TABLE categories ADD COLUMN meta_title TEXT'); } catch (err) {}
    try { await dbQuery('ALTER TABLE categories ADD COLUMN meta_description TEXT'); } catch (err) {}
    try { await dbQuery('ALTER TABLE categories ADD COLUMN keywords TEXT'); } catch (err) {}

    await dbQuery(sql([
      'CREATE TABLE IF NOT EXISTS comments (',
      '  id INTEGER PRIMARY KEY AUTOINCREMENT,',
      '  blog_id INTEGER NOT NULL,',
      '  parent_comment_id INTEGER,',
      '  image TEXT,',
      '  author_name TEXT,',
      '  author_email TEXT,',
      '  content TEXT NOT NULL,',
      "  status TEXT DEFAULT 'approved',",
      '  up_votes INTEGER DEFAULT 0,',
      '  down_votes INTEGER DEFAULT 0,',
      "  created_at TEXT DEFAULT (datetime('now')),",
      "  updated_at TEXT DEFAULT (datetime('now')),",
      '  FOREIGN KEY(blog_id) REFERENCES blogs(id) ON DELETE CASCADE,',
      '  FOREIGN KEY(parent_comment_id) REFERENCES comments(id) ON DELETE CASCADE',
      ');'
    ]));

    try { await dbQuery('ALTER TABLE admins ADD COLUMN secret_question TEXT'); } catch(e){}
    try { await dbQuery('ALTER TABLE admins ADD COLUMN secret_answer TEXT'); } catch(e){}
    const [adminRows] = await dbQuery('SELECT id FROM admins LIMIT 1');
    if (!adminRows || adminRows.length === 0) {
      console.log('No admin account found. Create one using the /ratans registration UI or insert directly into the database.');
    }
  } else {
    if (pool) {
      console.log('MySQL detected; skipping schema initialization (assumed already applied).');
      return;
    }
    await dbQuery(sql([
      'CREATE TABLE IF NOT EXISTS admins (',
      '  id INT AUTO_INCREMENT PRIMARY KEY,',
      '  email VARCHAR(255) UNIQUE,',
      '  password VARCHAR(255),',
      '  secret_question TEXT,',
      '  secret_answer TEXT',
      ') ENGINE=InnoDB;'
    ]));

    await dbQuery(sql([
      'CREATE TABLE IF NOT EXISTS blogs (',
      '  id INT AUTO_INCREMENT PRIMARY KEY,',
      '  title VARCHAR(255) NOT NULL,',
      '  slug VARCHAR(255) UNIQUE,',
      '  summary TEXT,',
      '  content LONGTEXT,',
      '  featured_image TEXT,',
      '  category VARCHAR(120),',
      '  category_id INT DEFAULT NULL,',
      '  is_hero BOOLEAN DEFAULT FALSE,',
      '  hero_order INT DEFAULT 0,',
      '  meta_title TEXT,',
      '  meta_description TEXT,',
      '  keywords TEXT,',
      '  views INT DEFAULT 0,',
      '  up_votes INT DEFAULT 0,',
      '  down_votes INT DEFAULT 0,',
      '  author VARCHAR(255),',
      '  published BOOLEAN DEFAULT FALSE,',
      '  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,',
      '  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
      ') ENGINE=InnoDB;'
    ]));

    await dbQuery(sql([
      'CREATE TABLE IF NOT EXISTS comments (',
      '  id INT AUTO_INCREMENT PRIMARY KEY,',
      '  blog_id INT NOT NULL,',
      '  parent_comment_id INT DEFAULT NULL,',
      '  image TEXT,',
      '  author_name VARCHAR(255),',
      '  author_email VARCHAR(255),',
      '  content TEXT NOT NULL,',
      "  status VARCHAR(30) DEFAULT 'approved',",
      '  up_votes INT DEFAULT 0,',
      '  down_votes INT DEFAULT 0,',
      '  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,',
      '  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,',
      '  INDEX idx_comments_blog_id (blog_id),',
      '  INDEX idx_comments_parent (parent_comment_id),',
      '  CONSTRAINT fk_comments_blog FOREIGN KEY (blog_id) REFERENCES blogs(id) ON DELETE CASCADE,',
      '  CONSTRAINT fk_comments_parent FOREIGN KEY (parent_comment_id) REFERENCES comments(id) ON DELETE CASCADE',
      ') ENGINE=InnoDB;'
    ]));

    // Ensure large HTML (e.g., base64 images) fits in MySQL
    try {
      await dbQuery('ALTER TABLE blogs MODIFY COLUMN content LONGTEXT');
    } catch (err) {
      // ignore if not supported or already applied
    }

    // Ensure newer columns exist (older DBs may predate schema additions)
    try { await dbQuery('ALTER TABLE blogs ADD COLUMN category VARCHAR(120)'); } catch (err) {}
    try { await dbQuery('ALTER TABLE blogs ADD COLUMN is_hero BOOLEAN DEFAULT FALSE'); } catch (err) {}
    try { await dbQuery('ALTER TABLE blogs ADD COLUMN hero_order INT DEFAULT 0'); } catch (err) {}
    try { await dbQuery('ALTER TABLE blogs ADD COLUMN category_id INT DEFAULT NULL'); } catch (err) {}
    try { await dbQuery('ALTER TABLE blogs ADD COLUMN views INT DEFAULT 0'); } catch (err) {}
    try { await dbQuery('ALTER TABLE product_brands ADD COLUMN views INT DEFAULT 0'); } catch (err) {}
    try { await dbQuery('ALTER TABLE product_brands ADD COLUMN meta_title TEXT'); } catch (err) {}
    try { await dbQuery('ALTER TABLE product_brands ADD COLUMN meta_description TEXT'); } catch (err) {}
    try { await dbQuery('ALTER TABLE product_brands ADD COLUMN keywords TEXT'); } catch (err) {}
    try { await dbQuery('ALTER TABLE blogs ADD COLUMN up_votes INT DEFAULT 0'); } catch (err) {}
    try { await dbQuery('ALTER TABLE blogs ADD COLUMN down_votes INT DEFAULT 0'); } catch (err) {}
    try { await dbQuery('ALTER TABLE comments ADD COLUMN parent_comment_id INT DEFAULT NULL'); } catch (err) {}
    try { await dbQuery('ALTER TABLE comments ADD COLUMN up_votes INT DEFAULT 0'); } catch (err) {}
    try { await dbQuery('ALTER TABLE comments ADD COLUMN down_votes INT DEFAULT 0'); } catch (err) {}
    try { await dbQuery('ALTER TABLE comments ADD COLUMN image TEXT'); } catch (err) {}

    await dbQuery(sql([
      'CREATE TABLE IF NOT EXISTS brand_requests (',
      '  id INT AUTO_INCREMENT PRIMARY KEY,',
      '  name VARCHAR(255),',
      '  mobile VARCHAR(100),',
      '  title VARCHAR(255),',
      '  description TEXT,',
      '  image TEXT,',
      "  status VARCHAR(30) DEFAULT 'open',",
      '  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,',
      '  resolved_at TIMESTAMP NULL',
      ') ENGINE=InnoDB;'
    ]));
    // Ensure `image` column exists in MySQL (check INFORMATION_SCHEMA then alter if missing)
    try {
      if (pool) {
        try {
          const [[colInfo]] = await pool.query("SELECT COUNT(*) as c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'brand_requests' AND COLUMN_NAME = 'image'", [DB_DATABASE]);
          if (!colInfo || Number(colInfo.c || 0) === 0) {
            await pool.query("ALTER TABLE brand_requests ADD COLUMN image TEXT");
            console.log('Added image column to brand_requests (MySQL)');
          }
          // ensure title column exists
          const [[titleInfo]] = await pool.query("SELECT COUNT(*) as c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'brand_requests' AND COLUMN_NAME = 'title'", [DB_DATABASE]);
          if (!titleInfo || Number(titleInfo.c || 0) === 0) {
            await pool.query("ALTER TABLE brand_requests ADD COLUMN title VARCHAR(255)");
            console.log('Added title column to brand_requests (MySQL)');
          }
        } catch (innerErr) {
          // best-effort: try ALTER directly
          try { await pool.query("ALTER TABLE brand_requests ADD COLUMN image TEXT"); console.log('Added image column to brand_requests (MySQL - direct)'); } catch(e2) { console.warn('Could not add image column to brand_requests (MySQL)', e2 && e2.message ? e2.message : String(e2)); }
        }
      }
    } catch(e){}
    // Ensure `image` column exists in SQLite (PRAGMA table_info)
    try {
      if (useSqlite && sqlite) {
        try {
          const stmt = sqlite.prepare("PRAGMA table_info('brand_requests')");
          const cols = stmt.all();
          const hasImage = Array.isArray(cols) && cols.some(c => String(c.name) === 'image');
          const hasTitle = Array.isArray(cols) && cols.some(c => String(c.name) === 'title');
          if (!hasImage) {
            sqlite.prepare("ALTER TABLE brand_requests ADD COLUMN image TEXT").run();
            console.log('Added image column to brand_requests (SQLite)');
          }
          if (!hasTitle) {
            sqlite.prepare("ALTER TABLE brand_requests ADD COLUMN title TEXT").run();
            console.log('Added title column to brand_requests (SQLite)');
          }
        } catch (ie) {
          try { sqlite.prepare("ALTER TABLE brand_requests ADD COLUMN image TEXT").run(); console.log('Added image column to brand_requests (SQLite - direct)'); } catch(e2) { console.warn('Could not add image column to brand_requests (SQLite)', e2 && e2.message ? e2.message : String(e2)); }
        }
      }
    } catch(e){}

    await dbQuery(sql([
      'CREATE TABLE IF NOT EXISTS product_brands (',
      '  id INT AUTO_INCREMENT PRIMARY KEY,',
      '  title VARCHAR(255),',
      '  image TEXT,',
      '  link TEXT,',
      '  description TEXT,',
      '  meta_title TEXT,',
      '  meta_description TEXT,',
      '  keywords TEXT,',
      '  active BOOLEAN DEFAULT TRUE,',
      '  position INT DEFAULT 0,',
      '  views INT DEFAULT 0,',
      '  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,',
      '  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
      ') ENGINE=InnoDB;'
    ]));

    await dbQuery(sql([
      'CREATE TABLE IF NOT EXISTS brand_strip (',
      '  id INT AUTO_INCREMENT PRIMARY KEY,',
      '  image TEXT,',
      '  link TEXT,',
      '  slug VARCHAR(255),',
      '  title TEXT,',
      '  price_text TEXT,',
      '  h1 TEXT,',
      '  h2 TEXT,',
      '  h3 TEXT,',
      '  meta_title TEXT,',
      '  meta_description TEXT,',
      '  keywords TEXT,',
      '  position INT DEFAULT 0,',
      '  active BOOLEAN DEFAULT TRUE,',
      '  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,',
      '  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
      ') ENGINE=InnoDB;'
    ]));
    try { if (pool) { await pool.query("ALTER TABLE brand_strip ADD COLUMN slug VARCHAR(255)"); } } catch(e){}
    try { if (pool) { await pool.query("ALTER TABLE brand_strip ADD COLUMN title TEXT"); } } catch(e){}
    try { if (pool) { await pool.query("ALTER TABLE brand_strip ADD COLUMN price_text TEXT"); } } catch(e){}
    try { if (pool) { await pool.query("ALTER TABLE brand_strip ADD COLUMN h1 TEXT"); } } catch(e){}
    try { if (pool) { await pool.query("ALTER TABLE brand_strip ADD COLUMN h2 TEXT"); } } catch(e){}
    try { if (pool) { await pool.query("ALTER TABLE brand_strip ADD COLUMN h3 TEXT"); } } catch(e){}
    try { if (pool) { await pool.query("ALTER TABLE brand_strip ADD COLUMN meta_title TEXT"); } } catch(e){}
    try { if (pool) { await pool.query("ALTER TABLE brand_strip ADD COLUMN meta_description TEXT"); } } catch(e){}
    try { if (pool) { await pool.query("ALTER TABLE brand_strip ADD COLUMN keywords TEXT"); } } catch(e){}

    await dbQuery(sql([
      'CREATE TABLE IF NOT EXISTS categories (',
      '  id INT AUTO_INCREMENT PRIMARY KEY,',
      '  name VARCHAR(255),',
      '  slug VARCHAR(255) UNIQUE,',
      '  description TEXT,',
      '  meta_title TEXT,',
      '  meta_description TEXT,',
      '  keywords TEXT,',
      '  position INT DEFAULT 0,',
      '  active BOOLEAN DEFAULT TRUE,',
      '  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,',
      '  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
      ') ENGINE=InnoDB;'
    ]));

    await dbQuery(sql([
      'CREATE TABLE IF NOT EXISTS news (',
      '  id INT AUTO_INCREMENT PRIMARY KEY,',
      '  title VARCHAR(255),',
      '  link TEXT,',
      '  position INT DEFAULT 0,',
      '  active BOOLEAN DEFAULT TRUE,',
      '  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,',
      '  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
      ') ENGINE=InnoDB;'
    ]));

    await dbQuery(sql([
      'CREATE TABLE IF NOT EXISTS pages (',
      '  id INT AUTO_INCREMENT PRIMARY KEY,',
      '  title VARCHAR(255) NOT NULL,',
      '  slug VARCHAR(255) UNIQUE,',
      '  slug_input TEXT,',
      '  content LONGTEXT,',
      '  meta_title TEXT,',
      '  meta_description TEXT,',
      '  keywords TEXT,',
      '  published BOOLEAN DEFAULT TRUE,',
      '  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,',
      '  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
      ') ENGINE=InnoDB;'
    ]));
    try { await dbQuery('ALTER TABLE pages ADD COLUMN slug_input TEXT'); } catch (err) {}
    try { await dbQuery('ALTER TABLE pages MODIFY COLUMN content LONGTEXT'); } catch (err) {}
    try { await dbQuery('ALTER TABLE pages ADD COLUMN meta_title TEXT'); } catch (err) {}
    try { await dbQuery('ALTER TABLE pages ADD COLUMN meta_description TEXT'); } catch (err) {}
    try { await dbQuery('ALTER TABLE pages ADD COLUMN keywords TEXT'); } catch (err) {}
    try { await dbQuery('ALTER TABLE pages ADD COLUMN published BOOLEAN DEFAULT TRUE'); } catch (err) {}

    try {
      if (pool) {
        try {
          const [[secretQ]] = await pool.query("SELECT COUNT(*) as c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'admins' AND COLUMN_NAME = 'secret_question'", [DB_DATABASE]);
          if (!secretQ || Number(secretQ.c || 0) === 0) {
            await pool.query("ALTER TABLE admins ADD COLUMN secret_question TEXT");
            console.log('Added secret_question column to admins (MySQL)');
          }
          const [[secretA]] = await pool.query("SELECT COUNT(*) as c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'admins' AND COLUMN_NAME = 'secret_answer'", [DB_DATABASE]);
          if (!secretA || Number(secretA.c || 0) === 0) {
            await pool.query("ALTER TABLE admins ADD COLUMN secret_answer TEXT");
            console.log('Added secret_answer column to admins (MySQL)');
          }
        } catch (innerErr) {
          try { await pool.query("ALTER TABLE admins ADD COLUMN secret_question TEXT"); await pool.query("ALTER TABLE admins ADD COLUMN secret_answer TEXT"); console.log('Added secret_question/secret_answer to admins (MySQL - direct)'); } catch(e2) { console.warn('Could not add secret columns to admins (MySQL)', e2 && e2.message ? e2.message : String(e2)); }
        }
      }
    } catch(e){}
    try { if (pool) { await pool.query("ALTER TABLE categories ADD COLUMN meta_title TEXT"); } } catch(e){}
    try { if (pool) { await pool.query("ALTER TABLE categories ADD COLUMN meta_description TEXT"); } } catch(e){}
    try { if (pool) { await pool.query("ALTER TABLE categories ADD COLUMN keywords TEXT"); } } catch(e){}
    try { if (pool) { await pool.query("ALTER TABLE product_brands ADD COLUMN meta_title TEXT"); } } catch(e){}
    try { if (pool) { await pool.query("ALTER TABLE product_brands ADD COLUMN meta_description TEXT"); } } catch(e){}
    try { if (pool) { await pool.query("ALTER TABLE product_brands ADD COLUMN keywords TEXT"); } } catch(e){}

    const [rows] = await dbQuery('SELECT * FROM admins LIMIT 1');
    if (rows.length === 0) {
      const pw = await bcrypt.hash('admin123', 10);
      await dbQuery('INSERT INTO admins (email, password) VALUES (?, ?)', ['admin@studygk.local', pw]);
      console.log('Seeded admin: admin@studygk.local / admin123');
    }
  }
}

async function resolveCategoryReference(input) {
  const empty = { categoryId: null, categoryName: '' };
  if (input === undefined || input === null) return empty;
  const raw = String(input).trim();
  if (!raw) return empty;

  const numericId = Number(raw);
  if (!Number.isNaN(numericId) && raw === String(numericId)) {
    const [[row]] = await dbQuery('SELECT id, name FROM categories WHERE id = ? LIMIT 1', [numericId]);
    if (row) {
      return { categoryId: Number(row.id), categoryName: row.name || '' };
    }
    return empty;
  }

  const name = raw;
  const [[row]] = await dbQuery('SELECT id, name FROM categories WHERE name = ? LIMIT 1', [name]);
  if (row) {
    return { categoryId: Number(row.id), categoryName: row.name || '' };
  }
  return { categoryId: null, categoryName: name };
}

function normalizeCommentRow(row) {
  if (!row) return null;
  const obj = typeof row === 'object' ? row : {};
  const parentVal = obj.parent_comment_id;
  const parentNumeric = parentVal === null || parentVal === undefined ? null : Number(parentVal);
  return {
    id: obj.id !== undefined ? Number(obj.id) : null,
    blog_id: obj.blog_id !== undefined ? Number(obj.blog_id) : null,
    parent_comment_id: Number.isInteger(parentNumeric) && parentNumeric > 0 ? parentNumeric : null,
    author_name: obj.author_name || '',
    author_email: obj.author_email || '',
    image: obj.image || '',
    content: obj.content || '',
    status: obj.status || 'pending',
    up_votes: obj.up_votes !== undefined ? Number(obj.up_votes) : 0,
    down_votes: obj.down_votes !== undefined ? Number(obj.down_votes) : 0,
    created_at: obj.created_at || null,
    updated_at: obj.updated_at || null
  };
}

function normalizePageRow(row) {
  if (!row) return null;
  const obj = typeof row === 'object' ? row : {};
  const publishedValue = obj.published;
  const publishedBool = publishedValue === true || publishedValue === 1 || publishedValue === '1';
  const storedSlug = obj.slug !== undefined && obj.slug !== null ? String(obj.slug) : '';
  const inputSlug = obj.slug_input !== undefined && obj.slug_input !== null ? String(obj.slug_input) : '';
  const normalizedSlug = normalizePageSlug(storedSlug || inputSlug);
  const slugInputValue = inputSlug || storedSlug || '';
  return {
    id: obj.id !== undefined ? Number(obj.id) : null,
    title: obj.title || '',
    slug: normalizedSlug,
    slug_input: slugInputValue,
    content: obj.content || '',
    meta_title: obj.meta_title || '',
    meta_description: obj.meta_description || '',
    keywords: obj.keywords || '',
    published: publishedBool,
    created_at: obj.created_at || null,
    updated_at: obj.updated_at || null
  };
}

function sanitizeCommentInput(str, { maxLength = 1000, allowMultiline = false } = {}) {
  if (!str) return '';
  let value = String(str);
  if (allowMultiline) {
    value = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    value = value.split('\n').map(line => line.trim()).filter(Boolean).join('\n');
  } else {
    value = value.replace(/\s+/g, ' ');
  }
  value = value.trim();
  if (!value) return '';
  return value.slice(0, maxLength);
}

function sanitizeCommentContent(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function validateEmail(str) {
  if (!str) return '';
  const trimmed = String(str).trim();
  if (!trimmed) return '';
  const simple = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return simple.test(trimmed) ? trimmed.slice(0, 190) : '';
}

// Categories: distinct categories from published blogs
app.get('/api/categories', asyncHandler(async (req, res) => {
  const publishedCondition = useSqlite ? 'published = 1' : 'published = 1';
  const sql = `SELECT DISTINCT category FROM blogs WHERE ${publishedCondition} AND category IS NOT NULL AND TRIM(category) <> '' ORDER BY category ASC`;
  const [rows] = await dbQuery(sql);
  res.json((rows || []).map(r => r.category).filter(Boolean));
}));

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });
  const parts = auth.split(' ');
  if (parts.length !== 2) return res.status(401).json({ error: 'Unauthorized' });
  const token = parts[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.admin = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

app.post('/api/admin/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Missing credentials' });
  const [rows] = await dbQuery(useSqlite ? 'SELECT * FROM admins WHERE email = ? LIMIT 1' : 'SELECT * FROM admins WHERE email = ? LIMIT 1', [email]);
  const adminRow = rows;
  if (!adminRow || adminRow.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
  const admin = useSqlite ? adminRow[0] : adminRow[0];
  const ok = await bcrypt.compare(password, admin.password);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: admin.id, email: admin.email }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ token });
}));

// Admin registration: only allowed if no admin exists
app.post('/api/admin/register', asyncHandler(async (req, res) => {
  const { email, password, secret_question, secret_answer } = req.body || {};
  if (!email || !password || !secret_question || !secret_answer) return res.status(400).json({ error: 'Missing fields' });
  const validEmail = validateEmail(email);
  if (!validEmail) return res.status(400).json({ error: 'Invalid email' });
  const [rows] = await dbQuery('SELECT id FROM admins LIMIT 1');
  if (rows && rows.length > 0) return res.status(400).json({ error: 'Admin account already exists' });
  const hashed = await bcrypt.hash(password, 10);
  const hashedAnswer = await bcrypt.hash(String(secret_answer || ''), 10);
  await dbQuery('INSERT INTO admins (email, password, secret_question, secret_answer) VALUES (?, ?, ?, ?)', [validEmail, hashed, String(secret_question || ''), hashedAnswer]);
  res.json({ ok: true });
}));

// Get secret question for forgot-password flow
app.get('/api/admin/forgot-question', asyncHandler(async (req, res) => {
  const email = String(req.query.email || '').trim();
  if (!email) return res.status(400).json({ error: 'Missing email' });
  const [rows] = await dbQuery('SELECT secret_question FROM admins WHERE email = ? LIMIT 1', [email]);
  if (!rows || rows.length === 0) return res.status(404).json({ error: 'Not found' });
  const row = rows[0];
  res.json({ secret_question: row.secret_question || '' });
}));

// Reset password using secret answer
app.post('/api/admin/forgot-reset', asyncHandler(async (req, res) => {
  const { email, answer, newPassword } = req.body || {};
  if (!email || !answer || !newPassword) return res.status(400).json({ error: 'Missing fields' });
  const [rows] = await dbQuery('SELECT id, secret_answer FROM admins WHERE email = ? LIMIT 1', [email]);
  if (!rows || rows.length === 0) return res.status(404).json({ error: 'Not found' });
  const admin = rows[0];
  const ok = await bcrypt.compare(String(answer || ''), admin.secret_answer);
  if (!ok) return res.status(401).json({ error: 'Invalid answer' });
  const hashed = await bcrypt.hash(newPassword, 10);
  await dbQuery('UPDATE admins SET password = ? WHERE id = ?', [hashed, admin.id]);
  res.json({ ok: true });
}));

app.get('/api/blogs', asyncHandler(async (req, res) => {
  const [rows] = await dbQuery(`
    SELECT
      b.id,
      b.title,
      b.slug,
      b.summary,
      b.content,
      b.author,
      b.published,
      b.created_at,
      b.updated_at,
      b.featured_image,
      b.category,
      b.category_id,
      b.is_hero,
      b.hero_order,
      b.views,
      b.up_votes,
      b.down_votes,
      (SELECT COUNT(*) FROM comments WHERE blog_id = b.id AND status = 'approved') AS comments_count
    FROM blogs b
    ORDER BY b.created_at DESC
  `);
  const list = Array.isArray(rows) ? rows.map(row => hydrateBlogRow(row, req)) : [];
  res.json(list);
}));

app.get('/api/blogs-lite', asyncHandler(async (req, res) => {
  const contentExpr = useSqlite ? "substr(b.content, 1, 1500)" : "SUBSTRING(b.content, 1, 1500)";
  const [rows] = await dbQuery(`
    SELECT
      b.id,
      b.title,
      b.slug,
      b.summary,
      ${contentExpr} AS content_preview,
      b.author,
      b.published,
      b.created_at,
      b.updated_at,
      b.featured_image,
      b.category,
      b.category_id,
      b.is_hero,
      b.hero_order,
      b.views,
      b.up_votes,
      b.down_votes
    FROM blogs b
    ORDER BY b.created_at DESC
  `);
  const list = Array.isArray(rows) ? rows.map(row => {
    const hydrated = hydrateBlogRow(row, req);
    return { ...hydrated, content_preview: row.content_preview || '' };
  }) : [];
  res.json(list);
}));

app.get('/api/blogs/:id', asyncHandler(async (req, res) => {
  const id = req.params.id;
  const [rows] = await dbQuery('SELECT * FROM blogs WHERE id = ? LIMIT 1', [id]);
  if (!rows || rows.length === 0) return res.status(404).json({ error: 'Not found' });
  const [countRow] = await dbQuery('SELECT COUNT(*) AS c FROM comments WHERE blog_id = ? AND status = ?', [id, 'approved']);
  const base = rows[0];
  const hydrated = hydrateBlogRow(base, req);
  const totalComments = Array.isArray(countRow) ? Number((countRow[0] && countRow[0].c) || 0) : Number((countRow && countRow.c) || 0);
  res.json({ ...hydrated, comments_count: totalComments });
}));

// fetch by slug
app.get('/api/blogs/slug/:slug', asyncHandler(async (req, res) => {
  const slug = req.params.slug;
  const [rows] = await dbQuery('SELECT * FROM blogs WHERE slug = ? LIMIT 1', [slug]);
  if (!rows || rows.length === 0) return res.status(404).json({ error: 'Not found' });
  const row = hydrateBlogRow(rows[0], req);
  const blogId = row.id;
  const [countRow] = await dbQuery('SELECT COUNT(*) AS c FROM comments WHERE blog_id = ? AND status = ?', [blogId, 'approved']);
  const totalComments = Array.isArray(countRow) ? Number((countRow[0] && countRow[0].c) || 0) : Number((countRow && countRow.c) || 0);
  res.json({ ...row, comments_count: totalComments });
}));

app.get('/api/blogs/:id/comments', asyncHandler(async (req, res) => {
  const blogId = Number(req.params.id);
  if (!Number.isInteger(blogId) || blogId <= 0) {
    return res.status(400).json({ error: 'Invalid blog id' });
  }
  const [rows] = await dbQuery('SELECT id, blog_id, parent_comment_id, image, author_name, author_email, content, status, up_votes, down_votes, created_at, updated_at FROM comments WHERE blog_id = ? AND status = ? ORDER BY created_at ASC', [blogId, 'approved']);
  const safe = (rows || []).map(normalizeCommentRow).map(row => ({
    id: row.id,
    blog_id: row.blog_id,
    parent_comment_id: row.parent_comment_id,
    author_name: row.author_name,
    content: sanitizeCommentContent(row.content),
    image: row.image || '',
    up_votes: Number(row.up_votes || 0),
    down_votes: Number(row.down_votes || 0),
    created_at: row.created_at
  }));
  res.json(safe);
}));

app.post('/api/blogs/:id/comments', asyncHandler(async (req, res) => {
  const blogId = Number(req.params.id);
  if (!Number.isInteger(blogId) || blogId <= 0) {
    return res.status(400).json({ error: 'Invalid blog id' });
  }
  const [[blogExists]] = await dbQuery('SELECT id FROM blogs WHERE id = ? LIMIT 1', [blogId]);
  if (!blogExists) {
    return res.status(404).json({ error: 'Blog not found' });
  }

  const name = sanitizeCommentInput(req.body?.author_name || req.body?.name, { maxLength: 120 }) || 'Anonymous';
  const email = validateEmail(req.body?.author_email || req.body?.email);
  const contentRaw = sanitizeCommentInput(req.body?.content || '', { maxLength: 1200, allowMultiline: true });
  if (!contentRaw) {
    return res.status(400).json({ error: 'Comment content required' });
  }

  const parentRaw = req.body && req.body.parent_comment_id !== undefined ? req.body.parent_comment_id : req.body?.parentId;
  let parentId = null;
  if (parentRaw !== undefined && parentRaw !== null && parentRaw !== '') {
    const numericParent = Number(parentRaw);
    if (Number.isInteger(numericParent) && numericParent > 0) {
      const [[parentExists]] = await dbQuery('SELECT id FROM comments WHERE id = ? AND blog_id = ? LIMIT 1', [numericParent, blogId]);
      if (parentExists && parentExists.id) {
        parentId = numericParent;
      }
    }
  }

  // moderation: check banned words from settings.json (data/settings.json)
  try {
    let banned = [];
    if (fs.existsSync(settingsFile)) {
      const sraw = fs.readFileSync(settingsFile, 'utf-8') || '{}';
      const s = JSON.parse(sraw);
      if (Array.isArray(s.bannedWords)) banned = s.bannedWords.map(w => String(w).toLowerCase());
    }
    const normalize = t => (t || '').toString().toLowerCase();
    const combined = [name, email, contentRaw].map(normalize).join(' ');
    const found = banned.find(b => b && combined.includes(b));
    if (found) {
      // log rejection
      try {
        const logPath = path.join(__dirname, '..', 'data', 'moderation.log');
        const entry = `${new Date().toISOString()}\tBLOG:${blogId}\tREJECTED\treason:${found}\tname:${name}\temail:${email}\n`;
        fs.appendFileSync(logPath, entry);
      } catch (le) { console.error('moderation log failed', le); }
      return res.status(403).json({ error: 'Comment contains banned content' });
    }
  } catch (e) {
    console.error('moderation check error', e);
  }

  const status = 'approved';
  const imageField = (req.body && req.body.image) ? String(req.body.image) : '';
  const params = [blogId, parentId, imageField, name, email, contentRaw, status];
  let newId;
  if (useSqlite) {
    const [info] = await dbQuery('INSERT INTO comments (blog_id, parent_comment_id, image, author_name, author_email, content, status) VALUES (?, ?, ?, ?, ?, ?, ?)', params);
    newId = info.lastInsertRowid;
  } else {
    const [result] = await dbQuery('INSERT INTO comments (blog_id, parent_comment_id, image, author_name, author_email, content, status) VALUES (?, ?, ?, ?, ?, ?, ?)', params);
    newId = result.insertId;
  }

  const [[row]] = await dbQuery('SELECT id, blog_id, parent_comment_id, image, author_name, author_email, content, status, up_votes, down_votes, created_at, updated_at FROM comments WHERE id = ? LIMIT 1', [newId]);
  const comment = normalizeCommentRow(row);
  const safeComment = {
    id: comment?.id || newId,
    blog_id: comment?.blog_id || blogId,
    parent_comment_id: comment?.parent_comment_id || null,
    author_name: comment?.author_name || name,
    content: sanitizeCommentContent(comment?.content || ''),
    status: comment?.status || status,
    up_votes: Number(comment?.up_votes || 0),
    down_votes: Number(comment?.down_votes || 0),
    created_at: comment?.created_at || new Date().toISOString()
  };
  res.status(201).json({
    comment: safeComment,
    message: 'Comment published'
  });
}));

// search endpoint
app.get('/api/search', asyncHandler(async (req, res) => {
  try{
    const q = (req.query.q || '').toString().trim();
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const per_page = Math.max(1, Math.min(100, parseInt(req.query.per_page || '10', 10)));
    const offset = (page - 1) * per_page;
    if (!q) return res.json({ items: [], total: 0, page, per_page });
    const like = '%' + q.toLowerCase() + '%';
    const publishedClause = useSqlite ? 'published = 1' : 'published = 1';
    const where = `(LOWER(title) LIKE ? OR LOWER(summary) LIKE ? OR LOWER(content) LIKE ? OR LOWER(keywords) LIKE ?) AND ${publishedClause}`;

    // TODO: enable FULLTEXT once migrated
    const [countRows] = await dbQuery(`SELECT COUNT(*) as c FROM blogs WHERE ${where}`, [like, like, like, like]);
    const total = Array.isArray(countRows) && countRows[0] ? Number(countRows[0].c || 0) : 0;

    const [rows] = await dbQuery(`SELECT id, title, slug, summary, content, keywords, author, published, created_at FROM blogs WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [like, like, like, like, per_page, offset]);
    res.json({ items: rows || [], total, page, per_page });
  }catch(err){ console.error(err); res.status(500).json({ error: 'Search failed' }) }
}));

// sitemap.xml
app.get('/sitemap.xml', asyncHandler(async (req, res) => {
  try{
    const [rows] = await dbQuery('SELECT id, slug, updated_at, created_at FROM blogs');
    const base = (req.protocol || 'http') + '://' + req.get('host')
    const urls = (rows || []).map(r => {
      const loc = base + '/posts/' + (r.slug || r.id)
      const lastmod = r.updated_at || r.created_at || new Date().toISOString()
      return `<url><loc>${loc}</loc><lastmod>${new Date(lastmod).toISOString()}</lastmod><changefreq>weekly</changefreq></url>`
    }).join('\n')
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`
    res.header('Content-Type','application/xml').send(xml)
  }catch(err){ console.error(err); res.status(500).send('error') }
}))

// robots.txt
app.get('/robots.txt', (req, res) => {
  const base = (req.protocol || 'http') + '://' + req.get('host')
  const txt = `User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`;
  res.header('Content-Type','text/plain').send(txt)
})

// file upload
// standard upload (keeps original generated filename)
app.post('/api/upload', authMiddleware, upload.single('file'), (req, res)=>{
  try{
    if (!req.file) return res.status(400).json({ error: 'No file' })
    const rel = '/uploads/' + path.basename(req.file.filename)
    res.json({ url: rel })
  }catch(err){ console.error(err); res.status(500).json({ error: 'Upload failed' }) }
})

// upload and rename to a desired filename (useful to save as slug-based name)
app.post('/api/upload-rename', authMiddleware, upload.single('file'), (req, res)=>{
  try{
    if (!req.file) return res.status(400).json({ error: 'No file' })
    const desired = (req.body && req.body.filename) ? String(req.body.filename).trim() : '';
    if (!desired) {
      // fallback to normal behavior
      const rel = '/uploads/' + path.basename(req.file.filename)
      return res.json({ url: rel })
    }
    // sanitize desired filename: keep only safe chars and ensure extension preserved
    const originalExt = path.extname(req.file.originalname) || path.extname(req.file.filename) || '';
    const desiredExt = path.extname(desired) || '';
    const useExt = desiredExt || originalExt || '.jpg';
    const base = desiredExt ? path.basename(desired, desiredExt) : path.basename(desired, originalExt);
    const baseSafe = (base || 'file').replace(/[^a-z0-9\-_.]+/gi, '-').slice(0, 120);
    const targetName = baseSafe + useExt;
    const src = path.join(uploadDir, req.file.filename);
    const dst = path.join(uploadDir, targetName);
    try{
      // remove existing destination if present (overwrite)
      if (fs.existsSync(dst)) fs.unlinkSync(dst);
    }catch(e){}
    fs.renameSync(src, dst);
    const rel = '/uploads/' + targetName;
    res.json({ url: rel });
  }catch(err){ console.error('upload-rename failed', err); try{ if (req.file && req.file.filename) fs.unlinkSync(path.join(uploadDir, req.file.filename)) }catch(e){}; res.status(500).json({ error: 'Upload failed' }) }
})

// Admin-only: list uploaded files for debugging
app.get('/api/uploads-list', authMiddleware, (req, res) => {
  try {
    const files = fs.readdirSync(uploadDir || path.join(__dirname, '..', 'data', 'uploads'))
      .filter(f => fs.statSync(path.join(uploadDir, f)).isFile())
      .slice().sort()
    // return as server-relative URLs
    const urls = files.map(f => '/uploads/' + f)
    res.json({ files, urls })
  } catch (err) {
    console.error('uploads-list failed', err)
    res.status(500).json({ error: 'Failed to list uploads' })
  }
})

// Admin-only: rename an existing uploaded file to a desired filename inside uploads directory
app.post('/api/uploads/rename-existing', authMiddleware, (req, res) => {
  try {
    const current = req.body && req.body.current ? String(req.body.current) : '';
    const desiredRaw = req.body && req.body.desired ? String(req.body.desired) : '';
    if (!current || !desiredRaw) {
      return res.status(400).json({ error: 'Missing current or desired filename' });
    }
    const currentName = path.basename(current);
    const desiredName = path.basename(desiredRaw);
    if (!currentName || !desiredName) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    const currentPath = path.join(uploadDir, currentName);
    const ext = path.extname(desiredName) || path.extname(currentName) || '.jpg';
    const baseSafe = path.basename(desiredName, ext).replace(/[^a-z0-9\-_.]+/gi, '-').slice(0, 140) || 'file';
    const targetName = baseSafe + ext.toLowerCase();
    const desiredPath = path.join(uploadDir, targetName);
    if (!fs.existsSync(currentPath)) {
      return res.status(404).json({ error: 'Current file not found' });
    }
    if (fs.existsSync(desiredPath)) {
      try { fs.unlinkSync(desiredPath); } catch (e) {}
    }
    fs.renameSync(currentPath, desiredPath);
    res.json({ url: '/uploads/' + targetName });
  } catch (err) {
    console.error('rename-existing failed', err);
    res.status(500).json({ error: 'Failed to rename file' });
  }
})

// public upload for unauthenticated users (used by Request page)
app.post('/api/upload-public', upload.single('file'), (req, res)=>{
  try{
    if (!req.file) return res.status(400).json({ error: 'No file' })
    const rel = '/uploads/' + path.basename(req.file.filename)
    res.json({ url: rel })
  }catch(err){ console.error(err); res.status(500).json({ error: 'Upload failed' }) }
})

app.post('/api/blogs', authMiddleware, asyncHandler(async (req, res) => {
  const { title, summary, content, author, published, meta_title, meta_description, keywords, featured_image, slug: providedSlug, category, is_hero, hero_order } = req.body;
  const makeSlug = s => (s||'').toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const slug = providedSlug ? makeSlug(providedSlug) : (makeSlug(title) + '-' + Date.now());

  let categoryId = null;
  let categoryName = '';
  try {
    const ref = await resolveCategoryReference(category);
    categoryId = ref.categoryId;
    categoryName = ref.categoryName;
  } catch (err) {
    console.error('Category resolve error', err);
    return res.status(400).json({ error: 'Invalid category reference' });
  }

  const payload = [
    title,
    slug,
    summary,
    content,
    meta_title || '',
    meta_description || '',
    keywords || '',
    0,
    featured_image || '',
    categoryName || '',
    categoryId,
    is_hero ? 1 : 0,
    Number(hero_order || 0),
    author || (req.admin && req.admin.email) || '',
    published ? 1 : 0
  ];

  let newId;
  if (useSqlite) {
    const [info] = await dbQuery('INSERT INTO blogs (title, slug, summary, content, meta_title, meta_description, keywords, views, featured_image, category, category_id, is_hero, hero_order, author, published) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', payload);
    newId = info.lastInsertRowid;
  } else {
    const [result] = await dbQuery('INSERT INTO blogs (title, slug, summary, content, meta_title, meta_description, keywords, views, featured_image, category, category_id, is_hero, hero_order, author, published) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', payload);
    newId = result.insertId;
  }

  const [rows] = await dbQuery('SELECT * FROM blogs WHERE id = ? LIMIT 1', [newId]);
  const [countRow] = await dbQuery('SELECT COUNT(*) AS c FROM comments WHERE blog_id = ? AND status = ?', [newId, 'approved']);
  const totalComments = Array.isArray(countRow) ? Number((countRow[0] && countRow[0].c) || 0) : Number((countRow && countRow.c) || 0);
  const row = rows && rows[0] ? hydrateBlogRow(rows[0], req) : {};
  res.json({ ...row, comments_count: totalComments });
}));

// Public settings (used by frontend to determine intervals and visibility)
app.get('/api/public-settings', asyncHandler(async (req, res) => {
  const s = readSettings();
  res.json({
    heroInterval: Number(s.heroInterval || 30),
    stripInterval: Number(s.stripInterval || 30),
    showHero: s.showHero !== false,
    showStrip: s.showStrip !== false,
    homepage_meta_title: s.homepage_meta_title || '',
    homepage_meta_description: s.homepage_meta_description || '',
    request_meta_title: s.request_meta_title || '',
    request_meta_description: s.request_meta_description || '',
    site_keywords: s.site_keywords || '',
    amazon_affiliate_tag: s.amazon_affiliate_tag || '',
    amazon_affiliate_enabled: !!s.amazon_affiliate_enabled,
    amazon_affiliate_disclosure: s.amazon_affiliate_disclosure || ''
  });
}));

// Admin: read/update settings
app.get('/api/settings', authMiddleware, asyncHandler(async (req, res) => {
  const s = readSettings();
  res.json(s);
}));

app.put('/api/settings', authMiddleware, asyncHandler(async (req, res) => {
  const payload = req.body || {};
  const s = Object.assign(readSettings(), payload);
  writeSettings(s);
  res.json(s);
}));

app.put('/api/blogs/:id', authMiddleware, asyncHandler(async (req, res) => {
  const id = req.params.id;
  const { title, slug: providedSlug, summary, content, author, published, meta_title, meta_description, keywords, featured_image, category, is_hero, hero_order } = req.body;
  const makeSlug = s => (s||'').toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  const slug = providedSlug ? makeSlug(providedSlug) : makeSlug(title)
  const authorFinal = author || (req.admin && req.admin.email) || '';
  let categoryId = null;
  let categoryName = '';
  try {
    const ref = await resolveCategoryReference(category);
    categoryId = ref.categoryId;
    categoryName = ref.categoryName;
  } catch (err) {
    console.error('Category resolve error', err);
    return res.status(400).json({ error: 'Invalid category reference' });
  }

  await dbQuery('UPDATE blogs SET title = ?, slug = ?, summary = ?, content = ?, meta_title = ?, meta_description = ?, keywords = ?, featured_image = ?, category = ?, category_id = ?, is_hero = ?, hero_order = ?, author = ?, published = ? WHERE id = ?', [title, slug, summary, content, meta_title || '', meta_description || '', keywords || '', featured_image || '', categoryName || '', categoryId, is_hero ? 1 : 0, Number(hero_order||0), authorFinal, published ? 1 : 0, id]);
  const [rows] = await dbQuery('SELECT * FROM blogs WHERE id = ? LIMIT 1', [id]);
  const [countRow] = await dbQuery('SELECT COUNT(*) AS c FROM comments WHERE blog_id = ? AND status = ?', [id, 'approved']);
  const totalComments = Array.isArray(countRow) ? Number((countRow[0] && countRow[0].c) || 0) : Number((countRow && countRow.c) || 0);
  const row = rows && rows[0] ? hydrateBlogRow(rows[0], req) : {};
  res.json({ ...row, comments_count: totalComments });
}));

app.delete('/api/blogs/:id', authMiddleware, asyncHandler(async (req, res) => {
  const id = req.params.id;
  await dbQuery('DELETE FROM blogs WHERE id = ?', [id]);
  res.json({ deleted: true });
}));

app.get('/api/pages/slug/:slug', asyncHandler(async (req, res) => {
  const slugParam = req.params.slug;
  const slug = normalizePageSlug(slugParam);
  if (!slug) return res.status(404).json({ error: 'Not found' });
  const [rows] = await dbQuery('SELECT * FROM pages WHERE slug = ? AND published = 1 LIMIT 1', [slug]);
  if (!rows || rows.length === 0) return res.status(404).json({ error: 'Not found' });
  res.json(normalizePageRow(rows[0]));
}));

app.get('/api/pages', authMiddleware, asyncHandler(async (req, res) => {
  const search = (req.query.search || '').toString().trim().toLowerCase();
  let rows;
  if (search) {
    const like = `%${search}%`;
    const sql = "SELECT * FROM pages WHERE LOWER(title) LIKE ? OR LOWER(slug) LIKE ? OR LOWER(COALESCE(slug_input, '')) LIKE ? ORDER BY updated_at DESC";
    const params = [like, like, like];
    [rows] = await dbQuery(sql, params);
  } else {
    const sql = 'SELECT * FROM pages ORDER BY updated_at DESC';
    [rows] = await dbQuery(sql);
  }
  const list = Array.isArray(rows) ? rows : [];
  res.json(list.map(normalizePageRow));
}));

app.get('/api/pages/:id', authMiddleware, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid page id' });
  const [rows] = await dbQuery('SELECT * FROM pages WHERE id = ? LIMIT 1', [id]);
  if (!rows || rows.length === 0) return res.status(404).json({ error: 'Not found' });
  res.json(normalizePageRow(rows[0]));
}));

app.post('/api/pages', authMiddleware, asyncHandler(async (req, res) => {
  const body = req.body || {};
  const title = (body.title || '').toString().trim();
  if (!title) return res.status(400).json({ error: 'Title is required' });
  const rawSlugInput = body.slug !== undefined && body.slug !== null ? body.slug.toString().trim() : '';
  const providedSlug = normalizePageSlug(rawSlugInput);
  const titleFallback = normalizePageSlug(title.replace(/\s+/g, '-')) || slugify(title);
  const baseSlug = normalizePageSlug(providedSlug || titleFallback || 'page') || 'page';
  let candidate = baseSlug;
  let suffix = 2;
  let attempts = 0;
  while (candidate) {
    const [dupRows] = await dbQuery('SELECT id FROM pages WHERE slug = ? LIMIT 1', [candidate]);
    if (!dupRows || dupRows.length === 0) break;
    if (attempts++ > 200) {
      candidate = appendPageSlugSuffix(baseSlug, Date.now());
      break;
    }
    candidate = appendPageSlugSuffix(baseSlug, suffix++);
  }
  const slug = candidate || appendPageSlugSuffix(baseSlug, Date.now());
  const content = body.content || '';
  const metaTitle = body.meta_title || '';
  const metaDescription = body.meta_description || '';
  const keywords = body.keywords || '';
  const published = body.published ? 1 : 0;

  const params = [title, slug, rawSlugInput, content, metaTitle, metaDescription, keywords, published];
  let newId;
  if (useSqlite) {
    const [info] = await dbQuery('INSERT INTO pages (title, slug, slug_input, content, meta_title, meta_description, keywords, published) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', params);
    newId = info.lastInsertRowid;
  } else {
    const [result] = await dbQuery('INSERT INTO pages (title, slug, slug_input, content, meta_title, meta_description, keywords, published) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', params);
    newId = result.insertId;
  }
  const [rows] = await dbQuery('SELECT * FROM pages WHERE id = ? LIMIT 1', [newId]);
  const page = rows && rows[0] ? normalizePageRow(rows[0]) : normalizePageRow({ id: newId, title, slug, slug_input: rawSlugInput, content, meta_title: metaTitle, meta_description: metaDescription, keywords, published });
  res.status(201).json(page);
}));

app.put('/api/pages/:id', authMiddleware, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid page id' });
  const body = req.body || {};
  const title = (body.title || '').toString().trim();
  if (!title) return res.status(400).json({ error: 'Title is required' });
  const rawSlugInput = body.slug !== undefined && body.slug !== null ? body.slug.toString().trim() : '';
  const providedSlug = normalizePageSlug(rawSlugInput);
  const titleFallback = normalizePageSlug(title.replace(/\s+/g, '-')) || slugify(title);
  const baseSlug = normalizePageSlug(providedSlug || titleFallback || 'page') || 'page';
  let candidate = baseSlug;
  let suffix = 2;
  let attempts = 0;
  while (candidate) {
    const [dupRows] = await dbQuery('SELECT id FROM pages WHERE slug = ? AND id <> ? LIMIT 1', [candidate, id]);
    if (!dupRows || dupRows.length === 0) break;
    if (attempts++ > 200) {
      candidate = appendPageSlugSuffix(baseSlug, Date.now());
      break;
    }
    candidate = appendPageSlugSuffix(baseSlug, suffix++);
  }
  const slug = candidate || appendPageSlugSuffix(baseSlug, Date.now());
  const content = body.content || '';
  const metaTitle = body.meta_title || '';
  const metaDescription = body.meta_description || '';
  const keywords = body.keywords || '';
  const published = body.published ? 1 : 0;

  if (useSqlite) {
    await dbQuery("UPDATE pages SET title = ?, slug = ?, slug_input = ?, content = ?, meta_title = ?, meta_description = ?, keywords = ?, published = ?, updated_at = datetime('now') WHERE id = ?", [title, slug, rawSlugInput, content, metaTitle, metaDescription, keywords, published, id]);
  } else {
    await dbQuery('UPDATE pages SET title = ?, slug = ?, slug_input = ?, content = ?, meta_title = ?, meta_description = ?, keywords = ?, published = ?, updated_at = NOW() WHERE id = ?', [title, slug, rawSlugInput, content, metaTitle, metaDescription, keywords, published, id]);
  }

  const [rows] = await dbQuery('SELECT * FROM pages WHERE id = ? LIMIT 1', [id]);
  if (!rows || rows.length === 0) return res.status(404).json({ error: 'Not found' });
  res.json(normalizePageRow(rows[0]));
}));

app.delete('/api/pages/:id', authMiddleware, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid page id' });
  await dbQuery('DELETE FROM pages WHERE id = ?', [id]);
  res.json({ deleted: true });
}));

// bump a blog to make it recent (sets created_at to now)
app.post('/api/blogs/:id/bump', authMiddleware, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid blog id' });
  try {
    if (useSqlite) {
      await dbQuery("UPDATE blogs SET created_at = datetime('now') WHERE id = ?", [id]);
    } else {
      await dbQuery('UPDATE blogs SET created_at = NOW() WHERE id = ?', [id]);
    }
    const [rows] = await dbQuery('SELECT * FROM blogs WHERE id = ? LIMIT 1', [id]);
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    console.error('bump failed', e);
    res.status(500).json({ error: 'Failed to bump blog' });
  }
}));

app.post('/api/blogs/:id/vote', asyncHandler(async (req, res) => {
  const blogId = Number(req.params.id);
  if (!Number.isInteger(blogId) || blogId <= 0) {
    return res.status(400).json({ error: 'Invalid blog id' });
  }

  const directionRaw = (req.body && req.body.direction) ? String(req.body.direction).toLowerCase() : '';
  const direction = directionRaw === 'down' ? 'down' : 'up';
  const column = direction === 'down' ? 'down_votes' : 'up_votes';

  const undo = req.body && (req.body.undo === true || String(req.body.undo) === 'true')
  if (undo) {
    if (useSqlite) {
      await dbQuery(`UPDATE blogs SET ${column} = CASE WHEN COALESCE(${column},0) > 0 THEN COALESCE(${column},0) - 1 ELSE 0 END WHERE id = ?`, [blogId]);
    } else {
      await dbQuery(`UPDATE blogs SET ${column} = GREATEST(COALESCE(${column},0) - 1, 0) WHERE id = ?`, [blogId]);
    }
  } else {
    const updateSql = `UPDATE blogs SET ${column} = COALESCE(${column}, 0) + 1 WHERE id = ?`;
    await dbQuery(updateSql, [blogId]);
  }

  const [[row]] = await dbQuery('SELECT up_votes, down_votes FROM blogs WHERE id = ? LIMIT 1', [blogId]);
  if (!row) return res.status(404).json({ error: 'Blog not found' });
  res.json({
    id: blogId,
    up_votes: Number(row.up_votes || 0),
    down_votes: Number(row.down_votes || 0)
  });
}));

app.post('/api/comments/:id/vote', asyncHandler(async (req, res) => {
  const commentId = Number(req.params.id);
  if (!Number.isInteger(commentId) || commentId <= 0) {
    return res.status(400).json({ error: 'Invalid comment id' });
  }

  const directionRaw = (req.body && req.body.direction) ? String(req.body.direction).toLowerCase() : '';
  const direction = directionRaw === 'down' ? 'down' : 'up';
  const column = direction === 'down' ? 'down_votes' : 'up_votes';

  const undo = req.body && (req.body.undo === true || String(req.body.undo) === 'true')
  let result
  if (undo) {
    if (useSqlite) {
      const [r] = await dbQuery(`UPDATE comments SET ${column} = CASE WHEN COALESCE(${column},0) > 0 THEN COALESCE(${column},0) - 1 ELSE 0 END WHERE id = ?`, [commentId]);
      result = r
    } else {
      const [r] = await dbQuery(`UPDATE comments SET ${column} = GREATEST(COALESCE(${column},0) - 1, 0) WHERE id = ?`, [commentId]);
      result = r
    }
  } else {
    const updateSql = `UPDATE comments SET ${column} = COALESCE(${column}, 0) + 1 WHERE id = ?`;
    const [r] = await dbQuery(updateSql, [commentId]);
    result = r
  }
  const affected = useSqlite ? (result && result.changes ? result.changes : 0) : (result && typeof result.affectedRows === 'number' ? result.affectedRows : 0);
  if (!affected) {
    return res.status(404).json({ error: 'Comment not found' });
  }

  const [[row]] = await dbQuery('SELECT up_votes, down_votes FROM comments WHERE id = ? LIMIT 1', [commentId]);
  if (!row) return res.status(404).json({ error: 'Comment not found' });
  res.json({
    id: commentId,
    up_votes: Number(row.up_votes || 0),
    down_votes: Number(row.down_votes || 0)
  });
}));

// Brand requests: public submit
app.post('/api/brand-requests', asyncHandler(async (req, res) => {
  let { name, mobile, title, description, image } = req.body;
  if (!name || !mobile || !description) return res.status(400).json({ error: 'Missing fields' });
  // If the client provided a data URL or remote URL, attempt to save locally and replace `image` with server-relative URL
  try{
    const saved = await saveImageFromString(image || '');
    if (saved) image = saved;
  }catch(e){ console.warn('Could not save image for brand request', e && e.message ? e.message : e) }

  const params = [name, mobile, title || '', description, image || '', 'open'];
  let newId;
  if (useSqlite) {
    const [info] = await dbQuery('INSERT INTO brand_requests (name, mobile, title, description, image, status) VALUES (?, ?, ?, ?, ?, ?)', params);
    newId = info.lastInsertRowid;
  } else {
    const [result] = await dbQuery('INSERT INTO brand_requests (name, mobile, title, description, image, status) VALUES (?, ?, ?, ?, ?, ?)', params);
    newId = result.insertId;
  }
  const [rows] = await dbQuery('SELECT * FROM brand_requests WHERE id = ? LIMIT 1', [newId]);
  res.json(rows[0]);
}));

// Admin: list brand requests
app.get('/api/brand-requests', authMiddleware, asyncHandler(async (req, res) => {
  const [rows] = await dbQuery('SELECT * FROM brand_requests ORDER BY created_at DESC');
  res.json(rows);
}));

// Admin: update brand request (e.g., mark solved)
app.put('/api/brand-requests/:id', authMiddleware, asyncHandler(async (req, res) => {
  const id = req.params.id;
  const { status } = req.body;
  // Use MySQL-compatible DATETIME/TIMESTAMP format (YYYY-MM-DD HH:MM:SS) to avoid incorrect datetime value errors
  const resolved_at = status === 'solved' ? (new Date().toISOString().slice(0,19).replace('T',' ')) : null;
  console.log('[PUT] /api/brand-requests/', id, 'status=', status, 'resolved_at=', resolved_at);
  try {
    await dbQuery('UPDATE brand_requests SET status = ?, resolved_at = ? WHERE id = ?', [status, resolved_at, id]);
    const [rows] = await dbQuery('SELECT * FROM brand_requests WHERE id = ? LIMIT 1', [id]);
    try{ fs.appendFileSync(path.join(__dirname, '..', 'data', 'brand_requests_update.log'), `[OK] ${new Date().toISOString()} id=${id} status=${status}\n`); }catch(e){}
    return res.json(rows[0]);
  } catch (err) {
    const msg = (err && err.stack) ? err.stack : String(err);
    console.error('Error updating brand request', id, msg);
    try{ fs.appendFileSync(path.join(__dirname, '..', 'data', 'brand_requests_update.log'), `[ERR] ${new Date().toISOString()} id=${id} err=${String(msg)}\n`); }catch(e){}
    return res.status(500).json({ error: 'Failed to update brand request' });
  }
}));

// Admin: delete brand request
app.delete('/api/brand-requests/:id', authMiddleware, asyncHandler(async (req, res) => {
  const id = req.params.id;
  await dbQuery('DELETE FROM brand_requests WHERE id = ?', [id]);
  res.json({ deleted: true });
}));

app.get('/api/admin/comments', authMiddleware, asyncHandler(async (req, res) => {
  const conditions = [];
  const params = [];
  const blogIdRaw = req.query.blog_id;
  if (blogIdRaw !== undefined) {
    const blogId = Number(blogIdRaw);
    if (!Number.isNaN(blogId) && blogId > 0) {
      conditions.push('c.blog_id = ?');
      params.push(blogId);
    }
  }
  const statusRaw = req.query.status ? String(req.query.status).toLowerCase() : '';
  const allowedStatuses = new Set(['approved', 'pending', 'rejected']);
  if (allowedStatuses.has(statusRaw)) {
    conditions.push('c.status = ?');
    params.push(statusRaw);
  }

  let sql = `SELECT c.id, c.blog_id, c.parent_comment_id, c.image, c.author_name, c.author_email, c.content, c.status, c.up_votes, c.down_votes, c.created_at, c.updated_at, b.title AS blog_title
    FROM comments c
    LEFT JOIN blogs b ON b.id = c.blog_id`;
  if (conditions.length) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  sql += ' ORDER BY c.created_at DESC LIMIT 500';

  const [rows] = await dbQuery(sql, params);
  const items = (rows || []).map(row => {
    const comment = normalizeCommentRow(row);
    return {
      ...comment,
      blog_title: row.blog_title || '',
      content: sanitizeCommentContent(comment.content),
      image: row.image || '',
      up_votes: Number(comment.up_votes || 0),
      down_votes: Number(comment.down_votes || 0)
    };
  });
  res.json(items);
}));

app.put('/api/admin/comments/:id', authMiddleware, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid comment id' });
  }
  const statusRaw = req.body && req.body.status ? String(req.body.status).toLowerCase() : '';
  const allowedStatuses = ['approved', 'pending', 'rejected'];
  if (!allowedStatuses.includes(statusRaw)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const updateSql = useSqlite
    ? 'UPDATE comments SET status = ?, updated_at = datetime(\'now\') WHERE id = ?'
    : 'UPDATE comments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
  const [result] = await dbQuery(updateSql, [statusRaw, id]);
  const affected = useSqlite ? (result && result.changes ? result.changes : 0) : (result && typeof result.affectedRows === 'number' ? result.affectedRows : 0);
  if (!affected) {
    return res.status(404).json({ error: 'Comment not found' });
  }

  const [[row]] = await dbQuery('SELECT id, blog_id, parent_comment_id, image, author_name, author_email, content, status, up_votes, down_votes, created_at, updated_at FROM comments WHERE id = ? LIMIT 1', [id]);
  const comment = normalizeCommentRow(row);
  res.json({
    ...comment,
    content: sanitizeCommentContent(comment?.content || ''),
    up_votes: Number(comment.up_votes || 0),
    down_votes: Number(comment.down_votes || 0)
  });
}));

app.delete('/api/admin/comments/:id', authMiddleware, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid comment id' });
  }
  await dbQuery('DELETE FROM comments WHERE id = ?', [id]);
  res.json({ deleted: true });
}));

// Product branding: public list
app.get('/api/brands', asyncHandler(async (req, res) => {
  const activeCondition = 'active = 1';
  const [rows] = await dbQuery(`SELECT * FROM product_brands WHERE ${activeCondition} ORDER BY position ASC, created_at DESC`);
  res.json(rows || []);
}));

// Public: increment and return blog views (hit counter)
app.post('/api/hit/blog/:id', asyncHandler(async (req, res) => {
  const id = req.params.id;
  await dbQuery('UPDATE blogs SET views = COALESCE(views,0) + 1 WHERE id = ?', [id]);
  const [rows] = await dbQuery('SELECT views FROM blogs WHERE id = ? LIMIT 1', [id]);
  const v = rows && rows[0] ? Number(rows[0].views || 0) : 0;
  res.json({ id, views: v });
}));

// Public: increment and return brand views (product_brands)
app.post('/api/hit/brand/:id', asyncHandler(async (req, res) => {
  const id = req.params.id;
  await dbQuery('UPDATE product_brands SET views = COALESCE(views,0) + 1 WHERE id = ?', [id]);
  const [rows] = await dbQuery('SELECT views FROM product_brands WHERE id = ? LIMIT 1', [id]);
  const v = rows && rows[0] ? Number(rows[0].views || 0) : 0;
  res.json({ id, views: v });
}));

// Brand strip (horizontal) - public list
app.get('/api/brand-strip', asyncHandler(async (req, res) => {
  const [rows] = await dbQuery('SELECT * FROM brand_strip WHERE active = 1 ORDER BY position ASC, created_at DESC');
  res.json(rows || []);
}));

// Admin: create brand strip item
app.post('/api/brand-strip', authMiddleware, asyncHandler(async (req, res) => {
  let { image, link, position, active, title, price_text, slug, h1, h2, h3, meta_title, meta_description, keywords } = req.body;
  const makeSlug = s => (s||'').toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  if ((!image || !String(image).trim()) && slug) {
    const generated = makeSlug(slug);
    image = '/uploads/' + generated + '.jpg';
  }
  if (!image) return res.status(400).json({ error: 'Missing image or slug to auto-generate image' });
  const params = [image || '', link || '', slug || '', title || '', price_text || '', h1 || '', h2 || '', h3 || '', meta_title || '', meta_description || '', keywords || '', Number(position || 0), active ? 1 : 0];
  let newId;
  if (useSqlite) {
    const [info] = await dbQuery('INSERT INTO brand_strip (image, link, slug, title, price_text, h1, h2, h3, meta_title, meta_description, keywords, position, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', params);
    newId = info.lastInsertRowid;
  } else {
    const [result] = await dbQuery('INSERT INTO brand_strip (image, link, slug, title, price_text, h1, h2, h3, meta_title, meta_description, keywords, position, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', params);
    newId = result.insertId;
  }
  const [rows] = await dbQuery('SELECT * FROM brand_strip WHERE id = ? LIMIT 1', [newId]);
  res.json(rows[0]);
}));

// Admin: update brand strip item
app.put('/api/brand-strip/:id', authMiddleware, asyncHandler(async (req, res) => {
  const id = req.params.id;
  let { image, link, position, active, title, price_text, slug, h1, h2, h3, meta_title, meta_description, keywords } = req.body;
  const makeSlug = s => (s||'').toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  if ((!image || !String(image).trim()) && slug) {
    const generated = makeSlug(slug);
    image = '/uploads/' + generated + '.jpg';
  }
  await dbQuery('UPDATE brand_strip SET image = ?, link = ?, slug = ?, title = ?, price_text = ?, h1 = ?, h2 = ?, h3 = ?, meta_title = ?, meta_description = ?, keywords = ?, position = ?, active = ? WHERE id = ?', [image || '', link || '', slug || '', title || '', price_text || '', h1 || '', h2 || '', h3 || '', meta_title || '', meta_description || '', keywords || '', Number(position||0), active ? 1 : 0, id]);
  const [rows] = await dbQuery('SELECT * FROM brand_strip WHERE id = ? LIMIT 1', [id]);
  res.json(rows[0]);
}));

// Admin: delete brand strip item
app.delete('/api/brand-strip/:id', authMiddleware, asyncHandler(async (req, res) => {
  const id = req.params.id;
  await dbQuery('DELETE FROM brand_strip WHERE id = ?', [id]);
  res.json({ deleted: true });
}));

// Admin: overview / dashboard counts
app.get('/api/admin/overview', authMiddleware, asyncHandler(async (req, res) => {
  try {
    const [[blogsCountRow]] = await dbQuery('SELECT COUNT(*) AS c FROM blogs');
    const [[totalViewsRow]] = await dbQuery('SELECT COALESCE(SUM(views),0) AS c FROM blogs');
    const [[commentsCountRow]] = await dbQuery("SELECT COUNT(*) AS c FROM comments");
    const [[stripsCountRow]] = await dbQuery('SELECT COUNT(*) AS c FROM brand_strip');
    const [[brandsCountRow]] = await dbQuery('SELECT COUNT(*) AS c FROM product_brands');
    const [[pendingRequestsRow]] = await dbQuery("SELECT COUNT(*) AS c FROM brand_requests WHERE status = 'open'");

    const [trendingRows] = await dbQuery(`SELECT b.id, b.title, b.slug, COALESCE(b.views,0) AS views, (SELECT COUNT(*) FROM comments WHERE blog_id = b.id AND status = 'approved') AS comments_count FROM blogs b ORDER BY COALESCE(b.views,0) DESC LIMIT 5`);

    res.json({
      blogs_count: Number((blogsCountRow && blogsCountRow.c) || 0),
      total_blog_views: Number((totalViewsRow && totalViewsRow.c) || 0),
      comments_count: Number((commentsCountRow && commentsCountRow.c) || 0),
      strips_count: Number((stripsCountRow && stripsCountRow.c) || 0),
      brands_count: Number((brandsCountRow && brandsCountRow.c) || 0),
      brand_requests_pending: Number((pendingRequestsRow && pendingRequestsRow.c) || 0),
      trending_blogs: Array.isArray(trendingRows) ? trendingRows : []
    });
  } catch (err) {
    console.error('overview failed', err && err.message ? err.message : err);
    res.status(500).json({ error: 'Failed to fetch overview' });
  }
}));

// Admin: list all categories (manage)
app.get('/api/admin/categories', authMiddleware, asyncHandler(async (req, res) => {
  const [rows] = await dbQuery('SELECT * FROM categories ORDER BY position ASC');
  res.json(rows || []);
}));

// Admin: create category
app.post('/api/categories', authMiddleware, asyncHandler(async (req, res) => {
  const { name, slug: providedSlug, description, meta_title, meta_description, keywords, position, active } = req.body;
  if (!name) return res.status(400).json({ error: 'Missing name' });
  const makeSlug = s => (s||'').toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const slug = providedSlug ? makeSlug(providedSlug) : makeSlug(name);
  const params = [name, slug, description || '', meta_title || '', meta_description || '', keywords || '', Number(position || 0), active ? 1 : 0];
  let newId;
  if (useSqlite) {
    const [info] = await dbQuery('INSERT INTO categories (name, slug, description, meta_title, meta_description, keywords, position, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', params);
    newId = info.lastInsertRowid;
  } else {
    const [result] = await dbQuery('INSERT INTO categories (name, slug, description, meta_title, meta_description, keywords, position, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', params);
    newId = result.insertId;
  }
  const [rows] = await dbQuery('SELECT * FROM categories WHERE id = ? LIMIT 1', [newId]);
  res.json(rows[0]);
}));

// Admin: update category
app.put('/api/categories/:id', authMiddleware, asyncHandler(async (req, res) => {
  const id = req.params.id;
  const { name, slug: providedSlug, description, meta_title, meta_description, keywords, position, active } = req.body;
  if (!name) return res.status(400).json({ error: 'Missing name' });
  const makeSlug = s => (s||'').toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const slug = providedSlug ? makeSlug(providedSlug) : makeSlug(name);
  await dbQuery('UPDATE categories SET name = ?, slug = ?, description = ?, meta_title = ?, meta_description = ?, keywords = ?, position = ?, active = ? WHERE id = ?', [name, slug, description || '', meta_title || '', meta_description || '', keywords || '', Number(position||0), active ? 1 : 0, id]);
  const [rows] = await dbQuery('SELECT * FROM categories WHERE id = ? LIMIT 1', [id]);
  res.json(rows[0]);
}));

// Admin: delete category
app.delete('/api/categories/:id', authMiddleware, asyncHandler(async (req, res) => {
  const id = req.params.id;
  await dbQuery('DELETE FROM categories WHERE id = ?', [id]);
  res.json({ deleted: true });
}));

// Public news ticker: list active news
app.get('/api/news', asyncHandler(async (req, res) => {
  const [rows] = await dbQuery('SELECT * FROM news WHERE active = 1 ORDER BY position ASC, created_at DESC');
  res.json(rows || []);
}));

// Admin: create news item
app.post('/api/news', authMiddleware, asyncHandler(async (req, res) => {
  const { title, link, position, active } = req.body;
  if (!title) return res.status(400).json({ error: 'Missing title' });
  const params = [title || '', link || '', Number(position || 0), active ? 1 : 0];
  let newId;
  if (useSqlite) {
    const [info] = await dbQuery('INSERT INTO news (title, link, position, active) VALUES (?, ?, ?, ?)', params);
    newId = info.lastInsertRowid;
  } else {
    const [result] = await dbQuery('INSERT INTO news (title, link, position, active) VALUES (?, ?, ?, ?)', params);
    newId = result.insertId;
  }
  const [rows] = await dbQuery('SELECT * FROM news WHERE id = ? LIMIT 1', [newId]);
  res.json(rows[0]);
}));

// Admin: update news item
app.put('/api/news/:id', authMiddleware, asyncHandler(async (req, res) => {
  const id = req.params.id;
  const { title, link, position, active } = req.body;
  await dbQuery('UPDATE news SET title = ?, link = ?, position = ?, active = ? WHERE id = ?', [title || '', link || '', Number(position||0), active ? 1 : 0, id]);
  const [rows] = await dbQuery('SELECT * FROM news WHERE id = ? LIMIT 1', [id]);
  res.json(rows[0]);
}));

// Admin: delete news item
app.delete('/api/news/:id', authMiddleware, asyncHandler(async (req, res) => {
  const id = req.params.id;
  await dbQuery('DELETE FROM news WHERE id = ?', [id]);
  res.json({ deleted: true });
}));

// Admin: create brand
app.post('/api/brands', authMiddleware, asyncHandler(async (req, res) => {
  const { title, image, link, description, meta_title, meta_description, keywords, active, position } = req.body;
  if (!title) return res.status(400).json({ error: 'Missing title' });
  const params = [title, image || '', link || '', description || '', meta_title || '', meta_description || '', keywords || '', active ? 1 : 0, Number(position || 0)];
  let newId;
  if (useSqlite) {
    const [info] = await dbQuery('INSERT INTO product_brands (title, image, link, description, meta_title, meta_description, keywords, active, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', params);
    newId = info.lastInsertRowid;
  } else {
    const [result] = await dbQuery('INSERT INTO product_brands (title, image, link, description, meta_title, meta_description, keywords, active, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', params);
    newId = result.insertId;
  }
  const [rows] = await dbQuery('SELECT * FROM product_brands WHERE id = ? LIMIT 1', [newId]);
  res.json(rows[0]);
}));

// Admin: update brand
app.put('/api/brands/:id', authMiddleware, asyncHandler(async (req, res) => {
  const id = req.params.id;
  const { title, image, link, description, meta_title, meta_description, keywords, active, position } = req.body;
  await dbQuery('UPDATE product_brands SET title = ?, image = ?, link = ?, description = ?, meta_title = ?, meta_description = ?, keywords = ?, active = ?, position = ? WHERE id = ?', [title || '', image || '', link || '', description || '', meta_title || '', meta_description || '', keywords || '', active ? 1 : 0, Number(position||0), id]);
  const [rows] = await dbQuery('SELECT * FROM product_brands WHERE id = ? LIMIT 1', [id]);
  res.json(rows[0]);
}));

// Admin: delete brand
app.delete('/api/brands/:id', authMiddleware, asyncHandler(async (req, res) => {
  const id = req.params.id;
  await dbQuery('DELETE FROM product_brands WHERE id = ?', [id]);
  res.json({ deleted: true });
}));

// Public: submit a brand entry for admin review (inactive by default)
app.post('/api/brands-public', asyncHandler(async (req, res) => {
  const { title, image, link, description, meta_title, meta_description, keywords } = req.body;
  if (!title || !description) return res.status(400).json({ error: 'Missing title or description' });
  const params = [title || '', image || '', link || '', description || '', meta_title || '', meta_description || '', keywords || '', 0, 0];
  let newId;
  if (useSqlite) {
    const [info] = await dbQuery('INSERT INTO product_brands (title, image, link, description, meta_title, meta_description, keywords, active, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', params);
    newId = info.lastInsertRowid;
  } else {
    const [result] = await dbQuery('INSERT INTO product_brands (title, image, link, description, meta_title, meta_description, keywords, active, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', params);
    newId = result.insertId;
  }
  const [rows] = await dbQuery('SELECT * FROM product_brands WHERE id = ? LIMIT 1', [newId]);
  res.json(rows[0]);
}));

app.get('/', (req, res) => res.json({ ok: true }));

// Serve a simple HTML page with meta tags for social crawlers
app.get('/posts/:slug', asyncHandler(async (req, res) => {
  const slug = req.params.slug;
  const param = slug;
  const [rows] = await dbQuery('SELECT * FROM blogs WHERE slug = ? OR id = ? LIMIT 1', [param, param]);
  const row = rows && rows.length ? rows[0] : null;

  if (!row) {
    // If no blog found, fallback to the frontend index so SPA can handle route
    const indexPath = path.join(__dirname, '..', 'frontend', 'index.html');
    if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
    return res.status(404).send('Not found');
  }

  const strip = (s) => (s || '').replace(/<[^>]*>/g,'').slice(0,160);
  const title = row.meta_title || row.title || 'StudyGKHub';
  const desc = row.meta_description || strip(row.content || '');
  const host = (req.protocol || 'http') + '://' + req.get('host');
  const url = host + '/posts/' + (row.slug || row.id);
  const image = row.featured_image ? (String(row.featured_image).startsWith('http') ? row.featured_image : host + row.featured_image) : '';

  const html = `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(desc)}"/><link rel="canonical" href="${escapeHtml(url)}"/>` +
    `<meta property="og:type" content="article"/><meta property="og:title" content="${escapeHtml(title)}"/><meta property="og:description" content="${escapeHtml(desc)}"/><meta property="og:url" content="${escapeHtml(url)}"/>` +
    (image ? `<meta property="og:image" content="${escapeHtml(image)}"/>` : '') +
    `<meta name="twitter:card" content="summary_large_image"/><meta name="twitter:title" content="${escapeHtml(title)}"/><meta name="twitter:description" content="${escapeHtml(desc)}"/>` +
    (image ? `<meta name="twitter:image" content="${escapeHtml(image)}"/>` : '') +
    `</head><body><div id="root"></div><script>window.__SSR_BLOG = ${JSON.stringify(row)};</script><script type="module" src="/src/main.jsx"></script></body></html>`;

  res.header('Content-Type','text/html').send(html);
}));

// Consistent JSON error responses (and prevents crashes from unhandled async errors)
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  if (err && (err.code === 'ER_DATA_TOO_LONG' || err.errno === 1406)) {
    return res.status(413).json({ error: 'Content too large for database. Try uploading images (not base64) or reduce content size.' });
  }
  return res.status(500).json({ error: 'Internal Server Error' });
});

initDb().then(() => {
  app.listen(PORT, () => {
    console.log('Server running on port', PORT);
  });
}).catch(err => {
  console.error('Failed to initialize DB', err);
  process.exit(1);
});
