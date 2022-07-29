"use strict";

/*
 * Created with @iobroker/create-adapter v2.1.1
 */

const axios = require("axios").default;
const { basename } = require("node:path");
const { URL } = require("node:url");

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");
const matrix = require("matrix-js-sdk");
// Next three lines because of https://github.com/matrix-org/matrix-js-sdk/issues/2415
const matrixcs = require("matrix-js-sdk/lib/matrix");
const request = require("request");
matrixcs.request(request);
// until here may be deleted when fix of https://github.com/matrix-org/matrix-js-sdk/issues/2415

// the client for matrix communication
let matrixClient;
// local variable for fast access to static data
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
            matrixClient.login("m.login.password",{"user": this.config.botName, "password": this.config.botPassword},
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
            fullUserId = data.user_id;
            this.setState("info.connection", true, true);
            try
            {
                await matrixClient.startClient();
                this.log.debug("client started!");
                // init the receive callback
                matrixClient.once("sync",(state, prevState, res) => {
                    this.log.debug("state: " + JSON.stringify(state));
                    this.log.debug("prevState: " + JSON.stringify(prevState));
                    this.log.debug("res: " + JSON.stringify(res));
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
        if (event.event.type === "m.room.message")
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
            const state = "send message to room with access token!";
            try
            {
                const data = {"body": message, "msgtype": "m.text" };
                matrixClient.sendEvent(roomId.val, "m.room.message", data);
            }
            catch (err)
            {
                this.log.error(err);
                this.log.error("error during: " + state);
            }
        }
    }
    /**
     * Get a buffer and a file name from a possibly base64 encoded string.
     * @param {string} base64String The possibly bas64 encoded data string.
     * @returns Object of `buffer` and `name` from the base64 string or null if no base64 string.
     */
    getBufferAndNameFromBase64String (base64String)
    {
        // check for base64 encoded data
        const b64match = base64String.match(/^data:([^/]+)\/([^;]+);base64,([a-zA-Z0-9+/]+=*)$/);
        if (!b64match) {
            return null;
        }
        // base64 encoded content
        const buffer = Buffer.from(b64match[3], "base64");

        // get mime type
        const mimeType = `${b64match[1].replace(/\W/g, "_")}/${b64match[2].replace(/\W/g, "_")}`;
        return {
            buffer,
            mimeType
        };
    }
    /**
     * Get the basename of a path or URL to a file.
     * @param file Path or URL to a file.
     * @returns The basename of the file.
     */
    getBasenameFromUrl (file)
    {
        if (file.match(/^\w+:\/\//))
        {
            try {
                const url = new URL(file);
                return basename(url.pathname);
            } catch (err) {
                return "";
            }
        } else {
            return "";
        }
    }
    /**
     * send file from url or base64 encoded data to matrix as image
     * @param {string} fileObject
     */
    async sendFileToMatrix(fileObject)
    {
        const file = String(fileObject);
        const b64data = this.getBufferAndNameFromBase64String(file);
        let buffer;
        let imageType;
        if(b64data)
        {
            buffer = b64data.buffer;
            imageType = b64data.mimeType;
            try {
                if ((imageType === "") && (buffer.length > 4))
                {
                    const header = buffer[0].toString(16) +buffer[1].toString(16) +buffer[2].toString(16) + buffer[3].toString(16);
                    switch (header) {
                        case "89504e47":
                            imageType = "image/png";
                            break;
                        case "47494638":
                            imageType = "image/gif";
                            break;
                        case "ffd8ffe0":
                        case "ffd8ffe1":
                        case "ffd8ffe2":
                        case "ffd8ffe3":
                        case "ffd8ffe8":
                            imageType = "image/jpeg";
                            break;
                        default:
                            imageType = "unknown"; // Or you can use the blob.type as fallback
                            break;
                    }
                }
                const uploadResponse = await matrixClient.uploadContent(buffer, { rawResponse: false, type: imageType });
                const matrixUrl = uploadResponse.content_uri;
                await matrixClient.sendImageMessage(roomId, null, matrixUrl, {}, "");
            } catch (err) {
                this.log.error(err);
            }
        }
        else
        {
            if ( file.startsWith("https://") || file.startsWith("http://"))
            {
                try {
                    const fileName = this.getBasenameFromUrl(file);
                    const imageResponse = await axios.get(file, { responseType: "arraybuffer" });
                    const imageType = imageResponse.headers["content-type"];
                    const uploadResponse = await matrixClient.uploadContent(imageResponse.data, { rawResponse: false, type: imageType });
                    const matrixUrl = uploadResponse.content_uri;
                    await matrixClient.sendImageMessage(roomId, null, matrixUrl, {}, fileName);
                } catch (err) {
                    this.log.error(err);
                }
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
                    if(state.val === "image")
                    {
                        this.sendFileToMatrix("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAACmSURBVFhH7ZdhCoAgDEZnd9D737T8xJkNNY1Ef+yB2LTcC1qWOT20kCBgjIkh0WwfmeuIxyGYnRzIPElgFSqgAvsKOOdCzeZ1y7EcZzDG16HvwtckihLdA4xxk3HeGGttc17Cc+lN6Ds/dlO6w6/ItQHn7H4GcDK3Em/zNboE5KKjcQstQxVQARVYLlDdC2YzvBfMQgVUYB8BlMWfn2E1ZJ7Fv+dEF0UZoNhXp9NnAAAAAElFTkSuQmCC");

                    }
                    else
                    {
                        this.sendMessageToMatrix(state.val.toString());
                    }
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
        if (typeof obj === "object")
        {
            // {"command":"send","message":{"file":"https://sciphy.de/toDownload/test.png"},"from":"system.adapter.javascript.0","_id":12345678}
            // {"command":"send","message":"Hello!","from":"system.adapter.javascript.0","_id":12345678}
            // {"command":"send","message":{"file":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAACmSURBVFhH7ZdhCoAgDEZnd9D737T8xJkNNY1Ef+yB2LTcC1qWOT20kCBgjIkh0WwfmeuIxyGYnRzIPElgFSqgAvsKOOdCzeZ1y7EcZzDG16HvwtckihLdA4xxk3HeGGttc17Cc+lN6Ds/dlO6w6/ItQHn7H4GcDK3Em/zNboE5KKjcQstQxVQARVYLlDdC2YzvBfMQgVUYB8BlMWfn2E1ZJ7Fv+dEF0UZoNhXp9NnAAAAAElFTkSuQmCC"},"from":"system.adapter.javascript.0","_id":12345678}
            if (obj.message)
            {
                if (obj.command === "send")
                {
                    if(obj.message.file)
                    {
                        this.log.debug("file command is triggered!");
                        this.sendFileToMatrix(obj.message.file);
                    }
                    else
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
