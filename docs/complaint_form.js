const select = document.getElementById("complaint-reason");
const otherContainer = document.getElementById("other-container");
const otherInput = document.getElementById("other-reason");

async function loadRideOptions() {
  try {
    const response = await fetch("/rides");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const rides = await response.json();
    select.innerHTML = ""; // Clear placeholder

    // Add ride options with ride_id as value
    rides.forEach((ride) => {
      const option = document.createElement("option");
      option.value = String(ride.ride_id);
      option.textContent = ride.ride_name;
      select.appendChild(option);
    });

    // Add static category options
    ["giftshop", "employee", "other"].forEach((val) => {
      const option = document.createElement("option");
      option.value = val;
      option.textContent =
        val === "giftshop"
          ? "Gift Shop"
          : val.charAt(0).toUpperCase() + val.slice(1);
      select.appendChild(option);
    });
  } catch (error) {
    console.error("Error loading rides:", error);
    select.innerHTML = '<option value="" disabled>Error loading rides</option>';
  }
}

// Load rides on page load
loadRideOptions();

select.addEventListener("change", function () {
  if (this.value === "other") {
    otherContainer.style.display = "block";
    otherInput.required = true;
  } else {
    otherContainer.style.display = "none";
    otherInput.required = false;
    otherInput.value = "";
  }
});
