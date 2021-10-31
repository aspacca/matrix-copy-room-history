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

let bridge;

const INVITER = process.env.INVITER;
const DOMAIN = process.env.DOMAIN;
const ELEMENT_EXPORT_FOLDER = process.env.ELEMENT_EXPORT_FOLDER;
const HOMESERVER_URL = process.env.HOMESERVER_URL;

if (undefined === INVITER || undefined === DOMAIN || undefined === ELEMENT_EXPORT_FOLDER || undefined === HOMESERVER_URL) {
  console.log("Please define all ENV variables (DOMAIN, ELEMENT_EXPORT_FOLDER, HOMESERVER_URL)");
  process.exit(255);
}

new Cli({
  registrationPath: "matrix-copy-room-history-registration.yaml",
  generateRegistration: function(reg, callback) {
    reg.setId(AppServiceRegistration.generateToken());
    reg.setHomeserverToken(AppServiceRegistration.generateToken());
    reg.setAppServiceToken(AppServiceRegistration.generateToken());
    reg.setSenderLocalpart("matrix-copy");
    reg.addRegexPattern("users", "@.*", false);
    reg.addRegexPattern("rooms", "!.*", false);
    callback(reg);
  },
  run: function(port, config) {
    bridge = new Bridge({
      homeserverUrl: HOMESERVER_URL,
      domain: DOMAIN,
      registration: "matrix-copy-room-history-registration.yaml",

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
        let hasJoined = {}
        let isInvited = {}

        let mappedEvents = {}

        let ownerIntent = bridge.getIntent(INVITER);
        if (jsonFile.split('.').pop() !== 'json') {
          return;
        }

        let rawdata = fs.readFileSync(ELEMENT_EXPORT_FOLDER + '/' + jsonFile);
        let jsonContent = JSON.parse(rawdata);
        if (!jsonContent.hasOwnProperty('messages')) {
          return;
        }

        let messages = jsonContent.messages.sort(function(a,b) {
          if (a.hasOwnProperty('origin_server_ts') && b.hasOwnProperty('origin_server_ts')) {
            if (a['origin_server_ts'] > b['origin_server_ts']) {
              return 1;
            } else if (a['origin_server_ts'] < b['origin_server_ts']) {
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

          if (!msg.content.hasOwnProperty('body')) {
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

          if (content.hasOwnProperty("m.relates_to") &&
            content["m.relates_to"].hasOwnProperty("m.in_reply_to") &&
            content["m.relates_to"]["m.in_reply_to"].hasOwnProperty("event_id")) {

            let oldEventID = content["m.relates_to"]["m.in_reply_to"]["event_id"];
            if (mappedEvents.hasOwnProperty(oldEventID)) {
              let newEventID = mappedEvents[oldEventID];

              content["m.relates_to"]["m.in_reply_to"]["event_id"] = newEventID;
            }
          }

          let roomID = ROOMS[originalRoomId];

          if (!isInvited.hasOwnProperty(userID) && userID !== INVITER) {
            await ownerIntent.invite(roomID, userID);
            isInvited[userID] = true;
          }

          let intent = bridge.getIntent(userID);

          if (!hasJoined.hasOwnProperty(userID) && userID !== INVITER) {
            await intent.join(roomID);
            hasJoined[userID] = true;
          }

          await console.log(msg.origin_server_ts, roomID, userID, jsonFile, content);

          let response = await intent.sendEvent(roomID, "m.room.message", content);

          mappedEvents[originalEventId] = response.event_id;

        });
      });
    }).catch(function(error) {
      console.log(error)
    });
  }
}).run();
