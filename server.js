const express = require("express");
const sql = require("mssql");
const port = process.env.PORT || 4000

const app = express();

app.get("/", (req,res)=>{
    res.sendFile(__dirname+"/docs/login.html")
});


app.use(express.static("docs"));
app.use(express.json());

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: { encrypt: true }
};


app.get("/customers", async (req, res) => {
    try{
        await sql.connect(config);
        const result = await sql.query("SELECT * FROM Customers");
        res.json(result.recordset);
    } catch (err) {
        res.send(err);
    }
});


app.post("/login", (req, res) => {
    const role = req.body.role;

    if(role === "customer"){
        res.json({redirect: "/customer.html"});
    }

    else if(role === "employee"){
        res.json({redirect: "/employee_login.html"});
    }

    else{
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
        res.status(500).send(err.message)
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

app.post("/buy-ticket", (req, res) => {
  console.log("Incoming body: ", req.body);
  res.send("Route works");
});

app.post("/buy-ticket", async (req, res) => {
    const { customer_id, cart } = req.body;

    if (!cart || cart.length === 0) {
        return res.status(400).send("Cart is empty.");
    }

    const customerCheck = await db.query(
        "SELECT 1 FROM Customers WHERE customer_id = $1",
        [customer_id]
    );

    if (customerCheck.rows.length === 0) {
        return res.status(400).send("Invalid customer ID.");
    }

    const client = await db.connect();

    try {
        await client.query("BEGIN");

        let totalPrice = 0;

        for (const item of cart) {
            const price = item.ticket_type === "adult" ? 50 : 30;
            totalPrice += price * item.quantity;
        }

        const issueDate = new Date();

        const expirationDate = new Date();
        expirationDate.setDate(issueDate.getDate() + 30);

        // ✅ FIXED: returning payment_id
        const paymentResult = await client.query(
            "INSERT INTO Ticket_Payment (customer_id, price, purchase_date) VALUES ($1, $2, $3) RETURNING payment_id",
            [customer_id, totalPrice, issueDate]
        );

        const payment_id = paymentResult.rows[0].payment_id;

        for (const item of cart) {
            for (let i = 0; i < item.quantity; i++) {
                await client.query(
                    "INSERT INTO Ticket (customer_id, visiting_date, expiration_date, ride, payment_id) VALUES ($1, $2, $3, $4, $5)",
                    [customer_id, issueDate, expirationDate, item.ride_id, payment_id]
                );
            }
        }

        await client.query("COMMIT");
        res.send("Tickets purchased successfully!");

    } catch (err) {
        await client.query("ROLLBACK");
        console.error(err);
        res.status(500).send("An error occurred while processing your purchase.");
    } finally {
        client.release();
    }
});


app.listen(port, () => {
    console.log("Server running on port 4000");
});