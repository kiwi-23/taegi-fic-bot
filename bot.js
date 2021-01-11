var twit = require("twit");
var config = require("./config");
var bot = new twit(config);

const axios = require("axios");
const cheerio = require("cheerio");

const firebase = require("firebase/app");
require('firebase/database');
var config2 = require("./config2");
firebase.initializeApp(config2);
var database1 = firebase.database();

const datastore = require("nedb");
const database2 = new datastore("database.db");
database2.loadDatabase();

var ref = database1.ref();

var mods = ["mangomya_", "TAEGINATION", "TAEGIRKlVE", "mya_kiwi"];
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

var recommend = bot.stream("statuses/filter", { track: "@taegificbot recommend" });

recommend.on("tweet", function (tweetdata) {
  let name = tweetdata.user.screen_name;
  let tweetid = tweetdata.id_str;
  let quote = false;
  if (tweetdata.quoted_status) {
    if (tweetdata.text.search(/@taegificbot recommend/i) == -1)
      quote = true;
  }
  if (!quote && !tweetdata.retweeted_status) {
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
        "pairing": "min yoongi | suga/kim seokjin | jin/kim taehyung | v"
      },
      {
        "ship": "taegiseok",
        "pairing": "jung hoseok | j-hope/kim taehyung | v/min yoongi | suga"
      },
      {
        "ship": "taegijoon",
        "pairing": "kim namjoon | rap monster/kim taehyung | v/min yoongi | suga"
      },
      {
        "ship": "taegimin",
        "pairing": "kim taehyung | v/min yoongi | suga/park jimin"
      },
      {
        "ship": "taegikook",
        "pairing": "jeon jungkook/kim taehyung | v/min yoongi | suga"
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
      database2.find(parameters, function (error, docs) {
        if (docs.length > 0) {
          let reply = "@" + name + " " + phrases[Math.floor(Math.random() * phrases.length)];
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

var submit = bot.stream("statuses/filter", { track: "@taegificbot submit" });

submit.on("tweet", function (tweetdata) {
  let quote = false;
  if (tweetdata.quoted_status) {
    if (tweetdata.text.search(/@taegificbot submit/i) == -1)
      quote = true;
  }
  if (!quote && !tweetdata.retweeted_status) {
    let valid = false;
    let name = tweetdata.user.screen_name;
    for (let i = 0; i < mods.length; i++) {
      if (name == mods[i])
        valid = true;
    }
    let tweetid = tweetdata.id_str;
    if (valid == false)
      tweet("@" + name + " this feature is only available to the mods at the moment :<", tweetid);
    else {
      let link = tweetdata.entities.urls[0].expanded_url;
      let entry = {};
      entry.link = link;
      valid = false;
      let pos = entry.link.search(/works/i);
      if (pos != -1) {
        valid = true;
        entry.id = entry.link.substring(pos + 6);
        let extra = entry.id.indexOf("/");
        if (extra != -1) {
          entry.id = entry.id.substring(0, extra);
          entry.link = entry.link.substring(0, (entry.link.search(entry.id) + entry.id.length));
        }
      }
      if (valid == true) {
        database2.find({id: entry.id}, async function (error, docs) {
          if (docs.length == 0) {
            await scrape(entry);
            database2.find({}, function (error, database) {
              tweet("@" + name + " the fic has been added to the database :D \r\ndatabase strength: " + database.length, tweetid);
            });
          }
          else {
            database2.find({}, function (error, database) {
              tweet("@" + name + " the fic already exists in the database :> \r\ndatabase strength: " + database.length, tweetid);
            });
          }
        });
      }
      else
        tweet("@" + name + " something went wrong :< please check if the url entered is valid.", tweetid);
    }
  }
});

function tweet(text, tweetid) {
  bot.post("statuses/update", {in_reply_to_status_id: tweetid, status: text}, function (error, data, response) {
    if (error)
      console.log("something went wrong D:");
    else
      console.log("tweet sent! :D")
  });
}

async function scrape(fic) {
  let promise = await new Promise((resolve, reject) => {
    axios.get(fic.link)
    .then((response) => {
      var $ = cheerio.load(response.data);
      fic.title = $("h4.heading a").eq(0).text().toLowerCase();
      if (fic.title.length == 0)
        fic.title = $("h2.heading").text().toLowerCase().replace(/\n/g, "").trim();
      fic.authors = [];
      let authors = $("a[rel=author]");
      for (let i = 0; i < authors.length; i++) {
        let author = $(authors).eq(i).text().toLowerCase();
        fic.authors.push(author);
      }
      fic.rating = $(".rating a").text().toLowerCase();
      if (fic.rating == "")
        fic.rating = $(".rating span").text().toLowerCase();
      fic.warnings = [];
      let warnings = $("dd.warning a");
      if (warnings.length == 0)
        warnings = $(".warnings a");
      for (let i = 0; i < warnings.length; i++) {
        let warning = $(warnings).eq(i).text().toLowerCase();
        fic.warnings.push(warning);
      }
      let categories = $("span.category span").text().toLowerCase().replace(/ /g, "");
      fic.categories = categories.split(",");
      if (categories.length == 0) {
        fic.categories = []
        categories = $(".category a");
        for (let i = 0; i < categories.length; i++) {
          let category = $(categories).eq(i).text().toLowerCase();
          fic.categories.push(category);
        }
      }
      fic.fandoms = [];
      let fandoms = $(".fandom a");
      if (fandoms.length == 0)
        fandoms = $(".fandoms a");
      for (let i = 0; i < fandoms.length; i++) {
        let fandom = $(fandoms).eq(i).text().toLowerCase();
        fic.fandoms.push(fandom);
      }
      fic.ships = [];
      let ships = $(".relationship a");
      if (ships.length == 0)
        ships = $(".relationships a");
      for (let i = 0; i < ships.length; i++) {
        let ship = $(ships).eq(i).text().toLowerCase();
        fic.ships.push(ship);
      }
      fic.tags = [];
      let tags = $(".freeform a");
      if (tags.length == 0)
        tags = $(".freeforms a");
      for (let i = 0; i < tags.length; i++) {
        let obj = {};
        obj.tag = $(tags).eq(i).text().toLowerCase();
        fic.tags.push(obj);
      }
      fic.language = $("dd.language").text().toLowerCase().replace(/\n/g, "").trim();
      fic.length = $("dd.words").text();
      fic.length = parseFloat(fic.length.replace(/,/g, ""));
      fic.chapters = $("dd.chapters").text();
      let slash = fic.chapters.indexOf("/");
      let left = parseFloat(fic.chapters.substring(0, slash));
      let right = parseFloat(fic.chapters.substring(slash + 1));
      if (left == right)
        fic.complete = true;
      else
        fic.complete = false;
      let updated = $(".datetime").text().toLowerCase();
      fic.updated = {};
      if (updated.length > 0) {
        fic.updated.day = parseFloat(updated.substring(0, 2));
        let month = updated.substring(3, 6).toLowerCase();
        let months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
        for (let i = 0; i < months.length; i++) {
          if (month == months[i])
            fic.updated.month = i + 1;
        }
        fic.updated.year = parseFloat(updated.substring(7));
      }
      else {
        updated = $("dd.status").text().toLowerCase();
        if (updated.length == 0)
          updated = $("dd.published").text().toLowerCase();
        fic.updated.year = parseFloat(updated.substring(0, 4));
        fic.updated.month = parseFloat(updated.substring(5, 7));
        fic.updated.date = parseFloat(updated.substring(8));
      }
      resolve(fic);
      ref.push(fic);
      database2.insert(fic);
    })
    .catch((error) => console.error(error));
  });
}

build();

function build() {
  ref.once("value", function (data) {
    let all = data.val();
    let ids = Object.keys(all);
    for (let i = 0; i < ids.length; i++) {
      let id = ids[i];
      let fic = all[id];
      database2.insert(fic);
    }
    console.log("local database rebuilt!");
  },
  function (error) {
    console.log(error);
  });
}
