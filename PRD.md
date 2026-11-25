# PRD — LibroYa

**Producto:** LibroYa  
**Tipo:** Aplicación web full-stack de comercio electrónico para venta de libros electrónicos, gestión de catálogo y stock, pasarela de pago PayPal Sandbox y gestión/seguimiento de envíos en tiempo real.  
**Versión:** 1.0 (Noviembre de 2026)  

---

## 1. Visión y Problema
LibroYa permite a lectores explorar y comprar libros electrónicos (EPUB, PDF, Audiolibro y Edición Impresa + eBook), validar disponibilidad de stock antes y durante el pago con PayPal Sandbox, obtener licencias digitales tras captura verificada y consultar en tiempo real el progreso de preparación y envío de su pedido. Para los administradores editoriales y de logística, ofrece una consola protegida con tablero Kanban en tiempo real y control de inventario.

---

## 2. Actores y Roles
| Rol | Alcance y permisos |
|---|---|
| **Visitante (no autenticado)** | Navega la página inicial (`/`), explora el catálogo público (`/catalogo`), filtra por categoría/formato/disponibilidad, inspecciona detalles de libros, arma carrito local, y accede a `/login` y `/registro`. No puede crear pedidos, pagar ni acceder a `/admin`. |
| **Cliente (`cliente`)** | Rol asignado obligatoriamente por el servidor al registrarse. Puede crear pedidos desde `/carrito`, pagar en `/checkout/[orderId]` con PayPal Sandbox, consultar exclusivamente sus propios pedidos en `/pedidos`, descargar certificados de licencia de pedidos pagados y recibir actualizaciones en tiempo real vía Socket.IO en su canal `user:<id>`. Recibe `403` si intenta acceder a funciones de administrador o a pedidos de otro cliente. |
| **Administrador (`administrador`)** | Gestionado por seed. Accede a `/admin` para visualizar el tablero Kanban de envíos (`Pendiente` -> `En preparación` -> `Enviado` -> `Entregado`), asignar códigos de guía, crear/editar/eliminar libros y ajustar el stock en tiempo real (`PATCH /api/books/:id/stock`). |

---

## 3. Cuentas de Prueba (Entorno Sandbox)
- **Cliente de prueba:** `cliente@libroya.com` / `Cliente123!`
- **Administrador de prueba:** `admin@libroya.com` / `Admin123!`
- **Notas de seguridad:** Estas cuentas son exclusivamente ficticias para pruebas funcionales. No contienen datos personales reales. Los pagos usan exclusivamente **PayPal Sandbox**.

---

## 4. Requisitos Funcionales por Área (TestSprite Areas)

### 4.1. Landing & Public Entry
- **RF-01:** La ruta `/` muestra propuesta de valor, botones de navegación (`Explorar catálogo`, `Iniciar sesión`, `Crear cuenta de cliente`) y títulos destacados obtenidos desde `GET /api/books`.
- **RF-02:** La barra de navegación muestra `Catálogo`, `Carrito (n)`, `Iniciar sesión` y `Crear cuenta` para visitantes; oculta `Gestión y Envíos` para usuarios no administradores.

### 4.2. Account Access
- **RF-03:** `POST /api/auth/register` crea usuario con contraseña cifrada mediante `bcrypt` y asigna `role: "cliente"` en el servidor (ignora cualquier campo `role` enviado desde el navegador).
- **RF-04:** `POST /api/auth/login` valida credenciales y devuelve JWT firmado (`Authorization: Bearer <token>`) más cookie `httpOnly`. Ante credenciales erróneas responde `401` con mensaje genérico `"Credenciales inválidas."`.
- **RF-05:** Un cliente autenticado que navegue a `/admin` visualiza pantalla de `"Acceso denegado (403)"` y toda petición a `/api/orders`, `PATCH /api/orders/:id/status` o `/api/books` mutante es rechazada con `403`.

### 4.3. Menu / Book Catalog & Stock
- **RF-06:** `/catalogo` permite búsqueda textual (título, autor, ISBN), filtro por categoría (`Programación`, `Inteligencia Artificial`, `Arquitectura`, `Ciencia Ficción`, `Negocios`, `Diseño`), filtro por formato (`EPUB`, `PDF`, `Audiolibro`, `Edición Impresa + eBook`) y casilla `"Solo con stock"`.
- **RF-07:** Los libros con `stock === 0` o `available === false` muestran insignia `"Agotado"` y deshabilitan el botón `"Añadir al carrito"`. Los libros con `stock <= 5` muestran alerta `"Últimas N uds."`.
- **RF-08:** El modal `"Detalles"` exhibe páginas, idioma, año, ISBN, stock actual y botón para añadir al carrito.

### 4.4. Cart & Delivery
- **RF-09:** `/carrito` permite aumentar/disminuir cantidades (limitado al stock máximo disponible) y quitar ítems, recalculando subtotal y total estimado según método de envío:
  - `DIGITAL_INSTANT`: `$0.00`
  - `STANDARD`: `$4.99`
  - `EXPRESS`: `$9.99`
- **RF-10:** El formulario exige `fullName`, `street`, `city`, `postalCode` y `country` válidos. Al confirmar, envía únicamente `{ items: [{ bookId, quantity }], shippingAddress, shippingMethod }` a `POST /api/orders`.
- **RF-11:** El backend consulta los precios vigentes en MongoDB, verifica stock suficiente y recalcula `subtotal`, `shippingCost` y `total`. Cualquier precio/total alterado en el navegador es ignorado. Cantidades `<= 0` o campos vacíos devuelven `400`; solicitudes superiores al stock devuelven `409`.

