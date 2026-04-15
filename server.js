const express = require("express");
const sql = require("mssql");
const port = process.env.PORT || 4000;

const app = express();

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/docs/login.html");
});

app.use(express.static("docs"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/employee_login.html", (req, res) => {
  res.sendFile(__dirname + "/docs/employee_login.html");
});

app.get("/customer_login.html", (req, res) => {
  res.sendFile(__dirname + "/docs/customer_login.html");
});

/*const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: { encrypt: true },
};*/

const config = {
  user: "BFNValley",
  password: "ThemeparkProject3!",
  server: "themepark-db-server.database.windows.net",
  database: "themepark-database",
  options: { encrypt: true },
};

app.get("/customers", async (req, res) => {
  try {
    await sql.connect(config);
    const result = await sql.query(`
            SELECT 
                c.customer_id,
                c.first_name,
                c.middle_initial,
                c.last_name,
                c.date_of_birth,
                c.phone_number,
                c.email_address,
                MAX(t.visiting_date) AS last_visit_date
            FROM Customers c
            LEFT JOIN Ticket t on c.customer_id = t.customer_id
            GROUP BY
                c.customer_id,
                c.first_name,
                c.middle_initial,
                c.last_name,
                c.date_of_birth,
                c.phone_number,
                c.email_address
            ORDER BY last_visit_date DESC
            `);
    res.json(result.recordset);
  } catch (err) {
    res.send(err);
  }
});

//  --- LOGIN PAGES ROUTES  ---

app.post("/login", (req, res) => {
  const role = req.body.role;

  if (role === "customer") {
    res.json({ redirect: "/customer_login.html" });
  } else if (role === "employee") {
    res.json({ redirect: "/employee_login.html" });
  } else {
    res.status(400).send("Invalid role");
  }
});

// --- Roles Check ---
function checkRoles(allowedRoles) {
  return (req, res, next) => {
    const role_id = Number(req.headers["role_id"]);

    if (!role_id) {
      return res.status(403).send("Access denied");
    }

    if (!allowedRoles.includes(role_id)) {
      return res.status(403).send("Access denied");
    }
    next();
  };
}

//  --- EMPLOYEE LOGIN ---

app.post("/employee_login", async (req, res) => {
  //employee user authentication
  try {
    await sql.connect(config);

    const { username, password } = req.body;

    console.log(username + " " + password);

    const request = new sql.Request();
    request.input("input_username", sql.VarChar(30), username);
    request.input("input_password", sql.VarChar(30), password);

    const result = await request.query(`
        SELECT Employee.username, Employee.employee_id, Employee.role_id, Role.role_name
        FROM Employee 
        LEFT JOIN Role ON Employee.role_id = Role.role_id
        WHERE Employee.username = @input_username
        AND Employee.employee_password = @input_password`);

    if (result.recordset.length === 0) {
      //check if not found username and password
      res.json({ success: false, redirect: "/employee_login.html" }); //if wrong reload page
    } else {
      res.json({
        success: true,
        redirect: "/employee.html",
        username: result.recordset[0].username,
        employee_id: result.recordset[0].employee_id,
        role_id: result.recordset[0].role_id,
        role_name: result.recordset[0].role_name,
      }); //else found username and password
    }
  } catch (err) {
    res.status(500).send(err.message);
  }
});

//  --- Customer LOGIN ---

