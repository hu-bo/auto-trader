-- partition_registry 分表注册表
CREATE TABLE IF NOT EXISTS partition_registry (
    id BIGSERIAL PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL UNIQUE,
    year INT NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT NOW()
);
