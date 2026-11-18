CREATE DATABASE IF NOT EXISTS minimarket CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE minimarket;
CREATE TABLE IF NOT EXISTS products (
 id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(120) NOT NULL,
 price INT NOT NULL, stock INT NOT NULL,
 CONSTRAINT chk_price CHECK(price >= 0),CONSTRAINT chk_stock CHECK(stock >= 0)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS orders (
 id INT AUTO_INCREMENT PRIMARY KEY,
 status ENUM('pendiente','en_preparacion','completado') NOT NULL DEFAULT 'pendiente',
 total INT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS order_items (
 id INT AUTO_INCREMENT PRIMARY KEY,order_id INT NOT NULL,product_id INT NOT NULL,
 quantity INT NOT NULL,unit_price INT NOT NULL,
 FOREIGN KEY(order_id) REFERENCES orders(id), FOREIGN KEY(product_id) REFERENCES products(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS stock_movements (
 id INT AUTO_INCREMENT PRIMARY KEY,product_id INT NOT NULL,
 stock_before INT NOT NULL,stock_after INT NOT NULL,
 reason ENUM('pedido','ajuste') NOT NULL,order_id INT NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(product_id) REFERENCES products(id)
) ENGINE=InnoDB;
INSERT INTO products(name,price,stock)
SELECT 'Leche 1 L',1300,20 WHERE NOT EXISTS(SELECT 1 FROM products);
