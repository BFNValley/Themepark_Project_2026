const express = require("express");
const sql = require("mssql");
const port = process.env.PORT || 4000

const app = express();
app.use(express.static("docs"));

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

app.listen(port, () => {
    console.log("Server running on port 4000");
});