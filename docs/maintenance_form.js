document
  .getElementById("maintenance_form")
  .addEventListener("submit", function () {
    document.getElementById("employee_id").value =
      localStorage.getItem("employee_id");
  });
