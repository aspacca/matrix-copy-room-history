# matrix-copy-room-history
Copy an Element export history of a Matrix Room to another Room on the same Matrix server

This README will explain requirements and how to run the script in order to copy an Element export history of a Matrix Room to another Room om the same Matrix server.
The code is based from https://github.com/matrix-org/matrix-appservice-bridge/blob/develop/HOWTO.md

You need to have:
- A working homeserver install
- An Element export history of a Matrix Room (https://element.io/blog/element-1-9-1-export-is-finally-here/)
- `npm` and `nodejs`
- `mapped_rooms.json` file to map from the original Room to the one to copy to.

NB: This how-to refers to the binary `node` - this may be `nodejs` depending on your distro.

# Install dependencies
Checkout the code and enter the directory.
Run `npm install` to install the required dependencies.
```
$ git checkout https://github.com/aspacca/matrix-copy-room-history.git
$ cd matrix-copy-room-history
$ npm install
```


## Registering as an application service
The scrip setup a CLI via the `Cli` class, which will dump the registration file to
`matrix-copy-room-history-registration.yaml`. It will register the user ID `@matrix-copy:domain` and ask
for exclusive rights (so no one else can create them) to the namespace of every users. It also generates two tokens which will be used for authentication.

Now type `DOMAIN=localhost HOMSEVER_URL=http://localhost:9000 node index.js -r -u "http://localhost:9000"` (`HOMSERVER_URL` and the last url param are the same URL that the
homeserver will try to use to communicate with the application service, `DOMAIN` is the DOMAIN of the homserver) and a file
`matrix-copy-room-history-registration.yaml` will be produced. In your Synapse install, edit
`homeserver.yaml` to include this file:
```yaml
app_service_config_files: ["/path/to/copy/matrix/history/matrix-copy-room-history-registration.yaml"]
```
Then restart your homeserver. Your application service is now registered.

## Collecting the Element history export of Room
You need to save the Element history export of every Room you want to copy in the same folder.
You can save everywhere since you will be able to point to that directory later in the process.


## Defining mapping for rooms
We need to create a json file to map the id of the Room you want to copy the history from to the Room you want to copy the history to.

- `mapped_rooms.json`

The keys in the json are the IDs on the original Room to copy from.
The values in the json are the IDs on the new Room to copy to.
```json
{
  "!dFgLMhERaQPhFNmxPu:your-homeserver-domain.com":"!lTyPKoNMeWDiOPlfHn:your-homeserver-domain.com",
  "!SDqaFGikLvBjPFdwxL:your-homeserver-domain.com":"!KdbHjErWcXpEQfGMki:your-homeserver-domain.com"
 }
```

# Run the import
Run the app service with `DOMAIN=localhost HOMSEVER_URL=http://localhost:9000 IMPORT_FOLDER=/tmp/ELEMENT-EXPORT-HISTORY node index.js -p 9000` and wait until the last message is print to console and imported on matrix.
Once it's done you can exit with CTRL+C


# Notes
The messages are sent to the homserver with the `Intent` object obtained from the bridge (https://github.com/matrix-org/matrix-appservice-bridge/blob/develop/README.md#intent).
This would make sure that user you are importing the message from joined to the room first before sending the message.
If the user cannot join the room the message is sent to an exception is thrown and the message won't be imported: it's suggested to have all the users on the homeserver already joined the rooms to import for.   

