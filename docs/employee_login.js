import sql from 'mssql';

const config = {
    user: process.env.DB_USER, 
    password: process.env.DB_PASS,
    server: process.env.DB_PASS,
    database: process.env.DB_PASS,
    options: {encrypt: true}
};


try {
        const e_input_username = document.getElementById('username');   //user input username
        const e_input_password = document.getElementById('password');   //user input password
        const e_form = document.getElementById('employee_login_form');

        const pool = sql.connect(config); //connect to database
        const username = pool.request().query('SELECT username FROM Employee WHERE username=' + input_username); //get username
        const password = pool.request().query('SELECT password FROM Employee WHERE username=' + input_username);  //get password

        e_form.addEventListener('submit', (e) => {
            if(e_input_username == username && e_input_password == password)    //if username and password correct
                window.location.href = 'employee.html';         //redirect to employee page
            else 
                window.location.href = 'employee_login.html'    //otherwise start over
            //e.preventDefault()
        });
} 
catch(err) { 
    console.error('Database connection failed while in employee login page:', err.message);
}



