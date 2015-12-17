"use strict";

//Constants
var SCRAPE_URL = "http://www.pokemon.com/us/pokemon-tcg/pokemon-cards/";

//Requires
var request = require('request-promise');
var cheerio = require('cheerio');
var Promise = require('bluebird');
var co = Promise.coroutine;
var trim = require('trim');
var Url = require('url');
var qs = require('querystring');
var capitalize = require('capitalize');
var _ = require('lodash');

function makeUrl(url, query) {
    return url + "?" + qs.stringify(query);
}

function cardIdFromUrl(url){
   return url.match(new RegExp("/(\\w+/\\w+)/$"))[1];
}

/**
 * Scrapes the page at the given URL, and returns an object {cards, numPages} where cards is an array of card objects
 * and numPages is the number of pages returned from this query
 */
function scrapeSearchPage(pageUrl) {

    return co(function *() {

        var cards = [];

        //Load the HTML page
        var $ = cheerio.load(yield request(pageUrl));

        //For each card, scrape some data
        $("#cardResults li").each(co(function* (i, el) {
            var $card = $(el);

            //Just scrape the database URL and the image for now
            var url = Url.resolve(SCRAPE_URL, $card.find("a").attr("href"));
            var card = {
                url: url,
                image: Url.resolve(SCRAPE_URL, $card.find("img").attr("src")),
                id: cardIdFromUrl(url)
            };

            cards.push(card);
        }));

        //Work out how many pages in total there are
        var totalText = $('#cards-load-more>div>span').text();
        var numPages = parseInt(/\d of (\d+)/.exec(totalText)[1]);

        return {
            numPages: numPages,
            cards: cards
        };

    })();
}


/**
 * Calls the callback function on each energy
 * @param $el the jQuery element to start scraping from
 * @param func called with (energy, $), where energy is the energy type (Fire etc.) and $ is a jQuery element for this energy
 */
function scrapeEnergies(el, $, func) {
    var $el = $(el);

    $el.find("li").each(function (i, val) {
        var $val = $(val);
        var type = $val.attr("title");
        func(type, $val);
    });
}

/**
 * Removes newlines from and trims a string
 * @param str
 */
function formatText(str) {
    return trim(str.replace(/\r?\n|\r/, " "));
}

