const select = document.getElementById("complaint-reason");
const otherContainer = document.getElementById("other-container");
const otherInput = document.getElementById("other-reason");

select.addEventListener("change", function () {
  if (this.value === "other") {
    otherContainer.style.display = "block";
    otherInput.required = true;
  } else {
    otherContainer.style.display = "none";
    otherInput.required = false;
    otherInput.value = ""; // clear it
  }
});
