/* Fuentes autorizadas: añadir únicamente datos verificados a través de Collectr API.
 * No se descargan precios mediante scraping ni se publican claves privadas.
 * Formato por ID interno: {"55":{"name":"...","number":"...","set":"...",
 * "language":"...","usd":4.25,"updatedAt":"ISO-8601","url":"https://app.getcollectr.com/explore/product/..."}}
 * Solo se usa como respaldo si no existe un precio TCGplayer y no hay precio fijo del propietario.
 */
window.COLLECTR_SNAPSHOT={cards:{}};
