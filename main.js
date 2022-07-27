"use strict";

/*
 * Created with @iobroker/create-adapter v2.1.1
 */

/// site references for matrix and crypto:
// https://www.npmjs.com/package/@matrix-org/matrix-sdk-crypto-nodejs
// https://turt2live.github.io/matrix-bot-sdk/tutorial-encryption-bots.html
// https://github.com/turt2live/matrix-bot-sdk
// another bot using project https://github.com/guardianproject/ractive
// https://matrix.org/docs/guides/usage-of-the-matrix-js-sdk

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");

global.Olm = require("olm");
const matrix = require("matrix-js-sdk");
const { LocalStorageCryptoStore } = require("matrix-js-sdk/lib/crypto/store/localStorage-crypto-store");
const { LocalStorage } = require("node-localstorage");
const localStorage = new LocalStorage("./localCryptoStorage");

// Next three lines because of https://github.com/matrix-org/matrix-js-sdk/issues/2415
const matrixcs = require("matrix-js-sdk/lib/matrix");
const request = require("request");
matrixcs.request(request);
// until here may be deleted when fix of https://github.com/matrix-org/matrix-js-sdk/issues/2415
//const { EventEmitterEvents } = require("matrix-js-sdk/lib/models/typed-event-emitter");

let matrixClient;
let accessToken = "";
let deviceID = "";
let fullUserId = "";
let roomId = "";
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
     * is called as part of the login chain to big for inline
     * @param {*} err
     * @param {*} data
     */
    async matrixRoomIdResponse(err, data)
    {
        if (data)
        {
            await this.setStateAsync("matrixServerData.roomId", {val: data.room_id, ack: true});
            roomId = data.room_id;
            matrixClient.login("m.login.password",{user: this.config.botName, password: this.config.botPassword},
                (err, data)=>this.matrixLoginResponse(err, data)
            );
        }
        else if (err)
        {
            this.log.error("Server or room not found. Check port (443/8448), room name and server.");
            this.log.error(err);
        }
    }
    /**
     * is called of last state of the login chain, Crypto disabled due to malfunction
     * @param {*} err
     * @param {*} data
     */
    async matrixLoginResponse(err, data)
    {
        if (data)
        {
            accessToken = data.access_token;
            deviceID = data.device_id;
            fullUserId = data.user_id;
            this.setState("info.connection", true, true);
            try
            {
                let baseURL = "";
                if (this.config.serverPort === "443")
                {
                    baseURL = "https://" + this.config.serverIp;
                }
                else
                {
                    baseURL = "https://" + this.config.serverIp + ":" + this.config.serverPort;
                }
                // ToDo: switch crypto on
                const fullUserId = "@" + this.config.botName + ":" + this.config.serverIp;
                this.log.debug("baseUrl: " + baseURL + " userId: " + fullUserId + " deviceId: " + deviceID + " accessToken: " + accessToken);
                matrixClient = matrix.createClient(
                    {
                        baseUrl: baseURL,
                        accessToken: accessToken,
                        //sessionStore: new matrix.WebStorageSessionStore(localStorage),
                        cryptoStore: new LocalStorageCryptoStore(localStorage),
                        userId: fullUserId,
                        deviceId: deviceID
                    });
                matrixClient.setDeviceDetails(deviceID, {display_name: "ioBrokerBot"});
                matrixClient.on("event", (event)=>this.onMatrixEvent(event,null,null));
                matrixClient.on("Event.decrypted", ()=>this.handleEventDecrypted);
                this.log.debug("try to start crypto!");
                await matrixClient.initCrypto();
                this.log.debug("crypto started!");
                await matrixClient.startClient();
                this.log.debug("client started!");
                matrixClient.restoreKeyBackupWithRecoveryKey(
                    "",
                    "",
                    "",
                    121,
                    2
                    );
                // init the receive callback
                // @ts-ignore
                matrixClient.once("sync",(state, prevState, res) => {
                    this.log.debug("state: " + JSON.stringify(state));
                    this.log.debug("prevState: " + JSON.stringify(prevState));
                    this.log.debug("res: " + JSON.stringify(res));
                    matrixClient.uploadKeys();
                    try {
                        matrixClient.on("Room.timeline", (event, room, toStartOfTimeline) => this.onMatrixEvent(event, room, toStartOfTimeline));
                    } catch (error) {
                        this.log.error(error);
                    }
                });
            }
            catch (err)
            {
                this.log.error(err);
            }
        }
        if (err)
        {
            this.log.error("Login has failed. Mostly credentials are wrong.");
            this.log.error(err);
        }
    }
    handleEventDecrypted (event)
    {
        try {
            if (event !== "null" && event !== "undefined" && event.isDecryptionFailure())
            {
                this.log.error("Decryption failure");
                //sendErrorMessage(event.getRoomId());
                return;
            }

            if (event.getType() === "m.room.message")
                this.onMatrixEvent(event,null,null);
        } catch (err) {
            this.log.error("Decryption error: " + err);
            //sendErrorMessage(event.getRoomId());
        }
    }

    /**
     * is called on every room event where the bot is in
     * @param {*} event
     * @param {*} room not used yet
     * @param {*} toStartOfTimeline not used yet
     */
    async onMatrixEvent(event, room, toStartOfTimeline)
    {
        let messageUsed = false;
        let reason = "";
        if (event.isEncrypted())
        {
            this.log.debug("encrypted event: " +JSON.stringify(event));
            reason = "encrypted!";
        }
        //this.log.debug("event: " + JSON.stringify(event));
        //this.log.debug("toStartOfTimeline: " + toStartOfTimeline);
        else if (event.event.type === "m.room.message")
        {
            if (event.event.sender !== fullUserId)
            {
                if (event.event.content.msgtype === "m.text")
                {
                    if (event.event.room_id === roomId)
                    {
                        this.setStateAsync("receiveMessage", {val: event.event.content.body, ack: true});
                        messageUsed = true;
                    }
                    else
                    {
                        reason = "roomid don't fit: " + event.event.content.room_id + " is not the expected " + roomId;
                    }
                }
                else
                {
                    reason = "message type is not m.text";
                }
            }
            else
            {
                reason = "It was my own message.";
            }
        }
        else
        {
            reason = "type not m.room.message";
        }
        if (messageUsed === false)
        {
            this.log.debug("Message ignored due to: " + reason);
        }
        else
        {
            this.log.debug("Message used.");
        }
    }
    /**
     * @param {string} message
     */
    async sendMessageToMatrix(message) {
        const roomId = await this.getStateAsync("matrixServerData.roomId");
        if (roomId)
        {
            try
            {
                const data = {"body": message, "msgtype": "m.text" };
                matrixClient.sendEvent(roomId.val, "m.room.message", data);
            }
            catch (err)
            {
                this.log.error(err);
                this.log.error("error during: send message to room with access token!");
            }
        }
    }
    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        this.unloaded = false;
        // Reset the connection indicator during startup
        this.setState("info.connection", false, true);

        // message will send after a change of the object sendMessage
        this.subscribeStates("sendMessage");
        if (this.config.serverIp === "")
        {
            this.log.error("No server set!");
        }
        else
        {
            try {
                let baseURL = "";
                if (this.config.serverPort === "443")
                {
                    baseURL = "https://" + this.config.serverIp;
                }
                else
                {
                    baseURL = "https://" + this.config.serverIp + ":" + this.config.serverPort;
                }
                matrixClient = matrix.createClient({baseUrl: baseURL});
                matrixClient.getRoomIdForAlias(this.config.roomName, (err, data) => this.matrixRoomIdResponse(err, data));
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
     * Is called if a object is changed
     * @param {*} obj
     */
    onMessage(obj) {
        if (typeof obj === "object" && obj.message)
        {
            if (obj.command === "send")
            {
                this.log.info("send command is triggered!" + obj.message);
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
