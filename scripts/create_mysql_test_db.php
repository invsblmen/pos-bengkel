<?php
// Usage: php scripts/create_mysql_test_db.php
$host = getenv('DB_HOST') ?: '127.0.0.1';
$port = getenv('DB_PORT') ?: '3306';
$user = getenv('DB_USERNAME') ?: 'root';
$pass = getenv('DB_PASSWORD') ?: '';
$name = getenv('DB_DATABASE') ?: 'pos_bengkel_test';

try {
    $dsn = sprintf('mysql:host=%s;port=%s', $host, $port);
    $pdo = new PDO($dsn, $user, $pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $sql = sprintf('CREATE DATABASE IF NOT EXISTS `%s` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci', $name);
    $pdo->exec($sql);
    echo "Created database: $name\n";
    exit(0);
} catch (PDOException $e) {
    fwrite(STDERR, "Failed to create database: " . $e->getMessage() . "\n");
    exit(2);
}
