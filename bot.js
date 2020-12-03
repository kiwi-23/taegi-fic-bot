const { JSDOM } = require( "jsdom" );
const { window } = new JSDOM( "" );
const $ = require( "jquery" )( window );

const axios = require("axios");
const cheerio = require("cheerio");
const datastore = require("nedb");

var twit = require("twit");
var config = require("./config");
var bot = new twit(config);

var database = [];
var index = 0;
var built = true;
var building = false;

const database1 = new datastore("database.db");
database1.loadDatabase();

var phrases = [
  "don't forget to leave kudos and comments! ",
  "remember to show authors love :> ",
  "hello! we're here to brighten your day! :D ",
  "was this what you were looking for? ",
  "hope you have a fun reading! ",
  "hey! here is your delivery~ ",
  "we got you! ",
  "hi! ",
  "we've got just what you were looking for! ",
  "hello! some piping hot fics for you~ ",
  "hey!! "
];

build();

function build() {
  tweet("@mangomya_ rebuilding database.");
  //spreadsheet id = 1MA1m2FVAorEpHLOi66o_Kv2Bqewim8CqFd5YvTexO4E
  $.getJSON("https://spreadsheets.google.com/feeds/list/1MA1m2FVAorEpHLOi66o_Kv2Bqewim8CqFd5YvTexO4E/1/public/values?alt=json", function(data) {
    for (let i = 0; i < data.feed.entry.length; i++) {
      let content = data.feed.entry[i]["gsx$enterlinks"]["$t"];
      content = content.trim();
      let link_arr = content.split("\n");
      for (let j = 0; j < link_arr.length; j++) {
        let link = link_arr[j].trim();
        add(link);
      }
    }
    console.log(database.length);
    index = 0;
    let rate = setInterval(async function() {
      console.log(index);
      await scrape();
      index++;
      if (index >= database.length) {
        clearInterval(rate);
        database1.insert(database);
        building = false;
        built = true;
        tweet("@mangomya_ rebuild finished. database strength: " + database.length);
      }
    }, 1000 * 5);
  });
}

async function scrape() {
  let url = database[index].link;
  let promise = await new Promise((resolve, reject) => {
    axios.get(url)
    .then((response) => {
      var $ = cheerio.load(response.data);
      let fic = database[index];
      fic.rating = $(".rating a").text();
      if (fic.rating == "")
        fic.rating = $(".rating span").text();
      fic.length = $(".words").eq(1).text();
      fic.length = parseFloat(fic.length.replace(/,/g, ""));
      fic.ships = [];
      let ships = $("dd.relationship a");
      if (ships.length == 0)
        ships = $("li.relationships a");
      for (let j = 0; j < ships.length; j++) {
        let ship = $(ships).eq(j).text();
        fic.ships.push(ship);
      }
      fic.tags = [];
      let tags = $("dd.freeform a");
      if (tags.length == 0)
        tags = $("li.freeforms a");
      for (let j = 0; j < tags.length; j++) {
        let obj = {};
        obj.tag = $(tags).eq(j).text().toLowerCase();
        fic.tags.push(obj);
      }
      resolve(fic);
    })
    .catch((error) => console.error(error));
  });
}

function add(link) {
  let entry = polish(link);
  if (entry.valid == true) {
    delete entry.valid;
    let repeat = search(entry);
    if (repeat == false)
      database.push(entry);
  }
}

function polish(link) {
  let entry = {};
  entry.link = link;
  entry.valid = false;
  let pos = entry.link.search("works");
  if (pos != -1) {
    entry.valid = true;
    entry.id = entry.link.substring(pos + 6);
    let extra = entry.id.indexOf("/");
    if (extra != -1) {
      entry.id = entry.id.substring(0, extra);
      entry.link = entry.link.substring(0, (entry.link.search(entry.id) + entry.id.length));
    }
  }
  return entry;
}

function search(entry) {
  let check = false;
  for (let i = 0; i < database.length; i++) {
    if (database[i].id === entry.id)
      check = true;
  }
  return check;
}

var stream = bot.stream("statuses/filter", { track: "@taegificbot recommend" });

