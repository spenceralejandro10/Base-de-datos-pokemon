# Bóveda TCG

Vitrina pública de cartas Pokémon con galería, filtros, referencias, disponibilidad y carrito de interés.

**Sitio web:** https://spenceralejandro10.github.io/Base-de-datos-pokemon/

**Google Sheets original:** https://docs.google.com/spreadsheets/d/1qFEBZ1OcQw6NUoF29ZvD-jfc9-l7KOHN_T3bxnXVqaI/edit

## Dos modos con un solo botón

- **Modo cliente** (predeterminado): consulta de imágenes, colección, idioma, número, cantidades, búsqueda en TCGplayer y selección de cartas para descargar un TXT.
- **Modo administrador**: pulsar el botón de la cabecera para mostrar **Editar carta** y **Buscar imagen** en cada ficha. Permite cambiar existencias y disponibilidad, corregir colección e idioma, asignar imágenes y restaurar la ficha del Excel. **Buscar imagen** abre Google Imágenes con el nombre, número, colección e idioma de la carta. Desde **Editar carta** está también **Buscar imagen automáticamente**, que consulta el catálogo, muestra una vista previa verificable y permite **Asignar esta imagen** sin copiar una URL manualmente. Si la coincidencia es de otro idioma, no se asigna automáticamente. El botón principal cambia a **Volver a cliente**.
- No existen formulario de ingreso, usuario ni contraseña para activar el modo de edición.

**Advertencia de seguridad:** por decisión del propietario la edición es pública y sin autenticación. CUALQUIER visitante puede activar el modo administrador y modificar fotos, fichas y cantidades. Este botón es exclusivamente un interruptor visual, NO es un control de acceso. No debe utilizarse con datos privados o para información que deba ser protegida contra ediciones de terceros.

## Datos y persistencia

- **178 referencias, 454 unidades** importadas del Excel. Los ID internos permanecen estables; se retiraron los ID 54 (Alakazam), 121 (Lapras ex) y 122 (Venusaur ex) al consolidar referencias duplicadas. Las nuevas cartas usan los ID 160–181.
- El inventario original se almacena en `public.pokemon_catalog` con acceso **de solo lectura** para visitantes. `cards.js` contiene una copia equivalente como respaldo de visualización.
- Las ediciones de imagen, ficha y existencias se guardan públicamente en tablas independientes de Supabase: `pokemon_image_overrides`, `pokemon_card_overrides`, `pokemon_stock_overrides`. Se reflejan en otros equipos al actualizar.
- Las fotografías manuales se relacionan con la identidad interna original de la carta para que no desaparezcan al ordenar el catálogo.
- Las fotografías subidas se guardan en `pokemon-gallery-overrides` (archivos con UUID; no se sobrescriben directamente). Las imágenes manuales previamente enlazadas desde Google se copian byte por byte al mismo almacenamiento público; `manual-image-backup.json` conserva los enlaces originales. La copia se verifica antes de reemplazar cada enlace, sin cambiar ID ni inventario.
- La galería se ordena por colecciones desde las más recientes hasta las más antiguas. Las etiquetas `BTCG` visibles se numeran consecutivamente en ese orden, mientras los ID internos se mantienen fijos.
- El carrito es una lista por navegador, no realiza compras ni altera existencias. Se puede copiar o descargar como archivo TXT.
- La web consulta la **oferta destacada real** de TCGplayer mediante el mismo endpoint público que su web: `POST https://data.tcgplayer.com/spotlight/search/{productId}` con cabecera `x-version: 1.0`. Se utiliza exclusivamente `spotlight.price`, sin sumar `shippingPrice`. TCGplayer elige el vendedor destacado, sea Direct o Marketplace. No se sustituye por `marketPrice`, `directLowPrice` ni `lowPrice`.
- La instantánea pública se prepara mediante `python scripts/update-prices.py`. El navegador consulta ofertas visibles con más de una hora y conserva el respaldo si una consulta falla. Se usan dos consultas simultáneas y una caché separada `boveda-spotlight-v3-*`; los datos anteriores de Direct Low no se reutilizan. El endpoint permite CORS desde el dominio de GitHub Pages. Una consulta fallida muestra «Oferta por confirmar», sin afirmar que no existan vendedores.
- TCGCSV se usa solo para identificar colección, número, nombre y producto, desde el script; no se consulta desde el navegador. El precio siempre procede de la oferta Spotlight de TCGplayer. El cambio USD/COP procede de ExchangeRate-API.
- Se exige coincidencia por colección, número y nombre. El catálogo japonés se consulta por separado y se solicita idioma japonés en la oferta. Las cartas en español muestran una referencia inglesa identificada. Cada oferta muestra su estado de conservación real, que no presupone el estado de la carta del inventario.
- Los precios no incluyen envío ni comisiones, y el valor de venta se confirma antes de comprar. La conversión redondea al peso más cercano sin márgenes añadidos. Si el cambio tiene más de siete días, no se muestra una conversión numérica. Una oferta conservada de más de un día queda identificada como «Último dato».
- `python scripts/update-prices.py` renueva exclusivamente `market-snapshot.js`; no escribe en Supabase ni modifica cartas, fotos o existencias. Si una actualización masiva falla, conserva la instantánea anterior.
- Las actualizaciones posteriores al Excel no se sincronizan solas: hay que actualizar `pokemon_catalog` y `cards.js` manteniendo los ID internos.

## Archivos

`index.html`: interfaz y herramientas de edición.
`styles.css`: diseño responsive.
`cards.js`: copia del inventario.
`app.js`: galería, filtros, carrito, interruptor y edición.
`shared-images.js`: imágenes compartidas y catálogo central.
`catalog-overrides.js`: colección e idioma corregidos.
`card-stock.js`: existencias.
`card-images.js`: imágenes de colecciones.
`market-prices.js`: coincidencias TCGplayer, conversión COP, actualización y enlace de consulta.
`market-snapshot.js`: respaldo público de cotizaciones y cambio.
`scripts/update-prices.py`: actualización del respaldo de precios.

La web estática se sirve desde GitHub Pages, rama `main`, carpeta raíz.
