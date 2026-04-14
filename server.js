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
    return res.status(400).send("Customer ID must be valid.");
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

app.get("/my-tickets", async (req, res) => {
  try {
    if (!req.session.customer || !req.session.customer.customer_id) {
      return res.status(401).send("Not logged in.");
    }

    await sql.connect(config);

    const request = new sql.Request();
    request.input("customer_id", sql.Int, req.session.customer.customer_id);

    const result = await request.query(`
      SELECT 
        r.ride_name,
        t.visiting_date,
        t.expiration_date,
        COUNT(*) AS quantity
      FROM Ticket t
      LEFT JOIN Ride r ON t.ride = r.ride_id
      WHERE t.customer_id = @customer_id
      GROUP BY r.ride_name, t.visiting_date, t.expiration_date
      ORDER BY t.visiting_date DESC
    `);

    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to load tickets.");
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
