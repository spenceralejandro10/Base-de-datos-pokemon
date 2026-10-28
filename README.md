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

- Las fotos se muestran automáticamente mediante TCGdex (incluidas 30th Celebration y 30th Classic Collection) y las imágenes propias tienen prioridad. Los enlaces manuales nunca se sobrescriben. Si un enlace deja de cargar, la galería busca una imagen oficial de respaldo. En modo administrador, **Completar fotos automáticamente** busca imágenes exactas en lote y solo guarda las verificadas, sin sustituir las manuales. Las imágenes de referencia en otro idioma no se guardan como fotografías exactas.

- **250 referencias, 565 unidades** importadas del Excel. Los ID internos permanecen estables; se retiraron los ID 54 (Alakazam), 121 (Lapras ex) y 122 (Venusaur ex) al consolidar referencias duplicadas. Las nuevas cartas usan los ID 160–253; se conservan intactos los identificadores anteriores.
- El inventario original se almacena en `public.pokemon_catalog` con acceso **de solo lectura** para visitantes. `cards.js` contiene una copia equivalente como respaldo de visualización.
- Las ediciones de imagen, ficha y existencias se guardan públicamente en tablas independientes de Supabase: `pokemon_image_overrides`, `pokemon_card_overrides`, `pokemon_stock_overrides`. Se reflejan en otros equipos al actualizar.
- Las fotografías manuales se relacionan con la identidad interna original de la carta para que no desaparezcan al ordenar el catálogo.
- Las fotografías subidas se guardan en `pokemon-gallery-overrides` (archivos con UUID; no se sobrescriben directamente). Las imágenes manuales previamente enlazadas desde Google se copian byte por byte al mismo almacenamiento público; `manual-image-backup.json` conserva los enlaces originales. La copia se verifica antes de reemplazar cada enlace, sin cambiar ID ni inventario.
- La galería se ordena por colecciones desde las más recientes hasta las más antiguas. Las etiquetas `BTCG` visibles se numeran consecutivamente en ese orden, mientras los ID internos se mantienen fijos.
- El carrito es una lista por navegador, no realiza compras ni altera existencias. Se puede copiar o descargar como archivo TXT.
- La web utiliza **TCGplayer Market Price** (`marketPrice`), basado en ventas realizadas, convertido a COP. No utiliza `spotlight.price`, Direct Low ni la oferta de un vendedor. No añade márgenes al cambio.
- El precio de mercado se distingue del estado declarado por el propietario: cartas sin jugar, recién sacadas de sobre y protegidas en toploader. No se asignan etiquetas de jugada, usada o dañada a partir de anuncios ajenos. Market Price es una referencia agregada, no una calificación profesional de cada unidad ni una garantía de venta.
- Se valida colección, número, nombre e idioma. Las cartas españolas conservan una referencia inglesa identificada. Si hay varios acabados, aparece un rango; si la identidad no está confirmada, no se inventa un precio.
- `python scripts/update-prices.py` actualiza únicamente `market-snapshot.js` desde los datos diarios de TCGCSV. La fecha se muestra en cada carta. No se consulta TCGCSV desde el navegador por su restricción CORS. La conversión usa ExchangeRate-API y se redondea al peso más cercano.
- Se mantiene la fuente y el precio de mercado originales por petición del propietario. La caché `boveda-market-v6-*` está separada de las versiones basadas en ofertas y de las imágenes manuales.
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
