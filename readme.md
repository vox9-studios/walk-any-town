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

## The front screen

Arriving with no place asked for puts up the front screen: the title, the search box in the middle, and a city
turning slowly behind it. Each showcase is a real place from `data/`, flown on an ellipse around one landmark
for twenty seconds before the next: the Eiffel Tower, then the river by the Wheel, then Notre-Dame. The list is
`SHOWCASE` in the page, each entry naming a slug, what to circle, how far out, how high and how long.

Type a place, pick a flight, or touch the view, and the front screen stands aside: the search box moves up into
the header and the controls for moving about appear beside it.

A link that names a place, such as `.../#agde-france`, lands in that place rather than on the front screen,
which is what a link ought to do. The title is how you get back: click **Walk any town, in letters** and the
address is cleared and the showcase starts again. Worth knowing, because walking about leaves the last place
in the address bar, so reloading returns there rather than to the front.

## Walking about

`W` `A` `S` `D` or the arrow keys walk, drag to look around, space jumps. Hold shift, or press **Run off** so it
reads **Run on**, to move at about two thirds again the walking pace. On a phone the left thumb walks, the right
thumb looks, and Run and Jump sit in the bottom right corner.

**Map** puts a small round map in the corner, looking straight down on the streets around you with the way you
are facing at the top and a pale dot for north. You are the amber mark in the middle. It reads about ninety
metres of town and costs a tenth of a millisecond a frame.

**Detail** steps the picture from medium to finest. It sets both the size of the type and how many characters a
frame may hold, so on a large screen the finest setting draws about seven times as many characters as the
coarsest, and the footer counts them for you. Drop it a step or two if a walk feels heavy on an older phone.

**Daylight** steps round to **Evening** and then **Night**. Evening puts the sun low in the west, throws long
shadows, warms everything it touches and lights the windows, which is the best time to walk a high street.

The footer says where each frame went: how long the picture took to work out, and how long to get onto the
canvas. Measured on a real screen at 176,000 half cells, that was 26.4 ms working it out against 7.7 ms
drawing it, which settled an argument: the cost is in the shading, not in getting type onto a canvas, and a
faster way of drawing characters would have bought almost nothing. Of the working out, walking the grid is a
quarter and shading the cells is three quarters, spread evenly rather than piled in one place.

So the price is simply the number of cells, at about a sixth of a microsecond each. Resolution trades against
frame rate directly: turning Blocks off halves the cells, and a step down in Detail takes off a third. While
the view is moving the page shades every other row and repeats it, which is a quarter off a moving frame for a
picture that is sliding past anyway, and full detail returns the moment you stand still.

**Blocks** trades texture for detail. With it on the picture is worked out on twice as many rows and two colours
are laid in every row of type, the way block characters do it in ANSI art, so vertical detail doubles without the
type getting smaller. The character texture goes, but shop signs keep their letters and read more clearly than
before, since a letter in either half of a cell claims the whole cell. It costs about 1.8 times the work a frame
and needs colour on. Pressing it once more gives **Blocks + letters**: the same twice-as-fine colour with every
character kept, so the picture stays made of type.

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

Fields beginning with `>` are the turning points of a flight over the town, in order. Give a town a route and
**Fly around** becomes **Fly over**: the camera climbs, follows the line at twenty-four metres a second looking
where it is going, eases down at the far end, turns and comes back. Press the button again, now reading
**Land**, and you are put on the ground under the camera facing the way you were flying, to walk on from there.

```
Parliament Square, London, UK | 400 | 51.50200,-0.12310 | @51.50090,-0.12200 | >51.50360,-0.11850 | >51.49900,-0.12530
```

A field written as `m6` sets how many metres a cell covers. The default is half a metre, which is what walking
wants. Flying wants less: the arithmetic is unforgiving, and a square big enough to hold a city cannot be drawn
at half a metre a cell.

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

## Flights

A town is a few hundred metres square, drawn at half a metre to the cell, and that is what walking wants.
Flying wants something else. The London Eye to the O2 is 8.5 km: at half a metre to the cell that is 17,000
cells across and close to four gigabytes of arrays, which is not a thing a browser will do.

