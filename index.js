"use strict";

//Constants
const SCRAPE_URL = "http://www.pokemon.com/us/pokemon-tcg/pokemon-cards/?format=expanded";

//Requires
let request = require('request-promise');
let cheerio = require('cheerio');
let co = require('co');
let url = require('url');

//Globals
let cards = [];
let numPages = 0;

/**
 * Scrapes the page at the given URL, and returns the jQuery object for further processing
 */
function* scrapeSearchPage(pageUrl){
	let response = yield request(pageUrl);
	let $ = cheerio.load(response);
	$("#cardResults li").each(function(i, el){
		let $card = $(el);
		let card = {
			url: url.resolve(SCRAPE_URL, card.find("a").attr("href")),
			image: url.resolve(SCRAPE_URL, card.find("img").attr("src"))
		};
		
		
		cards.push(card);
		console.log(cards[cards.length - 1]);
	});
	
	return $;
}

function* scrapeCardPage(card, pageUrl)
{
	let $ = cheerio.load(yield request(card.url));
	
	$header = $(".card-description");
	card.name = $header.find("h1").text();
	
	$basicInfo = $.find(".card-basic-info");
	card.type = $basicInfo.find(".card-type");
	card.hp = $basicInfo.find(".right");
	
	$abilities = $basicInfo.find("pokemon-abilities ability");
}

co(function *(){
	let $ = yield scrapePage(SCRAPE_URL);
	let totalText = $('#cards-load-more span').text();
	let numPages = /\d of (\d+)/.exec(totalText)[1];
	
	for (let i = 2; i <= numPages; i++){
		let scrapeURL = url.resolve(SCRAPE_URL, i.toString()) + "?format=expanded";
		yield scrapePage(scrapeURL)
		console.log("URL is" + scrapeURL);
	}
});