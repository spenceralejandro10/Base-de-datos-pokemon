# Bóveda TCG

Vitrina pública de cartas Pokémon con galería, filtros, referencias, disponibilidad y carrito de interés.

**Sitio web:** https://spenceralejandro10.github.io/Base-de-datos-pokemon/

**Google Sheets original:** https://docs.google.com/spreadsheets/d/1qFEBZ1OcQw6NUoF29ZvD-jfc9-l7KOHN_T3bxnXVqaI/edit

## Modo administrador desactivado (28 de octubre de 2026)

- **Modo cliente**: la vitrina sigue mostrando fotos, cartas, precios, cantidades, filtros y carrito de interés.
- **Modo administrador**: **inactivo hasta nueva solicitud explícita del propietario**. El botón está oculto y deshabilitado en `index.html`, y `app.js` tiene `ADMIN_ENABLED=false` para bloquear la activación, incluso si se usa un enlace antiguo con `?admin=1`.
- La protección no es solo visual: las tablas `public.pokemon_image_overrides`, `public.pokemon_card_overrides` y `public.pokemon_stock_overrides` conservan el permiso `SELECT` para `anon` y `authenticated`, pero no los permisos `INSERT`, `UPDATE` ni `DELETE`.
- La política `storage.objects` llamada `Public switch can upload gallery images` tiene temporalmente `WITH CHECK (false)`. El acceso público de lectura a las fotos se conserva.
- **Conservación**: no se eliminan las herramientas de edición, fotografías, filas, colecciones ni cantidades.

### Cómo reactivar cuando lo solicite el propietario

1. Cambiar `ADMIN_ENABLED=true` en `app.js` y subir su versión de caché en `index.html`; `adminDisplay()` volverá a mostrar el botón.
2. Restablecer los permisos públicos anteriores **solo si el propietario desea de nuevo una edición sin autenticación**:
   `GRANT INSERT, UPDATE, DELETE ON public.pokemon_image_overrides, public.pokemon_card_overrides, public.pokemon_stock_overrides TO anon, authenticated;`
3. Para reactivar también la subida pública de fotos, restaurar la política:
   `ALTER POLICY "Public switch can upload gallery images" ON storage.objects WITH CHECK ((bucket_id = 'pokemon-gallery-overrides'::text) AND (name ~ '^cards/[0-9a-z-]+[.](jpg|png|webp)$'::text));`
4. Comprobar accesos, catálogo, imágenes y edición al finalizar. Es preferible habilitar autenticación del propietario antes de reabrir escrituras públicas.

## Panel visual de consulta de pedidos (sin edición)

- El botón **Consultar lista** abre un panel amplio y de solo lectura. El visitante puede pegar el mensaje de selección de cartas recibido de un cliente; esto no modifica ningún dato de Bóveda TCG.
- Se identifica cada carta mediante nombre, número, expansión e idioma, y se contrasta su código público `BTCG`. Si el código y la identidad no coinciden, el sistema advierte y evita enseñar otra carta como si fuera la solicitada.
- Se muestran fotos, unidades pedidas, unidades registradas, precio por unidad incluido en el mensaje y precio de referencia `TCGplayer Market Price` (datos TCGCSV, convertidos a COP cuando hay una tasa de cambio válida).
- Cada fila enlaza directamente al producto verificado en TCGplayer; si no existe referencia exacta, dirige a la búsqueda correspondiente. Los precios pueden variar: se requiere consultar el sitio enlazado para validar el precio vigente.
- La pantalla suma los importes del mensaje y los precios de mercado disponibles; señala cualquier referencia no encontrada o sin precio.
- La única entrada es el cuadro de texto para consultar otra lista, y el selector de orden. No hay botones de editar, vender, empacar, quitar ni descontar existencias.
- La lista consultada se guarda solo en el almacenamiento local del navegador (clave `boveda-visual-consulta-v1`) para poder continuar tras actualizar la página. **Nueva consulta** solo borra esa copia local.
- Seguridad: el administrador permanece desactivado y se revocó la ejecución de `public.pokemon_register_sale` a `PUBLIC`, `anon` y `authenticated`. Las tablas públicas de fotos, metadatos y existencias continúan sin permisos de escritura para visitantes.
- La consulta no toca `pokemon_catalog`, `pokemon_stock_overrides`, `pokemon_image_overrides`, `pokemon_card_overrides` ni el Excel original.

## Datos y persistencia

- Las fotos se muestran automáticamente mediante TCGdex (incluidas 30th Celebration y 30th Classic Collection) y las imágenes propias tienen prioridad. Los enlaces manuales nunca se sobrescriben. Si un enlace deja de cargar, la galería busca una imagen oficial de respaldo. En modo administrador, **Completar fotos automáticamente** busca imágenes exactas en lote y solo guarda las verificadas, sin sustituir las manuales. Las imágenes de referencia en otro idioma no se guardan como fotografías exactas.

- **317 referencias, 650 unidades** importadas del Excel. Los ID internos permanecen estables; se retiraron los ID 54 (Alakazam), 121 (Lapras ex) y 122 (Venusaur ex) al consolidar referencias duplicadas. Las nuevas cartas usan los ID 160–253; se conservan intactos los identificadores anteriores.
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
