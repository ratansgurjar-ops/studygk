-- Initialize studygk database
CREATE DATABASE IF NOT EXISTS studygk;
USE studygk;
-- Add initial table as example
CREATE TABLE IF NOT EXISTS example (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