### 4.5. Payment & PayPal Sandbox Checkout
- **RF-12:** `/checkout/[orderId]` consulta `GET /api/orders/:id` y muestra el resumen autoritativo del servidor junto con los botones oficiales de PayPal Sandbox.
- **RF-13:** `POST /api/payments/paypal/order` crea la orden en PayPal Sandbox por el `order.total` almacenado en base de datos, validando propiedad del pedido y disponibilidad de stock.
- **RF-14:** `POST /api/payments/paypal/capture` captura el pago en PayPal, verifica `status === "COMPLETED"`, moneda `USD` e importe coincidente con `order.total`, descuenta atómicamente el stock de cada libro en MongoDB, marca `paymentStatus = "CAPTURED"` y `status = "PAID"`, y emite eventos WebSocket (`order:created`, `order:updated`, `stock:updated`).
- **RF-15 (Idempotencia y Recuperación):** Capturas repetidas para la misma orden retornan `200` con `idempotent: true` sin doble cobro ni doble descuento de stock. Si el usuario cancela (`POST /api/payments/paypal/cancel`) o falla PayPal, el pedido permanece en `PENDING_PAYMENT` sin descontar stock y permite reintentar.

### 4.6. Order History
- **RF-16:** `/pedidos` muestra exclusivamente los pedidos del usuario autenticado (`GET /api/orders/me`). Un usuario nunca puede consultar `GET /api/orders/:id` ni capturar pagos de un pedido ajeno (`403`).
- **RF-17:** Los pedidos pagados muestran línea de progreso (`Pendiente -> En preparación -> Enviado -> Entregado`), código de guía (`trackingCode`) cuando ha sido despachado y botón `"Descargar certificado de licencia"`.

### 4.7. Real-Time Order Tracking & Admin Kanban
- **RF-18:** El backend mantiene Socket.IO en el mismo proceso Express autenticando el handshake mediante JWT. Los administradores se unen únicamente a `admin:shipments` y cada usuario a `user:<id>`.
- **RF-19:** En `/admin`, el tablero Kanban muestra 4 columnas (`Pendiente`, `En preparación`, `Enviado`, `Entregado`) con Drag & Drop y botones de transición controlada.
- **RF-20 (Máquina de Estados):** Solo se permiten transiciones secuenciales válidas:
  `PAID -> PREPARING -> SHIPPED -> DELIVERED`.
  Cualquier intento de saltar etapas (ej. `PAID -> DELIVERED`) o mover pedidos sin pagar (`PENDING_PAYMENT`) es rechazado por el servidor con `400`.
- **RF-21:** Al cambiar el estado de un pedido en `/admin`, el cliente propietario conectado en `/pedidos` recibe `order:statusChanged` / `order:updated` en tiempo real sin recargar la página. Si la conexión cae, el cliente muestra `"Reconectando..."` y resincroniza por REST al reconectar.

---

## 5. Criterios de Aceptación y Casos de Prueba Mínimos
| ID | Área | Escenario | Resultado esperado | Prioridad |
|---|---|---|---|---|
| CA-01 | Entrada pública | Abrir `/` y `/catalogo` sin sesión | Catálogo carga libros; no expone rutas ni botones privados de admin | Alta |
| CA-02 | Acceso | Login válido e inválido | Token y redirección según rol / error genérico `401` | Alta |
| CA-03 | Roles | Cliente intenta abrir `/admin` o llamar endpoints admin | UI muestra Acceso denegado y API responde `403` | Alta |
| CA-04 | Catálogo | Filtrar por categoría, formato, búsqueda y stock | Resultados coinciden con filtros y libros agotados bloquean compra | Media |
| CA-05 | Carrito | Añadir, modificar cantidades y elegir método de envío | Respeta tope de stock y actualiza subtotal/total | Alta |
| CA-06 | Pedido | Cliente envía `unitPrice` o `total` alterados | Backend recalcula con precios de MongoDB e ignora los del cliente | Alta |
| CA-07 | Pago | Completar PayPal Sandbox | Captura verificada, stock descontado 1 vez, pedido pasa a `PAID` | Alta |
| CA-08 | Pago | Cancelar flujo PayPal o simular error | Pedido sigue `PENDING_PAYMENT`, stock intacto, permite reintentar | Alta |
| CA-09 | Idempotencia | Repetir petición `POST /api/payments/paypal/capture` | Responde `idempotent: true` sin doble descuento de stock | Alta |
| CA-10 | Historial | Cliente B intenta ver o pagar pedido de Cliente A | API responde `403 Forbidden` | Alta |
| CA-11 | Tiempo real | Admin mueve pedido a `En preparación` / `Enviado` | Cliente dueño ve el nuevo estado y código de guía en `/pedidos` sin recargar | Alta |
| CA-12 | Máquina de estados | Admin intenta saltar `PAID -> DELIVERED` | Servidor rechaza con `400` y mensaje explícito | Alta |
| CA-13 | Validación | Cantidad negativa, vacía o superior al stock; dirección vacía | Rechazado con `400` / `409` y mensaje claro | Media |
| CA-14 | Despliegue | Recargar rutas internas (`/catalogo`, `/pedidos`, `/admin`) | Sin errores 404 ni pérdida de sesión válida | Media |
