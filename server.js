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
        res.json({redirect: "/employee.html"});
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
                    THEN 1 ELSE 0 END)              AS Park_Operations_Affected
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

app.listen(port, () => {
    console.log("Server running on port 4000");
});