app.post("/customer_login", async (req, res) => {
  //customer user authentication
  //NOTE: customer username is email
  try {
    await sql.connect(config);

    const { username, password } = req.body;

    console.log("username: " + username + ", password: " + password); //used for debugging

    const request = new sql.Request();
    request.input("input_username", sql.VarChar(30), username);
    request.input("input_password", sql.VarChar(30), password);

    const result = await request.query(`
        SELECT Customers.email_address, Customers.customer_id
        FROM Customers 
        WHERE Customers.email_address = @input_username
        AND Customers.customer_password = @input_password`); //note: update schema, insert password attribute into Customers table

    if (result.recordset.length === 0) {
      //check if not found username and password
      res.json({ success: false, redirect: "/customer_login.html" }); //if wrong reload page
    } else {
      res.json({
        success: true,
        redirect: "/customer.html",
        customer_id: result.recordset[0].customer_id,
        username: result.recordset[0].email_address,
      }); //else found username and password
    }
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// create customer accounts

app.post("/create_customer_account", async (req, res) => {
  try {
    await sql.connect(config);

    const {
      first_name,
      middle_initial,
      last_name,
      date_of_birth,
      phone_number,
      email_address,
      password,
      retype_password,
    } = req.body;

    if (
      !first_name ||
      !last_name ||
      !date_of_birth ||
      !phone_number ||
      !email_address ||
      !password ||
      !retype_password
    ) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be filled.",
      });
    }

    if (password !== retype_password) {
      return res
        .status(400)
        .json({ success: false, message: "Passwords do not match." });
    }

    const normalizedPhone = String(phone_number).replace(/\D/g, "");
    if (normalizedPhone.length !== 10) {
      return res.status(400).json({
        success: false,
        message: "Phone number must be exactly 10 digits.",
      });
    }

    const trimmedMiddleInitial = (middle_initial || "").trim();
    if (trimmedMiddleInitial.length > 1) {
      return res.status(400).json({
        success: false,
        message: "Middle initial must be 1 character or blank.",
      });
    }

    const request = new sql.Request();
    request.input("first_name", sql.VarChar(30), first_name.trim());
    request.input(
      "middle_initial",
      sql.Char(1),
      trimmedMiddleInitial ? trimmedMiddleInitial.toUpperCase() : null,
    );
    request.input("last_name", sql.VarChar(30), last_name.trim());
    request.input("date_of_birth", sql.Date, date_of_birth);
    request.input("phone_number", sql.Char(10), normalizedPhone);
    request.input("email_address", sql.VarChar(255), email_address.trim());
    request.input("customer_password", sql.VarChar(30), password);

    await request.query(`
      INSERT INTO Customers
      (first_name, middle_initial, last_name, date_of_birth, phone_number, email_address, customer_password)
      VALUES
      (@first_name, @middle_initial, @last_name, @date_of_birth, @phone_number, @email_address, @customer_password)
    `);

    return res.json({
      success: true,
      redirect: "/customer_login.html",
      message: "Account created successfully.",
    });
  } catch (err) {
    if (err.number === 2627 || err.number === 2601) {
      return res.status(409).json({
        success: false,
        message: "An account with that email already exists.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Database error while creating account.",
    });
  }
});

// --- WEATHER ROUTES ---

app.get("/weather", async (req, res) => {
  try {
    await sql.connect(config);
    const result = await sql.query(`
            SELECT record_date, condition, rainout_flag
            FROM Weather_Record
            ORDER BY record_date DESC
        `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post("/weather", async (req, res) => {
  const { record_date, condition, rainout_flag } = req.body;
  if (!record_date || !condition) {
    return res.status(400).send("record_date and condition are required.");
  }
  try {
    await sql.connect(config);
    const request = new sql.Request();
    request.input("record_date", sql.Date, record_date);
    request.input("condition", sql.VarChar(30), condition);
    request.input("rainout_flag", sql.TinyInt, rainout_flag ?? 0);
    await request.query(`
            INSERT INTO Weather_Record (record_date, condition, rainout_flag)
            VALUES (@record_date, @condition, @rainout_flag)
        `);
    res.sendStatus(200);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// --- STATS: CUSTOMER Ticket History ---

app.get("/stats/customers-ticket-history", async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to)
    return res.status(400).send("Please provide from and to dates.");
  try {
    await sql.connect(config);
    const request = new sql.Request();
    request.input("from", sql.Date, from);
    request.input("to", sql.Date, to);
    const result = await request.query(`
            SELECT
                c.first_name + ' ' + c.last_name AS Customer,
                COUNT(t.ticket_id) AS Total_Tickets,
                CONVERT(VARCHAR(10), MAX(t.visiting_date), 120) AS Last_Visit
            FROM Customers c
            JOIN Ticket t ON c.customer_id = t.customer_id
            WHERE t.visiting_date BETWEEN @from AND @to
            GROUP BY c.customer_id, c.first_name, c.last_name
            ORDER BY Total_Tickets DESC
            `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// --- STATS: Popular Rides Per Month ---

app.get("/stats/rides-per-month", async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) {
    return res.status(400).send("Please provide from and to dates.");
  }
  try {
    await sql.connect(config);
    const request = new sql.Request();
    request.input("from", sql.Date, from);
    request.input("to", sql.Date, to);
    const result = await request.query(`
            SELECT
              DATENAME(MONTH, t.visiting_date) AS Month,
              r.ride_name AS Ride,
              COUNT(t.ticket_id) AS Tickets_Sold
            FROM Ticket t
            JOIN Ride r ON t.ride = r.ride_id
            WHERE t.visiting_date BETWEEN @from AND @to
            GROUP BY MONTH(t.visiting_date), DATENAME(MONTH, t.visiting_date), r.ride_name
            ORDER BY MONTH(t.visiting_date), Tickets_Sold DESC
        `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// ---STATS: Weather Impact on Ticket Sales ---

app.get("/stats/weather-impact", async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) {
    return res.status(400).send("Please provide from and to dates.");
  }
  try {
    await sql.connect(config);
    const request = new sql.Request();
    request.input("from", sql.Date, from);
    request.input("to", sql.Date, to);
    const result = await request.query(`
            SELECT
              wr.condition AS Weather_Condition,
              SUM(CASE WHEN wr.rainout_flag = 1
                  THEN 1 ELSE 0 END) AS Park_Operations_Affected,
              COUNT(t.ticket_id) AS Total_Tickets_Sold,
              COUNT(DISTINCT t.customer_id) AS Unique_Customers
            FROM Weather_Record wr
            LEFT JOIN Ticket t ON t.visiting_date = wr.record_date
            LEFT JOIN Customers c ON t.customer_id = c.customer_id
            WHERE wr.record_date BETWEEN @from AND @to
            GROUP BY wr.condition
            ORDER BY Total_Tickets_Sold DESC
            `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// ---STATS: Employee Maintenance Workload ---

app.get("/stats/employee-workload", async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to)
    return res.status(400).send("Please provide from and to dates.");
  try {
    await sql.connect(config);
    const request = new sql.Request();
    request.input("from", sql.Date, from);
    request.input("to", sql.Date, to);
    const result = await request.query(`
            SELECT
                e.first_name + ' ' + e.last_name AS Employee,
                COUNT(mt.ticket_id) AS Total_Maintenance_Tickets,
                SUM(CASE WHEN mt.maintenance_priority = 'high'
                    THEN 1 ELSE 0 END) AS High_Priority,
                SUM(CASE WHEN mt.maintenance_priority = 'medium'
                    THEN 1 ELSE 0 END) AS Medium_Priority,
                SUM(CASE WHEN mt.maintenance_priority = 'low'
                    THEN 1 ELSE 0 END) AS Low_Priority
            FROM Employee e
            LEFT JOIN Maintenance_Ticket mt ON e.employee_id = mt.employee_id
                AND mt.date_opened BETWEEN @from AND @to
            WHERE e.is_active = 1
            GROUP BY e.employee_id, e.first_name, e.last_name
            ORDER BY Total_Maintenance_Tickets DESC
        `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// --- CUSTOMER UPDATE & DELETE ---

app.put("/customers/:id", async (req, res) => {
  const { phone_number, email_address } = req.body;
  const id = req.params.id;
  try {
    await sql.connect(config);
    const request = new sql.Request();
    request.input("id", sql.Int, id);
    request.input("phone_number", sql.Char(10), phone_number);
    request.input("email_address", sql.VarChar(255), email_address);
    await request.query(`
            UPDATE Customers
            SET phone_number = @phone_number,
                email_address = @email_address
            WHERE customer_id = @id
        `);
    res.sendStatus(200);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.delete("/customers/:id", async (req, res) => {
  const id = req.params.id;
  try {
    await sql.connect(config);
    const request = new sql.Request();
    request.input("id", sql.Int, id);
    await request.query(`
            DELETE FROM Customers
            WHERE customer_id = @id
        `);
    res.sendStatus(200);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// --- COMBINED CHECKOUT ROUTES ---

async function processCheckout(customerIdRaw, ticketCartRaw, giftCartRaw) {
  const customerId = Number.parseInt(customerIdRaw, 10);
  const ticketCart = Array.isArray(ticketCartRaw) ? ticketCartRaw : [];
  const giftCart = Array.isArray(giftCartRaw) ? giftCartRaw : [];

  if (!Number.isInteger(customerId) || customerId <= 0) {
    throw new Error("Customer ID must be valid.");
  }

  if (ticketCart.length === 0 && giftCart.length === 0) {
    throw new Error("No items in checkout cart.");
  }

  const checkRequest = new sql.Request();
  checkRequest.input("customer_id", sql.Int, customerId);

  const customerCheck = await checkRequest.query(
    "SELECT 1 FROM Customers WHERE customer_id = @customer_id",
  );

  if (customerCheck.recordset.length === 0) {
    throw new Error("Invalid customer ID.");
  }

  const transaction = new sql.Transaction();
  await transaction.begin();

  try {
    const purchasedAt = new Date();
    const expirationDate = new Date();
    expirationDate.setDate(purchasedAt.getDate() + 30);

    const receipt = {
      purchasedAt,
      ticketItems: [],
      giftItems: [],
      ticketSubtotal: 0,
      giftSubtotal: 0,
      grandTotal: 0,
      ticketPaymentId: null,
      giftReceiptId: null,
    };

    if (ticketCart.length > 0) {
      for (const item of ticketCart) {
        const rideId = Number.parseInt(item.ride_id, 10);
        const quantity = Number.parseInt(item.quantity, 10);
        const ticketType = item.ticket_type || "Adult";

        if (!Number.isInteger(rideId) || rideId <= 0) {
          throw new Error("Invalid ride ID in ticket cart.");
        }

        if (!Number.isInteger(quantity) || quantity <= 0) {
          throw new Error("Ticket quantity must be at least 1.");
        }

        const rideRequest = new sql.Request(transaction);
        rideRequest.input("ride_id", sql.Int, rideId);

        const rideResult = await rideRequest.query(`
          SELECT ride_name, ride_price
          FROM Ride
          WHERE ride_id = @ride_id
            AND (
              COL_LENGTH('dbo.Ride', 'deprecated') IS NULL
              OR ISNULL(deprecated, 0) = 0
            )
        `);

        if (rideResult.recordset.length === 0) {
          throw new Error("Invalid ride ID in ticket cart.");
        }

        const rideName = rideResult.recordset[0].ride_name;
        let ticketUnitPrice = Number.parseFloat(
          rideResult.recordset[0].ride_price,
        );

        if (String(ticketType).toLowerCase() === "child") {
          ticketUnitPrice *= 0.5;
        }

        receipt.ticketSubtotal += ticketUnitPrice * quantity;
        receipt.ticketItems.push({
          ride_id: rideId,
          ride_name: rideName,
          ticket_type: ticketType,
          quantity,
          unit_price: Number(ticketUnitPrice.toFixed(2)),
          line_total: Number((ticketUnitPrice * quantity).toFixed(2)),
        });
      }

      const paymentRequest = new sql.Request(transaction);
      paymentRequest.input("customer_id", sql.Int, customerId);
      paymentRequest.input("price", sql.Decimal(10, 2), receipt.ticketSubtotal);
      paymentRequest.input("purchase_date", sql.DateTime, purchasedAt);

      const paymentResult = await paymentRequest.query(`
        INSERT INTO Ticket_Payment (customer_id, price, purchase_date)
        OUTPUT INSERTED.payment_id
        VALUES (@customer_id, @price, @purchase_date)
      `);

      receipt.ticketPaymentId = paymentResult.recordset[0].payment_id;

      for (const item of receipt.ticketItems) {
        for (let i = 0; i < item.quantity; i++) {
          const ticketRequest = new sql.Request(transaction);
          ticketRequest.input("customer_id", sql.Int, customerId);
          ticketRequest.input("visit_date", sql.DateTime, purchasedAt);
          ticketRequest.input("exp_date", sql.DateTime, expirationDate);
          ticketRequest.input("ride", sql.Int, item.ride_id);
          ticketRequest.input("ticket_type", sql.VarChar(20), item.ticket_type);
          ticketRequest.input(
            "ticket_price",
            sql.Decimal(10, 2),
            item.unit_price,
          );

          await ticketRequest.query(`
            INSERT INTO Ticket (
              customer_id,
              visiting_date,
              expiration_date,
              ride,
              ticket_type,
              ticket_price
            )
            VALUES (
              @customer_id,
              @visit_date,
              @exp_date,
              @ride,
              @ticket_type,
              @ticket_price
            )
          `);
        }
      }
    }

    if (giftCart.length > 0) {
      for (const item of giftCart) {
        const productId = Number.parseInt(item.product_id, 10);
        const quantity = Number.parseInt(item.quantity, 10);

        if (!Number.isInteger(productId) || productId <= 0) {
          throw new Error("Invalid product ID in gift cart.");
        }

        if (!Number.isInteger(quantity) || quantity <= 0) {
          throw new Error("Gift item quantity must be at least 1.");
        }

        const productRequest = new sql.Request(transaction);
        productRequest.input("product_id", sql.Int, productId);

        const productResult = await productRequest.query(`
          SELECT product_name, product_price, stock
          FROM Gift_Shop WITH (UPDLOCK, ROWLOCK)
          WHERE product_id = @product_id
        `);

        if (productResult.recordset.length === 0) {
          throw new Error("Invalid product in gift cart.");
        }

        const product = productResult.recordset[0];
        if (product.stock < quantity) {
          throw new Error(
            `${product.product_name} only has ${product.stock} item(s) left in stock.`,
          );
        }

        const unitPrice = Number.parseFloat(product.product_price);
        const lineTotal = unitPrice * quantity;
        receipt.giftSubtotal += lineTotal;
        receipt.giftItems.push({
          product_id: productId,
          product_name: product.product_name,
          quantity,
          unit_price: Number(unitPrice.toFixed(2)),
          line_total: Number(lineTotal.toFixed(2)),
        });

        const updateStockRequest = new sql.Request(transaction);
        updateStockRequest.input("product_id", sql.Int, productId);
        updateStockRequest.input("quantity", sql.Int, quantity);

        await updateStockRequest.query(`
          UPDATE Gift_Shop
          SET stock = stock - @quantity
          WHERE product_id = @product_id
        `);
      }

      const receiptTableCheck = new sql.Request(transaction);
      const tableCheckResult = await receiptTableCheck.query(`
        SELECT
          OBJECT_ID('Gift_Shop_Receipt', 'U') AS receipt_table_id,
          OBJECT_ID('Gift_Shop_Receipt_Item', 'U') AS receipt_item_table_id
      `);

      const hasReceiptTables =
        tableCheckResult.recordset[0].receipt_table_id &&
        tableCheckResult.recordset[0].receipt_item_table_id;

      if (hasReceiptTables) {
        const giftReceiptRequest = new sql.Request(transaction);
        giftReceiptRequest.input("customer_id", sql.Int, customerId);
        giftReceiptRequest.input(
          "purchase_datetime",
          sql.DateTime2,
          purchasedAt,
        );
        giftReceiptRequest.input(
          "subtotal",
          sql.Decimal(10, 2),
          receipt.giftSubtotal,
        );

        const giftReceiptResult = await giftReceiptRequest.query(`
          INSERT INTO Gift_Shop_Receipt (customer_id, purchase_datetime, subtotal)
          OUTPUT INSERTED.receipt_id
          VALUES (@customer_id, @purchase_datetime, @subtotal)
        `);

        const giftReceiptId = giftReceiptResult.recordset[0].receipt_id;
        receipt.giftReceiptId = giftReceiptId;

        for (const giftItem of receipt.giftItems) {
          const giftItemRequest = new sql.Request(transaction);
          giftItemRequest.input("receipt_id", sql.Int, giftReceiptId);
          giftItemRequest.input("product_id", sql.Int, giftItem.product_id);
          giftItemRequest.input("quantity", sql.Int, giftItem.quantity);
          giftItemRequest.input(
            "unit_price",
            sql.Decimal(10, 2),
            giftItem.unit_price,
          );

          await giftItemRequest.query(`
            INSERT INTO Gift_Shop_Receipt_Item
              (receipt_id, product_id, quantity, unit_price)
            VALUES
              (@receipt_id, @product_id, @quantity, @unit_price)
          `);
        }
      }
    }

    receipt.ticketSubtotal = Number(receipt.ticketSubtotal.toFixed(2));
    receipt.giftSubtotal = Number(receipt.giftSubtotal.toFixed(2));
    receipt.grandTotal = Number(
      (receipt.ticketSubtotal + receipt.giftSubtotal).toFixed(2),
    );

    await transaction.commit();
    return receipt;
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

app.post("/checkout", async (req, res) => {
  const { customer_id, ticket_cart, gift_cart } = req.body;

  try {
    await sql.connect(config);
    const receipt = await processCheckout(customer_id, ticket_cart, gift_cart);

    res.json({
      success: true,
      message: "Checkout completed successfully.",
      receipt,
    });
  } catch (err) {
    const message = err?.message || "Checkout failed.";
    const isValidationError =
      message.includes("Invalid") ||
      message.includes("must") ||
      message.includes("No items") ||
      message.includes("stock");

    res.status(isValidationError ? 400 : 500).json({
      success: false,
      message,
    });
  }
});

app.post("/buy-ticket", async (req, res) => {
  const { customer_id, cart } = req.body;

  try {
    await sql.connect(config);
    await processCheckout(customer_id, cart, []);
    res.send("Tickets purchased successfully!");
  } catch (err) {
    res
      .status(500)
      .send("Transaction failed: " + (err?.message || "Unknown error"));
  }
});

// --- TICKET RETRIEVAL ROUTE ---

app.get("/my-tickets/:customer_id", async (req, res) => {
  try {
    await sql.connect(config);

    const customer_id = parseInt(req.params.customer_id, 10);

    if (!customer_id) {
      return res.status(400).send("Invalid customer ID.");
    }

    const request = new sql.Request();
    request.input("customer_id", sql.Int, customer_id);

    const result = await request.query(`
      SELECT
        t.ticket_id,
        t.customer_id,
        t.visiting_date,
        t.expiration_date,
        t.ride,
        t.ticket_type,
        t.ticket_price,
        r.ride_name,
        r.ride_price
      FROM Ticket t
      LEFT JOIN Ride r ON t.ride = r.ride_id
      WHERE t.customer_id = @customer_id
      ORDER BY t.visiting_date DESC, t.ticket_id DESC
    `);

    res.json(result.recordset);
  } catch (err) {
    console.error("Error loading tickets:", err);
    res.status(500).send("Failed to load tickets: " + err.message);
  }
});

// --- RIDE RETREIVAL ROUTE ---

app.get("/rides", async (req, res) => {
  try {
    await sql.connect(config);

    const result = await sql.query(`
          SELECT
            ride_id,
            ride_name,
            ride_price,
            ride_status,
            CASE
              WHEN COL_LENGTH('dbo.Ride', 'deprecated') IS NULL THEN 0
              ELSE ISNULL(deprecated, 0)
            END AS deprecated
          FROM Ride
          WHERE
            COL_LENGTH('dbo.Ride', 'deprecated') IS NULL
            OR ISNULL(deprecated, 0) = 0
        `);

    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error retrieving rides.");
  }
});

app.get("/rides/all", checkRoles([1, 2]), async (req, res) => {
  try {
    await sql.connect(config);

    const result = await sql.query(`
      SELECT
        ride_id,
        ride_name,
        ride_price,
        ride_status,
        CASE
          WHEN COL_LENGTH('dbo.Ride', 'deprecated') IS NULL THEN 0
          ELSE ISNULL(deprecated, 0)
        END AS deprecated
      FROM Ride
      ORDER BY ride_id
    `);

    res.json(result.recordset);
  } catch (err) {
    res.status(500).send("Error retrieving rides.");
  }
});

app.post("/rides", checkRoles([1, 2]), async (req, res) => {
  const { ride_name, ride_price, ride_status } = req.body;

  if (!ride_name || ride_price == null || ride_status == null) {
    return res.status(400).send("All required fields must be filled in.");
  }

  const parsedPrice = Number(ride_price);
  const parsedStatus = Number(ride_status);

  if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
    return res.status(400).send("Ride price must be greater than 0.");
  }

  if (![0, 1].includes(parsedStatus)) {
    return res
      .status(400)
      .send("Ride status must be 0 (active) or 1 (closed).");
  }

  try {
    await sql.connect(config);
    const request = new sql.Request();
    request.input("ride_name", sql.VarChar(50), ride_name.trim());
    request.input("ride_price", sql.Decimal(10, 2), parsedPrice);
    request.input("ride_status", sql.Int, parsedStatus);

    await request.query(`
      INSERT INTO Ride (ride_name, ride_price, ride_status)
      VALUES (@ride_name, @ride_price, @ride_status)
    `);

    res.sendStatus(200);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.put("/rides/:id", checkRoles([1, 2]), async (req, res) => {
  const rideId = Number(req.params.id);
  const { ride_name, ride_price, ride_status } = req.body;

  if (!Number.isInteger(rideId) || rideId <= 0) {
    return res.status(400).send("Invalid ride id.");
  }

  if (!ride_name || ride_price == null || ride_status == null) {
    return res.status(400).send("All required fields must be filled in.");
  }

  const parsedPrice = Number(ride_price);
  const parsedStatus = Number(ride_status);

  if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
    return res.status(400).send("Ride price must be greater than 0.");
  }

  if (![0, 1].includes(parsedStatus)) {
    return res
      .status(400)
      .send("Ride status must be 0 (active) or 1 (closed).");
  }

  try {
    await sql.connect(config);
    const request = new sql.Request();
    request.input("ride_id", sql.Int, rideId);
    request.input("ride_name", sql.VarChar(50), ride_name.trim());
    request.input("ride_price", sql.Decimal(10, 2), parsedPrice);
    request.input("ride_status", sql.Int, parsedStatus);

    const result = await request.query(`
      UPDATE Ride
      SET ride_name = @ride_name,
          ride_price = @ride_price,
          ride_status = @ride_status
      WHERE ride_id = @ride_id
    `);

    if (!result.rowsAffected[0]) {
      return res.status(404).send("Ride not found.");
    }

    res.sendStatus(200);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.put("/rides/:id/deprecated", checkRoles([1, 2]), async (req, res) => {
  const rideId = Number(req.params.id);
  const deprecated = Number(req.body.deprecated);

  if (!Number.isInteger(rideId) || rideId <= 0) {
    return res.status(400).send("Invalid ride id.");
  }

  if (![0, 1].includes(deprecated)) {
    return res.status(400).send("Deprecated must be 0 or 1.");
  }

  try {
    await sql.connect(config);

    const columnCheckRequest = new sql.Request();
    const columnCheckResult = await columnCheckRequest.query(`
      SELECT CASE
        WHEN COL_LENGTH('dbo.Ride', 'deprecated') IS NULL THEN 0
        ELSE 1
      END AS has_column
    `);

    const request = new sql.Request();
    request.input("ride_id", sql.Int, rideId);
    request.input("deprecated", sql.Int, deprecated);

    const result = await request.query(`
      UPDATE Ride
      SET deprecated = @deprecated
      WHERE ride_id = @ride_id
    `);

    if (!result.rowsAffected[0]) {
      return res.status(404).send("Ride not found.");
    }

    return res.status(200).send("Ride deprecation status updated.");
  } catch (err) {
    return res.status(500).send(err.message);
  }
});

// --- EMPLOYEE ROUTEs ---
app.get("/employees", checkRoles([1]), async (req, res) => {
  try {
    await sql.connect(config);
    const result = await sql.query(`
      SELECT e.employee_id, e.first_name, e.middle_initial, e.last_name, e.role_id, r.role_name, e.username, e.pay_rate, e.is_active
      FROM Employee e
      LEFT JOIN Role r ON e.role_id=r.role_id
      WHERE e.is_active = 1
      ORDER BY e.employee_id
      `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post("/employees", checkRoles([1]), async (req, res) => {
  const {
    first_name,
    last_name,
    middle_initial,
    username,
    password,
    ssn,
    pay_rate,
    role_id,
  } = req.body;
  if (
    !first_name ||
    !last_name ||
    !username ||
    !password ||
    !ssn ||
    !pay_rate
  ) {
    return res.status(400).send("All required fields must be filled in.");
  }
  try {
    await sql.connect(config);
    const request = new sql.Request();
    request.input("first_name", sql.VarChar(30), first_name);
    request.input("last_name", sql.VarChar(30), last_name);
    request.input("middle_initial", sql.VarChar(1), middle_initial || null);
    request.input("username", sql.VarChar(30), username);
    request.input("password", sql.VarChar(30), password);
    request.input("ssn", sql.VarChar(9), ssn);
    request.input("pay_rate", sql.Decimal(10, 2), pay_rate);
    request.input("role_id", sql.Int, role_id || null);
    await request.query(`
      INSERT INTO Employee (first_name, middle_initial, last_name, username, employee_password, ssn, pay_rate, role_id, is_active)
      VALUES (@first_name, @middle_initial, @last_name, @username, @password, @ssn, @pay_rate, @role_id, 1)
    `);
    res.sendStatus(200);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.put("/employees/:id", checkRoles([1]), async (req, res) => {
  const { role_id, username, pay_rate, first_name, last_name } = req.body;
  const id = req.params.id;
  try {
    await sql.connect(config);
    const request = new sql.Request();
    request.input("id", sql.Int, id);
    request.input(
      "role_id",
      sql.Int,
      role_id != null && role_id !== "" ? parseInt(role_id) : null,
    );
    request.input("username", sql.VarChar(30), username);
    request.input("pay_rate", sql.Decimal(10, 2), pay_rate);
    request.input("first_name", sql.VarChar(30), first_name);
    request.input("last_name", sql.VarChar(30), last_name);
    await request.query(`
      UPDATE Employee
      SET role_id = @role_id, username = @username, pay_rate = @pay_rate, first_name = @first_name, last_name = @last_name
      WHERE employee_id = @id
    `);
    res.sendStatus(200);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.put("/employees/deactivate/:id", checkRoles([1]), async (req, res) => {
  const id = req.params.id;
  try {
    await sql.connect(config);
    const request = new sql.Request();
    request.input("id", sql.Int, id);

    await request.query(`
      UPDATE Employee
      SET is_active = 0
      WHERE employee_id = @id
    `);
    res.sendStatus(200);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// --- GIFT SHOP INVENTORY ROUTES ---

app.get("/gift-shop/products", checkRoles([1, 3]), async (req, res) => {
  try {
    await sql.connect(config);
    const result = await sql.query(`
      SELECT product_id, product_name, product_price, stock
      FROM Gift_Shop
      ORDER BY product_name
    `);

    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/gift-shop/catalog", async (req, res) => {
  try {
    await sql.connect(config);
    const result = await sql.query(`
      SELECT product_id, product_name, product_price, stock
      FROM Gift_Shop
      WHERE stock > 0
      ORDER BY product_name
    `);

    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/gift-shop/products", checkRoles([1, 3]), async (req, res) => {
  const { product_name, product_price, stock } = req.body;

  if (!product_name || product_price == null || stock == null) {
    return res
      .status(400)
      .json({ message: "Missing required product fields." });
  }

  const parsedPrice = Number(product_price);
  const parsedStock = Number(stock);

  if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
    return res
      .status(400)
      .json({ message: "Product price must be greater than 0." });
  }

  if (!Number.isInteger(parsedStock) || parsedStock < 0) {
    return res
      .status(400)
      .json({ message: "Stock must be a non-negative integer." });
  }

  try {
    await sql.connect(config);
    const request = new sql.Request();
    request.input("product_name", sql.VarChar(100), product_name.trim());
    request.input("product_price", sql.Decimal(10, 2), parsedPrice);
    request.input("stock", sql.Int, parsedStock);

    await request.query(`
      INSERT INTO Gift_Shop (product_name, product_price, stock)
      VALUES (@product_name, @product_price, @stock)
    `);

    res.json({ success: true, message: "Product added successfully." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put("/gift-shop/products/:id", checkRoles([1, 3]), async (req, res) => {
  const productId = Number(req.params.id);
  const { product_name, product_price, stock } = req.body;

  if (!Number.isInteger(productId) || productId <= 0) {
    return res.status(400).json({ message: "Invalid product id." });
  }

  if (!product_name || product_price == null || stock == null) {
    return res
      .status(400)
      .json({ message: "Missing required product fields." });
  }

  const parsedPrice = Number(product_price);
  const parsedStock = Number(stock);

  if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
    return res
      .status(400)
      .json({ message: "Product price must be greater than 0." });
  }

  if (!Number.isInteger(parsedStock) || parsedStock < 0) {
    return res
      .status(400)
      .json({ message: "Stock must be a non-negative integer." });
  }

  try {
    await sql.connect(config);
    const request = new sql.Request();
    request.input("product_id", sql.Int, productId);
    request.input("product_name", sql.VarChar(100), product_name.trim());
    request.input("product_price", sql.Decimal(10, 2), parsedPrice);
    request.input("stock", sql.Int, parsedStock);

    const result = await request.query(`
      UPDATE Gift_Shop
      SET product_name = @product_name,
          product_price = @product_price,
          stock = @stock
      WHERE product_id = @product_id
    `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: "Product not found." });
    }

    res.json({ success: true, message: "Product updated successfully." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete("/gift-shop/products/:id", checkRoles([1, 3]), async (req, res) => {
  const productId = Number(req.params.id);

  if (!Number.isInteger(productId) || productId <= 0) {
    return res.status(400).json({ message: "Invalid product id." });
  }

  try {
    await sql.connect(config);
    const request = new sql.Request();
    request.input("product_id", sql.Int, productId);

    const result = await request.query(`
      DELETE FROM Gift_Shop
      WHERE product_id = @product_id
    `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: "Product not found." });
    }

    res.json({ success: true, message: "Product deleted successfully." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/gift-shop/alerts", checkRoles([1, 3]), async (req, res) => {
  try {
    await sql.connect(config);

    const tableCheck = await new sql.Request().query(`
      SELECT CASE
        WHEN OBJECT_ID('dbo.Gift_Shop_Low_Stock_Alert', 'U') IS NULL THEN 0
        ELSE 1
      END AS has_table
    `);

    if (!tableCheck.recordset[0]?.has_table) {
      return res.json([]);
    }

    const result = await sql.query(`
      SELECT
        a.alert_id,
        a.product_id,
        a.product_name,
        a.current_stock,
        a.threshold,
        a.message,
        a.created_at
      FROM Gift_Shop_Low_Stock_Alert a
      WHERE a.acknowledged_at IS NULL
      ORDER BY a.created_at DESC, a.alert_id DESC
    `);

    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.put(
  "/gift-shop/alerts/:id/acknowledge",
  checkRoles([1, 3]),
  async (req, res) => {
    const alertId = Number(req.params.id);

    if (!Number.isInteger(alertId) || alertId <= 0) {
      return res.status(400).json({ message: "Invalid alert id." });
    }

    try {
      await sql.connect(config);

      const tableCheck = await new sql.Request().query(`
        SELECT CASE
          WHEN OBJECT_ID('dbo.Gift_Shop_Low_Stock_Alert', 'U') IS NULL THEN 0
          ELSE 1
        END AS has_table
      `);

      if (!tableCheck.recordset[0]?.has_table) {
        return res.status(400).json({ message: "Alert table does not exist." });
      }

      const request = new sql.Request();
      request.input("alert_id", sql.Int, alertId);

      const result = await request.query(`
        UPDATE Gift_Shop_Low_Stock_Alert
        SET acknowledged_at = SYSDATETIME()
        WHERE alert_id = @alert_id
          AND acknowledged_at IS NULL
      `);

      if (result.rowsAffected[0] === 0) {
        return res.status(404).json({ message: "Alert not found." });
      }

      res.json({ success: true, message: "Alert acknowledged." });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },
);

// customer complaint route

app.post("/submit-complaint", async (req, res) => {
  console.log("Incoming complaint:", req.body);

  const { fname, lname, email, reason, description, date } = req.body;

  const otherReason = req.body["other-reason"];

  if (!fname || !lname || !email || !reason || !description || !date) {
    return res.status(400).send("Missing required fields.");
  }

  try {
    await sql.connect(config);

    const request = new sql.Request();
    request.input("first_name", sql.VarChar(30), fname);
    request.input("last_name", sql.VarChar(30), lname);
    request.input("email", sql.VarChar(100), email);
    request.input("complaint_type", sql.VarChar(50), reason);
    request.input("reason_if_other", sql.VarChar(255), otherReason || null);
    request.input("complaint_description", sql.VarChar(sql.MAX), description);
    request.input("incident_date", sql.Date, date);

    await request.query(`
            INSERT INTO Complaint
            (first_name, last_name, email, complaint_type, reason_if_other, complaint_description, incident_date)
            VALUES
            (@first_name, @last_name, @email, @complaint_type, @reason_if_other, @complaint_description, @incident_date)
        `);

    res.redirect("/customer.html");
  } catch (err) {
    console.error("Complaint insert error:", err);
    res.status(500).send("Database error.");
  }
});

app.get("/complaints", async (req, res) => {
  try {
    await sql.connect(config);

    const result = await sql.query(`
      SELECT
        first_name,
        last_name,
        email,
        complaint_type,
        reason_if_other,
        complaint_description,
        incident_date
      FROM Complaint
      ORDER BY incident_date DESC
    `);

    res.json(result.recordset);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// maintenance ticket route

app.post("/submit-maintenance", async (req, res) => {
  try {
    const employeeId = req.body.employee_id;
    const rideId = req.body.ride;
    const issueType = req.body["maintenance-type"];
    const priority = req.body.priority;
    const status = req.body.status;
    const dateOpened = req.body["date-opened"];
    const description = req.body.description;

    await sql.connect(config);

    const request = new sql.Request();
    request.input("employee_id", sql.Int, employeeId);
    request.input("ride_id", sql.Int, rideId);
    request.input("issue_type", sql.VarChar(50), issueType);
    request.input("maintenance_priority", sql.VarChar(20), priority);
    request.input("maintenance_status", sql.VarChar(20), status);
    request.input("date_opened", sql.DateTime, dateOpened);
    request.input("maintenance_description", sql.VarChar(sql.MAX), description);

    await request.query(`
      INSERT INTO Maintenance_Ticket
      (
        ride_id,
        employee_id,
        date_opened,
        issue_type,
        maintenance_description,
        maintenance_priority,
        maintenance_status
      )
      VALUES
      (
        @ride_id,
        @employee_id,
        @date_opened,
        @issue_type,
        @maintenance_description,
        @maintenance_priority,
        @maintenance_status
      )
    `);

    res.redirect("/maintenance_portal.html");
  } catch (err) {
    console.log("ERROR:", err.message);
    res.status(500).send(err.message);
  }
});

app.listen(port, () => {
  console.log("Server running on port 4000");
});

app.get("/maintenance-tickets", async (req, res) => {
  try {
    await sql.connect(config);

    const result = await sql.query(`
      SELECT ticket_id, ride_id, employee_id, date_opened, issue_type, maintenance_description, maintenance_priority, maintenance_status
      FROM Maintenance_Ticket
      ORDER BY ticket_id
    `);

    res.json(result.recordset);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.put("/update-maintenance/:ticket_id", async (req, res) => {
  try {
    const ticketId = req.params.ticket_id;
    const {
      issue_type,
      maintenance_description,
      maintenance_priority,
      maintenance_status,
    } = req.body;

    await sql.connect(config);

    const request = new sql.Request();
    request.input("ticket_id", sql.Int, ticketId);
    request.input("issue_type", sql.VarChar(50), issue_type);
    request.input(
      "maintenance_description",
      sql.VarChar(sql.MAX),
      maintenance_description,
    );
    request.input(
      "maintenance_priority",
      sql.VarChar(20),
      maintenance_priority,
    );
    request.input("maintenance_status", sql.VarChar(20), maintenance_status);

    await request.query(`
      UPDATE Maintenance_Ticket
      SET
        issue_type = @issue_type,
        maintenance_description = @maintenance_description,
        maintenance_priority = @maintenance_priority,
        maintenance_status = @maintenance_status
      WHERE ticket_id = @ticket_id
    `);

    res.json({ success: true, message: "Ticket updated successfully" });
  } catch (err) {
    console.log("ERROR:", err.message);
    res.status(500).send(err.message);
  }
});

app.get("/maintenance-tickets/:ticket_id", async (req, res) => {
  try {
    const ticketId = req.params.ticket_id;

    await sql.connect(config);

    const request = new sql.Request();
    request.input("ticket_id", sql.Int, ticketId);

    const result = await request.query(`
      SELECT ticket_id, ride_id, employee_id, date_opened, issue_type, maintenance_description, maintenance_priority, maintenance_status
      FROM Maintenance_Ticket
      WHERE ticket_id = @ticket_id
    `);

    if (result.recordset.length === 0) {
      res.status(404).send("Ticket not found");
    } else {
      res.json(result.recordset[0]);
    }
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// gift shop stuff
