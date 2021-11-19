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
$ git clone https://github.com/aspacca/matrix-copy-room-history.git
$ cd matrix-copy-room-history
$ npm install
```

## Defining mapping for rooms
You need to create a json file to map the id of the Room you want to copy the history from to the Room you want to copy the history to.

- `mapped_rooms.json`

The keys in the json are the IDs on the original Room to copy from.
The values in the json are the IDs on the new Room to copy to.
```json
{
  "!dFgLMhERaQPhFNmxPu:your-homeserver-domain.com":"!lTyPKoNMeWDiOPlfHn:your-homeserver-domain.com",
  "!SDqaFGikLvBjPFdwxL:your-homeserver-domain.com":"!KdbHjErWcXpEQfGMki:your-homeserver-domain.com"
 }
```

## Collecting the Element history export of Room
You need to save the Element history export of every Room you want to copy in the same folder.
You can save everywhere since you will be able to point to that directory later in the process via an `ELEMENT_EXPORT_FOLDER` environment variable.

## Adjusting homeserver rate limits

If you're importing a very large room, the script may hit the homeserver's rate limits (an `M_LIMIT_EXCEEDED` error).
To ensure an uninterrupted import, consider increasing these rate limits in Synapse's `homeserver.yaml`:

```yaml
# Aggressively increased rate limits for importing to work.
# Make sure to restore them back after importing.
rc_joins:
    local:
        burst_count: 1000000
        per_second: 10000
    remote:
        burst_count: 1000000
        per_second: 10000
rc_login:
    account:
        burst_count: 1000000
        per_second: 10000
    address:
        burst_count: 1000000
        per_second: 10000
    failed_attempts:
        burst_count: 1000000
        per_second: 10000
rc_message:
    burst_count: 1000000
    per_second: 10000
rc_registration:
    burst_count: 1000000
    per_second: 10000
```

## Registering as an application service
The script setup a CLI via the `Cli` class, which will dump the registration file to
`matrix-copy-room-history-registration.yaml`. It will register the user ID `@matrix-copy:domain` and ask
for rights to the namespace of every users and rooms. It also generates two tokens which will be used for authentication.

Now type `INVITER=@roomadmin:localhost DOMAIN=localhost HOMESERVER_URL=http://localhost:9000 ELEMENT_EXPORT_FOLDER=/tmp/ELEMENT-EXPORT-HISTORY node index.js -r -u "http://localhost:9000"` (`INVITER` is the Admin user of the Room the history will be copied to, `HOMESERVER_URL` and the last url param are the same URL that the
homeserver will try to use to communicate with the application service, `DOMAIN` is the DOMAIN of the homserver) and a file
`matrix-copy-room-history-registration.yaml` will be produced. In your Synapse install, edit
`homeserver.yaml` to include this file:
```yaml
app_service_config_files: ["/path/to/copy/matrix/history/matrix-copy-room-history-registration.yaml"]
```
Then restart your homeserver. Your application service is now registered.

# Run the import
Run the app service with `INVITER=@roomadmin:localhost DOMAIN=localhost HOMESERVER_URL=http://localhost:9000 ELEMENT_EXPORT_FOLDER=/tmp/ELEMENT-EXPORT-HISTORY node index.js -p 9000` and wait until the last message is print to console and copied to the new Room.
Once it's done you can exit with CTRL+C


# Notes
The messages are sent to the homeserver with the `Intent` object obtained from the bridge (https://github.com/matrix-org/matrix-appservice-bridge/blob/develop/README.md#intent).
You must create the Room where to copy the history too before running the script. An `INVITER` should also be set (ie: the Admin of the Room where to copy the history): this
is needed in order to let the Admin user invite the members of the original Room in the new one, in order to prevent troubles with invite only Rooms.
The script will take care of invitation and joining the new Room by the members of the old one.

All messages imported into the new room **get a new timestamp** and do not retain the original message's date/time.
