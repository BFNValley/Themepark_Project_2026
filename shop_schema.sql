CREATE TABLE Product (
  ProductID INT PRIMARY KEY,
  Name VARCHAR(50),
  Price DECIMAL(5,2),
  Stock INT
);

CREATE TABLE Orders (
  OrderID INT PRIMARY KEY,
  CustomerID INT,
  OrderDate DATE
);

CREATE TABLE OrderItem (
  OrderID INT,
  ProductID INT,
  Quantity INT,
  PRIMARY KEY (OrderID, ProductID),
  FOREIGN KEY (OrderID) REFERENCES Orders(OrderID),
  FOREIGN KEY (ProductID) REFERENCES Product(ProductID)
);

-- Trigger to update stock after purchase
CREATE TRIGGER update_stock_after_purchase
AFTER INSERT ON OrderItem
FOR EACH ROW
BEGIN
  UPDATE Product
  SET Stock = Stock - NEW.Quantity
  WHERE ProductID = NEW.ProductID;
END;

-- Prevent negative stock
CREATE TRIGGER prevent_negative_stock
BEFORE UPDATE ON Product
FOR EACH ROW
BEGIN
  IF NEW.Stock < 0 THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Stock cannot be negative';
  END IF;
END;
