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

/*
app.get("/customers", async (req, res) => {
    try{
        await sql.connect(config);
        const result = await sql.query("SELECT * FROM Customers");
        res.json(result.recordset);
    } catch (err) {
        res.send(err);
    }
});
*/


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
})

app.listen(port, () => {
    console.log("Server running on port 4000");
});