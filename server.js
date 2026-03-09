const express = require("express");
const sql = require("mssql");

const app = express();
app.use(express.static("public"));

const config = {
    user: "BFNValley",
    password: "ThemeparkProject3!",
    server: "themepark-db-server.database.windows.net",
    database: "themepark-database",
    options: {
        encrypt: true
    }
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

app.listen(3000, () => {
    console.log("Server running on port 3000");
});