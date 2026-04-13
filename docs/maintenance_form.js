document
  .getElementById("maintenance_form")
  .addEventListener("submit", function () {
    document.getElementById("employee_id").value =
      sessionStorage.getItem("employee_id");
  });
