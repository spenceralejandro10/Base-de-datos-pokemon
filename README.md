# Bóveda TCG

Una vitrina sencilla para consultar cartas Pokémon, conocer la disponibilidad y seleccionar las cartas de interés.

**Sitio público:** https://spenceralejandro10.github.io/Base-de-datos-pokemon/

**Administración:** https://spenceralejandro10.github.io/Base-de-datos-pokemon/?admin=1

## Qué puede hacer un visitante

- Ver las imágenes y los datos de las cartas de la colección.
- Buscar por nombre, código de carta, colección e idioma.
- Filtrar por disponibilidad o limpiar todos los filtros.
- Abrir **Ver en TCGplayer**, que busca la carta por nombre, número y colección directamente en TCGplayer.
- Agregar cartas al carrito de interés y descargar o copiar la selección con códigos y cantidades.

**La web no publica cifras de precios, no utiliza Cardmarket, no procesa pagos y no reserva productos.** El precio final de la venta se confirma con el vendedor y puede variar a favor del comprador.

## Cómo entrar como administrador

1. Entra a la vitrina normalmente. El formulario de administración **no se abre solo**, incluso si la dirección contiene `?admin=1`. Pulsa **Gestión** cuando quieras ingresar; el formulario aparece únicamente tras ese clic.
2. Usuario: `custodio`. Es un alias de una cuenta Supabase Auth autorizada en una tabla privada; no es una contraseña.
3. En el primer acceso, abre **Primera vez o recuperación de acceso**, verifica la identidad con el correo del propietario y configura una contraseña de 12 o más caracteres.
4. Los próximos accesos se hacen con el alias `custodio` y esa contraseña privada.
5. Una vez autenticado, aparece **Editar carta**. Puedes subir una imagen, corregir colección/idioma, modificar cantidades y marcar una carta como no disponible.

El botón de edición nunca se muestra al público. Las políticas RLS de Supabase bloquean modificaciones anónimas o no autorizadas, independientemente de los botones de la interfaz.

## Inventario sincronizado

- **104 referencias y 249 unidades** importadas de la pestaña `Inventario` del Google Sheets original, con su nombre, numeración, colección, año, idioma y cantidad exactos.
- Las cartas se ordenan por **colección más reciente a más antigua** en la galería, la tabla y el filtro de expansiones. Dentro de cada colección se conserva el orden del Excel. Las etiquetas visibles `BTCG-0001` a `BTCG-0104` son consecutivas según el orden completo de exhibición; los identificadores internos usados en imágenes, stock y carritos **no se modifican**.
- El contenido se guarda en la tabla `pokemon_catalog` de Supabase (lectura pública y escritura restringida). `cards.js` es una copia de respaldo idéntica; no se altera el Google Sheets.
- Las etiquetas `BTCG` ahora se numeran en el orden visual. El identificador interno del duplicado anterior (54) queda retirado, pero se conservan las asociaciones de fotografías y el carrito con la fila consolidada de Alakazam (ID interno 37). Los códigos visibles pueden variar si el administrador cambia las colecciones o se modifica el orden de exhibición; cada lista exportada también incluye nombre, número, colección e idioma para reconocer la carta.
- Las fotografías manuales almacenadas en Supabase siguen vinculadas a su ID aunque cambien nombre, colección o idioma.
- Las fotografías que se asignaron **solo en el navegador anterior** permanecen en ese navegador. Al iniciar sesión como administrador desde ese **mismo navegador**, la web intenta sincronizarlas con Supabase sin borrar la copia local; también sigue disponible la opción de sincronización manual.

## Datos y persistencia

- El inventario original de Google Sheets (104 referencias) no se modifica.
- Las imágenes que sube el administrador quedan en Supabase Storage y en `pokemon_image_overrides`.
- La colección y el idioma corregidos en la vitrina se guardan en `pokemon_card_overrides`.
- Las existencias y la disponibilidad se guardan en `pokemon_stock_overrides`.
- Estos cambios se ven en todos los dispositivos tras actualizar la página.
- El carrito es una lista local de cada visitante y se exporta como archivo TXT; no altera el stock.
- Los cambios posteriores que hagas en Google Sheets no se importan automáticamente: se debe actualizar `pokemon_catalog` y `cards.js` como en esta sincronización.

## Archivos

`index.html` página, `styles.css` diseño, `cards.js` inventario, `card-images.js` imágenes, `market-prices.js` enlaces TCGplayer, `shared-images.js` autenticación e imágenes, `catalog-overrides.js` fichas, `card-stock.js` existencias, `app.js` galería y carrito.

El sitio se publica con GitHub Pages desde `main` y `/(root)`.
