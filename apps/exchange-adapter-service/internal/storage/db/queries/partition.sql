-- name: GetPartitionRegistry :many
SELECT table_name, year, created_at
FROM partition_registry
ORDER BY year;

-- name: InsertPartitionRegistry :exec
INSERT INTO partition_registry (table_name, year)
VALUES ($1, $2)
ON CONFLICT (table_name) DO NOTHING;

-- name: GetPartitionByYear :one
SELECT table_name, year, created_at
FROM partition_registry
WHERE year = $1;
