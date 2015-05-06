# Pokemon TCG Scraper

## Introduction

The pokemon TCG scraper does what you'd expect - it scrapes the official pokemon.com TCG database. The resulting data
can be used to populate databases, make calculations, or any other purpose.

## Usage

First, to install the module, simply run `npm install pokemon-tcg-scraper`, and in your code add
`var scraper = require('pokemon-tcg-scraper')`

You can then run queries using the promise interface (note: there is no callback interface, but you can treat the then()
argument as the callback). For example, if we wanted data on the Blastoise from Boundaries Crossed, we'd find the URL
and run:

```javascript
scraper.scrapeCard("http://www.pokemon.com/us/pokemon-tcg/pokemon-cards/bw-series/bw7/31/").then(function(card){
    console.log(JSON.stringify(card, null, 4));
});
```

This will print the following:

```json
{
   "name":"Blastoise",
   "type":"Stage 2 Pokémon",
   "superType":"Pokémon",
   "evolvesFrom":"Wartortle",
   "hp":140,
   "color":"Water",
   "passive":{
      "name":"Deluge",
      "text":"As often as you like during your turn (before your attack), you may attach a Water Energy card from your hand to 1 of your Pokémon."
   },
   "abilities":[
      {
         "cost":[
            "Colorless",
            "Colorless",
            "Colorless",
            "Colorless"
         ],
         "name":"Hydro Pump",
         "damage":"60+",
         "text":"Does 10 more damage for each Water Energy attached to this Pokémon."
      }
   ],
   "weaknesses":[
      {
         "type":"Grass",
         "value":"×2"
      }
   ],
   "resistances":[

   ],
   "retreatCost":4
}
```

## API

The TCG scraper exposes 3 functions:

* scrapeAll(query, scrapeDetails)
* scrapeCard(url)
* scrapeSearchPage(url)

`scrapeAll` Queries the official Pokemon database using the first parameter, which is an object consisting of key/value
pairs to be used in the query string. The specification of this is described in the node querystring module. The function
returns an array of cards, each with a `url` and `image` property. If scrapeDetails is true, which it is by default, then
the scraper will also run scrapeCard on each card, and augment it with all the fields listed in the output section.

`scrapeCard(url)` Takes a card URL (i.e. a URL in the pokemon TCG website, like "http://www.pokemon.com/us/pokemon-tcg/pokemon-cards/bw-series/bw7/31/") and returns all data from the page. This is
used internally but it can also be useful for scraping specific cards.

`scrapeSearchPage(url)` Also used internally, but this time it scrapes one of the pages of the search results (e.g.
"http://www.pokemon.com/us/pokemon-tcg/pokemon-cards/2?card-darkness="). Returns an array of cards with the `url` and
`image` properties described above.

## Output

### Pokemon

If the scraper encounters a pokemon card, it outputs objects with the following fields

 * `name`: The pokemon's name, e.g. "Blastoise",
 * `type`: The specific of card, e.g. "Stage 2 Pokémon",
 * `superType`: The general type of card, e.g. "Pokémon",
 * `evolvesFrom`: The previous evolution, e.g. "Wartortle",
 * `hp`: The card's hit points, e.g. 140,
 * `color`: The card's colour, e.g. "Water",
 * `passive`:  The card's passive ability (Ability, Pokemon Power, Poke Body etc.) Contains a `name` and `text` field.
 e.g.
 ```json
 {
        "name": "Deluge",
        "text": "As often as you like during your turn (before your attack), you may attach a Water Energy card from your hand to 1 of your Pokémon."
},
    ```
 * `abilities` An array of abilities, consisting of `cost`, `name`, `damage`, and `text`. E.g.
  ```json
  [
        {
            "cost": [
                "Colorless",
                "Colorless",
                "Colorless",
                "Colorless"
            ],
            "name": "Hydro Pump",
            "damage": "60+",
            "text": "Does 10 more damage for each Water Energy attached to this Pokémon."
        }
    ],
    ```
 * `weaknesses` An object with `type` and `value` fields indicating the Pokemon's weakness. E.g.
 ```json
 [
        {
            "type": "Grass",
            "value": "×2"
        }
]
```

 * `resistances` An array containing a list of weaknesses with the `type` and `value` fields. E.g.
   ```json
    [
       {
           "type": "Psychic",
           "value": "-20"
       }
   ]
   ```
 * `retreatCost` The cost (as an integer, the number of colourless energies) to retreat the Pokemon. E.g. 2

### Other

All other cards (energies and trainers) simply have the fields `name` and `text`.
