#!/usr/bin/env node --harmony
const scraper = require("./index");
const assert = require("assert");
const request = require('request-promise');
const co = require('co');
require('co-mocha');

function checkResponse(response, content_type){
    assert(response.statusCode == 200);
    assert(response.headers['content-type'].includes(content_type));
}

describe("scrapeSearchPage", () => {

    //Scrape the first page of the unfiltered results
    it("Scrapes an array of cards and a page count", function *() {
        const page = yield scraper.scrapeSearchPage("http://www.pokemon.com/us/pokemon-tcg/pokemon-cards/?None");
        assert(page.numPages > 400);
        assert(page.cards.length >= 12);
    });

//Scrape a search page with just a Snivy on it
    it("Returns name, image, and id", function *() {
        const page = yield scraper.scrapeSearchPage("http://www.pokemon.com/us/pokemon-tcg/pokemon-cards/?cardName=snivy&cardText=slam");
        const card = page.cards[0];

        //Check the URL
        const urlResp = yield request({
            resolveWithFullResponse: true,
            url: card.url
        });
        checkResponse(urlResp, 'html');

        //Check the image
        const imgResp = yield request({
            resolveWithFullResponse: true,
            url: card.image
        });
        checkResponse(imgResp, 'image');
    });
});

describe("scrapeCard", () => {

    it("Correctly scrapes trainers", function *() {
        //Scrape N
        const card = yield scraper.scrapeCard("http://www.pokemon.com/us/pokemon-tcg/pokemon-cards/bw-series/bwp/BW100/");
        assert(card.name == "N");
        assert(card.set.name == "BW—Promo");
        assert(card.text.includes("Prize cards"));
    });

    it("Correctly scrapes pokemon", function *() {
        //Scrape Snivy
        const card = yield scraper.scrapeCard("http://www.pokemon.com/us/pokemon-tcg/pokemon-cards/bw-series/bwp/BW01/");
        assert(card.name == "Snivy");
        assert(card.hp == 60);
        assert(card.set.name == "BW—Promo");
        assert(card.abilities[0].name == "Slam");
        //Check the image
        const imgResp = yield request({
            resolveWithFullResponse: true,
            url: card.image
        });
        checkResponse(imgResp, 'image');
        assert(card.id == "bwp/BW01");
    });

    it("Handles mega EXs", function *() {
        const card = yield scraper.scrapeCard("http://www.pokemon.com/us/pokemon-tcg/pokemon-cards/xy-series/xy1/2/");
        assert(card.name == "M-Venusaur-EX");
        assert(card.hp == 230);
        assert(card.set.name == "XY");
        assert(card.abilities[0].name == "Crisis Vine");
    });

    it("Correctly scrapes different types of pokemon abilities", function *() {
        const toScrape = [
            'http://www.pokemon.com/us/pokemon-tcg/pokemon-cards/bw-series/bw7/31/',
            'http://www.pokemon.com/us/pokemon-tcg/pokemon-cards/diamond-pearl-series/dp3/2/',
            'http://www.pokemon.com/us/pokemon-tcg/pokemon-cards/ex-series/ex14/14/',
            'http://www.pokemon.com/us/pokemon-tcg/pokemon-cards/ex-series/ex6/104/'].map(function (url) {
            return scraper.scrapeCard(url);
        });

        for (const card of yield toScrape) {
            assert("passive" in card);
        }
    });
});

describe("scrapeAll", function () {

    it("scrapes multi page queries", function *() {
        const cards = yield scraper.scrapeAll({
            cardName: "saur"
        }, false);
        assert(Array.isArray(cards));
        assert(cards.length >= 24);
    });

    it("scrapes card details when scrapeDetails is true", function *() {
        const cards = yield scraper.scrapeAll({
            cardName: "saur"
        }, true);

        //At least one of the '*saur' pokemon should have Vine Whip
        assert(cards.some(function (saur) {
            return saur.abilities.some(function (attack) {
                return attack.name == "Vine Whip";
            });
        }));
    });
});