stream.on("tweet", function(tweetdata) {
  let name = tweetdata.user.screen_name;
  let tweetid = tweetdata.id_str;
  let quote = false;
  if (tweetdata.quoted_status) {
    if (tweetdata.text.search(/@taegificbot recommend/i) == -1)
      quote = true;
  }
  if (!quote && !tweetdata.retweeted_status) {
    if (!building) {
      database1.find({}, function(error, docs) {
        if (docs.length == 0) {
          building = true;
          built = false;
          tweet("@" + name + " the bot is temporarily down for daily restructuring :< please retry a little later.", tweetid);
          build();
        }
        else {
          let valid = true;
          let length = "";
          let tags = [];
          let text = tweetdata.text;
          let index_l = text.search(/length/i);
          if (index_l != -1) {
            let start = text.indexOf("(", index_l);
            let end = text.indexOf(")", index_l);
            if (start != -1 && end != -1) {
              length = text.substring(start + 1, end);
              length = length.trim().toLowerCase();
            }
            else
              valid = false;
          }
          let index_t = text.search(/tags/i);
          if (index_t != -1) {
            let start = text.indexOf("(", index_t);
            let end = text.indexOf(")", index_t);
            if (start != -1 && end != -1) {
              let tags_str = text.substring(start + 1, end);
              let tags_arr = tags_str.split(",");
              for (let i = 0; i < tags_arr.length; i++) {
                let tag = tags_arr[i].trim().toLowerCase();
                let words = [];
                if (tag.search(" ") != -1)
                  words = tag.split(" ");
                else
                  words.push(tag);
                tags.push(words);
              }
            }
            else
              valid = false;
          }
          let poly = [
            {
              "ship": "taegijin",
              "pairing": "Min Yoongi | Suga/Kim Seokjin | Jin/Kim Taehyung | V"
            },
            {
              "ship": "taegiseok",
              "pairing": "Jung Hoseok | J-Hope/Kim Taehyung | V/Min Yoongi | Suga"
            },
            {
              "ship": "taegijoon",
              "pairing": "Kim Namjoon | Rap Monster/Kim Taehyung | V/Min Yoongi | Suga"
            },
            {
              "ship": "taegimin",
              "pairing": "Kim Taehyung | V/Min Yoongi | Suga/Park Jimin"
            },
            {
              "ship": "taegikook",
              "pairing": "Jeon Jungkook/Kim Taehyung | V/Min Yoongi | Suga"
            }
          ];
          let threshold1 = 0;
          let threshold2 = Infinity;
          if (length == "short")
            threshold2 = 5000;
          else if (length == "average") {
            threshold1 = 5000;
            threshold2 = 20000;
          }
          else if (length == "long") {
            threshold1 = 20000;
            threshold2 = 50000;
          }
          else if (length == "epic")
            threshold1 = 50000;
          else if (length != "")
            valid = false;
          if (valid == true) {
            let parameters = {
              $and: [
                {
                  length: {
                    $gt: threshold1,
                    $lt: threshold2
                  },
                }
              ]
            };
            let obj1 = {};
            obj1["$and"] = [];
            for (let i = 0; i < tags.length; i++) {
              let obj2 = {};
              tags[i][0] = tags[i][0].toLowerCase();
              for (let j = 0; j < poly.length; j++) {
                if (tags[i][0] === poly[j].ship) {
                  obj2.ships = {};
                  obj2.ships["$elemMatch"] = poly[j].pairing;
                  break;
                }
              }
              if (!obj2.ships) {
                obj2.tags = {};
                obj2.tags["$elemMatch"] = {};
                obj2.tags["$elemMatch"]["$and"] = [];
                for (let j = 0; j < tags[i].length; j++) {
                  let obj3 = {};
                  obj3.tag = new RegExp(tags[i][j]);
                  obj2.tags["$elemMatch"]["$and"].push(obj3);
                }
              }
              obj1["$and"].push(obj2);
            }
            parameters["$and"].push(obj1);
            database1.find(parameters, function (error, docs) {
              let reply = "@" + name + " " + phrases[Math.floor(Math.random() * phrases.length)];
              if (docs.length > 0) {
                let fics = [];
                if (docs.length <= 3)
                  fics = docs;
                else {
                  for (let i = 0; i < 3; i++) {
                    let index = Math.floor(Math.random() * docs.length);
                    fics.push(docs[index]);
                    docs.splice(index, 1);
                  }
                }
                for (let i = 0; i < fics.length; i++) {
                  reply += "\n" + fics[i].link;
                }
                tweet(reply, tweetid);
              }
              else
                tweet("@" + name + " your query did not match any result :< please try a more general search.", tweetid);
            });
          }
          else
            tweet("@" + name + " something went wrong :< please check your syntax again.", tweetid);
        }
      });
    }
    else
      tweet("@" + name + " the bot is temporarily down for daily restructuring :< please retry a little later.", tweetid);
  }
});

function tweet(text, tweetid) {
  bot.post("statuses/update", {in_reply_to_status_id: tweetid, status: text}, function(error, data, response) {
    if (error)
      console.log("something went wrong!");
    else
      console.log("tweet sent!")
  });
}
