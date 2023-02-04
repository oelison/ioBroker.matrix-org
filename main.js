"use strict";

/*
 * Created with @iobroker/create-adapter v2.1.1
 */

const axios = require("axios").default;
const fs = require("fs");
const helper = require("./lib/helper");

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");
const matrix = require("matrix-js-sdk");
const { json } = require("stream/consumers");

// the client for matrix communication
let matrixClient;
// local variable for fast access to static data
let fullUserId = "";
let roomId = "";
class MatrixOrg extends utils.Adapter
{

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
     * @param {*} data
     */
    async matrixRoomIdResponse(data)
    {
        if (data)
        {
            await this.setStateAsync("matrixServerData.roomId", {val: data.room_id, ack: true});
            roomId = data.room_id;
            matrixClient.login("m.login.password",{"user": this.config.botName, "password": this.config.botPassword},
                (err, data)=>this.matrixLoginResponse(err, data)
            );
        }
    }
    /**
     * is called as part of the login chain to big for inline
     * @param {*} err
     */
    async matrixRoomIdResponseErr(err)
    {
        if (err)
        {
            this.log.error("Server or room not found. Check port (443/8448), room name and server.");
            this.log.error(JSON.stringify(err));
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
                    try
                    {
                        matrixClient.on("Room.timeline", (event, room, toStartOfTimeline) => this.onMatrixEvent(event, room, toStartOfTimeline));
                    }
                    catch (err)
                    {
                        this.log.error(err);
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
     * @param {*} _room not used yet
     * @param {*} _toStartOfTimeline not used yet
     */
    async onMatrixEvent(event, _room, _toStartOfTimeline)
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
    async sendMessageToMatrix(message)
    {
        try {
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
        } catch (error) {
            this.log.error(error);
            this.log.error("error during: matrixServerData.roomId");
        }
    }
    /***
     * @param {object} message
     */
    async sendHtmlToMatrix(message)
    {
        const roomId = await this.getStateAsync("matrixServerData.roomId");
        if (roomId)
        {
            const state = "send message with html content to room with access token!";
            try {
                const data = {"body": message.text, msgtype: "m.text", format: "org.matrix.custom.html", formatted_body: message.html};
                matrixClient.sendEvent(roomId.val, "m.room.message", data);
            } catch (err) {
                this.log.error(err);
                this.log.error("error during: " + state);
            }
        }
    }
    /**
     * send the file as an image to matrix
     * @param {*} buffer contain the binary data from the image
     * @param {string} fileType mime type of the image
     */
    async sendFileToMatrix(buffer, fileType)
    {
        try
        {
            const uploadResponse = await matrixClient.uploadContent(buffer, { rawResponse: false, type: fileType });
            const matrixUrl = uploadResponse.content_uri;
            let msgtype = matrix.MsgType.File;
            let info = {};
            if (fileType.startsWith("image"))
            {
                msgtype = matrix.MsgType.Image;
            }
            else if (fileType.startsWith("video"))
            {
                msgtype = matrix.MsgType.Video;
                info = {
                    mimetype: fileType
                };
            }
            const content = {
                msgtype: msgtype,
                url: matrixUrl,
                info: info,
                body: "",
            };
            await matrixClient.sendMessage(roomId, null, content, undefined);
        }
        catch (err)
        {
            this.log.error(err);
            this.log.error("Sending of file failed");
        }
    }
    /**
     * send file from url or base64 encoded data to matrix as image
     * @param {object} fileObject
     */
    async sendFile(fileObject)
    {
        this.log.debug(JSON.stringify(fileObject));
        const file = String(fileObject.file);
        const b64dataString = helper.getBufferAndNameFromBase64String(file);
        const b64dataObject = helper.getBufferAndNameFromBase64Object(fileObject.file);
        let fileType;
        let buffer;
        if(b64dataString)
        {
            this.log.debug("String detected");
            buffer = b64dataString.buffer;
            fileType = b64dataString.mimeType;
        }
        else if (b64dataObject)
        {
            this.log.debug("Object detected");
            buffer = b64dataObject.buffer;
            fileType = b64dataObject.mimeType;
        }
        else if ( file.startsWith("https://") || file.startsWith("http://"))
        {
            try
            {
                const imageResponse = await axios.get(file, { responseType: "arraybuffer" });
                fileType = imageResponse.headers["content-type"];
                this.log.debug("http mimetype: " + fileType);
                buffer = imageResponse.data;
            }
            catch (err)
            {
                this.log.error(err);
                this.log.error("read from file failed.");
            }
        }
        else if ( file.startsWith("file://"))
        {
            if (fileObject.type)
            {
                fileType = fileObject.type;
                this.log.debug("file filetype: " + fileType);
            }
            try
            {
                let fileName = file.slice(7);
                if (helper.isWindows())
                {
                    if (file.startsWith("file:///"))
                    {
                        fileName = file.slice(8);
                    }
                }
                buffer = fs.readFileSync(fileName);
            }
            catch (err)
            {
                this.log.error(err);
            }
        }
        else
        {
            this.log.error("no matching data found!");
        }
        try {
            if (fileType === undefined)
            {
                fileType = helper.getFileTypeFromData(buffer);
                this.log.debug("guessed file type: " + fileType);
            }
            else
            {
                this.log.debug("file type: " + fileType);
            }
        } catch (error) {
            this.log.error(error);
            this.log.error("getFileType call failed");
        }
        try
        {
            this.sendFileToMatrix(buffer, String(fileType));
        }
        catch (err)
        {
            this.log.error(err);
            this.log.error("Send file failed!");
        }
    }
    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady()
    {
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
                matrixClient = matrix.createClient({baseUrl: baseURL});
                matrixClient.getRoomIdForAlias(this.config.roomName)
                    .then((data) => this.matrixRoomIdResponse(data))
                    .catch((err) => this.matrixRoomIdResponseErr(err));
            }
            catch (err)
            {
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
    onUnload(callback)
    {
        this.unloaded = true;
        try
        {
            callback();
        }
        catch (e)
        {
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
                this.log.debug("try send");
                if (state.ack === false) // This is ioBroker convention, only send commands if ack = false
                {
                    if(state.val === "image")
                    {
                        this.sendFile({file:{type:"image/png",base64:"iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAACmSURBVFhH7ZdhCoAgDEZnd9D737T8xJkNNY1Ef+yB2LTcC1qWOT20kCBgjIkh0WwfmeuIxyGYnRzIPElgFSqgAvsKOOdCzeZ1y7EcZzDG16HvwtckihLdA4xxk3HeGGttc17Cc+lN6Ds/dlO6w6/ItQHn7H4GcDK3Em/zNboE5KKjcQstQxVQARVYLlDdC2YzvBfMQgVUYB8BlMWfn2E1ZJ7Fv+dEF0UZoNhXp9NnAAAAAElFTkSuQmCC"}});
                    }
                    else
                    {
                        this.sendMessageToMatrix(state.val.toString());
                    }
                }
            }
        }
        else
        {
            // The state was deleted
            this.log.info(`state ${id} deleted`);
        }
    }
    /**
     * Is called if a object is changed
     * @param {*} obj
     */
    onMessage(obj)
    {
        if (typeof obj === "object")
        {
            this.log.debug(JSON.stringify(obj));
            // {"command":"send","message":{"file":"https://sciphy.de/toDownload/test.png"},"from":"system.adapter.javascript.0","_id":12345678}
            // {"command":"send","message":"Hello!","from":"system.adapter.javascript.0","_id":12345678}
            // {"command":"send","message":{"file":{"type":"image/png","base64":"iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAACmSURBVFhH7ZdhCoAgDEZnd9D737T8xJkNNY1Ef+yB2LTcC1qWOT20kCBgjIkh0WwfmeuIxyGYnRzIPElgFSqgAvsKOOdCzeZ1y7EcZzDG16HvwtckihLdA4xxk3HeGGttc17Cc+lN6Ds/dlO6w6/ItQHn7H4GcDK3Em/zNboE5KKjcQstQxVQARVYLlDdC2YzvBfMQgVUYB8BlMWfn2E1ZJ7Fv+dEF0UZoNhXp9NnAAAAAElFTkSuQmCC"}},"from":"system.adapter.javascript.0","_id":12345678}
            if (obj.message)
            {
                if (obj.command === "send")
                {
                    this.log.debug("send command arrived");
                    if(obj.message.file)
                    {
                        this.log.debug("file command is triggered!");
                        this.sendFile(obj.message);
                    }
                    else if (obj.message.html)
                    {
                        this.log.debug("html message");
                        this.sendHtmlToMatrix(obj.message);
                    }
                    else
                    {
                        this.log.debug("send command is triggered!" + obj.message);
                        if (obj.message)
                        {
                            this.log.debug("message send");
                            this.sendMessageToMatrix(obj.message);
                        }
                        if (obj.callback)
                        {
                            this.log.debug("callback added");
                            this.sendTo(obj.from, obj.command, "Message computed", obj.callback);
                        }
                    }
                }
            }
        }
    }
}

if (require.main !== module)
{
    // Export the constructor in compact mode
    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    module.exports = (options) => new MatrixOrg(options);
}
else
{
    // otherwise start the instance directly
    new MatrixOrg();
}

// testcode for JS scripts in ioBroker
// sendTo("matrix-org.0", "image test filesystem windows!");
// sendTo("matrix-org.0",{file: "file:///C:/tmp/images/test.png"});
// sendTo("matrix-org.0", "image test json!");
// sendTo("matrix-org.0",{file:{type:"image/png",base64:"iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAACmSURBVFhH7ZdhCoAgDEZnd9D737T8xJkNNY1Ef+yB2LTcC1qWOT20kCBgjIkh0WwfmeuIxyGYnRzIPElgFSqgAvsKOOdCzeZ1y7EcZzDG16HvwtckihLdA4xxk3HeGGttc17Cc+lN6Ds/dlO6w6/ItQHn7H4GcDK3Em/zNboE5KKjcQstQxVQARVYLlDdC2YzvBfMQgVUYB8BlMWfn2E1ZJ7Fv+dEF0UZoNhXp9NnAAAAAElFTkSuQmCC"}});
// sendTo("matrix-org.0", "image test data!");
// sendTo("matrix-org.0",{file:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAACmSURBVFhH7ZdhCoAgDEZnd9D737T8xJkNNY1Ef+yB2LTcC1qWOT20kCBgjIkh0WwfmeuIxyGYnRzIPElgFSqgAvsKOOdCzeZ1y7EcZzDG16HvwtckihLdA4xxk3HeGGttc17Cc+lN6Ds/dlO6w6/ItQHn7H4GcDK3Em/zNboE5KKjcQstQxVQARVYLlDdC2YzvBfMQgVUYB8BlMWfn2E1ZJ7Fv+dEF0UZoNhXp9NnAAAAAElFTkSuQmCC"});
// sendTo("matrix-org.0", "Html!");
// sendTo("matrix-org.0",{html: "<h1>Hello World!</h1>", text: "Hello World!"});
// sendTo("matrix-org.0", "html table");
// sendTo("matrix-org.0",{html: "<table><tr><td>1</td><td>2</td></tr><tr><td>a</td><td>b</td></tr><table>", text: "Your client can not show html!"});
// sendTo("matrix-org.0", "test ready.");