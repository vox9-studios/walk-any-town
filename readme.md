# Walk any town, in letters

A first-person walk through real streets, drawn entirely with text characters. One HTML page, no libraries, no build step.
Streets, buildings and the shape of the ground come from open map data.

## How the site works

- `index.html` is the whole app: map data goes in, a height map comes out, and every frame is an array of characters.
- `towns.txt` lists the places you want ready to walk, one per line.
- Every time you change the repository, a GitHub Action reads `towns.txt`, downloads the map data for any new
  place, saves it as `data/<place>.json`, and publishes the site. Visitors load those files from your own
  address, so nothing depends on outside servers while they walk.
- Anyone can type a place that is not in `towns.txt` and the browser builds it there and then: it asks
  Nominatim where the place is, the Overpass servers for its buildings and streets, and Open-Meteo for the
  shape of its ground. A town built this way is kept in that browser, so going back to it costs nobody
  another request, and its address ending works as a link like any other.
- A live lookup builds whatever the place search hands back, which for a misspelling can be somewhere else
  entirely: "Adge" is a building in Nantes, 700 km from Agde. The search box is set to the name that was
  actually found once the town is up, so a walk that looks nothing like the place you meant can be explained
  by reading it. Towns in `towns.txt` appear in the box's suggestions and are matched exactly, so they cannot
  go astray this way.
- Those servers are free, shared and sometimes busy, and a refusal is normal rather than a fault. A place in
  `towns.txt` is always there in a fraction of a second and never depends on them, so it is still the better
  home for anywhere you care about.

## Walking about

`W` `A` `S` `D` or the arrow keys walk, drag to look around, space jumps. Hold shift, or press **Run off** so it
reads **Run on**, to move at about two thirds again the walking pace. On a phone the left thumb walks, the right
thumb looks, and Run and Jump sit in the bottom right corner.

**Map** puts a small round map in the corner, looking straight down on the streets around you with the way you
are facing at the top and a pale dot for north. You are the amber mark in the middle. It reads about ninety
metres of town and costs a tenth of a millisecond a frame.

**Detail** steps the picture from coarse to finest. It sets both the size of the type and how many characters a
frame may hold, so on a large screen the finest setting draws about seven times as many characters as the
coarsest, and the footer counts them for you. Drop it a step or two if a walk feels heavy on an older phone.

**Blocks** trades texture for detail. With it on the picture is worked out on twice as many rows and two colours
are laid in every row of type, the way block characters do it in ANSI art, so vertical detail doubles without the
type getting smaller. The character texture goes, but shop signs keep their letters and read more clearly than
before, since a letter in either half of a cell claims the whole cell. It costs about 1.8 times the work a frame
and needs colour on.

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

A line can also say how far the square should reach from its centre, and where that centre should be:

```
Market Place, Hexham, UK | 300
High Street, East Grinstead, UK | 300 | 51.124221,-0.008164
```

The reach is in metres, between 100 and 400, and defaults to 200. A centre of your own is how you hold two
streets in one square when neither of them sits in the middle: put the centre between them and widen the reach
until both are inside. Changing either value rebuilds that town by itself on the next commit.

A fourth field, written with an `@` in front, says where a walk should begin. Without it you start on whichever
named street runs nearest the middle of the square, which is usually right and occasionally dull:

```
Agde, France | 300 | 43.313650,3.470200 | @43.314786,3.469694
```

That one opens on the Pont des Maréchaux, looking along the bridge with the Hérault on both sides. The page
puts you on the named street nearest the mark and faces you along it, so aiming at a bridge, a market place or
a particular corner all work. Moving the mark costs nothing: it is kept in `data/index.json` rather than in the
town's own file, so no map data is fetched again.

A wider square is not free. The page works at half a metre to the cell, so 300 m reaches 1200 cells across and
takes a little under a second to build, against about a fifth of a second at 200 m. Phones manage 300 m; go much
past that and the wait before the first frame starts to show.

It works anywhere OpenStreetMap has been drawn, not only in England. These four were built and walked as a
test, and each took about half a minute:

```
Grote Markt, Brugge, Belgium | 300
Royal Mile, Edinburgh, UK | 300
Asakusa, Taito, Tokyo, Japan | 300
Bourbon Street, New Orleans, USA | 300
```

Two things to expect away from home. Where a building carries no tags the page guesses, and the guesses are
English: brick and render, ridged roofs, chimneys, a west tower on a church. And a shop sign is drawn from the
Latin alphabet, so a name written in Japanese or Greek leaves the fascia blank rather than wrong.

To refresh a town after the map has been improved, delete its file in `data/` and commit.

## Making a town look more like itself

Everything the page draws comes from tags on OpenStreetMap, so the surest way to improve a street is to improve
its map. The page reads, and falls back sensibly without:

| What it draws | Tags it reads |
| --- | --- |
| Walls | `building:material`, `building:facade:material`, `building:colour` |
| Roofs | `roof:shape`, `roof:material`, `roof:colour`, `roof:height`, `roof:levels` |
| Storeys | `building:levels`, `height` |
| Shopfronts | `shop`, `amenity`, `name` |
| Streets | `width`, `lanes`, `oneway`, `surface`, `highway` |

Where a tag is missing the page guesses from the kind of building and the shape of its footprint: a terrace of
houses gets ridged roofs and chimneys, a deep commercial block gets a flat roof behind a parapet, and a
`place_of_worship` gets a battlemented west tower with pinnacles and tall pointed windows. Those are rules, not
records, so a building with no tags is a plausible building rather than the real one. Adding
`building:material=brick` to your own street in OpenStreetMap does more for the view than any change to this page.

## Good to know

- The ground is real. Each town's build samples a grid of ground heights and the page lays the streets and
  buildings on it, so a town on a hill reads as one. East Grinstead falls 28 m across its square, which is why
  the old High Street stands well above the shops on London Road.
- Buildings stand level on the mean ground under their own footprint, so a house on a slope shows more wall on
  its downhill side, as it does in life.
- A road tagged `bridge` that crosses water gets a deck arched clear of it, about four metres of air at the
  crown, with a stone parapet down each side. Drawn flat at ground level, as it was before, a bridge is just a
  road that happens to look wet. Bridges shorter than ten metres, and those that cross something other than
  water, are left as the roads they are.
- The trees you see are the ones the map records, the woods it outlines, and a thin scatter over open grass,
  about one to every hundred metres square. Streets are not meant to disappear behind invented foliage.
- Map data © OpenStreetMap contributors, under the Open Database Licence. Ground heights for a town built by
  the Action come from [OpenTopoData](https://www.opentopodata.org/), which serves EU-DEM (produced using
  Copernicus data funded by the European Union), Mapzen terrain tiles and NASA SRTM; a town built live in the
  browser uses [Open-Meteo](https://open-meteo.com/), which serves Copernicus DEM and, unlike OpenTopoData,
  allows a web page to call it. The page names whichever it used in the footer. Keep both credits there.
- The public map and elevation servers are shared and free. This setup only touches them when you add or resize
  a town, never when someone visits, which keeps the site within their usage rules.
