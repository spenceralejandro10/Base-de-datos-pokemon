# Bóveda TCG

Vitrina de cartas Pokémon TCG con catálogo visual, buscador, enlaces a TCGplayer, existencias, carrito de interés y administración restringida.

**Vitrina pública:** https://spenceralejandro10.github.io/Base-de-datos-pokemon/

**Panel del administrador:** https://spenceralejandro10.github.io/Base-de-datos-pokemon/?admin=1

**Usuario administrativo:** `custodio`. La contraseña se configura de forma privada tras verificar el correo del propietario; no se guarda ni se publica en este repositorio.

**Inventario original:** https://docs.google.com/spreadsheets/d/1qFEBZ1OcQw6NUoF29ZvD-jfc9-l7KOHN_T3bxnXVqaI/edit

## Vista pública

- Galería y tabla de cartas con ID fijo en formato `BTCG-0001`, `BTCG-0002`, etc.
- Búsqueda por carta, número, colección, idioma y código interno.
- Filtros de disponibilidad y botón **Limpiar filtros** para regresar a la vista completa.
- Precio de referencia **TCGplayer en USD** exclusivamente si existe Market Price reciente y un enlace de producto verificable. Si no existe, se busca **Cardmarket en EUR** y se presenta la tendencia. Nunca se muestran ambas fuentes como precios alternativos de la misma carta.
- **Comprobar en TCGplayer** cuando se encuentra una ficha exacta. Si se usa Cardmarket como respaldo, la página muestra **Ver precios en Cardmarket**; de lo contrario, ofrece enlaces de búsqueda sin inventar precios.
- **Agregar a mi selección** limita las unidades solicitadas a las disponibles.
- Carrito de interés con **Descargar lista .txt** / **Copiar lista**. La lista incluye identificadores y cantidades. **No cobra, no crea pedidos, no reserva ni descuenta stock.**
- Los visitantes nunca ven botones de edición ni pueden escribir en Supabase.

## Administración

El acceso está disimulado como el enlace discreto **Acceso Bóveda** en el pie de la web. Abre la dirección del **panel del administrador**, introduce el usuario `custodio` y tu contraseña. **En el primer ingreso**, pulsa «Primera vez o recuperación de acceso» para recibir la verificación en el correo autorizado; una vez confirmado, abre «Crear o cambiar contraseña». Este paso lo debe completar el propietario: todavía no existe una contraseña preestablecida. Supabase Auth gestiona su almacenamiento seguro y las políticas de base de datos hacen cumplir la autorización.

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

**Precios:** datos de mercado consultados mediante TCGdex o Pokémon TCG API. Se muestra Market Price (nunca midPrice) de TCGplayer únicamente cuando dispone de fecha reciente, productId/enlace exacto e identificación inglesa compatible. Solo si falta, se ofrece la tendencia de Cardmarket en EUR. Datos con más de siete días no se anuncian como precios actuales. No equivalen a ofertas garantizadas, cotizaciones al segundo ni precios finales de Bóveda TCG. El precio final se confirma antes de cerrar la venta y puede ser incluso uno o dos dólares menor, según la situación del mercado. Se deben comprobar estado, versión e idioma.

## GitHub Pages

Publicar la rama `main` desde `/(root)`.
