let products = [];
let cart = [];

const grid = document.getElementById("product-grid");
const statusMsg = document.getElementById("status-msg");
const cartList = document.getElementById("cart-list");
const cartTotal = document.getElementById("cart-total");

document.getElementById("refresh-btn").addEventListener("click", loadProducts);
document.getElementById("clear-cart-btn").addEventListener("click", () => {
  cart = [];
  renderCart();
});

function setStatus(message, isError = false) {
  statusMsg.textContent = message;
  statusMsg.style.color = isError ? "#a53025" : "#1e7d46";
}

async function loadProducts() {
  setStatus("Loading products...");
  try {
    const response = await fetch("/gift-shop/catalog");
    const data = await response.json();

    if (!response.ok) {
      setStatus(data.message || "Failed to load products.", true);
      return;
    }

    products = data;
    renderProducts();
    setStatus(data.length ? "Products loaded." : "No products in stock.");
  } catch (err) {
    setStatus("Server error while loading products.", true);
  }
}

function renderProducts() {
  grid.innerHTML = "";

  if (!products.length) {
    grid.innerHTML = "<p>No products available right now.</p>";
    return;
  }

  products.forEach((product) => {
    const item = document.createElement("article");
    item.className = "product-item";
    item.innerHTML = `
      <h3>${escapeHtml(product.product_name)}</h3>
      <p class="product-meta">Price: $${Number(product.product_price).toFixed(2)}</p>
      <p class="product-meta">In Stock: ${product.stock}</p>
      <div class="quantity-row">
        <label for="qty-${product.product_id}">Qty</label>
        <input id="qty-${product.product_id}" type="number" min="1" max="${product.stock}" value="1" />
        <button type="button" data-id="${product.product_id}">Add</button>
      </div>
    `;

    const button = item.querySelector("button");
    button.addEventListener("click", () => addToCart(product.product_id));
    grid.appendChild(item);
  });
}

function addToCart(productId) {
  const product = products.find((p) => p.product_id === productId);
  if (!product) return;

  const qtyInput = document.getElementById(`qty-${productId}`);
  const quantity = Number(qtyInput.value);

  if (!Number.isInteger(quantity) || quantity < 1) {
    alert("Quantity must be at least 1.");
    return;
  }

  if (quantity > product.stock) {
    alert("Quantity exceeds available stock.");
    return;
  }

  const existing = cart.find((c) => c.product_id === productId);
  if (existing) {
    const newQty = existing.quantity + quantity;
    if (newQty > product.stock) {
      alert("Total quantity in cart exceeds stock.");
      return;
    }
    existing.quantity = newQty;
  } else {
    cart.push({
      product_id: product.product_id,
      product_name: product.product_name,
      product_price: Number(product.product_price),
      quantity,
    });
  }

  renderCart();
}

function renderCart() {
  cartList.innerHTML = "";
  let total = 0;

  cart.forEach((item, index) => {
    total += item.product_price * item.quantity;

    const li = document.createElement("li");
    li.textContent = `${item.product_name} - $${item.product_price.toFixed(2)} x ${item.quantity} `;

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.textContent = "Remove";
    removeButton.addEventListener("click", () => {
      cart.splice(index, 1);
      renderCart();
    });

    li.appendChild(removeButton);
    cartList.appendChild(li);
  });

  cartTotal.textContent = total.toFixed(2);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

loadProducts();