So a flight is a different kind of place, listed in `scripts/flights.txt`:

```
thames-eye-to-o2 | The Thames, Westminster to the O2 | 8 | 520
> 51.49700,-0.12700
> 51.50150,-0.12150
> 51.50450,-0.11800
```

The fields are a name for the file, a title, how many metres a cell covers, and how far either side of the
line to fetch. Each `>` is a turning point. The build asks the map servers for a corridor along the route, one
leg at a time rather than one enormous query, thins the shapes to what a cell that size can hold, and writes
it out like any other place. Ten kilometres of the Thames comes to about seven thousand buildings, because
most of a river corridor is river.

Flights appear in the **Take a flight** menu beside the search box. Choosing one loads it and takes off. Press
the button again, now reading **Land**, and you are put on the ground under the camera to walk on from there.
The cruise is quicker and higher the longer the route, so a ten kilometre run is about three minutes each way
at two hundred metres rather than seven minutes underneath the towers.

Above a metre and a half to the cell the page stops drawing what cannot be seen from the air: roofs, chimneys,
church towers, bridge parapets, road markings and parked cars. Trees are sized in metres, so they stay trees.

## Making a town look more like itself

Everything the page draws comes from tags on OpenStreetMap, so the surest way to improve a street is to improve
its map. The page reads, and falls back sensibly without:

| What it draws | Tags it reads |
| --- | --- |
| Walls | `building:material`, `building:facade:material`, `building:colour` |
| Roofs | `roof:shape`, `roof:material`, `roof:colour`, `roof:height`, `roof:levels` |
| Storeys | `building:levels`, `height` |
| The shape of a modelled building | `building:part` with its own `height`, `roof:shape` and colours |
| Shopfronts | `shop`, `amenity`, `name` |
| Streets | `width`, `lanes`, `oneway`, `surface`, `highway` |

`building:part` is the one that changes a landmark. Where somebody has modelled a building in three dimensions,
each part carries its own height and roof, and the page raises them separately, tallest last. Parliament Square
holds 1,577 of them: the Palace of Westminster comes out with its towers and pinnacles rather than as one slab
the shape of its footprint. Where nobody has modelled it, as at East Grinstead, a church still gets the invented
west tower, because there is nothing better to go on.

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
- **Fly around** circles the middle of the town at a height and radius set by the size of the square, so it is a
  fly-over of a city and a turn about a village. Haze thins as the camera climbs, and so does the view distance:
  at a hundred metres up the ground you are looking at is seven hundred cells away, and a street-level view
  distance would leave the frame empty. Land beyond the edge of the square carries on, muted, rather than as
  mown lawn.
- A road tagged `bridge` that crosses water gets a deck arched clear of it, about four metres of air at the
  crown, with a stone parapet down each side. Drawn flat at ground level, as it was before, a bridge is just a
  road that happens to look wet. Bridges shorter than ten metres, and those that cross something other than
  water, are left as the roads they are.
- The trees you see are the ones the map records, the woods it outlines, and a thin scatter over open grass,
  about one to every hundred metres square. Streets are not meant to disappear behind invented foliage.
  A height map cannot hang a canopy over open air, so a tree is a solid column; the wall of that column is
  drawn as bark below the leaves and the crown is given a ragged outline, which is what makes it read as a
  tree rather than a green slab.
- Streets wide enough for two cars get a broken white line.
- Map data © OpenStreetMap contributors, under the Open Database Licence. Ground heights for a town built by
  the Action come from [OpenTopoData](https://www.opentopodata.org/), which serves EU-DEM (produced using
  Copernicus data funded by the European Union), Mapzen terrain tiles and NASA SRTM; a town built live in the
  browser uses [Open-Meteo](https://open-meteo.com/), which serves Copernicus DEM and, unlike OpenTopoData,
  allows a web page to call it. The page names whichever it used in the footer. Keep both credits there.
- The public map and elevation servers are shared and free. This setup only touches them when you add or resize
  a town, never when someone visits, which keeps the site within their usage rules.
