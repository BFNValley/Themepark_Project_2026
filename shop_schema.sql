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
