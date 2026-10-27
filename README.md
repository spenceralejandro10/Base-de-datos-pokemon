# Bóveda TCG

Vitrina de cartas Pokémon TCG con catálogo visual, buscador, enlaces a TCGplayer, existencias, carrito de interés y administración restringida.

**Vitrina pública:** https://spenceralejandro10.github.io/Base-de-datos-pokemon/

**Panel del administrador:** https://spenceralejandro10.github.io/Base-de-datos-pokemon/?admin=1

**Inventario original:** https://docs.google.com/spreadsheets/d/1qFEBZ1OcQw6NUoF29ZvD-jfc9-l7KOHN_T3bxnXVqaI/edit

## Vista pública

- Galería y tabla de cartas con ID fijo en formato `BTCG-0001`, `BTCG-0002`, etc.
- Búsqueda por carta, número, colección, idioma y código interno.
- Filtros de disponibilidad y botón **Limpiar filtros** para regresar a la vista completa.
- Precio de referencia **TCGplayer en USD** por variante cuando la fuente publica datos, junto con su última fecha de actualización.
- **Ver carta en TCGplayer** cuando la API tiene un `productId` verificable; de lo contrario, **Buscar en TCGplayer** con nombre, número y expansión.
- **Agregar a mi selección** limita las unidades solicitadas a las disponibles.
- Carrito de interés con **Descargar lista .txt** / **Copiar lista**. La lista incluye identificadores y cantidades. **No cobra, no crea pedidos, no reserva ni descuenta stock.**
- Los visitantes nunca ven botones de edición ni pueden escribir en Supabase.

## Administración

Abre la dirección del **panel del administrador** y autentícate con el correo de administrador autorizado por la base de datos.

Desde **Editar carta**, el propietario puede:

- Subir una fotografía o asignar una URL HTTPS. Las imágenes quedan persistidas en Supabase y visibles desde cualquier equipo.
- Escribir o corregir la colección, idioma y nota de verificación para esta vitrina.
- Establecer las unidades disponibles y marcar una carta como **No disponible**.
- Restaurar colección e idioma desde los registros originales de Google Sheets.
- Importar imágenes antiguas guardadas solamente en el navegador actual.

**Importante:** todas las modificaciones se guardan en tablas independientes de Supabase con RLS: `pokemon_image_overrides`, `pokemon_card_overrides` y `pokemon_stock_overrides`. El documento original de Google Sheets no se reescribe. Los cambios publicados son visibles desde distintos computadores o celulares después de actualizar la página (y periódicamente mientras permanezca abierta).

La cuenta permitida está validada **en la base de datos**, no solo por el botón oculto. El cliente utiliza una clave pública de Supabase; no incluye claves privilegiadas de servicio.

## Archivo e infraestructura

- `index.html` — página de la vitrina y panel.
- `styles.css` — diseño responsive.
- `cards.js` — copia del inventario de Google Sheets (importación estática de 55 referencias).
- `card-images.js` — imágenes de cartas buscadas en catálogos.
- `market-prices.js` — precios de referencia TCGplayer y enlaces.
- `shared-images.js` — login y fotografías persistidas.
- `catalog-overrides.js` — colección e idioma corregidos en la vitrina.
- `card-stock.js` — existencias y disponibilidad.
- `app.js` — galerías, filtros, carrito, panel administrativo.

El carrito se guarda temporalmente en **el navegador de cada visitante**, no como un pedido en un servidor. Su selección puede exportarse como archivo TXT y compartirse con el vendedor.

**Nota:** los cambios que se hagan posteriormente en Google Sheets no actualizan `cards.js` automáticamente. Es necesario importar nuevamente los registros de la hoja sin sobrescribir los ajustes publicados por el administrador. Las imágenes y existencias sí están alojadas en Supabase.

**Precios:** datos de mercado consultados mediante TCGdex o Pokémon TCG API. No equivalen a precios garantizados, cotizaciones instante por instante ni ofertas de Bóveda TCG. Las ediciones japonesas o los registros con datos insuficientes pueden carecer de precio de referencia en TCGplayer.

## GitHub Pages

Publicar la rama `main` desde `/(root)`.
