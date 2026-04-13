async function loadTickets() {
  const response = await fetch("/maintenance-tickets");
  const tickets = await response.json();

  const tbody = document.querySelector("#ticketsTable tbody");
  tbody.innerHTML = "";

  tickets.forEach((ticket) => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${ticket.ticket_id}</td>
      <td>${ticket.ride_id}</td>
      <td>${ticket.employee_id}</td>
      <td>${ticket.maintenance_type}</td>
      <td>${ticket.maintenance_status}</td>
      <td>${ticket.issue_type}</td>
      <td>${ticket.maintenance_priority}</td>
      <td>${ticket.maintenance_description}</td>
      <td>${ticket.date_opened}</td>
      <td>
        <button onclick="editTicket(${ticket.ticket_id})">Edit</button>
      </td>
    `;

    tbody.appendChild(row);
  });
}

function editTicket(ticketId) {
  window.location.href = `/edit_maintenance.html?ticket_id=${ticketId}`;
}

loadTickets();

app.post("/maintenance-tickets/update/:id", async (req, res) => {
  try {
    await sql.connect(config);

    const {
      ride_id,
      employee_id,
      maintenance_type,
      maintenance_status,
      description,
    } = req.body;

    const request = new sql.Request();
    request.input("ticket_id", sql.Int, req.params.id);
    request.input("ride_id", sql.Int, ride_id);
    request.input("employee_id", sql.Int, employee_id);
    request.input("maintenance_type", sql.VarChar(50), maintenance_type);
    request.input("maintenance_status", sql.VarChar(50), maintenance_status);
    request.input("description", sql.VarChar(sql.MAX), description);

    await request.query(`
      UPDATE Maintenance_Ticket
      SET ride_id = @ride_id,
          employee_id = @employee_id,
          maintenance_type = @maintenance_type,
          maintenance_status = @maintenance_status,
          description = @description
      WHERE ticket_id = @ticket_id
    `);

    res.json({ success: true });
  } catch (err) {
    res.status(500).send(err.message);
  }
});
