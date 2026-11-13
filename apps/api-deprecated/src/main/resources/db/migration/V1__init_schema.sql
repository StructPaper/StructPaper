-- StructPaper V1 Schema Migration
-- Compatible with both H2 (dev/test) and MySQL 8+ (production)

CREATE TABLE IF NOT EXISTS manuscripts (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    title VARCHAR(500),
    journal_id VARCHAR(64),
    rev INT NOT NULL DEFAULT 1,
    doc_json LONGTEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS revisions (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    manuscript_id VARCHAR(64) NOT NULL,
    rev INT NOT NULL,
    summary VARCHAR(500),
    doc_json LONGTEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS assets (
    sha256 VARCHAR(64) NOT NULL PRIMARY KEY,
    mime_type VARCHAR(100),
    size_bytes BIGINT NOT NULL,
    file_path VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_revisions_manuscript_id ON revisions(manuscript_id);
