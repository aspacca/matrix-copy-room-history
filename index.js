// Usage:
// node index.js -r -u "http://localhost:9000" # remember to add the registration!
// node index.js -p 9000
const fs = require('fs');
const Cli = require("matrix-appservice-bridge").Cli;
const Bridge = require("matrix-appservice-bridge").Bridge;
const AppServiceRegistration = require("matrix-appservice-bridge").AppServiceRegistration;

async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}

const ROOMS = require('./mapped_rooms.json');

var htmlEntities = {
  nbsp: ' ',
  cent: '¢',
  pound: '£',
  yen: '¥',
  euro: '€',
  copy: '©',
  reg: '®',
  lt: '<',
  gt: '>',
  quot: '"',
  amp: '&',
  apos: '\''
};

function unescapeHTML(str) {
  return str.replace(/\&([^;]+);/g, function (entity, entityCode) {
    var match;

    if (entityCode in htmlEntities) {
      return htmlEntities[entityCode];
      /*eslint no-cond-assign: 0*/
    } else if (match = entityCode.match(/^#x([\da-fA-F]+)$/)) {
      return String.fromCharCode(parseInt(match[1], 16));
      /*eslint no-cond-assign: 0*/
    } else if (match = entityCode.match(/^#(\d+)$/)) {
      return String.fromCharCode(~~match[1]);
    } else {
      return entity;
    }
  });
}

let bridge;

const DOMAIN = process.env.DOMAIN;
const ELEMENT_EXPORT_FOLDER = process.env.IMPORT_FOLDER;
const HOMESERVER_URL = process.env.HOMESERVER_URL;

if (undefined === DOMAIN || undefined === ELEMENT_EXPORT_FOLDER || undefined === HOMESERVER_URL) {
  console.log("Please define all ENV variables (DOMAIN, ELEMENT_EXPORT_FOLDER, HOMESERVER_URL)");
  process.exit(255);
}

new Cli({
  registrationPath: "matrix-copy-history-registration.yaml",
  generateRegistration: function(reg, callback) {
    reg.setId(AppServiceRegistration.generateToken());
    reg.setHomeserverToken(AppServiceRegistration.generateToken());
    reg.setAppServiceToken(AppServiceRegistration.generateToken());
    reg.setSenderLocalpart("matrix-copy");
    callback(reg);
  },
  run: function(port, config) {
    bridge = new Bridge({
      homeserverUrl: HOMESERVER_URL,
      domain: DOMAIN,
      registration: "matrix-copy-history-registration.yaml",

      controller: {
        onUserQuery: function(queriedUser) {
          return {}; // auto-provision users with no additonal data
        },

        onEvent: function(request, context) {
        }
      }
    });
    console.log("Matrix-side listening on port %s", port);
    bridge.run(port, config).then(async () => {
      let importFolders = fs.readdirSync(ELEMENT_EXPORT_FOLDER).sort();
      await asyncForEach(importFolders, async (jsonFile) => {
        let mappedEvents = {}
        if (jsonFile.split('.').pop() !== 'json') {
            return;
          }

          let rawdata = fs.readFileSync(jsonFile);
          let jsonContent = JSON.parse(rawdata);
          if (!jsonContent.hasOwnProperty('messages')) {
            return;
          }

          let messages = jsonContent.messages.sort(function(a,b) {
            if (a.hasOwnProperty('age') && b.hasOwnProperty('age')) {
              if (a['age'] > b['age']) {
                return 1;
              } else if (a['age'] < b['age']) {
                return -1;
              }
            }

            return 0;
          });

          await asyncForEach(messages, async (msg) => {
            if (!msg.hasOwnProperty('type') || msg.type !== "m.room.message") {
              return;
            }

            if (!msg.hasOwnProperty('room_id')) {
              return;
            }

            let originalRoomId = msg.room_id;

            if (!ROOMS.hasOwnProperty(originalRoomId)) {
              return;
            }

            if (!msg.hasOwnProperty('content')) {
              return;
            }

            let content = msg.content;

            if (!msg.hasOwnProperty('sender')) {
              return;
            }

            let userID = msg.sender;

            if (!msg.hasOwnProperty('event_id')) {
              return;
            }

            let originalEventId = msg.event_id;


            if (content.hasOwnProperty("m.relates.to") &&
              content["m.relates.to"].hasOwnProperty("m.in_reply_to") &&
              content["m.relates.to"]["m.in_reply_to"].hasOwnProperty("event_id")) {

              let oldEventID = content["m.relates.to"]["m.in_reply_to"]["event_id"];
              if (mappedEvents.hasOwnProperty(oldEventID)) {
                let newEventID = mappedEvents[oldEventID];

                content["m.relates.to"]["m.in_reply_to"]["event_id"] = newEventID;
              }
            }

            // content.body = unescapeHTML(content.body);

            let roomID = ROOMS[originalRoomId];

            let intent = bridge.getIntent(userID);
            await console.log(msg.age, roomID, userID, jsonFile, content);
            let reponse = await intent.sendEvent(roomID, "m.room.message", content);

            mappedEvents[originalEventId] = reponse.event_id;

          });
        });
    }).catch(function(error) {
      console.log(error)
    });
  }
}).run();
