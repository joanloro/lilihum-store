document.addEventListener('DOMContentLoaded', () => {
  let productos = [];
  let carrito = [];
  let paginaActual = 1;
  const POR_PAGINA = 12;
  const WA_NUMBER = '573229087527';
  let intervalosSlide = {};

  const $ = id => document.getElementById(id);
  const productsGrid = $('productsGrid');
  const cartItems = $('cartItems');
  const cartTotal = $('cartTotal');
  const cartCount = $('cartCount');
  const cartOverlay = $('cartOverlay');
  const cartToggle = $('cartToggle');
  const cartClose = $('cartClose');
  const whatsappBtn = $('whatsappBtn');
  const searchInput = $('searchInput');
  const sortSelect = $('sortSelect');
  const pagination = $('pagination');
  const modalOverlay = $('productModal');
  const modalBody = $('modalBody');

  function formatPrice(n) {
    return '$' + Number(n).toLocaleString('es-CO');
  }

  function getPrecioRange(p) {
    if (p.variantes) {
      const precios = p.variantes.map(v => v.precio);
      return { min: Math.min(...precios), max: Math.max(...precios) };
    }
    return { min: p.precio, max: p.precio };
  }

  function getStockTotal(p) {
    if (p.variantes) return p.variantes.reduce((s, v) => s + v.stock, 0);
    return p.stock;
  }

  function filtrarYOrdenar() {
    let filtrados = [...productos];
    const termino = searchInput ? searchInput.value.toLowerCase().trim() : '';
    if (termino) {
      filtrados = filtrados.filter(p => {
        if (p.nombre.toLowerCase().includes(termino)) return true;
        if (p.descripcion && p.descripcion.toLowerCase().includes(termino)) return true;
        if (p.variantes) return p.variantes.some(v => v.tono.toLowerCase().includes(termino));
        return false;
      });
    }
    const criterio = sortSelect ? sortSelect.value : 'nombre-asc';
    switch (criterio) {
      case 'nombre-asc': filtrados.sort((a, b) => a.nombre.localeCompare(b.nombre)); break;
      case 'nombre-desc': filtrados.sort((a, b) => b.nombre.localeCompare(a.nombre)); break;
      case 'precio-asc':
        filtrados.sort((a, b) => getPrecioRange(a).min - getPrecioRange(b).min);
        break;
      case 'precio-desc':
        filtrados.sort((a, b) => getPrecioRange(b).max - getPrecioRange(a).max);
        break;
    }
    const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
    if (paginaActual > totalPaginas) paginaActual = totalPaginas;
    if (paginaActual < 1) paginaActual = 1;
    const inicio = (paginaActual - 1) * POR_PAGINA;
    const paginados = filtrados.slice(inicio, inicio + POR_PAGINA);
    return { productosAMostrar: paginados, totalPaginas, totalResultados: filtrados.length };
  }

  function crearCarrusel(contenedor, imagenes, idUnico, autoSlide = true) {
    contenedor.innerHTML = '';
    if (!imagenes || imagenes.length === 0) {
      const img = document.createElement('img');
      img.src = 'img/placeholder.jpg';
      img.alt = '';
      img.className = 'carousel-img';
      contenedor.appendChild(img);
      return () => {};
    }

    const track = document.createElement('div');
    track.className = 'carousel-track';

    imagenes.forEach((src) => {
      const img = document.createElement('img');
      img.src = src;
      img.alt = '';
      img.className = 'carousel-img';
      img.onerror = function () {
        if (this.dataset.fallback) return;
        this.dataset.fallback = '1';
        this.src =
          "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22400%22><rect fill=%22%23BF6676%22 width=%22400%22 height=%22400%22/><text x=%2250%%22 y=%2250%%22 text-anchor=%22middle%22 fill=%22white%22 font-size=%2220%22>?</text></svg>";
      };
      track.appendChild(img);
    });

    const dots = document.createElement('div');
    dots.className = 'carousel-dots';

    let current = 0;
    const dotEls = [];

    imagenes.forEach((_, i) => {
      const dot = document.createElement('span');
      dot.className = i === 0 ? 'active' : '';
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        goTo(i);
      });
      dots.appendChild(dot);
      dotEls.push(dot);
    });

    contenedor.appendChild(track);
    contenedor.appendChild(dots);

    function goTo(idx) {
      current = idx;
      track.style.transform = `translateX(-${current * 100}%)`;
      dotEls.forEach((d, j) => (d.className = j === current ? 'active' : ''));
    }

    let intervalo = null;
    if (autoSlide && imagenes.length > 1) {
      intervalo = setInterval(() => {
        goTo((current + 1) % imagenes.length);
      }, 3000);

      contenedor.addEventListener('mouseenter', () => {
        if (intervalo) {
          clearInterval(intervalo);
          intervalo = null;
        }
      });
      contenedor.addEventListener('mouseleave', () => {
        if (!intervalo) {
          intervalo = setInterval(() => {
            goTo((current + 1) % imagenes.length);
          }, 3000);
        }
      });
    }

    return () => {
      if (intervalo) clearInterval(intervalo);
    };
  }

  function renderProductos() {
    const { productosAMostrar, totalPaginas, totalResultados } = filtrarYOrdenar();

    Object.values(intervalosSlide).forEach((fn) => fn());
    intervalosSlide = {};

    productsGrid.innerHTML = '';
    if (totalResultados === 0) {
      productsGrid.innerHTML = '<p class="loader">No se encontraron productos</p>';
      pagination.innerHTML = '';
      return;
    }

    productosAMostrar.forEach((p) => {
      const card = document.createElement('div');
      card.className = 'product-card';

      const imagenes = p.imagenes || ['img/placeholder.jpg'];
      const rango = getPrecioRange(p);
      const stockTotal = getStockTotal(p);
      const agotado = stockTotal === 0;
      const esVariantes = !!p.variantes;

      const carouselDiv = document.createElement('div');
      carouselDiv.className = 'card-carousel';

      const idUnico = 'c_' + p.id;
      const cleanup = crearCarrusel(carouselDiv, imagenes, idUnico, true);
      intervalosSlide[idUnico] = cleanup;

      const bodyDiv = document.createElement('div');
      bodyDiv.className = 'product-body';

      let priceHtml = '';
      if (esVariantes && rango.min !== rango.max) {
        priceHtml = `${formatPrice(rango.min)} – ${formatPrice(rango.max)}`;
      } else {
        priceHtml = formatPrice(rango.min);
      }

      let badgeHtml = '';
      if (agotado) {
        badgeHtml = '<span class="tag-agotado">Agotado</span>';
      } else if (esVariantes) {
        badgeHtml = `<span class="tag-variant">${p.variantes.length} tonos</span>`;
      }

      bodyDiv.innerHTML = `
        <h3 class="product-name">${p.nombre}</h3>
        <div class="product-price">${priceHtml}</div>
        ${p.descripcion && !esVariantes ? `<p class="product-desc">${p.descripcion}</p>` : ''}
        ${badgeHtml}
        <div class="product-actions">
          <button class="btn btn-primary" ${agotado ? 'disabled' : ''}>
            ${agotado ? 'Agotado' : 'Agregar'}
          </button>
        </div>
      `;

      card.appendChild(carouselDiv);
      card.appendChild(bodyDiv);

      card.addEventListener('click', (e) => {
        if (e.target.closest('.btn') || e.target.closest('.carousel-dots span')) return;
        abrirModal(p);
      });

      const addBtn = bodyDiv.querySelector('.btn-primary');
      if (addBtn && !agotado) {
        addBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (esVariantes) {
            abrirModal(p);
          } else {
            agregarAlCarrito(p.id);
          }
        });
      }

      productsGrid.appendChild(card);
    });

    renderPaginacion(totalPaginas);
  }

  function abrirModal(producto) {
    const esVariantes = !!producto.variantes;

    let varianteActual = null;
    if (esVariantes) {
      varianteActual = producto.variantes.find((v) => v.stock > 0) || producto.variantes[0];
    }

    const modalImagenes = esVariantes
      ? varianteActual && varianteActual.imagenes
        ? varianteActual.imagenes
        : producto.imagenes
      : producto.imagenes;

    let html = '<button class="modal-close" id="modalCloseBtn">&times;</button>';
    html += '<div class="modal-carousel" id="modalCarousel"></div>';
    html += '<div class="modal-info">';
    html += `<h2 class="modal-title">${producto.nombre}</h2>`;
    if (esVariantes && varianteActual) {
      html += `<p class="modal-tono">Tono: <strong>${varianteActual.tono}</strong></p>`;
    }
    if (producto.descripcion) {
      html += `<p class="modal-desc">${producto.descripcion}</p>`;
    }

    if (esVariantes) {
      html += '<div class="modal-variant-group">';
      html += '<label for="modalVariantSelect">Selecciona tono:</label>';
      html += '<select id="modalVariantSelect" class="modal-variant-select">';
      producto.variantes.forEach((v) => {
        const stockLabel = v.stock > 0 ? '' : ' (Agotado)';
        const disabled = v.stock === 0 ? 'disabled' : '';
        const selected = varianteActual && v.id === varianteActual.id ? 'selected' : '';
        html += `<option value="${v.id}" ${disabled} ${selected}>${v.tono}${stockLabel}</option>`;
      });
      html += '</select></div>';
    }

    const precioActual = esVariantes ? (varianteActual ? varianteActual.precio : 0) : producto.precio;
    const stockActual = esVariantes ? (varianteActual ? varianteActual.stock : 0) : producto.stock;
    html += `<div class="modal-price" id="modalPrice">${formatPrice(precioActual)}</div>`;
    html += `<div class="modal-stock" id="modalStock">${stockActual > 0 ? `${stockActual} en stock` : 'Agotado'}</div>`;
    html += '<div class="modal-actions">';
    html += `<button class="btn btn-primary" id="modalAddBtn" ${stockActual === 0 ? 'disabled' : ''}>Agregar al carrito</button>`;
    html += `<button class="btn btn-whatsapp" id="modalBuyBtn" ${stockActual === 0 ? 'disabled' : ''}>Comprar ahora</button>`;
    html += '</div></div>';

    modalBody.innerHTML = html;

    const modalCarousel = $('modalCarousel');
    const cleanup = crearCarrusel(modalCarousel, modalImagenes, 'modal_' + producto.id, true);
    if (intervalosSlide['modal']) intervalosSlide['modal']();
    intervalosSlide['modal'] = cleanup;

    if (esVariantes) {
      const select = $('modalVariantSelect');
      select.addEventListener('change', () => {
        const vId = Number(select.value);
        const v = producto.variantes.find((x) => x.id === vId);
        if (!v) return;

        if (intervalosSlide['modal']) intervalosSlide['modal']();
        const cleanup2 = crearCarrusel(modalCarousel, v.imagenes || producto.imagenes, 'modal_' + v.id, true);
        intervalosSlide['modal'] = cleanup2;

        const tonoEl = modalBody.querySelector('.modal-tono');
        if (tonoEl) tonoEl.innerHTML = `Tono: <strong>${v.tono}</strong>`;

        $('modalPrice').textContent = formatPrice(v.precio);
        $('modalStock').textContent = v.stock > 0 ? `${v.stock} en stock` : 'Agotado';

        const addBtn = $('modalAddBtn');
        const buyBtn = $('modalBuyBtn');
        addBtn.disabled = v.stock === 0;
        buyBtn.disabled = v.stock === 0;
      });
    }

    $('modalAddBtn').addEventListener('click', () => {
      if (esVariantes) {
        const select = $('modalVariantSelect');
        const vId = Number(select.value);
        const v = producto.variantes.find((x) => x.id === vId);
        if (v && v.stock > 0) {
          agregarAlCarrito(vId, producto);
        }
      } else {
        agregarAlCarrito(producto.id);
      }
      cerrarModal();
    });

    $('modalBuyBtn').addEventListener('click', () => {
      if (esVariantes) {
        const select = $('modalVariantSelect');
        const vId = Number(select.value);
        const v = producto.variantes.find((x) => x.id === vId);
        if (v && v.stock > 0) {
          agregarAlCarrito(vId, producto);
        }
      } else {
        agregarAlCarrito(producto.id);
      }
      cerrarModal();
      if (carrito.length > 0) whatsappBtn.click();
    });

    modalOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';

    $('modalCloseBtn').addEventListener('click', cerrarModal);
  }

  function cerrarModal() {
    modalOverlay.classList.remove('open');
    document.body.style.overflow = '';
    if (intervalosSlide['modal']) {
      intervalosSlide['modal']();
      delete intervalosSlide['modal'];
    }
  }

  function renderPaginacion(totalPaginas) {
    pagination.innerHTML = '';
    if (totalPaginas <= 1) return;
    const ant = document.createElement('button');
    ant.className = 'page-btn';
    ant.textContent = 'Anterior';
    ant.disabled = paginaActual === 1;
    ant.addEventListener('click', () => {
      if (paginaActual > 1) {
        paginaActual--;
        renderProductos();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
    pagination.appendChild(ant);
    for (let i = 1; i <= totalPaginas; i++) {
      const btn = document.createElement('button');
      btn.className = 'page-btn' + (i === paginaActual ? ' active' : '');
      btn.textContent = i;
      btn.addEventListener('click', () => {
        paginaActual = i;
        renderProductos();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      pagination.appendChild(btn);
    }
    const sig = document.createElement('button');
    sig.className = 'page-btn';
    sig.textContent = 'Siguiente';
    sig.disabled = paginaActual === totalPaginas;
    sig.addEventListener('click', () => {
      if (paginaActual < totalPaginas) {
        paginaActual++;
        renderProductos();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
    pagination.appendChild(sig);
  }

  async function cargarProductos() {
    try {
      const res = await fetch('data/productos.json');
      productos = await res.json();
      paginaActual = 1;
      renderProductos();
    } catch (e) {
      productsGrid.innerHTML = '<p class="loader">Error al cargar productos</p>';
    }
  }

  function agregarAlCarrito(id, parentProducto = null) {
    let itemData = null;

    if (parentProducto && parentProducto.variantes) {
      const v = parentProducto.variantes.find((x) => x.id === id);
      if (!v) return;
      itemData = {
        id: v.id,
        parentId: parentProducto.id,
        nombre: parentProducto.nombre,
        tono: v.tono,
        precio: v.precio,
        stock: v.stock,
        imagenes: v.imagenes || parentProducto.imagenes
      };
    } else {
      const p = productos.find((x) => x.id === id);
      if (!p) return;
      itemData = {
        id: p.id,
        nombre: p.nombre,
        precio: p.precio,
        stock: p.stock,
        imagenes: p.imagenes
      };
    }

    const existente = carrito.find((i) => i.id === itemData.id);
    if (existente) {
      existente.cantidad++;
    } else {
      carrito.push({ ...itemData, cantidad: 1 });
    }
    actualizarCarritoUI();
    abrirCarrito();
  }

  function actualizarCarritoUI() {
    const totalItems = carrito.reduce((acc, i) => acc + i.cantidad, 0);
    cartCount.textContent = totalItems;
    if (carrito.length === 0) {
      cartItems.innerHTML = '<p class="cart-empty">El carrito está vacío</p>';
      cartTotal.textContent = formatPrice(0);
      return;
    }
    let html = '';
    let total = 0;
    carrito.forEach((item) => {
      const subtotal = item.precio * item.cantidad;
      total += subtotal;
      const nombreDisplay = item.tono ? `${item.nombre} - Tono ${item.tono}` : item.nombre;
      html += `
        <div class="cart-item">
          <img src="${(item.imagenes && item.imagenes[0]) || 'img/placeholder.jpg'}" alt="${nombreDisplay}" class="cart-item-img"
            onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2256%22 height=%2256%22><rect fill=%22%23BF6676%22 width=%2256%22 height=%2256%22/></svg>'">
          <div class="cart-item-info">
            <div class="cart-item-name">${nombreDisplay}</div>
            <div class="cart-item-price">${formatPrice(item.precio)} c/u</div>
            <div class="cart-item-qty">
              <button class="qty-minus" data-id="${item.id}">−</button>
              <span>${item.cantidad}</span>
              <button class="qty-plus" data-id="${item.id}">+</button>
            </div>
          </div>
          <button class="cart-item-remove" data-id="${item.id}">&times;</button>
        </div>
      `;
    });
    cartItems.innerHTML = html;
    cartTotal.textContent = formatPrice(total);
    cartItems.querySelectorAll('.qty-plus').forEach((btn) => {
      btn.addEventListener('click', () => {
        const item = carrito.find((i) => i.id === Number(btn.dataset.id));
        if (item) item.cantidad++;
        actualizarCarritoUI();
      });
    });
    cartItems.querySelectorAll('.qty-minus').forEach((btn) => {
      btn.addEventListener('click', () => {
        const item = carrito.find((i) => i.id === Number(btn.dataset.id));
        if (item) {
          item.cantidad--;
          if (item.cantidad <= 0) carrito = carrito.filter((i) => i.id !== item.id);
        }
        actualizarCarritoUI();
      });
    });
    cartItems.querySelectorAll('.cart-item-remove').forEach((btn) => {
      btn.addEventListener('click', () => {
        carrito = carrito.filter((i) => i.id !== Number(btn.dataset.id));
        actualizarCarritoUI();
      });
    });
  }

  function abrirCarrito() {
    cartOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function cerrarCarrito() {
    cartOverlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  cartToggle.addEventListener('click', abrirCarrito);
  cartClose.addEventListener('click', cerrarCarrito);
  cartOverlay.addEventListener('click', (e) => {
    if (e.target === cartOverlay) cerrarCarrito();
  });

  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) cerrarModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      cerrarModal();
      cerrarCarrito();
    }
  });

  whatsappBtn.addEventListener('click', () => {
    if (carrito.length === 0) return;
    let total = 0;
    let lines = ['*Pedido Lilihum*', ''];
    carrito.forEach((item) => {
      const subtotal = item.precio * item.cantidad;
      total += subtotal;
      const nombreDisplay = item.tono ? `${item.nombre} - Tono ${item.tono}` : item.nombre;
      lines.push(`• ${nombreDisplay} x${item.cantidad} = ${formatPrice(subtotal)}`);
    });
    lines.push('', `*Total: ${formatPrice(total)}*`);
    lines.push('', '¡Gracias por tu compra!');
    const texto = encodeURIComponent(lines.join('\n'));
    window.open(`https://wa.me/${WA_NUMBER}?text=${texto}`, '_blank');
  });

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      paginaActual = 1;
      renderProductos();
    });
  }
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      paginaActual = 1;
      renderProductos();
    });
  }

  cargarProductos();
});
