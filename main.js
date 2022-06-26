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
        this.on("unload", this.onUnload.bind(this));
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {

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
                role: "indicator",
                read: true,
                write: true,
            },
            native: {},
        });

        // message will send after a change
        this.subscribeStates("sendMessage");

        let reqUrl = "https://"
        + this.config.serverIp + ":"
        + this.config.serverPort + "/_matrix/client/r0/directory/room/"
        + this.config.roomName;
        reqUrl = reqUrl.replace("#", "%23");
        this.log.debug("url request with axios: " + reqUrl);
        try {
            const res = await axios.get(reqUrl);
            if (res.status === 200) {
                const roomIdData = res.data;
                await this.setStateAsync("matrixServerData.roomId", {val: roomIdData.room_id, ack: true});
                this.setState("info.connection", true, true);
            }
        } catch (err) {
            this.log.error(err);
            this.setState("info.connection", false, true);
        }
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback
     */
    onUnload(callback) {
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
            const roomId = await this.getStateAsync("matrixServerData.roomId");
            if (roomId)
            {
                let reqUrl = "https://"
                + this.config.serverIp + ":"
                + this.config.serverPort + "/_matrix/client/r0/login";
                reqUrl = reqUrl.replace("#", "%23");
                const data = {"type": "m.login.password", "user": this.config.botName, "password": this.config.botPassword };
                try
                {
                    let res = await axios.post(reqUrl, data);
                    if (res.status === 200) {
                        const accTokenData = res.data;
                        const accToken = accTokenData.access_token;
                        reqUrl = "https://"
                        + this.config.serverIp + ":"
                        + this.config.serverPort + "/_matrix/client/r0/rooms/"
                        + roomId.val + "/send/m.room.message/35?access_token="
                        + accToken;
                        const data = {"body": state.val, "msgtype": "m.text" };
                        reqUrl = reqUrl.replace("#", "%23");
                        res = await axios.put(reqUrl, data);
                        if (res.status === 200) {
                            reqUrl = "https://"
                            + this.config.serverIp + ":"
                            + this.config.serverPort + "/_matrix/client/r0/logout?access_token="
                            + accToken;
                            const data = {};
                            reqUrl = reqUrl.replace("#", "%23");
                            axios.post(reqUrl, data);
                            // ignore the returns, there is no info in it.
                        }
                    }
                }
                catch (err)
                {
                    this.log.error(err);
                }
            }
        } else {
            // The state was deleted
            this.log.info(`state ${id} deleted`);
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
