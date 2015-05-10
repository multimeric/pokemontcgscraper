var scraper = require("./index");
var assert = require("assert");
var Promise = require('bluebird');

describe("scrapeSearchPage", function () {

    //Scrape the first page of the unfiltered results
    it("Scrapes an array of cards and a page count", function (done) {
        scraper.scrapeSearchPage("http://www.pokemon.com/us/pokemon-tcg/pokemon-cards/?None").then(function (page) {
            assert(page.numPages > 400);
            assert(page.cards.length >= 12);
            done();
        });
    });
});

describe("scrapeCard", function () {

    it("Correctly scrapes trainers", function (done) {
        //Scrape N
        scraper.scrapeCard("http://www.pokemon.com/us/pokemon-tcg/pokemon-cards/bw-series/bwp/BW100/").then(function (card) {
            assert(card.name == "N");
            assert(card.text.indexOf ("Prize cards" != -1));
            done();
        });

    });

    it("Correctly scrapes pokemon", function (done) {
        //Scrape Snivy
        scraper.scrapeCard("http://www.pokemon.com/us/pokemon-tcg/pokemon-cards/bw-series/bwp/BW01/").then(function (card) {
            assert(card.name == "Snivy");
            assert(card.hp == 60);
            assert(card.abilities[0].name == "Slam");
            done();
        });
    });

    it("Handles mega EXs", function (done) {
        scraper.scrapeCard("http://www.pokemon.com/us/pokemon-tcg/pokemon-cards/xy-series/xy1/2/").then(function (card) {
            assert(card.name == "M Venusaur-EX");
            assert(card.hp == 230);
            assert(card.abilities[0].name == "Crisis Vine");
            done();
        });
    });

    it("Correctly scrapes different types of pokemon abilities", function (done) {
        var toScrape = [
            'http://www.pokemon.com/us/pokemon-tcg/pokemon-cards/bw-series/bw7/31/',
            'http://www.pokemon.com/us/pokemon-tcg/pokemon-cards/diamond-pearl-series/dp3/2/',
            'http://www.pokemon.com/us/pokemon-tcg/pokemon-cards/ex-series/ex14/14/',
            'http://www.pokemon.com/us/pokemon-tcg/pokemon-cards/ex-series/ex6/104/'].map(function (url) {
                return scraper.scrapeCard(url);
            });

        Promise.all(toScrape).map(function(card) {
            assert("passive" in card);
        }).then(function () {
            done();
        });
    });
});

describe("scrapeAll", function () {

    it("scrapes multi page queries", function (done) {
        scraper.scrapeAll({
            cardName: "saur"
        }, false).then(function (cards) {
            assert(Array.isArray(cards));
            assert(cards.length >= 24);
            done();
        });
    });
});