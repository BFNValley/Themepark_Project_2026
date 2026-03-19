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

app.listen(port, () => {
    console.log("Server running on port 4000");
});