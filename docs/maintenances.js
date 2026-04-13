async function loadTickets() {
  const response = await fetch("/maintenance-tickets");
  const tickets = await response.json();

  const tbody = document.querySelector("#maintenanceTicketsTable tbody");
  tbody.innerHTML = "";

  tickets.forEach((ticket) => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${ticket.ticket_id}</td>
      <td>${ticket.ride_id}</td>
      <td>${ticket.employee_id}</td>
      <td>${ticket.issue_type}</td>
      <td>${ticket.maintenance_priority}</td>
      <td>${ticket.maintenance_status}</td>
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
