CREATE TABLE IF NOT EXISTS sales (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    product VARCHAR(120) NOT NULL,
    customer VARCHAR(120) NOT NULL,
    quantity INT UNSIGNED NOT NULL CHECK (quantity BETWEEN 1 AND 9999),
    unit_price_cents INT UNSIGNED NOT NULL CHECK (unit_price_cents BETWEEN 1 AND 99999999),
    sold_on DATE NOT NULL,
    INDEX sales_by_date (sold_on DESC, id DESC)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
