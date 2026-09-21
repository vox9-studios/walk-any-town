# Walk any town, in letters

A first-person walk through real streets, drawn entirely with text characters. One HTML page, no libraries, no build step.
Streets and buildings come from OpenStreetMap.

## How the site works

- `index.html` is the whole app: map data goes in, a height map comes out, and every frame is an array of characters.
- `towns.txt` lists the places you want ready to walk, one per line.
- Every time you change the repository, a GitHub Action reads `towns.txt`, downloads the map data for any new
  place, saves it as `data/<place>.json`, and publishes the site. Visitors load those files from your own
  address, so nothing depends on outside servers while they walk.
- A place that is not in `towns.txt` falls back to a live lookup in the visitor's browser. The public map
  servers often turn these away, so treat it as a bonus rather than the main route.

## Set it up on GitHub Pages

1. Create a new **public** repository on GitHub, for example `walk-any-town`.
2. Upload everything in this folder, keeping the folder names. On a computer, drag the whole folder into
   "Add file > Upload files". On a phone, use "Add file > Create new file" and type the full path as the
   name, such as `.github/workflows/site.yml`, then paste the file's contents.
3. In the repository, open **Settings > Pages** and set **Source** to **GitHub Actions**.
4. Open the **Actions** tab, choose "Build towns and publish site", and press **Run workflow**.
5. After a minute or two the run shows a green tick and the site's address, usually
   `https://<your-name>.github.io/walk-any-town/`.

If the run has a yellow warning, open it: a skipped town is listed with the reason (usually a name the place
search did not recognise, or map servers that were busy; running the workflow again normally fixes the latter).

## Add a town

Edit `towns.txt`, add a line such as `Market Place, Hexham, UK`, and commit. The site rebuilds itself and the
town appears in the search box suggestions. Link straight to a town with its address ending, for example
`.../#high-street-east-grinstead-uk`.

To refresh a town after the map has been improved, delete its file in `data/` and commit.

## Good to know

- Each town is a 400 m square. The ground is flat; real slopes would need elevation data added.
- Facades, roofs and windows are generated from rules, so streets are recognisable by layout, building size and
  shop names rather than by exact frontages.
- Map data © OpenStreetMap contributors, under the Open Database Licence. Keep the credit line in the page footer.
- The public OpenStreetMap servers are shared and free. This setup only touches them when you add a town,
  never when someone visits, which keeps the site within their usage rules.
