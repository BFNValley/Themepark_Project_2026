let cart =[];

function addToCart(){
    const ride_id = document.getElementById("rideSelect").value;
    const ticket_type = document.getElementById("ticketType").value;
    const quantity = parseInt(document.getElementById("ticketQuantity").value);

   
    if (quantity < 1)
    {
        alert("Quantity must be at least 1.");
        return;
    }

    const rideSelect = document.getElementById("rideSelect");
    const ride_name = rideSelect.selectedOptions[0].textContent;
    const ride_price = parseFloat(rideSelect.selectedOptions[0].dataset.price);

    const item = { ride_id, ticket_type, quantity, ride_price, ride_name };
    cart.push(item);
    renderCart();
}

function renderCart(){
    const cartList = document.getElementById("cartList");
    cartList.innerHTML = "";

    cart.forEach((item, index) => {
        const li = document.createElement("li");
        li.textContent = `Ride ${item.ride_id} - ${item.ticket_type} x ${item.quantity}`;

        const removeButton = document.createElement("button");
        removeButton.textContent = "Remove";
        removeButton.onclick = () => {
            cart.splice(index, 1);
            renderCart();
        };

        li.appendChild(removeButton);
        cartList.appendChild(li);
    });

    calculateTotal();
}

function calculateTotal(){
    let total = 0;
    cart.forEach(item => {
        let price = item.ride_price;

        if (item.ticket_type === "child") {
            price *= 0.5;
        }

        total += price * item.quantity;
    });
    document.getElementById("totalPrice").textContent = total.toFixed(2);
}

async function loadRides(){
    try{
        const response = await fetch("/rides");
        const rides = await response.json();

        const rideSelect = document.getElementById("rideSelect");
        rideSelect.innerHTML = "";

        rides.forEach(ride => {
            const option = document.createElement("option");
            option.value = ride.ride_id;
            option.textContent = `${ride.ride_name} ($${ride.ride_price})`;

            option.dataset.price = ride.ride_price;
            option.dataset.name = ride.ride_name;

            rideSelect.appendChild(option);
        });
    } catch (err) {
        console.error("Error loading rides:", err);
    }
}

window.onload = loadRides;

async function checkout(){
    const customer_id = document.getElementById("customerID").value;

    if(!customer_id){
        alert("Please enter your customer ID.");
        return;
    }

    if (cart.length === 0){
        alert("Your cart is empty.");
        return;
    }

    const response = await fetch ("/buy-ticket", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({customer_id, cart})
    });

    const result = await response.text();
    alert(result);

    cart = [];
    renderCart();
}