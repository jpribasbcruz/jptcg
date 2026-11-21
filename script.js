// ---------- Config ----------
// Troque pelo link de pagamento gerado no seu painel do Mercado Pago
// (Mercado Pago > Cobranças > Link de pagamento). O cliente paga lá,
// com Pix ou cartão, e os dados do cartão nunca passam pelo seu site.
const LINK_PAGAMENTO_PADRAO = "https://www.mercadopago.com.br/";

const WHATSAPP_NUMERO = "5500000000000"; // troque pelo seu número, com DDI e DDD

// ---------- Estado ----------
let produtos = [];
let carrinho = JSON.parse(localStorage.getItem("carrinho") || "{}");

// ---------- Elementos ----------
const grid = document.getElementById("product-grid");
const filtroTipo = document.getElementById("filtro-tipo");
const cartDrawer = document.getElementById("cart-drawer");
const cartItemsEl = document.getElementById("cart-items");
const cartTotalEl = document.getElementById("cart-total");
const cartCountEl = document.getElementById("cart-count");
const overlay = document.getElementById("overlay");
const checkoutOverlay = document.getElementById("checkout-overlay");
const checkoutModal = document.getElementById("checkout-modal");
const stepEndereco = document.getElementById("step-endereco");
const stepPagamento = document.getElementById("step-pagamento");
const resumoTotal = document.getElementById("resumo-total");
const linkPagamento = document.getElementById("link-pagamento");

// ---------- Carregar produtos ----------
fetch("produtos.json")
  .then((r) => r.json())
  .then((data) => {
    produtos = data;
    renderGrid();
  })
  .catch(() => {
    grid.innerHTML = "<p>Não foi possível carregar o catálogo agora.</p>";
  });

function formatarPreco(valor) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function renderGrid() {
  const tipo = filtroTipo.value;
  const lista = tipo === "todos" ? produtos : produtos.filter((p) => p.tipo === tipo);

  grid.innerHTML = lista.map((p) => `
    <article class="card">
      <span class="card-tipo">${p.tipo} · ${p.colecao}</span>
      <h3>${p.nome}</h3>
      <p class="card-desc">${p.descricao}</p>
      <span class="card-preco">${formatarPreco(p.preco)}</span>
      <span class="card-estoque">${p.estoque > 0 ? p.estoque + " em estoque" : "Esgotado"}</span>
      <button class="btn-add" data-id="${p.id}" ${p.estoque === 0 ? "disabled" : ""}>
        ${p.estoque === 0 ? "Indisponível" : "Adicionar ao carrinho"}
      </button>
    </article>
  `).join("");

  grid.querySelectorAll(".btn-add").forEach((btn) => {
    btn.addEventListener("click", () => adicionarAoCarrinho(btn.dataset.id));
  });
}

filtroTipo.addEventListener("change", renderGrid);

// ---------- Carrinho ----------
function salvarCarrinho() {
  localStorage.setItem("carrinho", JSON.stringify(carrinho));
}

function adicionarAoCarrinho(id) {
  carrinho[id] = (carrinho[id] || 0) + 1;
  salvarCarrinho();
  renderCarrinho();
  abrirCarrinho();
}

function alterarQtd(id, delta) {
  if (!carrinho[id]) return;
  carrinho[id] += delta;
  if (carrinho[id] <= 0) delete carrinho[id];
  salvarCarrinho();
  renderCarrinho();
}

function calcularTotal() {
  return Object.entries(carrinho).reduce((soma, [id, qtd]) => {
    const produto = produtos.find((p) => p.id === id);
    return produto ? soma + produto.preco * qtd : soma;
  }, 0);
}

