"use strict";

/*
 * Created with @iobroker/create-adapter v2.1.1
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");

const axios = require("axios").default;

class MatrixOrg extends utils.Adapter {

    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    constructor(options) {
        super({
            ...options,
            name: "matrix-org",
        });
        this.on("ready", this.onReady.bind(this));
        this.on("stateChange", this.onStateChange.bind(this));
        this.on("message", this.onMessage.bind(this));
        this.on("unload", this.onUnload.bind(this));
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        this.unloaded = false;
        // Reset the connection indicator during startup
        this.setState("info.connection", false, true);

        /*
        the send message container
        */
        await this.setObjectNotExistsAsync("sendMessage", {
            type: "state",
            common: {
                name: "Send message",
                type: "string",
                role: "text",
                read: true,
                write: true,
            },
            native: {},
        });

        // message will send after a change
        this.subscribeStates("sendMessage");
        if (this.config.serverIp === "")
        {
            this.log.error("No server set!");
        }
        else
        {
            let reqUrl = "https://"
            + this.config.serverIp + ":"
            + this.config.serverPort + "/_matrix/client/r0/directory/room/"
            + this.config.roomName;
            reqUrl = encodeURI(reqUrl); // to catch the most malformating strings
            reqUrl = reqUrl.replace("#", "%23"); // still needed for the room key, at least my server need it. Do not before or the % will be %25 :-)
            this.log.debug("url request with axios: " + reqUrl);
            try {
                const res = await axios.get(reqUrl);
                if (res.status === 200) {
                    if (this.unloaded === false) {
                        const roomIdData = res.data;
                        await this.setStateAsync("matrixServerData.roomId", {val: roomIdData.room_id, ack: true});
                        this.setState("info.connection", true, true);
                    }
                }
                else
                {
                    this.log.error("Server or room not found. Check port (443/8448), room name and server.");
                }
            } catch (err) {
                this.log.error(err);
                this.log.error("Server not reached! " + this.config.serverIp + ":" + this.config.serverPort + " with room: " + this.config.roomName);
                this.setState("info.connection", false, true);
            }
        }
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback
     */
    onUnload(callback) {
        this.unloaded = true;
        try {
            callback();
        } catch (e) {
            callback();
        }
    }

    /**
     * Is called if a subscribed state changes
     * @param {string} id
     * @param {ioBroker.State | null | undefined} state
     */
    async onStateChange(id, state)
    {
        if (state)
        {
            // The state was changed
            if (state.val)
            {
                if (state.ack === false) // This is ioBroker convention, only send commands if ack = false
                {
                    this.sendMessageToMatrix(state.val.toString());
                }
            }
        } else {
            // The state was deleted
            this.log.info(`state ${id} deleted`);
        }
    }
    /**
     * @param {string} message
     */
    async sendMessageToMatrix(message) {
        const roomId = await this.getStateAsync("matrixServerData.roomId");
        if (roomId)
        {
            let state = "get access token with user and password!";
            let reqUrl = "https://"
            + this.config.serverIp + ":"
            + this.config.serverPort + "/_matrix/client/r0/login";
            reqUrl = encodeURI(reqUrl);
            const data = {"type": "m.login.password", "user": this.config.botName, "password": this.config.botPassword };
            try
            {
                let res = await axios.post(reqUrl, data);
                if (res.status === 200) {
                    state = "send message to room with access token!";
                    const accTokenData = res.data;
                    const accToken = accTokenData.access_token;
                    reqUrl = "https://"
                    + this.config.serverIp + ":"
                    + this.config.serverPort + "/_matrix/client/r0/rooms/"
                    + roomId.val + "/send/m.room.message/35?access_token="
                    + accToken;
                    const data = {"body": message, "msgtype": "m.text" };
                    reqUrl = encodeURI(reqUrl);
                    res = await axios.put(reqUrl, data);
                    if (res.status === 200) {
                        state = "logout again to invalidate token.";
                        reqUrl = "https://"
                        + this.config.serverIp + ":"
                        + this.config.serverPort + "/_matrix/client/r0/logout?access_token="
                        + accToken;
                        const data = {};
                        reqUrl = encodeURI(reqUrl);
                        axios.post(reqUrl, data);
                        // ignore the returns, there is no info in it.
                    }
                }
            }
            catch (err)
            {
                this.log.error(err);
                this.log.error("URL requested: " + reqUrl);
                this.log.error("error during: " + state);
            }
        }
    }

    onMessage(obj) {
        if (typeof obj === "object" && obj.message)
        {
            if (obj.command === "send")
            {
                this.log.info("send command is triggered! Oeli." + obj.message);
                if (obj.message)
                {
                    this.sendMessageToMatrix(obj.message);
                }
                if (obj.callback)
                {
                    this.sendTo(obj.from, obj.command, "Message computed", obj.callback);
                }
            }
        }
    }
}

if (require.main !== module) {
    // Export the constructor in compact mode
    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    module.exports = (options) => new MatrixOrg(options);
} else {
    // otherwise start the instance directly
    new MatrixOrg();
}
