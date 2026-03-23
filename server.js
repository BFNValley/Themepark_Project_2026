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

// --- STATS: CUSTOMER PER PERIOD ---

app.get("/stats/customers-per-month", async (req, res) => {
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
                DATENAME(MONTH, t.visiting_date)  AS Month,
                MONTH(t.visiting_date) AS Month_Num,
                COUNT(DISTINCT t.customer_id) AS Unique_Customers,
                COUNT(t.ticket_id) AS Total_Tickets
            FROM Ticket t
            WHERE t.visiting_date BETWEEN @from AND @to
            GROUP BY MONTH(t.visiting_date), DATENAME(MONTH, t.visiting_date)
            ORDER BY Month_Num
            `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// --- STATS: MAINTENANCE SUMMARY ---

app.get("/stats/maintenance-summary", async (req, res) => {
    const { from, to } = req.query;
    if (!from || !to) {
        return res.status(400).send("Please provide from and to dates.");
    } try {
        await sql.connect(config);
        const request = new sql.Request();
        request.input("from", sql.Date, from);
        request.input("to", sql.Date, to);
        const result = await request.query(`
            SELECT 
                r.ride_name AS Ride,
                COUNT(DISTINCT mt.maintenance_id) AS Maintenance_Tickets,
                SUM(CASE WHEN mt.ride_status = 'major maintenance'
                    THEN 1 ELSE 0 END) AS Major_Issues,
                SUM(CASE WHEN mt.ride_status = 'minor maintenance'
                    THEN 1 ELSE 0 END) AS Minor_Issues,
                COUNT(DISTINCT br.breakdown_id) AS Total_Breakdowns
            FROM Ride r
            LEFT JOIN Maintenance_Ticket mt ON r.ride_id = mt.ride_id
                AND mt.date_opened BETWEEN @from AND @to
            LEFT JOIN Breakdown_Record br ON r.ride_id = br.ride_id
                AND CAST (br.breakdown_timestamp AS DATE) BETWEEN @from AND @to
            GROUP BY r.ride_id, r.ride_name
            ORDER BY Maintenance_Tickets DESC
        `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// --- MOST POPULAR RIDES PER PERIOD ---

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
                MONTH(t.visiting_date) AS Month_Num,
                r.ride_name AS Ride,
                COUNT(t.ticket_id) AS Tickets_Sold
            FROM Ticket t
            JOIN Ride r ON t.ride = r.ride_id
            WHERE t.visiting_date BETWEEN @from AND @to
            GROUP BY MONTH(t.visiting_date), DATENAME(MONTH, t.visiting_date), r.ride_name
            ORDER BY Month_Num, Tickets_Sold DESC
            `);
            res.json(result.recordset);
    } catch (err) {
        res.status(500).send(err.message);
    }
})

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
            "SELECT 1 FROM Customers WHERE customer_id = @customer_id"
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