function scrapeCard(url) {

    return co(function *() {
        var card = {};

        //Load the HTML page from the URL
        var $ = cheerio.load(yield request(url));

        //Add the ID because we don't need the actual page for that
        card.id = cardIdFromUrl(url);

        //Scrape the card name
        var $header = $(".card-description");
        card.name = $header.find("h1").text();

        //Scrape the type and HP
        var $basicInfo = $(".card-basic-info");

        //Scrape the image
        var $img = $(".card-image>img");
        card.image = Url.resolve(url, $img.attr('src'));

        //Scrape the type and evolution
        var $type = $basicInfo.find(".card-type");
        card.type = $type.find("h2").text();
        if (card.type.indexOf("Trainer") != -1)
            card.superType = "Trainer";
        else if (card.type.indexOf("Energy") != -1)
            card.superType = "Energy";
        else if (card.type.indexOf("Pokémon") != -1)
            card.superType = "Pokémon";

        //If it's a trainer or anything non-pokemon, just scrape the text
        if (card.superType == "Trainer" || card.superType == "Energy") {
            card.text = formatText($(".pokemon-abilities").text());
            return card;
        }

        var $evolved_from = $type.find("h4");
        if ($evolved_from.length > 0)
            card.evolvesFrom = trim($evolved_from.find("a").text());

        var hp_text = $basicInfo.find(".card-hp").text();
        card.hp = parseInt(/\d+/.exec(hp_text)[0]);

        //Scrape the passive ability/poke body/poke power if they have one
        var passive_name = $(".pokemon-abilities h3");
        if (passive_name.length > 0 && passive_name.next()[0].name == "p") {
            card.passive = {
                name: passive_name.find("div:last-child").text(),
                text: formatText(passive_name.next().text())
            };
        }

        //Scrape each ability sequentially
        card.abilities = [];
        card.rules = []; //Rules are things like the EX rule
        var $abilities = $(".pokemon-abilities .ability");
        $abilities.each(function (i, el) {
            var $ability = $(el);
            var ability = {
                cost: []
            };

            //Scrape the ability name
            var $name = $ability.find("h4.left");
            //If there is no name, it's a rule
            if ($name.length == 0) {
                card.rules.push(formatText($ability.text()));
                return;
            }
            ability.name = $name.text();


            //Scrape the cost
            var $energies = $ability.find("ul.left li");
            $energies.each(function (i, energy) {
                var $energy = $(energy);
                ability.cost.push($energy.attr("title"));
            });

            //Scrape the ability damage
            var $damage = $ability.find("span.right.plus");
            ability.damage = $damage.text();

            //Scrape the ability text
            var $text = $ability.find(">p");
            ability.text = formatText($text.text());

            //Add it to the card
            card.abilities.push(ability);
        });

        //Scrape the colour
        var colourUrl = $basicInfo.find(".right>a").attr("href");
        if (colourUrl) {
            var queryString = Object.keys(Url.parse(colourUrl, true).query)[0];
            card.color = capitalize(/card-(.*)/.exec(queryString)[1]);
        }
        //If no colour icon is present, try to guess it from the abilities
        else {
            //An array of energy:count pairs
            var pairs = _.chain(card.abilities)
                .map("cost")
                .flatten()
                .countBy(function (energy) {
                    return energy;
                }).pairs()
                .value();

            card.color = _.chain(pairs)
                .max(function (pair) {
                    return pair[1];
                })
                .value()[0];
        }

        //Scrape the other stats
        var $stats = $(".pokemon-stats");

        card.weaknesses = [];
        var $weakness = $stats.find(".stat:contains(Weakness)");
        scrapeEnergies($weakness.find("ul.card-energies"), $, function (type, $) {
            card.weaknesses.push({
                type: type,
                value: trim($.text())
            });
        });

        card.resistances = [];
        var $resistance = $stats.find(".stat:contains(Resistance)");
        scrapeEnergies($resistance.find("ul.card-energies"), $, function (type, $) {
            card.resistances.push({
                type: type,
                value: trim($.text())
            });
        });

        var $retreat = $stats.find(":contains(Retreat Cost)");
        card.retreatCost = $retreat.find(".energy").length;

        return card;
    })();
}

/**
 * Scrapes the Pokemon TCG database
 * @param query The query string to use for the search.
 * @param scrapeDetails True if you want to return the card data, false if you just want the URLs
 * @returns {*}
 */
function scrapeAll(query, scrapeDetails) {

    return co(function *() {
        //By default, scrape the card details
        scrapeDetails = scrapeDetails === undefined ? true : scrapeDetails;

        //Load the HTML page
        process.stdout.write("Scraping initial page...");
        var scrapeURL = makeUrl(SCRAPE_URL, query);
        var search = yield scrapeSearchPage(scrapeURL);
        process.stdout.write("Done!\n");

        //Recurring variables
        var cards = search.cards;
        var i;

        //Scrape all of the pages sequentially;
        process.stdout.write('Scraping card URLs...\n');
        for (i = 2; i <= search.numPages; i++) {
            process.stdout.write('   Scraping page ' + i + '...');
            var scrapeURL = makeUrl(Url.resolve(SCRAPE_URL, i.toString()), query);
            var results = yield scrapeSearchPage(scrapeURL);
            cards = cards.concat(results.cards);
            process.stdout.write('Done!\n');
        }

        //Scrape all of the cards sequentially if requested
        if (scrapeDetails) {
            process.stdout.write('Scraping card details...\n');
            for (i = 0; i < cards.length; i++) {
                var card = cards[i];
                process.stdout.write('   Scraping card ' + card.url);
                _.assign(card, yield scrapeCard(card.url));
                process.stdout.write('Done!\n')
            }
        }

        return cards;
    })();
}

module.exports = {
    scrapeAll: scrapeAll,
    scrapeCard: scrapeCard,
    scrapeSearchPage: scrapeSearchPage
};