function renderCarrinho() {
  const ids = Object.keys(carrinho);
  const totalItens = ids.reduce((s, id) => s + carrinho[id], 0);
  cartCountEl.textContent = totalItens;

  if (ids.length === 0) {
    cartItemsEl.innerHTML = '<p class="cart-empty">Seu carrinho está vazio.</p>';
  } else {
    cartItemsEl.innerHTML = ids.map((id) => {
      const p = produtos.find((prod) => prod.id === id);
      if (!p) return "";
      return `
        <div class="cart-item">
          <div>
            <div>${p.nome}</div>
            <div class="cart-item-qty">
              <button data-id="${id}" data-delta="-1">-</button>
              <span>${carrinho[id]}</span>
              <button data-id="${id}" data-delta="1">+</button>
            </div>
          </div>
          <strong>${formatarPreco(p.preco * carrinho[id])}</strong>
        </div>
      `;
    }).join("");

    cartItemsEl.querySelectorAll("button[data-delta]").forEach((btn) => {
      btn.addEventListener("click", () =>
        alterarQtd(btn.dataset.id, parseInt(btn.dataset.delta, 10))
      );
    });
  }

  cartTotalEl.textContent = formatarPreco(calcularTotal());
}

function abrirCarrinho() {
  cartDrawer.classList.add("open");
  overlay.classList.add("active");
}
function fecharCarrinho() {
  cartDrawer.classList.remove("open");
  overlay.classList.remove("active");
}

document.getElementById("open-cart").addEventListener("click", abrirCarrinho);
document.getElementById("close-cart").addEventListener("click", fecharCarrinho);
overlay.addEventListener("click", fecharCarrinho);

// ---------- Checkout: endereço -> link de pagamento ----------
document.getElementById("go-checkout").addEventListener("click", () => {
  if (Object.keys(carrinho).length === 0) return;
  fecharCarrinho();
  abrirCheckout();
});

function abrirCheckout() {
  stepEndereco.hidden = false;
  stepPagamento.hidden = true;
  checkoutModal.classList.add("open");
  checkoutOverlay.classList.add("active");
}
function fecharCheckout() {
  checkoutModal.classList.remove("open");
  checkoutOverlay.classList.remove("active");
}
document.getElementById("close-checkout").addEventListener("click", fecharCheckout);
checkoutOverlay.addEventListener("click", fecharCheckout);

document.getElementById("form-endereco").addEventListener("submit", (e) => {
  e.preventDefault();
  const dados = Object.fromEntries(new FormData(e.target).entries());

  // Monta o resumo do pedido para enviar por WhatsApp junto com o pagamento,
  // já que o checkout é manual/semiautomático nesta versão gratuita.
  const itensTexto = Object.entries(carrinho)
    .map(([id, qtd]) => {
      const p = produtos.find((prod) => prod.id === id);
      return p ? `${qtd}x ${p.nome} (${formatarPreco(p.preco)})` : "";
    })
    .filter(Boolean)
    .join("\n");

  const total = calcularTotal();
  resumoTotal.textContent = formatarPreco(total);
  linkPagamento.href = LINK_PAGAMENTO_PADRAO;

  // Prepara um link de WhatsApp com o pedido pronto, para você confirmar
  // o envio depois que o cliente mostrar o comprovante do Mercado Pago.
  const mensagem = encodeURIComponent(
    `Olá! Fiz um pedido na Pack Rare:\n\n${itensTexto}\n\nTotal: ${formatarPreco(total)}\n\n` +
    `Nome: ${dados.nome}\nEndereço: ${dados.endereco}, ${dados.numero} ${dados.complemento || ""}\n` +
    `${dados.cidade}/${dados.uf} - CEP ${dados.cep}\nE-mail: ${dados.email}`
  );
  linkPagamento.dataset.whatsapp = `https://wa.me/${WHATSAPP_NUMERO}?text=${mensagem}`;

  stepEndereco.hidden = true;
  stepPagamento.hidden = false;
});

// Depois de clicar em pagar, oferece o atalho para confirmar o pedido no WhatsApp
linkPagamento.addEventListener("click", () => {
  setTimeout(() => {
    if (linkPagamento.dataset.whatsapp && confirm("Pagamento feito? Quer enviar o comprovante pelo WhatsApp agora?")) {
      window.open(linkPagamento.dataset.whatsapp, "_blank");
    }
  }, 800);
});

// ---------- Inicialização ----------
renderCarrinho();
