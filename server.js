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

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: { encrypt: true },
};

app.get("/customers", async (req, res) => {
  try {
    await sql.connect(config);
    const result = await sql.query("SELECT * FROM Customers");
    res.json(result.recordset);
  } catch (err) {
    res.send(err);
  }
});

app.post("/login", (req, res) => {
  const role = req.body.role;

  if (role === "customer") {
    res.json({ redirect: "/customer.html" });
  } else if (role === "employee") {
    res.json({ redirect: "/employee_login.html" });
  } else {
    res.status(400).send("Invalid role");
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

// --- WEATHER IMPACT ROUTE ---

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
                wr.condition                        AS Weather_Condition,
                SUM(CASE WHEN wr.rainout_flag = 1
                    THEN 1 ELSE 0 END)              AS Park_Operations_Affected,
                COUNT(t.ticket_id)                  AS Total_Tickets_Sold
            FROM Weather_Record wr
            LEFT JOIN Ticket t ON t.visiting_date = wr.record_date
            WHERE wr.record_date BETWEEN @from AND @to
            GROUP BY wr.condition
            ORDER BY Total_Tickets_Sold DESC
        `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// ---CUSTOMER UPDATE & DELETE ---

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

// --- TICKET BUYING ROUTE ---

/*
app.post("/buy-ticket", (req, res) => {
  console.log("Incoming body: ", req.body);
  res.send("Route works");
});
*/
app.post("/buy-ticket", async (req, res) => {
  console.log("Incoming body:", req.body);

  const { customer_id, cart } = req.body;

  // ✅ Basic validation
  if (!customer_id) {
    return res.status(400).send("Customer ID is required.");
  }

  if (!cart || cart.length === 0) {
    return res.status(400).send("Cart is empty.");
  }

  try {
    await sql.connect(config);

    //Check if customer exists
    const checkRequest = new sql.Request();
    checkRequest.input("customer_id", sql.Int, parseInt(customer_id));

    const customerCheck = await checkRequest.query(
      "SELECT 1 FROM Customers WHERE customer_id = @customer_id",
    );

    if (customerCheck.recordset.length === 0) {
      return res.status(400).send("Invalid customer ID.");
    }

    //Start transaction
    const transaction = new sql.Transaction();
    await transaction.begin();

    try {
      //Calculate total price
      let totalPrice = 0;

      for (const item of cart) {
        const priceRequest = new sql.Request(transaction);
        priceRequest.input("ride_id", sql.Int, item.ride_id);

        const priceResult = await priceRequest.query(`
                    SELECT ride_price FROM Ride WHERE ride_id = @ride_id
                `);

        if (priceResult.recordset.length === 0) {
          throw new Error("Invalid ride ID in cart.");
        }

        const ridePrice = priceResult.recordset[0].ride_price;

        totalPrice += ridePrice * item.quantity;
      }

      const issueDate = new Date();

      const expirationDate = new Date();
      expirationDate.setDate(issueDate.getDate() + 30);

      //Insert payment
      const paymentRequest = new sql.Request(transaction);

      paymentRequest.input("customer_id", sql.Int, customer_id);
      paymentRequest.input("price", sql.Int, totalPrice);
      paymentRequest.input("purchase_date", sql.DateTime, issueDate);

      const paymentResult = await paymentRequest.query(`
                INSERT INTO Ticket_Payment (customer_id, price, purchase_date)
                OUTPUT INSERTED.payment_id
                VALUES (@customer_id, @price, @purchase_date)
            `);

      const payment_id = paymentResult.recordset[0].payment_id;

      //Insert tickets
      for (const item of cart) {
        for (let i = 0; i < item.quantity; i++) {
          const ticketRequest = new sql.Request(transaction);

          ticketRequest.input("customer_id", sql.Int, customer_id);
          ticketRequest.input("visit_date", sql.DateTime, issueDate);
          ticketRequest.input("exp_date", sql.DateTime, expirationDate);
          ticketRequest.input("ride", sql.Int, item.ride_id);

          await ticketRequest.query(`
                        INSERT INTO Ticket (customer_id, visiting_date, expiration_date, ride)
                        VALUES (@customer_id, @visit_date, @exp_date, @ride)
                    `);
        }
      }

      // Commit transaction
      await transaction.commit();

      res.send("Tickets purchased successfully!");
    } catch (err) {
      await transaction.rollback();
      console.error("Transaction Error:", err);
      res.status(500).send("Transaction failed.");
    }
  } catch (err) {
    console.error("Connection Error:", err);
    res.status(500).send("Database connection failed.");
  }
});

// --- RIDE RETREIVAL ROUTE ---

app.get("/rides", async (req, res) => {
  try {
    await sql.connect(config);

    const result = await sql.query(`
            SELECT ride_id, ride_name, ride_price, height_requirement
            FROM Ride
        `);

    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error retrieving rides.");
  }
});

app.listen(port, () => {
  console.log("Server running on port 4000");
});

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

    res.send("Complaint submitted successfully.");
  } catch (err) {
    console.error("Complaint insert error:", err);
    res.status(500).send("Database error.");
  }
});
