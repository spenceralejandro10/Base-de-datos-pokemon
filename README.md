# Mi colección Pokémon TCG

Galería web de cartas Pokémon que utiliza una copia del inventario de Google Sheets (el archivo original no se modifica).

**Página:** https://spenceralejandro10.github.io/Base-de-datos-pokemon/

**Excel original:** https://docs.google.com/spreadsheets/d/1qFEBZ1OcQw6NUoF29ZvD-jfc9-l7KOHN_T3bxnXVqaI/edit

## Archivos

- `index.html` — página web.
- `styles.css` — aspecto y adaptación móvil.
- `cards.js` — copia de los registros actuales del inventario.
- `card-images.js` — identificación de cartas e imágenes a partir de número, colección e idioma.
- `app.js` — buscador, filtros, galería y tabla con miniaturas.

## Cómo se obtienen las imágenes

1. Se buscan la colección y el número exacto en **TCGdex**, en el idioma correspondiente (inglés, español o japonés).
2. Se comprueba la identidad y el total de cartas de la colección; cuando hay traducciones se contrasta el número.
3. Si no existe imagen disponible, se intenta con la antigua Pokémon TCG API.
4. Cuando la colección o numeración no es suficiente, se muestra un aviso en lugar de una imagen de otra carta.
5. **Asignar imagen** permite indicar una fotografía manual; esa preferencia se guarda **solo en el navegador actual** (localStorage), no se sube a GitHub.

### Correcciones visuales sin tocar Google Sheets

Las tres cartas japonesas `003/049` (Venusaur ex), `009/049` (Charizard ex) y `016/049` (Blastoise ex) se buscan en el set **SVG: Venusaur, Charizard & Blastoise Special Deck Set ex**, aunque la copia del Excel las tenga clasificadas como `Shiny Treasure ex`. La web muestra una advertencia sobre la discrepancia; **los datos originales permanecen intactos**.

La carta `Venusaur ex 003/165` (151) y la carta `Lapras ex 164` (SVP Promo) también cuentan con una asignación de colección *solo para localizar sus imágenes*, porque esas colecciones quedaron en blanco en el Excel.

## Actualizaciones

Actualmente `cards.js` es una **copia estática** del Google Sheets. Los cambios manuales posteriores en Google Sheets **no se sincronizan automáticamente** con GitHub Pages; hay que actualizar `cards.js` leyendo la hoja original. No se debe editar el inventario original desde esta web.

## Publicación

GitHub Pages debe usar `main` y la carpeta `/(root)`. Cualquier nuevo commit sobre los archivos de la rama publicada iniciará un despliegue.
