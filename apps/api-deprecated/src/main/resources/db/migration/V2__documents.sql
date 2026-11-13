-- Word-like documents: one row per user document (name, status, latest content) plus export artifacts.
-- Compatible with H2 (dev/test) and MySQL 8+.

CREATE TABLE IF NOT EXISTS documents (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    journal_id VARCHAR(64),
    status VARCHAR(32) NOT NULL DEFAULT 'draft',
    rev INT NOT NULL DEFAULT 1,
    doc_json LONGTEXT,
    snapshot_key VARCHAR(300),
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_documents_updated ON documents(deleted, updated_at);

CREATE TABLE IF NOT EXISTS document_exports (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    document_id VARCHAR(64) NOT NULL,
    format VARCHAR(16) NOT NULL,
    file_name VARCHAR(300) NOT NULL,
    object_key VARCHAR(400) NOT NULL,
    size_bytes BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_document_exports_doc ON document_exports(document_id);
