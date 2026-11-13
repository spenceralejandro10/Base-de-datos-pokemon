# Bóveda TCG

Colección Pokémon: https://spenceralejandro10.github.io/Base-de-datos-pokemon/

## Inventario e imágenes

`cards.js` conserva la secuencia publicada y los ID internos. Las actualizaciones remotas se aplican a esos mismos ID, en su posición original; no agregan cartas retiradas. Los códigos BTCG se muestran consecutivamente en ese orden. Los filtros no reorganizan las cartas.

El catálogo y las correcciones de idioma y existencias se leen de Supabase. Las imágenes manuales y sus respaldos se conservan. El acceso por clave y el modo de edición de imagen, cantidad e idioma siguen disponibles.

## Imágenes y datos compartidos

Las fotografías manuales y las imágenes automáticas confirmadas se guardan como archivos públicos en el almacenamiento de la colección. Cada copia conserva los mismos bytes y se verifica por SHA-256 antes de publicar su URL. No se eliminan las fotografías originales ni se modifica ningún registro del inventario.

`shared-images-snapshot.js` es un respaldo público versionado de las referencias de imágenes. Se carga junto con la página y permite mostrar las fotografías desde una sesión nueva, incluso con el almacenamiento del navegador deshabilitado o si falla la lectura de la base de datos. La imagen manual más reciente de la base de datos tiene prioridad sobre ese respaldo.

El workflow `Respaldar imágenes compartidas` actualiza exclusivamente ese respaldo cada día. La galería descarga las imágenes al acercarse a la zona visible, y los archivos conservados usan nombres basados en su contenido para permitir caché larga sin confundir fotografías nuevas con versiones anteriores.

Los precios y enlaces introducidos manualmente permanecen en `pricing-core.js`, dentro del código publicado y su historial de versiones. La memoria local de un visitante no es la fuente de esos precios. Las imágenes manuales nuevas solo se consideran guardadas después de confirmar la escritura compartida; una escritura rechazada no se presenta como un guardado local satisfactorio.

El modo administrador continúa desactivado. El respaldo y las copias públicas no habilitan herramientas de edición para visitantes.

## Cotizaciones

- Se usa exclusivamente `marketPrice` de TCGplayer, distribuido por TCGCSV. No se usan ofertas, mínimos anunciados, medias de anuncios ni estimaciones para completar huecos.
- Se valida colección, nombre, número completo e idioma. El precio inglés usado para una carta española se identifica como referencia. Una carta japonesa no recibe un precio inglés por coincidencia de número.
- Se muestra un único precio unitario por referencia. Se utiliza el acabado explícito de la carta o la impresión estándar (Holofoil, Normal y después Reverse Holofoil); no se promedian acabados. El acabado elegido se identifica en la carta.
- El inventario suma exactamente precio unitario COP × cantidad disponible por cada referencia publicada, con enteros; los filtros, el carrito y las ofertas no cambian el inventario que entra en ese cálculo.
- Los precios fijados expresamente por el propietario siguen identificados como tales. No se presentan como cotizaciones de mercado.
- La conversión prioriza la TRM oficial de Superfinanciera en datos.gov.co y verifica su periodo de vigencia según la fecha de Bogotá, incluidos fines de semana y festivos. Si falla, ExchangeRate-API se identifica como cambio de mercado. Una tasa vencida no se suma al total.
- La conversión se redondea por unidad al peso más cercano con aritmética de punto fijo. El total coincide con la suma de los precios unitarios mostrados por sus cantidades.
- Se muestra la fecha del archivo de precios de la fuente; la fecha de consulta es independiente. Los datos de más de 48 horas se identifican como vencidos y se excluyen del total.
- Las referencias sin precio verificable quedan pendientes; el total se identifica como parcial. Se permiten ofertas por toda la colección y se señala el subtotal parcial en la oferta y su exportación.

Cada apertura consulta `market-snapshot.json` desde la rama `main`, sin reutilizar una respuesta HTTP anterior. Esto permite recibir las actualizaciones automáticas incluso si GitHub Pages todavía conserva una versión previa. Si GitHub no responde, se intenta el respaldo del mismo sitio y luego se conserva el último dato local, con su fecha original. También se consulta la TRM al entrar, volver a la pestaña o recuperar conexión. Mientras la pestaña está visible se revisa cada cinco minutos.

TCGCSV publica una vez al día, normalmente después de las 20:00 UTC. El workflow `Actualizar cotizaciones` ingiere la publicación a las 20:35 UTC (15:35 Colombia) y consulta la nueva TRM a las 05:15 UTC (00:15 Colombia). GitHub puede demorar las tareas programadas. Se consulta primero `last-updated.txt` y no se vuelven a descargar colecciones cuyo precio e identidad ya se sincronizaron para esa publicación.

El actualizador conserva resultados correctos si alguna colección falla y mantiene la fecha anterior de las fuentes fallidas. Los fallos aparecen en GitHub Actions. Solo escribe `market-snapshot.json`; no escribe inventario, existencias, fotografías ni HTML.

## Collectr

El respaldo de Collectr está implementado con validación de identidad, fecha, moneda, condición y URL del producto. **Todavía no está conectado a una API de Collectr**: el archivo `collectr-snapshot.json` está vacío. Sin un dato autorizado verificable, se ofrece un enlace de consulta y no se inventa ningún valor.

Después de obtener acceso autorizado, un exportador de la API puede mantener `collectr-snapshot.json` con este formato normalizado:

```json
{
  "status": "configured",
  "cards": {
    "100": {
      "name": "Gengar ex",
      "number": "090/128",
      "set": "30th Celebration",
      "language": "Inglés",
      "usd": 0.70,
      "currency": "USD",
      "condition": "ungraded",
      "updatedAt": "FECHA_ISO_REAL_DE_LA_COTIZACION",
      "url": "https://app.getcollectr.com/explore/product/ID_VERIFICADO"
    }
  }
}
```

Este es el formato interno del sitio; no pretende ser el contrato de la API de Collectr. Nunca se publican claves privadas. El workflow ingiere este respaldo al modificarse. No se acepta un precio de otra edición, idioma, moneda o una carta graduada.

## Mantenimiento

```sh
node --test tests/*.test.mjs
node scripts/update-prices.mjs
```

No se necesitan paquetes npm ni dependencias de terceros para estas tareas. `pricing-core.js` comparte las mismas reglas entre navegador, actualizador y pruebas.

Se retiraron los dos actualizadores Python y el workflow duplicado que fijaba el dólar manualmente, el reporte de valoración sin uso y las antiguas instantáneas JavaScript. Las copias de seguridad de imágenes y la herramienta de conservación de fotografías se mantienen porque sirven para recuperación.
