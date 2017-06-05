#!/usr/bin/env node --harmony
"use strict";

//Constants
const SCRAPE_URL = "http://www.pokemon.com/us/pokemon-tcg/pokemon-cards/";

//Requires
const request = require('request-promise');
const cheerio = require('cheerio');
const Promise = require('bluebird');
const co = Promise.coroutine;
const trim = require('trim');
const Url = require('url');
const qs = require('querystring');
const capitalize = require('capitalize');
const _ = require('lodash');

function makeUrl(url, query) {
    return url + "?" + qs.stringify(query);
}

function cardIdFromUrl(url) {
    return url.match(new RegExp("/(\\w+/\\w+)/$"))[1];
}

/**
 * Scrapes the page at the given URL, and returns an object {cards, numPages} where cards is an array of card objects
 * and numPages is the number of pages returned from this query
 */
function scrapeSearchPage(pageUrl) {

    return co(function *() {
        //Load the HTML page
        const $ = cheerio.load(yield request(pageUrl));

        //For each card, scrape some data
        const cards = Array.from($("#cardResults li")).map(el => {
            const $card = $(el);

            //Just scrape the database URL and the image for now
            const url = Url.resolve(SCRAPE_URL, $card.find("a").attr("href"));
            return {
                url: url,
                image: Url.resolve(SCRAPE_URL, $card.find("img").attr("src")),
                id: cardIdFromUrl(url)
            };
        });

        //Work out how many pages in total there are
        const totalText = $('#cards-load-more>div>span').text();
        //Check if there's no result.
        if(totalText){
            const numPages = parseInt(/\d of (\d+)/.exec(totalText)[1]);
        }else{
            const numPages = 0;
        }

        return {
            numPages: numPages,
            cards: cards
        };

    })();
}


/**
 * Calls the callback function on each energy
 * @param el the DOM element to start scraping from
 * @param $ the query object el exists within
 * @param func called with (energy, $), where energy is the energy type (Fire etc.) and $ is a jQuery element for this energy
 */
function scrapeEnergies(el, $, func) {
    const $el = $(el);

    $el.find("li").each(function (i, val) {
        const $val = $(val);
        const type = $val.attr("title");
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
        const card = {};

        //Load the HTML page from the URL
        const $ = cheerio.load(yield request(url));
        const $stats = $(".pokemon-stats");

        //Add the ID because we don't need the actual page for that
        card.id = cardIdFromUrl(url);

        //Scrape the card name
        const $header = $(".card-description");
        card.name = $header.find("h1").text();

        //Scrape the type and HP
        const $basicInfo = $(".card-basic-info");

        //Scrape the image
        const $img = $(".card-image>img");
        card.image = Url.resolve(url, $img.attr('src'));

        //Scrape the type and evolution
        const $type = $basicInfo.find(".card-type");
        card.type = $type.find("h2").text();
        if (card.type.indexOf("Trainer") != -1)
            card.superType = "Trainer";
        else if (card.type.indexOf("Energy") != -1)
            card.superType = "Energy";
        else if (card.type.indexOf("Pokémon") != -1)
            card.superType = "Pokémon";

        card.set = {
            name: $stats.find("h3").text(),
            url: Url.resolve(SCRAPE_URL, $stats.find("h3 > a").attr("href"))
        };

        //If it's a trainer or anything non-pokemon, just scrape the text
        if (card.superType == "Trainer" || card.superType == "Energy") {
            card.text = formatText($(".pokemon-abilities").text());
            return card;
        }

        const $evolved_from = $type.find("h4");
        if ($evolved_from.length > 0)
            card.evolvesFrom = trim($evolved_from.find("a").text());

        const hp_text = $basicInfo.find(".card-hp").text();
        card.hp = parseInt(/\d+/.exec(hp_text)[0]);

        //Scrape the passive ability/poke body/poke power if they have one
        const passive_name = $(".pokemon-abilities h3");
        if (passive_name.length > 0 && passive_name.next()[0].name == "p") {
            card.passive = {
                name: passive_name.find("div:last-child").text(),
                text: formatText(passive_name.next().text())
            };
        }

        //Scrape each ability sequentially
        card.abilities = [];
        card.rules = []; //Rules are things like the EX rule
        const $abilities = $(".pokemon-abilities .ability");
        $abilities.each(function (i, el) {
            const $ability = $(el);
            const ability = {
                cost: []
            };

            //Scrape the ability name
            const $name = $ability.find("h4.left");
            //If there is no name, it's a rule
            if ($name.length == 0) {
                card.rules.push(formatText($ability.text()));
                return;
            }
            ability.name = $name.text();


            //Scrape the cost
            const $energies = $ability.find("ul.left li");
            $energies.each(function (i, energy) {
                const $energy = $(energy);
                ability.cost.push($energy.attr("title"));
            });

            //Scrape the ability damage
            const $damage = $ability.find("span.right.plus");
            ability.damage = $damage.text();

            //Scrape the ability text
            const $text = $ability.find(">p");
            ability.text = formatText($text.text());

            //Add it to the card
            card.abilities.push(ability);
        });

        //Scrape the colour
        const colourUrl = $basicInfo.find(".right>a").attr("href");
        if (colourUrl) {
            const queryString = Object.keys(Url.parse(colourUrl, true).query)[0];
            card.color = capitalize(/card-(.*)/.exec(queryString)[1]);
        }
        //If no colour icon is present, try to guess it from the abilities
        else {
            //An array of energy:count pairs
            const pairs = _.chain(card.abilities)
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

        card.weaknesses = [];
        const $weakness = $stats.find(".stat:contains(Weakness)");
        scrapeEnergies($weakness.find("ul.card-energies"), $, function (type, $) {
            card.weaknesses.push({
                type: type,
                value: trim($.text())
            });
        });

        card.resistances = [];
        const $resistance = $stats.find(".stat:contains(Resistance)");
        scrapeEnergies($resistance.find("ul.card-energies"), $, function (type, $) {
            card.resistances.push({
                type: type,
                value: trim($.text())
            });
        });

        const $retreat = $stats.find(":contains(Retreat Cost)");
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
        const scrapeURL = makeUrl(SCRAPE_URL, query);
        const search = yield scrapeSearchPage(scrapeURL);

        //Check if there's no result
        if(!search.numPages){
            return 0;
        }

        //Recurring variables
        var cards = search.cards;
        var i;

        //Scrape all of the pages sequentially;
        for (i = 2; i <= search.numPages; i++) {
            const scrapeURL = makeUrl(Url.resolve(SCRAPE_URL, i.toString()), query);
            const results = yield scrapeSearchPage(scrapeURL);
            cards = cards.concat(results.cards);
        }

        //Scrape all of the cards sequentially if requested
        if (scrapeDetails) {
            for (i = 0; i < cards.length; i++) {
                const card = cards[i];
                _.assign(card, yield scrapeCard(card.url));
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
