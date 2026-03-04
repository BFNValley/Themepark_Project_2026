CREATE TABLE Sales_Line_Item(
    transaction_id INT,
    product_id INT,
    quantity INT CHECK (quantity > 0),
    price_at_time DECIMAL,
    PRIMARY KEY (transaction_id, product_id),
    FOREIGN KEY (transaction_id) REFERENCES Sales_Transaction(transaction_id),
    FOREIGN KEY (product_id) REFERENCES Gift_Shop(product_id)
);