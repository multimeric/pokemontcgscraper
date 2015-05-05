var scraper = require("./index");
var assert = require("assert");

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

    it("Correctly scrapes single cards", function (done) {
        //Scrape Snivy
        scraper.scrapeCard("http://www.pokemon.com/us/pokemon-tcg/pokemon-cards/bw-series/bwp/BW01/").then(function (card) {
            assert(card.name == "Snivy");
            assert(card.hp == 60);
            assert(card.abilities[0].name == "Slam");
            done();
        });
    });
});

describe("scrapeAll", function () {

    it("scrapes the entire pokemon database", function (done) {
        scraper.scrapeAll({
            cardText: "Victory Star"
        }).then(function (cards) {
            assert(Array.isArray(cards));
            assert(cards.length >= 4);
            done();
        });
    });
});